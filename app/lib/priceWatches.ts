import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import { ALL_FUEL_TYPES } from "@/app/lib/fuelConstants";
import { readFuelDatasetCache } from "@/app/lib/fuelDatasetCache";
import type { FuelStation, FuelType } from "@/app/lib/types";
import {
  DEFAULT_THRESHOLD_GBP,
  MAX_THRESHOLD_GBP,
  MAX_WATCHES_PER_USER,
  MIN_THRESHOLD_GBP,
  type CreateStationWatchInput,
  type PriceAlertEvent,
  type PriceWatch,
} from "@/app/lib/priceWatchTypes";

export type {
  CreateStationWatchInput,
  PriceAlertEvent,
  PriceWatch,
  PriceWatchKind,
} from "@/app/lib/priceWatchTypes";
export {
  DEFAULT_THRESHOLD_GBP,
  MAX_THRESHOLD_GBP,
  MAX_WATCHES_PER_USER,
  MIN_THRESHOLD_GBP,
} from "@/app/lib/priceWatchTypes";

const FUEL_TYPES = new Set<FuelType>(ALL_FUEL_TYPES);
const MIN_PRICE = 0.8;
const MAX_PRICE = 3.5;

let schemaReady: Promise<void> | null = null;

export function ensurePriceWatchSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS price_watch (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'station',
        station_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        station_brand TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        baseline_price REAL NOT NULL,
        threshold_gbp REAL NOT NULL,
        last_seen_price REAL,
        last_checked_at BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        UNIQUE (user_id, station_id, fuel_type)
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS price_alert_event (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        watch_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        station_brand TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        old_price REAL NOT NULL,
        new_price REAL NOT NULL,
        dropped_at BIGINT NOT NULL,
        read_at BIGINT
      )
    `);
    await ensureBigintEpochColumns("price_watch", [
      "last_checked_at",
      "created_at",
      "updated_at",
    ]);
    await ensureBigintEpochColumns("price_alert_event", [
      "dropped_at",
      "read_at",
    ]);
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_price_watch_user
      ON price_watch (user_id)
    `);
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_price_alert_user_read
      ON price_alert_event (user_id, read_at)
    `);
  })();
  return schemaReady;
}

function mapWatch(row: {
  id: string;
  user_id: string;
  kind: string;
  station_id: string;
  station_name: string;
  station_brand: string;
  fuel_type: string;
  baseline_price: number;
  threshold_gbp: number;
  last_seen_price: number | null;
  last_checked_at: number | string | null;
  created_at: number | string;
  updated_at: number | string;
}): PriceWatch {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind === "route" ? "route" : "station",
    stationId: row.station_id,
    stationName: row.station_name,
    stationBrand: row.station_brand,
    fuelType: row.fuel_type as FuelType,
    baselinePrice: Number(row.baseline_price),
    thresholdGbp: Number(row.threshold_gbp),
    lastSeenPrice:
      row.last_seen_price == null ? null : Number(row.last_seen_price),
    lastCheckedAt:
      row.last_checked_at == null ? null : Number(row.last_checked_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapAlert(row: {
  id: string;
  user_id: string;
  watch_id: string;
  station_id: string;
  station_name: string;
  station_brand: string;
  fuel_type: string;
  old_price: number;
  new_price: number;
  dropped_at: number | string;
  read_at: number | string | null;
}): PriceAlertEvent {
  return {
    id: row.id,
    userId: row.user_id,
    watchId: row.watch_id,
    stationId: row.station_id,
    stationName: row.station_name,
    stationBrand: row.station_brand,
    fuelType: row.fuel_type as FuelType,
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    droppedAt: Number(row.dropped_at),
    readAt: row.read_at == null ? null : Number(row.read_at),
  };
}

/** True when current price has fallen by at least the threshold vs baseline. */
export function shouldFirePriceAlert(
  baselinePrice: number,
  currentPrice: number,
  thresholdGbp: number
): boolean {
  if (
    !Number.isFinite(baselinePrice) ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(thresholdGbp)
  ) {
    return false;
  }
  return currentPrice <= baselinePrice - thresholdGbp + 1e-9;
}

export function parseCreateStationWatchBody(
  body: unknown
):
  | { ok: true; value: CreateStationWatchInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;

  const stationId =
    typeof b.stationId === "string" ? b.stationId.trim() : "";
  if (!stationId || stationId.length > 128) {
    return { ok: false, error: "stationId is required" };
  }

  const stationName =
    typeof b.stationName === "string" ? b.stationName.trim() : "";
  if (!stationName || stationName.length > 200) {
    return { ok: false, error: "stationName is required" };
  }

  const stationBrand =
    typeof b.stationBrand === "string" ? b.stationBrand.trim() : "";
  if (!stationBrand || stationBrand.length > 120) {
    return { ok: false, error: "stationBrand is required" };
  }

  if (typeof b.fuelType !== "string" || !FUEL_TYPES.has(b.fuelType as FuelType)) {
    return {
      ok: false,
      error: "fuelType must be E10, E5, B7_Diesel, B7_Premium, or HVO",
    };
  }

  const baseline = Number(b.baselinePrice);
  if (!Number.isFinite(baseline) || baseline < MIN_PRICE || baseline > MAX_PRICE) {
    return {
      ok: false,
      error: `baselinePrice must be between £${MIN_PRICE.toFixed(2)} and £${MAX_PRICE.toFixed(2)}`,
    };
  }

  let thresholdGbp = DEFAULT_THRESHOLD_GBP;
  if (b.thresholdGbp !== undefined && b.thresholdGbp !== null) {
    const t = Number(b.thresholdGbp);
    if (
      !Number.isFinite(t) ||
      t < MIN_THRESHOLD_GBP ||
      t > MAX_THRESHOLD_GBP
    ) {
      return {
        ok: false,
        error: `thresholdGbp must be between £${MIN_THRESHOLD_GBP.toFixed(2)} and £${MAX_THRESHOLD_GBP.toFixed(2)}`,
      };
    }
    thresholdGbp = Math.round(t * 1000) / 1000;
  }

  return {
    ok: true,
    value: {
      stationId,
      stationName,
      stationBrand,
      fuelType: b.fuelType as FuelType,
      baselinePrice: Math.round(baseline * 1000) / 1000,
      thresholdGbp,
    },
  };
}

export async function listPriceWatches(userId: string): Promise<PriceWatch[]> {
  await ensurePriceWatchSchema();
  const rows = await dbAll<{
    id: string;
    user_id: string;
    kind: string;
    station_id: string;
    station_name: string;
    station_brand: string;
    fuel_type: string;
    baseline_price: number;
    threshold_gbp: number;
    last_seen_price: number | null;
    last_checked_at: number | string | null;
    created_at: number | string;
    updated_at: number | string;
  }>(
    `SELECT * FROM price_watch WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(mapWatch);
}

