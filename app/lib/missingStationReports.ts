import { randomUUID } from "node:crypto";
import {
  dbAll,
  dbGet,
  dbRun,
  ensureBigintEpochColumns,
} from "@/app/lib/db";

export interface MissingStationReportInput {
  name: string;
  brand?: string | null;
  address?: string | null;
  notes?: string | null;
  lat: number;
  lng: number;
  /** Optional place label from autocomplete */
  placeLabel?: string | null;
}

export interface MissingStationReportRow {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  address: string | null;
  notes: string | null;
  lat: number;
  lng: number;
  place_label: string | null;
  created_at: number;
}

export interface AdminMissingStationReport {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  brand: string | null;
  address: string | null;
  notes: string | null;
  lat: number;
  lng: number;
  placeLabel: string | null;
  createdAt: number;
}

let schemaReady: Promise<void> | null = null;

export function ensureMissingStationSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS missing_station_report (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        address TEXT,
        notes TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        place_label TEXT,
        created_at BIGINT NOT NULL
      )
    `);
    await ensureBigintEpochColumns("missing_station_report", ["created_at"]);
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_missing_station_report_user
      ON missing_station_report (user_id)
    `);
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_missing_station_report_created
      ON missing_station_report (created_at)
    `);
  })();
  return schemaReady;
}

const NAME_MAX = 120;
const BRAND_MAX = 80;
const ADDRESS_MAX = 200;
const NOTES_MAX = 500;
const LABEL_MAX = 200;

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

export function parseMissingStationBody(
  body: unknown
):
  | { ok: true; value: MissingStationReportInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid payload" };
  }
  const record = body as Record<string, unknown>;

  const name =
    typeof record.name === "string" ? record.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return { ok: false, error: "Station name is required" };

  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Location is required" };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: "Invalid coordinates" };
  }

  return {
    ok: true,
    value: {
      name,
      brand: trimOrNull(record.brand, BRAND_MAX),
      address: trimOrNull(record.address, ADDRESS_MAX),
      notes: trimOrNull(record.notes, NOTES_MAX),
      lat,
      lng,
      placeLabel: trimOrNull(record.placeLabel, LABEL_MAX),
    },
  };
}

/** Limit how often a user can submit (spam guard). */
const MIN_INTERVAL_MS = 30_000;

export async function createMissingStationReport(
  userId: string,
  input: MissingStationReportInput
): Promise<MissingStationReportRow> {
  await ensureMissingStationSchema();

  const latest = await dbGet<{ created_at: number }>(
    `SELECT created_at FROM missing_station_report
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (
    latest &&
    Number.isFinite(latest.created_at) &&
    Date.now() - Number(latest.created_at) < MIN_INTERVAL_MS
  ) {
    throw new Error("Please wait a moment before sending another report");
  }

  const id = randomUUID();
  const createdAt = Date.now();
  await dbRun(
    `INSERT INTO missing_station_report
      (id, user_id, name, brand, address, notes, lat, lng, place_label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.name,
      input.brand ?? null,
      input.address ?? null,
      input.notes ?? null,
      input.lat,
      input.lng,
      input.placeLabel ?? null,
      createdAt,
    ]
  );

  return {
    id,
    user_id: userId,
    name: input.name,
    brand: input.brand ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    lat: input.lat,
    lng: input.lng,
    place_label: input.placeLabel ?? null,
    created_at: createdAt,
  };
}

export async function listMissingStationReports(): Promise<
  AdminMissingStationReport[]
> {
  await ensureMissingStationSchema();
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT r.*, u.name AS user_name, u.email AS user_email
     FROM missing_station_report r
     JOIN "user" u ON u.id = r.user_id
     ORDER BY r.created_at DESC`
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name || "Member"),
    userEmail: String(row.user_email || ""),
    name: String(row.name),
    brand: row.brand == null ? null : String(row.brand),
    address: row.address == null ? null : String(row.address),
    notes: row.notes == null ? null : String(row.notes),
    lat: Number(row.lat),
    lng: Number(row.lng),
    placeLabel: row.place_label == null ? null : String(row.place_label),
    createdAt: Number(row.created_at),
  }));
}
