import { parseCsvRecords } from "@/app/lib/csvRecords";
import type { FuelStation, FuelType } from "@/app/lib/types";

export interface PetrolPricesStation {
  sourceId: string;
  sourceUrl: string | null;
  name: string;
  brand: string;
  address: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  prices: Partial<Record<FuelType, number>>;
  updatedAt: string | null;
}

export interface StationMatchSuggestion {
  source: PetrolPricesStation;
  station: FuelStation | null;
  score: number;
  distanceMetres: number | null;
}

const FIELD_ALIASES = {
  sourceId: ["id", "station_id", "site_id", "forecourt_id"],
  sourceUrl: ["url", "station_url", "source_url", "petrolprices_url"],
  name: ["name", "station_name", "site_name", "forecourt_name"],
  brand: ["brand", "station_brand", "site_brand"],
  address: ["address", "station_address", "site_address"],
  postcode: ["postcode", "post_code", "postal_code"],
  lat: ["latitude", "lat"],
  lng: ["longitude", "lng", "lon", "long"],
  E10: ["e10", "unleaded", "petrol", "regular_unleaded"],
  E5: ["e5", "super_unleaded", "premium_unleaded"],
  B7_Diesel: ["b7_diesel", "b7", "diesel", "regular_diesel"],
  B7_Premium: ["b7_premium", "b7p", "premium_diesel", "super_diesel"],
  HVO: ["hvo", "hydrotreated_vegetable_oil", "renewable_diesel"],
  updatedAt: ["updated_at", "last_updated", "price_updated_at", "timestamp"],
} as const;

function normalizedKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizePostcode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeWords(value: string): string[] {
  const ignored = new Set(["service", "services", "station", "petrol", "fuel", "the"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !ignored.has(word));
}

function wordSimilarity(a: string, b: string): number {
  const left = new Set(normalizeWords(a));
  const right = new Set(normalizeWords(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function valueFor(
  record: Record<string, unknown>,
  aliases: readonly string[]
): unknown {
  for (const alias of aliases) {
    const value = record[alias];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function textValue(record: Record<string, unknown>, aliases: readonly string[]): string {
  const value = valueFor(record, aliases);
  return value == null ? "" : String(value).trim();
}

function coordinateValue(
  record: Record<string, unknown>,
  aliases: readonly string[],
  min: number,
  max: number
): number | null {
  const value = Number(valueFor(record, aliases));
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function priceValue(
  record: Record<string, unknown>,
  aliases: readonly string[]
): number | undefined {
  let value = Number(String(valueFor(record, aliases) ?? "").replace(/[£p,\s]/gi, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value > 10) value /= 100;
  return value >= 0.8 && value <= 5 ? Math.round(value * 1000) / 1000 : undefined;
}

function normalizeRecord(raw: Record<string, unknown>, index: number): PetrolPricesStation | null {
  const record = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizedKey(key), value])
  );
  const name = textValue(record, FIELD_ALIASES.name);
  const postcode = textValue(record, FIELD_ALIASES.postcode);
  const lat = coordinateValue(record, FIELD_ALIASES.lat, 49, 61);
  const lng = coordinateValue(record, FIELD_ALIASES.lng, -9, 2.5);
  if (!name || (!postcode && (lat === null || lng === null))) return null;

  const prices: Partial<Record<FuelType, number>> = {};
  for (const fuel of ["E10", "E5", "B7_Diesel", "B7_Premium", "HVO"] as const) {
    const price = priceValue(record, FIELD_ALIASES[fuel]);
    if (price !== undefined) prices[fuel] = price;
  }

  return {
    sourceId:
      textValue(record, FIELD_ALIASES.sourceId) ||
      `${normalizePostcode(postcode) || `${lat},${lng}`}-${normalizedKey(name)}-${index}`,
    sourceUrl: textValue(record, FIELD_ALIASES.sourceUrl) || null,
    name,
    brand: textValue(record, FIELD_ALIASES.brand),
    address: textValue(record, FIELD_ALIASES.address),
    postcode,
    lat,
    lng,
    prices,
    updatedAt: textValue(record, FIELD_ALIASES.updatedAt) || null,
  };
}

export function parsePetrolPricesFile(text: string, fileName: string): PetrolPricesStation[] {
  let records: Record<string, unknown>[];
  if (fileName.toLowerCase().endsWith(".json") || text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    const parsed: unknown = JSON.parse(text);
    const rows =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { stations?: unknown }).stations)
          ? (parsed as { stations: unknown[] }).stations
          : [];
    records = rows.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    );
  } else {
    const rows = parseCsvRecords(text);
    if (rows.length < 2) return [];
    const headers = rows[0];
    records = rows.slice(1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
    );
  }
  return records
    .map((record, index) => normalizeRecord(record, index))
    .filter((station): station is PetrolPricesStation => station !== null);
}

function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function scoreCandidate(
  source: PetrolPricesStation,
  station: FuelStation
): { score: number; distanceMetres: number | null } {
  const sourcePostcode = normalizePostcode(source.postcode);
  const stationPostcode = normalizePostcode(station.postcode ?? "");
  const postcodeMatch = Boolean(sourcePostcode && sourcePostcode === stationPostcode);
  const distanceMetres =
    source.lat !== null && source.lng !== null
      ? haversineMetres({ lat: source.lat, lng: source.lng }, station.location)
      : null;
  if (!postcodeMatch && (distanceMetres === null || distanceMetres > 3_000)) {
    return { score: 0, distanceMetres };
  }

  let score = postcodeMatch ? 55 : 0;
  if (distanceMetres !== null) {
    if (distanceMetres <= 100) score += 30;
    else if (distanceMetres <= 300) score += 25;
    else if (distanceMetres <= 750) score += 18;
    else if (distanceMetres <= 1_500) score += 10;
    else if (distanceMetres <= 3_000) score += 4;
  }
  score += wordSimilarity(source.name, station.name) * 15;
  if (source.brand) score += wordSimilarity(source.brand, station.brand) * 8;
  if (source.address && station.address) {
    score += wordSimilarity(source.address, station.address) * 7;
  }
  return { score: Math.min(100, Math.round(score)), distanceMetres };
}

export function suggestStationMatches(
  sources: PetrolPricesStation[],
  stations: FuelStation[]
): StationMatchSuggestion[] {
  const byPostcode = new Map<string, FuelStation[]>();
  for (const station of stations) {
    const postcode = normalizePostcode(station.postcode ?? "");
    if (!postcode) continue;
    byPostcode.set(postcode, [...(byPostcode.get(postcode) ?? []), station]);
  }

  return sources.map((source) => {
    const postcodeCandidates = byPostcode.get(normalizePostcode(source.postcode)) ?? [];
    const candidates = postcodeCandidates.length > 0 ? postcodeCandidates : stations;
    let best: FuelStation | null = null;
    let bestScore = 0;
    let bestDistance: number | null = null;
    for (const station of candidates) {
      const result = scoreCandidate(source, station);
      if (result.score > bestScore) {
        best = station;
        bestScore = result.score;
        bestDistance = result.distanceMetres;
      }
    }
    return {
      source,
      station: bestScore >= 45 ? best : null,
      score: bestScore,
      distanceMetres: bestDistance,
    };
  });
}
