import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun } from "@/app/lib/db";
import type { FuelType, StationCommunitySummary } from "@/app/lib/types";

const FUEL_TYPES = new Set<FuelType>(["E10", "E5", "B7_Diesel"]);
const MAX_COMMENT = 500;
/** Plausible UK £/L band (guards against typos / abuse). */
const MIN_PRICE = 0.8;
const MAX_PRICE = 3.5;

export type ContributionKind = "price" | "review";

export interface StationContributionRow {
  id: string;
  userId: string;
  userName: string;
  stationId: string;
  fuelType: FuelType;
  pricePerLitre: number | null;
  comment: string | null;
  rating: number | null;
  createdAt: number;
  updatedAt: number;
}

export type { StationCommunitySummary };

export interface UpsertContributionInput {
  stationId: string;
  kind: ContributionKind;
  /** Required for kind=price (unless clearing) */
  fuelType?: FuelType;
  pricePerLitre?: number | null;
  comment?: string | null;
  rating?: number | null;
  /** Clear only this kind's fields; leave the other side intact */
  clear?: boolean;
}

let schemaReady: Promise<void> | null = null;

export function ensureContributionSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS station_contribution (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        price_per_litre REAL,
        comment TEXT,
        rating INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (user_id, station_id)
      )
    `);
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

function parsePriceBody(
  stationId: string,
  b: Record<string, unknown>,
  clear: boolean
): { ok: true; value: UpsertContributionInput } | { ok: false; error: string } {
  if (clear) {
    return { ok: true, value: { stationId, kind: "price", clear: true } };
  }

  const fuelType = b.fuelType;
  if (typeof fuelType !== "string" || !FUEL_TYPES.has(fuelType as FuelType)) {
    return { ok: false, error: "fuelType must be E10, E5, or B7_Diesel" };
  }

  if (
    b.pricePerLitre === undefined ||
    b.pricePerLitre === null ||
    b.pricePerLitre === ""
  ) {
    return { ok: false, error: "pricePerLitre is required" };
  }
  const n = Number(b.pricePerLitre);
  if (!Number.isFinite(n) || n < MIN_PRICE || n > MAX_PRICE) {
    return {
      ok: false,
      error: `pricePerLitre must be between £${MIN_PRICE.toFixed(2)} and £${MAX_PRICE.toFixed(2)}`,
    };
  }

  return {
    ok: true,
    value: {
      stationId,
      kind: "price",
      fuelType: fuelType as FuelType,
      pricePerLitre: Math.round(n * 1000) / 1000,
    },
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

function mapRow(row: Record<string, unknown>): StationContributionRow {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    userName: asString(row.user_name, "Member") || "Member",
    stationId: asString(row.station_id),
    fuelType: row.fuel_type as FuelType,
    pricePerLitre:
      row.price_per_litre == null ? null : Number(row.price_per_litre),
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
  comment: string | null;
  rating: number | null;
  created_at: number;
};

function applyUpsertFields(
  existing: ExistingRow | undefined,
  input: UpsertContributionInput
): {
  fuelType: FuelType;
  pricePerLitre: number | null;
  comment: string | null;
  rating: number | null;
} {
  let fuelType: FuelType = (existing?.fuel_type as FuelType) || "E10";
  let pricePerLitre: number | null =
    existing?.price_per_litre == null ? null : Number(existing.price_per_litre);
  let comment: string | null =
    existing?.comment == null ? null : String(existing.comment);
  let rating: number | null =
    existing?.rating == null ? null : Number(existing.rating);

  if (input.kind === "price") {
    if (input.clear) {
      pricePerLitre = null;
    } else {
      fuelType = input.fuelType ?? fuelType;
      pricePerLitre = input.pricePerLitre ?? null;
    }
  } else if (input.clear) {
    comment = null;
    rating = null;
  } else {
    rating = input.rating ?? null;
    comment = input.comment ?? null;
  }

  return { fuelType, pricePerLitre, comment, rating };
}

export async function upsertContribution(
  userId: string,
  input: UpsertContributionInput
): Promise<StationContributionRow | null> {
  await ensureContributionSchema();
  const now = Date.now();
  const existing = await dbGet<ExistingRow>(
    `SELECT id, fuel_type, price_per_litre, comment, rating, created_at
     FROM station_contribution
     WHERE user_id = ? AND station_id = ?`,
    [userId, input.stationId]
  );

  const { fuelType, pricePerLitre, comment, rating } = applyUpsertFields(
    existing,
    input
  );

  // Nothing left — remove the row entirely
  if (pricePerLitre == null && comment == null && rating == null) {
    if (existing) {
      await dbRun(`DELETE FROM station_contribution WHERE id = ?`, [
        existing.id,
      ]);
    }
    return null;
  }

  if (existing) {
    await dbRun(
      `UPDATE station_contribution
       SET fuel_type = ?, price_per_litre = ?, comment = ?, rating = ?, updated_at = ?
       WHERE id = ?`,
      [fuelType, pricePerLitre, comment, rating, now, existing.id]
    );
  } else {
    await dbRun(
      `INSERT INTO station_contribution
         (id, user_id, station_id, fuel_type, price_per_litre, comment, rating, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        input.stationId,
        fuelType,
        pricePerLitre,
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
      summary.recentComments.push({
        userName: row.userName,
        comment: row.comment,
        rating: row.rating,
        fuelType: row.fuelType,
        pricePerLitre: row.pricePerLitre,
        updatedAt: row.updatedAt,
      });
    }
  }

  if (row.pricePerLitre != null) {
    const prevAt = summary.communityPriceUpdatedAt[row.fuelType];
    if (prevAt == null || row.updatedAt > prevAt) {
      summary.communityPrices[row.fuelType] = row.pricePerLitre;
      summary.communityPriceUpdatedAt[row.fuelType] = row.updatedAt;
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