export async function getStationWatch(
  userId: string,
  stationId: string,
  fuelType: FuelType
): Promise<PriceWatch | null> {
  await ensurePriceWatchSchema();
  const row = await dbGet<{
    id: string;
    user_id: string;
    kind: string;
    station_id: string;
    station_name: string;
    station_brand: string;
    fuel_type: string;
    baseline_price: number;
    threshold_gbp: number;
    last_seen_price: number | null;
    last_checked_at: number | string | null;
    created_at: number | string;
    updated_at: number | string;
  }>(
    `SELECT * FROM price_watch
     WHERE user_id = ? AND station_id = ? AND fuel_type = ?`,
    [userId, stationId, fuelType]
  );
  return row ? mapWatch(row) : null;
}

export async function createStationWatch(
  userId: string,
  input: CreateStationWatchInput
): Promise<PriceWatch> {
  await ensurePriceWatchSchema();

  const existing = await getStationWatch(
    userId,
    input.stationId,
    input.fuelType
  );
  if (existing) {
    const now = Date.now();
    await dbRun(
      `UPDATE price_watch
       SET station_name = ?, station_brand = ?, baseline_price = ?,
           threshold_gbp = ?, last_seen_price = ?, last_checked_at = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        input.stationName,
        input.stationBrand,
        input.baselinePrice,
        input.thresholdGbp ?? DEFAULT_THRESHOLD_GBP,
        input.baselinePrice,
        now,
        now,
        existing.id,
        userId,
      ]
    );
    const updated = await getStationWatch(
      userId,
      input.stationId,
      input.fuelType
    );
    if (!updated) throw new Error("Failed to update price watch");
    return updated;
  }

  const countRow = await dbGet<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM price_watch WHERE user_id = ?`,
    [userId]
  );
  const count = Number(countRow?.c ?? 0);
  if (count >= MAX_WATCHES_PER_USER) {
    throw new Error(
      `You can watch up to ${MAX_WATCHES_PER_USER} stations. Remove one first.`
    );
  }

  const now = Date.now();
  const id = randomUUID();
  const threshold = input.thresholdGbp ?? DEFAULT_THRESHOLD_GBP;
  await dbRun(
    `INSERT INTO price_watch (
      id, user_id, kind, station_id, station_name, station_brand, fuel_type,
      baseline_price, threshold_gbp, last_seen_price, last_checked_at,
      created_at, updated_at
    ) VALUES (?, ?, 'station', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.stationId,
      input.stationName,
      input.stationBrand,
      input.fuelType,
      input.baselinePrice,
      threshold,
      input.baselinePrice,
      now,
      now,
      now,
    ]
  );

  const created = await getStationWatch(
    userId,
    input.stationId,
    input.fuelType
  );
  if (!created) throw new Error("Failed to create price watch");
  return created;
}

export async function deletePriceWatch(
  userId: string,
  watchId: string
): Promise<boolean> {
  await ensurePriceWatchSchema();
  const before = await dbGet<{ id: string }>(
    `SELECT id FROM price_watch WHERE id = ? AND user_id = ?`,
    [watchId, userId]
  );
  if (!before) return false;
  await dbRun(`DELETE FROM price_alert_event WHERE watch_id = ? AND user_id = ?`, [
    watchId,
    userId,
  ]);
  await dbRun(`DELETE FROM price_watch WHERE id = ? AND user_id = ?`, [
    watchId,
    userId,
  ]);
  return true;
}

export async function listPriceAlerts(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<PriceAlertEvent[]> {
  await ensurePriceWatchSchema();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const unreadOnly = options?.unreadOnly === true;
  const rows = await dbAll<{
    id: string;
    user_id: string;
    watch_id: string;
    station_id: string;
    station_name: string;
    station_brand: string;
    fuel_type: string;
    old_price: number;
    new_price: number;
    dropped_at: number | string;
    read_at: number | string | null;
  }>(
    unreadOnly
      ? `SELECT * FROM price_alert_event
         WHERE user_id = ? AND read_at IS NULL
         ORDER BY dropped_at DESC LIMIT ?`
      : `SELECT * FROM price_alert_event
         WHERE user_id = ?
         ORDER BY dropped_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map(mapAlert);
}

export async function countUnreadPriceAlerts(userId: string): Promise<number> {
  await ensurePriceWatchSchema();
  const row = await dbGet<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM price_alert_event
     WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
  return Number(row?.c ?? 0);
}

export async function markPriceAlertsRead(
  userId: string,
  options: { ids?: string[]; all?: boolean }
): Promise<number> {
  await ensurePriceWatchSchema();
  const now = Date.now();
  if (options.all) {
    const before = await countUnreadPriceAlerts(userId);
    await dbRun(
      `UPDATE price_alert_event SET read_at = ?
       WHERE user_id = ? AND read_at IS NULL`,
      [now, userId]
    );
    return before;
  }
  const ids = (options.ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return 0;
  let marked = 0;
  for (const id of ids) {
    const row = await dbGet<{ id: string; read_at: number | string | null }>(
      `SELECT id, read_at FROM price_alert_event WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!row || row.read_at != null) continue;
    await dbRun(
      `UPDATE price_alert_event SET read_at = ? WHERE id = ? AND user_id = ?`,
      [now, id, userId]
    );
    marked += 1;
  }
  return marked;
}

/**
 * Compare watches against a station price map. Fires at most one unread event
 * per watch; resets baseline to the new price so further drops can re-alert.
 */
export async function evaluatePriceWatches(
  userId: string,
  stationsById: Map<string, FuelStation>
): Promise<{ checked: number; fired: number }> {
  await ensurePriceWatchSchema();
  const watches = await listPriceWatches(userId);
  const now = Date.now();
  let fired = 0;

  for (const watch of watches) {
    const station = stationsById.get(watch.stationId);
    const current = station?.prices?.[watch.fuelType];
    if (current == null || !Number.isFinite(current)) {
      await dbRun(
        `UPDATE price_watch SET last_checked_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, watch.id]
      );
      continue;
    }

    const price = Math.round(Number(current) * 1000) / 1000;
    const shouldFire = shouldFirePriceAlert(
      watch.baselinePrice,
      price,
      watch.thresholdGbp
    );

    if (shouldFire) {
      const unread = await dbGet<{ id: string }>(
        `SELECT id FROM price_alert_event
         WHERE watch_id = ? AND user_id = ? AND read_at IS NULL
         LIMIT 1`,
        [watch.id, userId]
      );
      if (!unread) {
        await dbRun(
          `INSERT INTO price_alert_event (
            id, user_id, watch_id, station_id, station_name, station_brand,
            fuel_type, old_price, new_price, dropped_at, read_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            randomUUID(),
            userId,
            watch.id,
            watch.stationId,
            station?.name ?? watch.stationName,
            station?.brand ?? watch.stationBrand,
            watch.fuelType,
            watch.baselinePrice,
            price,
            now,
          ]
        );
        fired += 1;
      }
      await dbRun(
        `UPDATE price_watch
         SET baseline_price = ?, last_seen_price = ?, last_checked_at = ?,
             station_name = ?, station_brand = ?, updated_at = ?
         WHERE id = ?`,
        [
          price,
          price,
          now,
          station?.name ?? watch.stationName,
          station?.brand ?? watch.stationBrand,
          now,
          watch.id,
        ]
      );
    } else {
      await dbRun(
        `UPDATE price_watch
         SET last_seen_price = ?, last_checked_at = ?,
             station_name = ?, station_brand = ?, updated_at = ?
         WHERE id = ?`,
        [
          price,
          now,
          station?.name ?? watch.stationName,
          station?.brand ?? watch.stationBrand,
          now,
          watch.id,
        ]
      );
    }
  }

  return { checked: watches.length, fired };
}

/** Load national cache (any age) and evaluate the user's watches. */
export async function evaluatePriceWatchesFromCache(
  userId: string
): Promise<{ checked: number; fired: number; pricesFetchedAt: number | null }> {
  const cached = await readFuelDatasetCache(Number.POSITIVE_INFINITY);
  if (!cached) {
    return { checked: 0, fired: 0, pricesFetchedAt: null };
  }
  const byId = new Map(cached.stations.map((s) => [s.id, s]));
  const result = await evaluatePriceWatches(userId, byId);
  return { ...result, pricesFetchedAt: cached.fetchedAt };
}
