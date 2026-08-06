import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import { ALL_FUEL_TYPES } from "@/app/lib/fuelConstants";
import type { FuelType, VehiclePreset } from "@/app/lib/types";

const FUEL_TYPES = new Set<FuelType>(ALL_FUEL_TYPES);
export const MAX_VEHICLE_PRESETS = 8;
const MAX_NAME = 40;
const MIN_MPG = 1;
const MAX_MPG = 200;
const MIN_TANK = 1;
const MAX_TANK = 200;

export interface UserVehiclePresets {
  presets: VehiclePreset[];
  activePresetId: string | null;
  /** True once the account has ever been written (even with an empty list). */
  synced: boolean;
}

export type ReplaceVehiclePresetsInput = Omit<UserVehiclePresets, "synced">;

let schemaReady: Promise<void> | null = null;

export function ensureVehiclePresetSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS vehicle_preset (
        user_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        mpg REAL NOT NULL,
        tank_capacity_litres REAL NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, id)
      )
    `);
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_vehicle_preset_user
      ON vehicle_preset (user_id, sort_order)
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_vehicle_settings (
        user_id TEXT PRIMARY KEY NOT NULL,
        active_preset_id TEXT,
        updated_at BIGINT NOT NULL
      )
    `);
    await ensureBigintEpochColumns("vehicle_preset", ["created_at", "updated_at"]);
    await ensureBigintEpochColumns("user_vehicle_settings", ["updated_at"]);
  })();
  return schemaReady;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME) || "My car";
}

function parseFuelType(
  value: unknown
): { ok: true; fuelType: FuelType } | { ok: false; error: string } {
  if (typeof value !== "string" || !FUEL_TYPES.has(value as FuelType)) {
    return { ok: false, error: "fuelType must be E10, E5, B7_Diesel, or B7_Premium" };
  }
  return { ok: true, fuelType: value as FuelType };
}

function parsePreset(
  raw: unknown,
  index: number
): { ok: true; preset: VehiclePreset } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: `presets[${index}] is invalid` };
  }
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id.trim() : "";
  if (!id || id.length > 64) {
    return { ok: false, error: `presets[${index}].id is required` };
  }
  const name =
    typeof p.name === "string" ? normalizeName(p.name) : normalizeName("");
  const fuel = parseFuelType(p.fuelType);
  if (!fuel.ok) {
    return { ok: false, error: `presets[${index}].${fuel.error}` };
  }
  const mpg = Number(p.mpg);
  if (!Number.isFinite(mpg) || mpg < MIN_MPG || mpg > MAX_MPG) {
    return {
      ok: false,
      error: `presets[${index}].mpg must be between ${MIN_MPG} and ${MAX_MPG}`,
    };
  }
  const tank = Number(p.tankCapacityLitres);
  if (!Number.isFinite(tank) || tank < MIN_TANK || tank > MAX_TANK) {
    return {
      ok: false,
      error: `presets[${index}].tankCapacityLitres must be between ${MIN_TANK} and ${MAX_TANK}`,
    };
  }
  return {
    ok: true,
    preset: {
      id,
      name,
      fuelType: fuel.fuelType,
      mpg: Math.round(mpg * 10) / 10,
      tankCapacityLitres: Math.round(tank * 10) / 10,
    },
  };
}

export function parseReplaceBody(
  body: unknown
):
  | { ok: true; value: ReplaceVehiclePresetsInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.presets)) {
    return { ok: false, error: "presets must be an array" };
  }
  if (b.presets.length > MAX_VEHICLE_PRESETS) {
    return {
      ok: false,
      error: `At most ${MAX_VEHICLE_PRESETS} vehicle presets allowed`,
    };
  }

  const presets: VehiclePreset[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < b.presets.length; i++) {
    const parsed = parsePreset(b.presets[i], i);
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.preset.id)) {
      return { ok: false, error: `Duplicate preset id: ${parsed.preset.id}` };
    }
    seen.add(parsed.preset.id);
    presets.push(parsed.preset);
  }

  let activePresetId: string | null = null;
  if (b.activePresetId != null && b.activePresetId !== "") {
    if (typeof b.activePresetId !== "string") {
      return { ok: false, error: "activePresetId must be a string or null" };
    }
    const id = b.activePresetId.trim();
    if (!seen.has(id)) {
      return {
        ok: false,
        error: "activePresetId must match a preset in the list",
      };
    }
    activePresetId = id;
  }

  return { ok: true, value: { presets, activePresetId } };
}

function mapRow(row: Record<string, unknown>): VehiclePreset {
  return {
    id: asString(row.id),
    name: asString(row.name, "My car") || "My car",
    fuelType: asString(row.fuel_type, "E10") as FuelType,
    mpg: Number(row.mpg),
    tankCapacityLitres: Number(row.tank_capacity_litres),
  };
}

export async function getUserVehiclePresets(
  userId: string
): Promise<UserVehiclePresets> {
  await ensureVehiclePresetSchema();
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT id, name, fuel_type, mpg, tank_capacity_litres
     FROM vehicle_preset
     WHERE user_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  const presets = rows.map(mapRow).filter((p) => FUEL_TYPES.has(p.fuelType));

  const settings = await dbGet<{ active_preset_id: string | null }>(
    `SELECT active_preset_id FROM user_vehicle_settings WHERE user_id = ?`,
    [userId]
  );
  const synced = settings != null;
  const active =
    settings?.active_preset_id != null
      ? String(settings.active_preset_id)
      : null;
  const activePresetId =
    active && presets.some((p) => p.id === active) ? active : null;

  return { presets, activePresetId, synced };
}

export async function replaceUserVehiclePresets(
  userId: string,
  input: ReplaceVehiclePresetsInput
): Promise<UserVehiclePresets> {
  await ensureVehiclePresetSchema();
  const now = Date.now();

  await dbRun(`DELETE FROM vehicle_preset WHERE user_id = ?`, [userId]);

  for (let i = 0; i < input.presets.length; i++) {
    const p = input.presets[i];
    await dbRun(
      `INSERT INTO vehicle_preset
         (id, user_id, name, fuel_type, mpg, tank_capacity_litres, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        userId,
        p.name,
        p.fuelType,
        p.mpg,
        p.tankCapacityLitres,
        i,
        now,
        now,
      ]
    );
  }

  const existing = await dbGet<{ user_id: string }>(
    `SELECT user_id FROM user_vehicle_settings WHERE user_id = ?`,
    [userId]
  );
  if (existing) {
    await dbRun(
      `UPDATE user_vehicle_settings
       SET active_preset_id = ?, updated_at = ?
       WHERE user_id = ?`,
      [input.activePresetId, now, userId]
    );
  } else {
    await dbRun(
      `INSERT INTO user_vehicle_settings (user_id, active_preset_id, updated_at)
       VALUES (?, ?, ?)`,
      [userId, input.activePresetId, now]
    );
  }

  return getUserVehiclePresets(userId);
}
