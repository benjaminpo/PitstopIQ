import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import type { FuelStation, FuelType } from "@/app/lib/types";
import type { PetrolPricesStation } from "@/app/lib/stationMatching";

export interface ConfirmedStationMatch {
  id: string;
  officialStationId: string;
  officialStationName: string;
  sourceStationId: string;
  sourceUrl: string | null;
  sourceStationName: string;
  sourcePostcode: string;
  sourcePrices: Partial<Record<FuelType, number>>;
  officialPrices: Partial<Record<FuelType, number>>;
  matchScore: number;
  confirmedBy: string;
  confirmedAt: number;
}

interface MatchRow {
  id: string;
  official_station_id: string;
  official_station_name: string;
  source_station_id: string;
  source_url: string | null;
  source_station_name: string;
  source_postcode: string;
  source_prices_json: string;
  official_prices_json: string;
  match_score: number;
  confirmed_by: string;
  confirmed_at: number | string;
}

let schemaReady: Promise<void> | null = null;

/** Short in-process cache — these rows change rarely vs map pans. */
const LIST_CACHE_TTL_MS = 60_000;
let listCache: { at: number; rows: ConfirmedStationMatch[] } | null = null;

export function invalidateConfirmedStationMatchesCache(): void {
  listCache = null;
}

async function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS station_price_match (
        id TEXT PRIMARY KEY NOT NULL,
        official_station_id TEXT NOT NULL,
        official_station_name TEXT NOT NULL,
        source_station_id TEXT NOT NULL,
        source_url TEXT,
        source_station_name TEXT NOT NULL,
        source_postcode TEXT NOT NULL,
        source_prices_json TEXT NOT NULL,
        official_prices_json TEXT NOT NULL,
        match_score INTEGER NOT NULL,
        confirmed_by TEXT NOT NULL,
        confirmed_at BIGINT NOT NULL,
        UNIQUE (official_station_id, source_station_id)
      )
    `);
    try {
      await dbRun(`ALTER TABLE station_price_match ADD COLUMN source_url TEXT`);
    } catch {
      // Existing databases already have the column after the first migration.
    }
    await ensureBigintEpochColumns("station_price_match", ["confirmed_at"]);
  })();
  return schemaReady;
}

function fromRow(row: MatchRow): ConfirmedStationMatch {
  return {
    id: row.id,
    officialStationId: row.official_station_id,
    officialStationName: row.official_station_name,
    sourceStationId: row.source_station_id,
    sourceUrl: row.source_url,
    sourceStationName: row.source_station_name,
    sourcePostcode: row.source_postcode,
    sourcePrices: JSON.parse(row.source_prices_json) as Partial<Record<FuelType, number>>,
    officialPrices: JSON.parse(row.official_prices_json) as Partial<Record<FuelType, number>>,
    matchScore: Number(row.match_score),
    confirmedBy: row.confirmed_by,
    confirmedAt: Number(row.confirmed_at),
  };
}

export async function listConfirmedStationMatches(): Promise<ConfirmedStationMatch[]> {
  if (listCache && Date.now() - listCache.at < LIST_CACHE_TTL_MS) {
    return listCache.rows;
  }
  await ensureSchema();
  const rows = await dbAll<MatchRow>(
    `SELECT * FROM station_price_match ORDER BY confirmed_at DESC`
  );
  const mapped = rows.map(fromRow);
  listCache = { at: Date.now(), rows: mapped };
  return mapped;
}

/**
 * Overlay the newest confirmed admin prices onto Fuel Finder stations.
 * Unspecified fuel grades retain their official values.
 */
export function applyConfirmedStationPrices(
  stations: FuelStation[],
  matches: ConfirmedStationMatch[]
): FuelStation[] {
  const latestByStation = new Map<string, ConfirmedStationMatch>();
  for (const match of matches) {
    const current = latestByStation.get(match.officialStationId);
    if (!current || match.confirmedAt > current.confirmedAt) {
      latestByStation.set(match.officialStationId, match);
    }
  }

  return stations.map((station) => {
    const match = latestByStation.get(station.id);
    if (!match || Object.keys(match.sourcePrices).length === 0) return station;
    const pricesUpdatedAt = { ...station.pricesUpdatedAt };
    for (const fuel of Object.keys(match.sourcePrices) as FuelType[]) {
      pricesUpdatedAt[fuel] = match.confirmedAt;
    }
    return {
      ...station,
      prices: { ...station.prices, ...match.sourcePrices },
      pricesUpdatedAt,
      pricesLastUpdatedAt: Math.max(
        station.pricesLastUpdatedAt ?? 0,
        match.confirmedAt
      ),
    };
  });
}

export async function confirmStationMatch(input: {
  source: PetrolPricesStation;
  station: FuelStation;
  score: number;
  confirmedBy: string;
}): Promise<ConfirmedStationMatch> {
  await ensureSchema();
  const now = Date.now();
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM station_price_match
     WHERE official_station_id = ? AND source_station_id = ?`,
    [input.station.id, input.source.sourceId]
  );
  const id = existing?.id ?? randomUUID();
  if (existing) {
    await dbRun(
      `UPDATE station_price_match
       SET official_station_name = ?, source_url = ?, source_station_name = ?, source_postcode = ?,
           source_prices_json = ?, official_prices_json = ?, match_score = ?,
           confirmed_by = ?, confirmed_at = ?
       WHERE id = ?`,
      [
        input.station.name,
        input.source.sourceUrl,
        input.source.name,
        input.source.postcode,
        JSON.stringify(input.source.prices),
        JSON.stringify(input.station.prices),
        input.score,
        input.confirmedBy,
        now,
        id,
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO station_price_match (
        id, official_station_id, official_station_name, source_station_id,
        source_url, source_station_name, source_postcode, source_prices_json,
        official_prices_json, match_score, confirmed_by, confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.station.id,
        input.station.name,
        input.source.sourceId,
        input.source.sourceUrl,
        input.source.name,
        input.source.postcode,
        JSON.stringify(input.source.prices),
        JSON.stringify(input.station.prices),
        input.score,
        input.confirmedBy,
        now,
      ]
    );
  }
  const saved = await dbGet<MatchRow>(`SELECT * FROM station_price_match WHERE id = ?`, [id]);
  if (!saved) throw new Error("Confirmed station match was not saved");
  invalidateConfirmedStationMatchesCache();
  return fromRow(saved);
}
