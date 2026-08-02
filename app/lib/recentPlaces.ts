import { dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  MAX_RECENT_PLACES,
  sanitizeRecentPlaces,
} from "@/app/lib/locationHistory";
import type { PlaceSuggestion } from "@/app/lib/placeSearch";

export interface UserRecentPlaces {
  places: PlaceSuggestion[];
  /** True once the account has ever been written (even with an empty list). */
  synced: boolean;
}

export type ReplaceRecentPlacesInput = { places: PlaceSuggestion[] };

let schemaReady: Promise<void> | null = null;

export function ensureRecentPlacesSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_recent_places (
        user_id TEXT PRIMARY KEY NOT NULL,
        places_json TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
    await ensureBigintEpochColumns("user_recent_places", ["updated_at"]);
  })();
  return schemaReady;
}

export function parseReplaceBody(
  body: unknown
):
  | { ok: true; value: ReplaceRecentPlacesInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.places)) {
    return { ok: false, error: "places must be an array" };
  }
  if (b.places.length > MAX_RECENT_PLACES) {
    return {
      ok: false,
      error: `At most ${MAX_RECENT_PLACES} recent places allowed`,
    };
  }
  const places = sanitizeRecentPlaces(b.places);
  if (places.length !== b.places.length) {
    return { ok: false, error: "One or more places are invalid" };
  }
  return { ok: true, value: { places } };
}

export async function getUserRecentPlaces(
  userId: string
): Promise<UserRecentPlaces> {
  await ensureRecentPlacesSchema();
  const row = await dbGet<{ places_json: string }>(
    `SELECT places_json FROM user_recent_places WHERE user_id = ?`,
    [userId]
  );
  if (!row) {
    return { places: [], synced: false };
  }
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(row.places_json);
  } catch {
    parsed = [];
  }
  return { places: sanitizeRecentPlaces(parsed), synced: true };
}

export async function replaceUserRecentPlaces(
  userId: string,
  input: ReplaceRecentPlacesInput
): Promise<UserRecentPlaces> {
  await ensureRecentPlacesSchema();
  const now = Date.now();
  const placesJson = JSON.stringify(input.places.slice(0, MAX_RECENT_PLACES));

  const existing = await dbGet<{ user_id: string }>(
    `SELECT user_id FROM user_recent_places WHERE user_id = ?`,
    [userId]
  );
  if (existing) {
    await dbRun(
      `UPDATE user_recent_places
       SET places_json = ?, updated_at = ?
       WHERE user_id = ?`,
      [placesJson, now, userId]
    );
  } else {
    await dbRun(
      `INSERT INTO user_recent_places (user_id, places_json, updated_at)
       VALUES (?, ?, ?)`,
      [userId, placesJson, now]
    );
  }

  return getUserRecentPlaces(userId);
}
