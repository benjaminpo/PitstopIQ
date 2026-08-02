import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import { ALL_FUEL_TYPES } from "@/app/lib/fuelConstants";
import type { FuelType, StationCommunitySummary } from "@/app/lib/types";

const FUEL_TYPES = new Set<FuelType>(ALL_FUEL_TYPES);
const MAX_COMMENT = 500;
/** Plausible UK £/L band (guards against typos / abuse). */
const MIN_PRICE = 0.8;
const MAX_PRICE = 3.5;

export type ContributionKind = "price" | "review";

export type FuelPriceMap = Partial<Record<FuelType, number>>;

export interface StationContributionRow {
  id: string;
  userId: string;
  userName: string;
  stationId: string;
  /** Member-reported £/L by fuel grade */
  prices: FuelPriceMap;
  comment: string | null;
  rating: number | null;
  createdAt: number;
  updatedAt: number;
}

export type { StationCommunitySummary };

export interface UpsertContributionInput {
  stationId: string;
  kind: ContributionKind;
  /**
   * Prices to merge (kind=price). Clearing uses `clearFuelType` or
   * clears every grade when `clear` is true and no fuel type is set.
   */
  prices?: FuelPriceMap;
  /** When clearing a single grade */
  clearFuelType?: FuelType;
  comment?: string | null;
  rating?: number | null;
  /** Clear only this kind's fields; leave the other side intact */
  clear?: boolean;
}

let schemaReady: Promise<void> | null = null;

function parsePricesJson(raw: unknown): FuelPriceMap {
  if (raw == null || raw === "") return {};
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const out: FuelPriceMap = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!FUEL_TYPES.has(key as FuelType)) continue;
    const n = Number(value);
    if (Number.isFinite(n)) out[key as FuelType] = n;
  }
  return out;
}

function serializePrices(prices: FuelPriceMap): string | null {
  const keys = ALL_FUEL_TYPES.filter((t) => prices[t] != null);
  if (keys.length === 0) return null;
  const out: Record<string, number> = {};
  for (const t of keys) {
    out[t] = prices[t] as number;
  }
  return JSON.stringify(out);
}

/** Legacy columns kept in sync for older rows / NOT NULL fuel_type. */
function legacyPriceColumns(prices: FuelPriceMap): {
  fuelType: FuelType;
  pricePerLitre: number | null;
} {
  for (const t of ALL_FUEL_TYPES) {
    if (prices[t] != null) {
      return { fuelType: t, pricePerLitre: prices[t] as number };
    }
  }
  return { fuelType: "E10", pricePerLitre: null };
}

function hasAnyPrice(prices: FuelPriceMap): boolean {
  return ALL_FUEL_TYPES.some((t) => prices[t] != null);
}

async function ensurePricesJsonColumn(): Promise<void> {
  try {
    await dbRun(
      `ALTER TABLE station_contribution ADD COLUMN prices_json TEXT`
    );
  } catch {
    // Column already exists (SQLite / Postgres without IF NOT EXISTS).
  }
}

async function migrateLegacyPrices(): Promise<void> {
  const rows = await dbAll<{
    id: string;
    fuel_type: string;
    price_per_litre: number | null;
    prices_json: string | null;
  }>(
    `SELECT id, fuel_type, price_per_litre, prices_json
     FROM station_contribution
     WHERE prices_json IS NULL AND price_per_litre IS NOT NULL`
  );
  for (const row of rows) {
    const fuel = row.fuel_type as FuelType;
    if (!FUEL_TYPES.has(fuel)) continue;
    const prices: FuelPriceMap = { [fuel]: Number(row.price_per_litre) };
    await dbRun(`UPDATE station_contribution SET prices_json = ? WHERE id = ?`, [
      serializePrices(prices),
      row.id,
    ]);
  }
}

