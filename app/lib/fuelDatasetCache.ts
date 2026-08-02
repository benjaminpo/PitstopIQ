/**
 * Server-only durable cache for the national Fuel Finder dataset.
 * Must not be imported from Client Components (pulls in pg / better-sqlite3).
 */
import { dbGet, dbRun } from "@/app/lib/db";
import type { FuelStation } from "@/app/lib/types";

const CACHE_ROW_ID = "national";

export interface PersistedFuelDataset {
  fetchedAt: number;
  stations: FuelStation[];
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS fuel_dataset_cache (
        id TEXT PRIMARY KEY NOT NULL,
        fetched_at INTEGER NOT NULL,
        stations_json TEXT NOT NULL
      )
    `);
  })();
  return schemaReady;
}

/**
 * Shared national dataset cache (Neon in production, SQLite locally).
 * Survives serverless cold starts so reloads don't re-pull Fuel Finder.
 */
export async function readFuelDatasetCache(
  maxAgeMs: number
): Promise<PersistedFuelDataset | null> {
  try {
    await ensureSchema();
    const row = await dbGet<{ fetched_at: number | string; stations_json: string }>(
      `SELECT fetched_at, stations_json FROM fuel_dataset_cache WHERE id = ?`,
      [CACHE_ROW_ID]
    );
    if (!row) return null;

    const fetchedAt = Number(row.fetched_at);
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt >= maxAgeMs) {
      return null;
    }

    const stations = JSON.parse(row.stations_json) as FuelStation[];
    if (!Array.isArray(stations) || stations.length === 0) return null;

    return { fetchedAt, stations };
  } catch (error) {
    console.warn("[fuelDatasetCache] read failed:", error);
    return null;
  }
}

export async function writeFuelDatasetCache(
  dataset: PersistedFuelDataset
): Promise<void> {
  try {
    await ensureSchema();
    await dbRun(
      `DELETE FROM fuel_dataset_cache WHERE id = ?`,
      [CACHE_ROW_ID]
    );
    await dbRun(
      `INSERT INTO fuel_dataset_cache (id, fetched_at, stations_json) VALUES (?, ?, ?)`,
      [CACHE_ROW_ID, dataset.fetchedAt, JSON.stringify(dataset.stations)]
    );
  } catch (error) {
    console.warn("[fuelDatasetCache] write failed:", error);
  }
}
