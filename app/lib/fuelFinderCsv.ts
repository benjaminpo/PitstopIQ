import { createDecipheriv, createHash } from "node:crypto";
import {
  parsePriceLastUpdated,
  parsePriceToGbpPerLitre,
} from "./fuelPriceParse";
import type { FuelStation, FuelType, GeoPoint } from "./types";

/**
 * Portal transport secret (NEXT_PUBLIC_SECRET_KEY in the Fuel Finder SPA).
 * Used only to decrypt /internal/... JSON envelopes — not an API credential.
 */
const DEFAULT_TRANSPORT_SECRET =
  "wAndRKxKefFpcuAMQyObcik5zkthu80KcrvK7av3oXCUeyjm3HyzZUuFvR9UN97Kd6jGJANMU9K3TITw1dCPLc";

/** CSV fuel grade columns → app FuelType */
const CSV_FUEL_COLUMNS: Array<{ price: string; updated: string; type: FuelType }> =
  [
    {
      price: "forecourts.fuel_price.E10",
      updated: "forecourts.price_submission_timestamp.E10",
      type: "E10",
    },
    {
      price: "forecourts.fuel_price.E5",
      updated: "forecourts.price_submission_timestamp.E5",
      type: "E5",
    },
    {
      price: "forecourts.fuel_price.B7S",
      updated: "forecourts.price_submission_timestamp.B7S",
      type: "B7_Diesel",
    },
  ];

export function getFuelFinderTransportSecret(): string {
  return (
    process.env.FUEL_FINDER_TRANSPORT_SECRET?.trim() || DEFAULT_TRANSPORT_SECRET
  );
}

/** Decrypt the AES-256-CBC `{ nxhex, iv }` envelope used by Fuel Finder internal APIs. */
export function decryptFuelFinderNxhex(payload: {
  nxhex: string;
  iv: string;
}): unknown {
  const key = createHash("sha256")
    .update(getFuelFinderTransportSecret())
    .digest();
  const iv = Buffer.from(payload.iv, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const plain =
    decipher.update(payload.nxhex, "hex", "utf8") + decipher.final("utf8");
  return JSON.parse(plain) as unknown;
}

/** Minimal RFC4180 CSV parser (handles quotes and escaped quotes). */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop a trailing empty line from a final newline
  if (
    rows.length > 0 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0] === ""
  ) {
    rows.pop();
  }

  return rows;
}

function truthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Map a Fuel Finder national prices CSV into app stations.
 * Prices are pence/litre (same as the JSON API); timestamps are JS Date strings.
 */
export function parseFuelFinderCsv(
  text: string,
  routeCentre: GeoPoint = { lat: 54.0, lng: -2.5 }
): FuelStation[] {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];

  const header = records[0].map((h) => h.trim());
  const index = new Map(header.map((h, i) => [h, i]));
  const col = (name: string, row: string[]) => {
    const i = index.get(name);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const stations: FuelStation[] = [];

  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    if (!row || row.length === 0) continue;

    if (
      truthyFlag(col("forecourts.temporary_closure", row)) ||
      truthyFlag(col("forecourts.permanent_closure", row))
    ) {
      continue;
    }

    const id = col("forecourts.node_id", row);
    const lat = Number(col("forecourts.location.latitude", row));
    const lng = Number(col("forecourts.location.longitude", row));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const prices: Partial<Record<FuelType, number>> = {};
    let latestUpdatedAt = 0;

    for (const fuel of CSV_FUEL_COLUMNS) {
      const gbp = parsePriceToGbpPerLitre(col(fuel.price, row));
      if (gbp === undefined) continue;
      prices[fuel.type] = gbp;
      const updatedAt = parsePriceLastUpdated(col(fuel.updated, row));
      if (updatedAt !== undefined && updatedAt > latestUpdatedAt) {
        latestUpdatedAt = updatedAt;
      }
    }

    if (Object.keys(prices).length === 0) continue;

    const trading = col("forecourts.trading_name", row);
    const brand = col("forecourts.brand_name", row);
    const location = { lat, lng };

    stations.push({
      id,
      name: trading || brand || "Forecourt",
      brand: brand || trading || "Unknown",
      location,
      prices,
      pricesLastUpdatedAt: latestUpdatedAt > 0 ? latestUpdatedAt : null,
      distanceOffRouteMiles: Number(
        haversineMiles(routeCentre, location).toFixed(2)
      ),
      detourExtraSeconds: 0,
    });
  }

  return stations;
}

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.7613;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FuelFinderCsvPresignPayload {
  success?: boolean;
  data?: {
    redirectUrl?: string;
    generated_at?: string;
  };
  message?: string;
}

export function extractCsvPresign(
  decrypted: unknown
): { redirectUrl: string; generatedAt: string | null } | null {
  if (!decrypted || typeof decrypted !== "object") return null;
  const payload = decrypted as FuelFinderCsvPresignPayload;
  const redirectUrl = payload.data?.redirectUrl?.trim();
  if (!redirectUrl) return null;
  return {
    redirectUrl,
    generatedAt: payload.data?.generated_at?.trim() || null,
  };
}