export function ensureContributionSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS station_contribution (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        price_per_litre REAL,
        prices_json TEXT,
        comment TEXT,
        rating INTEGER,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        UNIQUE (user_id, station_id)
      )
    `);
    // Existing Neon tables were created with INTEGER; widen for Date.now() ms.
    await ensureBigintEpochColumns("station_contribution", [
      "created_at",
      "updated_at",
    ]);
    await ensurePricesJsonColumn();
    await migrateLegacyPrices();
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_station_contribution_station
      ON station_contribution (station_id)
    `);
  })();
  return schemaReady;
}

function parseStationId(
  body: Record<string, unknown>
): { ok: true; stationId: string } | { ok: false; error: string } {
  const stationId =
    typeof body.stationId === "string" ? body.stationId.trim() : "";
  if (!stationId || stationId.length > 128) {
    return { ok: false, error: "stationId is required" };
  }
  return { ok: true, stationId };
}

function parseOnePrice(
  value: unknown
): { ok: true; n: number } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: false, error: "pricePerLitre is required" };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_PRICE || n > MAX_PRICE) {
    return {
      ok: false,
      error: `pricePerLitre must be between £${MIN_PRICE.toFixed(2)} and £${MAX_PRICE.toFixed(2)}`,
    };
  }
  return { ok: true, n: Math.round(n * 1000) / 1000 };
}

function parseFuelType(
  value: unknown
): { ok: true; fuelType: FuelType } | { ok: false; error: string } {
  if (typeof value !== "string" || !FUEL_TYPES.has(value as FuelType)) {
    return { ok: false, error: "fuelType must be E10, E5, or B7_Diesel" };
  }
  return { ok: true, fuelType: value as FuelType };
}

function parsePriceMapFromBody(
  b: Record<string, unknown>
): { ok: true; prices: FuelPriceMap } | { ok: false; error: string } {
  if (b.prices != null && typeof b.prices === "object" && !Array.isArray(b.prices)) {
    const raw = b.prices as Record<string, unknown>;
    const prices: FuelPriceMap = {};
    let sawKey = false;
    for (const t of ALL_FUEL_TYPES) {
      if (!(t in raw)) continue;
      sawKey = true;
      const parsed = parseOnePrice(raw[t]);
      if (!parsed.ok) {
        return { ok: false, error: `${t}: ${parsed.error}` };
      }
      prices[t] = parsed.n;
    }
    if (!sawKey) {
      return { ok: false, error: "prices must include at least one fuel grade" };
    }
    return { ok: true, prices };
  }

  const fuel = parseFuelType(b.fuelType);
  if (!fuel.ok) return fuel;
  const price = parseOnePrice(b.pricePerLitre);
  if (!price.ok) return price;
  return { ok: true, prices: { [fuel.fuelType]: price.n } };
}

function parsePriceBody(
  stationId: string,
  b: Record<string, unknown>,
  clear: boolean
): { ok: true; value: UpsertContributionInput } | { ok: false; error: string } {
  if (clear) {
    if (b.fuelType != null && b.fuelType !== "") {
      const fuel = parseFuelType(b.fuelType);
      if (!fuel.ok) return fuel;
      return {
        ok: true,
        value: {
          stationId,
          kind: "price",
          clear: true,
          clearFuelType: fuel.fuelType,
        },
      };
    }
    return { ok: true, value: { stationId, kind: "price", clear: true } };
  }

  const parsed = parsePriceMapFromBody(b);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: { stationId, kind: "price", prices: parsed.prices },
  };
}

function parseReviewBody(
  stationId: string,
  b: Record<string, unknown>,
  clear: boolean
): { ok: true; value: UpsertContributionInput } | { ok: false; error: string } {
  if (clear) {
    return { ok: true, value: { stationId, kind: "review", clear: true } };
  }

  let comment: string | null = null;
  if (typeof b.comment === "string") {
    const trimmed = b.comment.trim();
    if (trimmed.length > MAX_COMMENT) {
      return { ok: false, error: `comment must be ≤ ${MAX_COMMENT} characters` };
    }
    comment = trimmed.length > 0 ? trimmed : null;
  }

  let rating: number | null = null;
  if (b.rating !== undefined && b.rating !== null && b.rating !== "") {
    const n = Number(b.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return { ok: false, error: "rating must be an integer from 1 to 5" };
    }
    rating = n;
  }

  if (rating == null && comment == null) {
    return { ok: false, error: "Provide a rating and/or comment" };
  }

  return {
    ok: true,
    value: { stationId, kind: "review", rating, comment },
  };
}

