import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import type { FuelStation } from "@/app/lib/types";

export interface StationAdminOverride {
  stationId: string;
  brand: string | null;
  closed: boolean;
  note: string | null;
  updatedBy: string;
  updatedAt: number;
}

interface OverrideRow {
  station_id: string;
  brand: string | null;
  closed: number | boolean;
  note: string | null;
  updated_by: string;
  updated_at: number | string;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS station_admin_override (
        station_id TEXT PRIMARY KEY NOT NULL,
        brand TEXT,
        closed INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        updated_by TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
    await ensureBigintEpochColumns("station_admin_override", ["updated_at"]);
  })();
  return schemaReady;
}

function fromRow(row: OverrideRow): StationAdminOverride {
  return {
    stationId: row.station_id,
    brand: row.brand?.trim() || null,
    closed: Boolean(row.closed),
    note: row.note?.trim() || null,
    updatedBy: row.updated_by,
    updatedAt: Number(row.updated_at),
  };
}

export async function listStationAdminOverrides(): Promise<StationAdminOverride[]> {
  await ensureSchema();
  const rows = await dbAll<OverrideRow>(
    `SELECT * FROM station_admin_override ORDER BY updated_at DESC`
  );
  return rows.map(fromRow);
}

/**
 * Apply admin brand overrides and optionally hide stations marked closed.
 * Closed stations stay in the list when hideClosed is false (admin review).
 */
export function applyStationAdminOverrides(
  stations: FuelStation[],
  overrides: StationAdminOverride[],
  options: { hideClosed?: boolean } = {}
): FuelStation[] {
  const { hideClosed = true } = options;
  const byId = new Map(overrides.map((override) => [override.stationId, override]));

  return stations.flatMap((station) => {
    const override = byId.get(station.id);
    if (hideClosed && override?.closed) return [];
    if (!override?.brand) return [station];
    return [{ ...station, brand: override.brand }];
  });
}

export async function upsertStationAdminOverride(input: {
  stationId: string;
  brand: string | null;
  closed: boolean;
  note?: string | null;
  updatedBy: string;
}): Promise<StationAdminOverride> {
  await ensureSchema();
  const brand = input.brand?.trim() || null;
  const note = input.note?.trim() || null;
  const now = Date.now();

  // Drop the row when there is nothing left to override.
  if (!brand && !input.closed && !note) {
    await dbRun(`DELETE FROM station_admin_override WHERE station_id = ?`, [
      input.stationId,
    ]);
    return {
      stationId: input.stationId,
      brand: null,
      closed: false,
      note: null,
      updatedBy: input.updatedBy,
      updatedAt: now,
    };
  }

  const existing = await dbGet<{ station_id: string }>(
    `SELECT station_id FROM station_admin_override WHERE station_id = ?`,
    [input.stationId]
  );

  if (existing) {
    await dbRun(
      `UPDATE station_admin_override
       SET brand = ?, closed = ?, note = ?, updated_by = ?, updated_at = ?
       WHERE station_id = ?`,
      [brand, input.closed ? 1 : 0, note, input.updatedBy, now, input.stationId]
    );
  } else {
    await dbRun(
      `INSERT INTO station_admin_override (
        station_id, brand, closed, note, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.stationId, brand, input.closed ? 1 : 0, note, input.updatedBy, now]
    );
  }

  const saved = await dbGet<OverrideRow>(
    `SELECT * FROM station_admin_override WHERE station_id = ?`,
    [input.stationId]
  );
  if (!saved) {
    return {
      stationId: input.stationId,
      brand: null,
      closed: false,
      note: null,
      updatedBy: input.updatedBy,
      updatedAt: now,
    };
  }
  return fromRow(saved);
}