export function parseUpsertBody(
  body: unknown
): { ok: true; value: UpsertContributionInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const b = body as Record<string, unknown>;
  const station = parseStationId(b);
  if (!station.ok) return station;

  const kind = b.kind;
  if (kind !== "price" && kind !== "review") {
    return { ok: false, error: 'kind must be "price" or "review"' };
  }

  const clear = b.clear === true;
  if (kind === "price") {
    return parsePriceBody(station.stationId, b, clear);
  }
  return parseReviewBody(station.stationId, b, clear);
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function pricesFromRow(row: Record<string, unknown>): FuelPriceMap {
  const fromJson = parsePricesJson(row.prices_json);
  if (hasAnyPrice(fromJson)) return fromJson;
  const fuel = row.fuel_type as FuelType;
  if (
    FUEL_TYPES.has(fuel) &&
    row.price_per_litre != null &&
    Number.isFinite(Number(row.price_per_litre))
  ) {
    return { [fuel]: Number(row.price_per_litre) };
  }
  return {};
}

function mapRow(row: Record<string, unknown>): StationContributionRow {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    userName: asString(row.user_name, "Member") || "Member",
    stationId: asString(row.station_id),
    prices: pricesFromRow(row),
    comment: row.comment == null ? null : asString(row.comment),
    rating: row.rating == null ? null : Number(row.rating),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getMyContribution(
  userId: string,
  stationId: string
): Promise<StationContributionRow | null> {
  await ensureContributionSchema();
  const row = await dbGet<Record<string, unknown>>(
    `SELECT c.*, u.name AS user_name
     FROM station_contribution c
     JOIN "user" u ON u.id = c.user_id
     WHERE c.user_id = ? AND c.station_id = ?`,
    [userId, stationId]
  );
  return row ? mapRow(row) : null;
}

type ExistingRow = {
  id: string;
  fuel_type: string;
  price_per_litre: number | null;
  prices_json: string | null;
  comment: string | null;
  rating: number | null;
  created_at: number;
};

function applyUpsertFields(
  existing: ExistingRow | undefined,
  input: UpsertContributionInput
): {
  prices: FuelPriceMap;
  comment: string | null;
  rating: number | null;
} {
  let prices: FuelPriceMap = existing
    ? pricesFromRow(existing as unknown as Record<string, unknown>)
    : {};
  let comment: string | null =
    existing?.comment == null ? null : String(existing.comment);
  let rating: number | null =
    existing?.rating == null ? null : Number(existing.rating);

  if (input.kind === "price") {
    if (input.clear) {
      if (input.clearFuelType) {
        const next = { ...prices };
        delete next[input.clearFuelType];
        prices = next;
      } else {
        prices = {};
      }
    } else if (input.prices) {
      prices = { ...prices, ...input.prices };
    }
  } else if (input.clear) {
    comment = null;
    rating = null;
  } else {
    rating = input.rating ?? null;
    comment = input.comment ?? null;
  }

  return { prices, comment, rating };
}

export async function upsertContribution(
  userId: string,
  input: UpsertContributionInput
): Promise<StationContributionRow | null> {
  await ensureContributionSchema();
  const now = Date.now();
  const existing = await dbGet<ExistingRow>(
    `SELECT id, fuel_type, price_per_litre, prices_json, comment, rating, created_at
     FROM station_contribution
     WHERE user_id = ? AND station_id = ?`,
    [userId, input.stationId]
  );

  const { prices, comment, rating } = applyUpsertFields(existing, input);

  // Nothing left — remove the row entirely
  if (!hasAnyPrice(prices) && comment == null && rating == null) {
    if (existing) {
      await dbRun(`DELETE FROM station_contribution WHERE id = ?`, [
        existing.id,
      ]);
    }
    return null;
  }

  const legacy = legacyPriceColumns(prices);
  const pricesJson = serializePrices(prices);

  if (existing) {
    await dbRun(
      `UPDATE station_contribution
       SET fuel_type = ?, price_per_litre = ?, prices_json = ?, comment = ?, rating = ?, updated_at = ?
       WHERE id = ?`,
      [
        legacy.fuelType,
        legacy.pricePerLitre,
        pricesJson,
        comment,
        rating,
        now,
        existing.id,
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO station_contribution
         (id, user_id, station_id, fuel_type, price_per_litre, prices_json, comment, rating, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        input.stationId,
        legacy.fuelType,
        legacy.pricePerLitre,
        pricesJson,
        comment,
        rating,
        now,
        now,
      ]
    );
  }

  return getMyContribution(userId, input.stationId);
}

export async function deleteContribution(
  userId: string,
  stationId: string
): Promise<boolean> {
  await ensureContributionSchema();
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM station_contribution WHERE user_id = ? AND station_id = ?`,
    [userId, stationId]
  );
  if (!existing) return false;
  await dbRun(`DELETE FROM station_contribution WHERE id = ?`, [existing.id]);
  return true;
}

function emptySummary(stationId: string): StationCommunitySummary {
  return {
    stationId,
    avgRating: null,
    ratingCount: 0,
    commentCount: 0,
    communityPrices: {},
    communityPriceUpdatedAt: {},
    recentComments: [],
  };
}

function foldContributionIntoSummary(
  summary: StationCommunitySummary,
  row: StationContributionRow
): void {
  if (row.rating != null) {
    const prevTotal = (summary.avgRating ?? 0) * summary.ratingCount;
    summary.ratingCount += 1;
    summary.avgRating = prevTotal + row.rating;
  }

  if (row.comment) {
    summary.commentCount += 1;
    if (summary.recentComments.length < 5) {
      const primary = legacyPriceColumns(row.prices);
      summary.recentComments.push({
        userName: row.userName,
        comment: row.comment,
        rating: row.rating,
        fuelType: primary.fuelType,
        pricePerLitre: primary.pricePerLitre,
        updatedAt: row.updatedAt,
      });
    }
  }

  for (const fuelType of ALL_FUEL_TYPES) {
    const price = row.prices[fuelType];
    if (price == null) continue;
    const prevAt = summary.communityPriceUpdatedAt[fuelType];
    if (prevAt == null || row.updatedAt > prevAt) {
      summary.communityPrices[fuelType] = price;
      summary.communityPriceUpdatedAt[fuelType] = row.updatedAt;
    }
  }
}

function finalizeAverages(
  summaries: Record<string, StationCommunitySummary>
): void {
  for (const summary of Object.values(summaries)) {
    if (summary.ratingCount > 0 && summary.avgRating != null) {
      summary.avgRating =
        Math.round((summary.avgRating / summary.ratingCount) * 10) / 10;
    } else {
      summary.avgRating = null;
    }
  }
}

export async function getCommunitySummaries(
  stationIds: string[]
): Promise<Record<string, StationCommunitySummary>> {
  await ensureContributionSchema();
  const unique = [...new Set(stationIds.filter(Boolean))].slice(0, 100);
  const out: Record<string, StationCommunitySummary> = {};
  for (const id of unique) out[id] = emptySummary(id);
  if (unique.length === 0) return out;

  const placeholders = unique.map(() => "?").join(", ");
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT c.*, u.name AS user_name
     FROM station_contribution c
     JOIN "user" u ON u.id = c.user_id
     WHERE c.station_id IN (${placeholders})
     ORDER BY c.updated_at DESC`,
    unique
  );

  for (const raw of rows) {
    const row = mapRow(raw);
    const summary = out[row.stationId] ?? emptySummary(row.stationId);
    out[row.stationId] = summary;
    foldContributionIntoSummary(summary, row);
  }

  finalizeAverages(out);
  return out;
}
