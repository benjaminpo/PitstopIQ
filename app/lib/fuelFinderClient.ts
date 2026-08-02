import type { FuelStation, FuelType, GeoPoint, MapBounds } from "./types";

const DEFAULT_BASE_URL = "https://www.fuel-finder.service.gov.uk";
const TOKEN_PATH = "/api/v1/oauth/generate_access_token";
const REFRESH_PATH = "/api/v1/oauth/regenerate_access_token";
const PFS_PATH = "/api/v1/pfs";
const PRICES_PATH = "/api/v1/pfs/fuel-prices";

const BATCH_SIZE = 500;
const MIN_REQUEST_GAP_MS = 2100;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_BATCHES = 80;
const USER_AGENT = "PitstopIQ/1.0 (route fuel cost calculator)";

/** API fuel_type → app FuelType */
const FUEL_TYPE_MAP: Record<string, FuelType> = {
  E10: "E10",
  E5: "E5",
  B7_STANDARD: "B7_Diesel",
  B7: "B7_Diesel",
};

interface TokenResponse {
  success?: boolean;
  data?: {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  message?: string;
}

type ApiCoord = string | number | null;

interface ApiLocation {
  address_line_1?: string | null;
  city?: string | null;
  postcode?: string | null;
  latitude?: ApiCoord;
  longitude?: ApiCoord;
}

interface ApiStation {
  node_id: string;
  trading_name?: string | null;
  brand_name?: string | null;
  temporary_closure?: boolean;
  permanent_closure?: boolean | null;
  location?: ApiLocation;
}

interface ApiFuelPrice {
  price: string | number | null;
  fuel_type: string;
  price_last_updated?: string | null;
}

interface ApiPriceStation {
  node_id: string;
  trading_name?: string | null;
  fuel_prices?: ApiFuelPrice[];
}

interface CachedDataset {
  fetchedAt: number;
  stations: FuelStation[];
}

let tokenCache: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
} | null = null;

let datasetCache: CachedDataset | null = null;
let inflightRefresh: Promise<CachedDataset> | null = null;
let lastRequestAt = 0;

function getConfig() {
  const clientId = process.env.FUEL_FINDER_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET?.trim() ?? "";
  const baseUrl = (
    process.env.FUEL_FINDER_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/$/, "");

  return { clientId, clientSecret, baseUrl };
}

export function isFuelFinderConfigured(): boolean {
  const { clientId, clientSecret } = getConfig();
  return Boolean(clientId && clientSecret);
}

async function throttle(): Promise<void> {
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

async function fuelFinderFetch(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {}
): Promise<Response> {
  const { baseUrl } = getConfig();
  const { skipAuth, headers: initHeaders, ...rest } = init;

  await throttle();

  const headers = new Headers(initHeaders);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", USER_AGENT);

  if (!skipAuth) {
    const token = await getAccessToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });

  // One retry on 401/403 with forced token refresh. The API allows a single
  // active token per client, so a concurrent token generation (e.g. another
  // server instance) revokes ours mid-run and requests start returning
  // 403 "Token revoked or expired".
  if ((response.status === 401 || response.status === 403) && !skipAuth) {
    tokenCache = null;
    const token = await getAccessToken(true);
    headers.set("Authorization", `Bearer ${token}`);
    await throttle();
    response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
    });
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 5);
    await new Promise((r) => setTimeout(r, Math.max(retryAfter, 5) * 1000));
    await throttle();
    response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
    });
  }

  return response;
}

async function getAccessToken(force = false): Promise<string> {
  const { clientId, clientSecret } = getConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Fuel Finder credentials are not configured");
  }

  const now = Date.now();
  if (
    !force &&
    tokenCache &&
    tokenCache.expiresAt > now + 60_000
  ) {
    return tokenCache.accessToken;
  }

  // Prefer refresh token when available
  if (!force && tokenCache?.refreshToken) {
    try {
      const refreshed = await requestToken(REFRESH_PATH, {
        client_id: clientId,
        refresh_token: tokenCache.refreshToken,
      });
      if (refreshed) return refreshed;
    } catch {
      // fall through to full generate
    }
  }

  const generated = await requestToken(TOKEN_PATH, {
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (!generated) {
    throw new Error("Failed to obtain Fuel Finder access token");
  }
  return generated;
}

async function requestToken(
  path: string,
  body: Record<string, string>
): Promise<string | null> {
  const response = await fuelFinderFetch(path, {
    method: "POST",
    skipAuth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const server = response.headers.get("server") ?? "";
    // CloudFront often returns a bare 403 (empty body) when the caller IP is
    // outside the UK — useful signal when diagnosing region misconfiguration.
    console.warn(
      `[fuelFinder] token ${path} → ${response.status} ` +
        `server=${server || "(none)"} body=${text.slice(0, 200) || "(empty)"}`
    );
    return null;
  }

  const json = (await response.json()) as TokenResponse;
  const access = json.data?.access_token;
  if (!access) return null;

  const expiresIn = json.data?.expires_in ?? 3600;
  tokenCache = {
    accessToken: access,
    refreshToken: json.data?.refresh_token ?? tokenCache?.refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return access;
}

/**
 * Parse the API's price_last_updated string to epoch ms.
 * Handles ISO 8601 and the legacy CMA "dd/MM/yyyy HH:mm:ss" format.
 */
export function parsePriceLastUpdated(
  raw: string | null | undefined
): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const ukFormat =
    /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      trimmed
    );
  if (ukFormat) {
    const [, dd, mm, yyyy, hh, min, ss] = ukFormat;
    const t = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, ss ? +ss : 0);
    return Number.isFinite(t) ? t : undefined;
  }

  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? t : undefined;
}

/** Convert API price (usually pence, sometimes £) to £/litre */
export function parsePriceToGbpPerLitre(
  raw: string | number | null | undefined
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Values under ~10 are almost certainly already in pounds
  if (n < 10) return Number(n.toFixed(3));
  return Number((n / 100).toFixed(3));
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

function inBounds(point: GeoPoint, bounds: MapBounds): boolean {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

async function fetchAllBatches<T>(path: string): Promise<T[]> {
  const all: T[] = [];

  for (let batch = 1; batch <= MAX_BATCHES; batch++) {
    const url = `${path}?batch-number=${batch}`;
    const response = await fuelFinderFetch(url, { method: "GET" });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Fuel Finder ${path} batch ${batch} → ${response.status}: ${text}`);
    }

    const page = (await response.json()) as T[];
    if (!Array.isArray(page)) {
      throw new TypeError(`Fuel Finder ${path} returned unexpected payload`);
    }

    all.push(...page);
    if (page.length < BATCH_SIZE) break;
  }

  return all;
}

function mapStations(
  stations: ApiStation[],
  pricesByNode: Map<string, Partial<Record<FuelType, number>>>,
  updatedByNode: Map<string, number>,
  routeCentre: GeoPoint
): FuelStation[] {
  const mapped: FuelStation[] = [];

  for (const s of stations) {
    if (s.temporary_closure || s.permanent_closure) continue;
    const lat = Number(s.location?.latitude);
    const lng = Number(s.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const prices = pricesByNode.get(s.node_id);
    if (!prices || Object.keys(prices).length === 0) continue;

    const location = { lat, lng };
    mapped.push({
      id: s.node_id,
      name: s.trading_name?.trim() || s.brand_name?.trim() || "Forecourt",
      brand: s.brand_name?.trim() || s.trading_name?.trim() || "Unknown",
      location,
      prices,
      pricesLastUpdatedAt: updatedByNode.get(s.node_id) ?? null,
      distanceOffRouteMiles: Number(
        haversineMiles(routeCentre, location).toFixed(2)
      ),
      detourExtraSeconds: 0,
    });
  }

  return mapped;
}

/**
 * Merge one API fuel price into the station's price map (keeping the
 * cheapest per grade) and return its last-updated timestamp, if usable.
 */
function mergeFuelPrice(
  prices: Partial<Record<FuelType, number>>,
  fp: ApiFuelPrice
): number | undefined {
  const mapped = FUEL_TYPE_MAP[fp.fuel_type];
  if (!mapped) return undefined;
  const gbp = parsePriceToGbpPerLitre(fp.price);
  if (gbp === undefined) return undefined;
  const existing = prices[mapped];
  if (existing === undefined || gbp < existing) {
    prices[mapped] = gbp;
  }
  return parsePriceLastUpdated(fp.price_last_updated);
}

function aggregatePriceRows(priceRows: ApiPriceStation[]): {
  pricesByNode: Map<string, Partial<Record<FuelType, number>>>;
  updatedByNode: Map<string, number>;
} {
  const pricesByNode = new Map<string, Partial<Record<FuelType, number>>>();
  const updatedByNode = new Map<string, number>();

  for (const row of priceRows) {
    const prices: Partial<Record<FuelType, number>> = {};
    let latestUpdatedAt = 0;
    for (const fp of row.fuel_prices ?? []) {
      const updatedAt = mergeFuelPrice(prices, fp);
      if (updatedAt !== undefined && updatedAt > latestUpdatedAt) {
        latestUpdatedAt = updatedAt;
      }
    }
    if (Object.keys(prices).length > 0) {
      pricesByNode.set(row.node_id, prices);
    }
    if (latestUpdatedAt > 0) {
      updatedByNode.set(row.node_id, latestUpdatedAt);
    }
  }

  return { pricesByNode, updatedByNode };
}

async function refreshDataset(): Promise<CachedDataset> {
  // Sequential on purpose — Fuel Finder requires waiting for each response
  // before the next request (30 rpm Information Recipient limit).
  const stations = await fetchAllBatches<ApiStation>(PFS_PATH);
  const priceRows = await fetchAllBatches<ApiPriceStation>(PRICES_PATH);

  const { pricesByNode, updatedByNode } = aggregatePriceRows(priceRows);

  const UK_CENTRE: GeoPoint = { lat: 54.0, lng: -2.5 };
  const mapped = mapStations(stations, pricesByNode, updatedByNode, UK_CENTRE);

  datasetCache = { fetchedAt: Date.now(), stations: mapped };
  console.info(
    `[fuelFinder] cached ${mapped.length} stations with prices (${stations.length} PFS / ${priceRows.length} price rows)`
  );
  return datasetCache;
}

async function getAllStationsCached(): Promise<CachedDataset> {
  if (
    datasetCache &&
    Date.now() - datasetCache.fetchedAt < CACHE_TTL_MS
  ) {
    return datasetCache;
  }

  inflightRefresh ??= refreshDataset().finally(() => {
    inflightRefresh = null;
  });

  try {
    return await inflightRefresh;
  } catch (error) {
    // A failed refresh (e.g. token revoked mid-batch) shouldn't wipe out
    // real data — serve the stale dataset rather than falling back to mocks.
    if (datasetCache) {
      console.warn(
        "[fuelFinder] refresh failed, serving stale dataset from",
        new Date(datasetCache.fetchedAt).toISOString(),
        error
      );
      return datasetCache;
    }
    throw error;
  }
}

export interface FuelFinderFetchResult {
  stations: FuelStation[];
  /** Epoch ms when the national prices dataset was last pulled from Fuel Finder */
  pricesFetchedAt: number;
}

/**
 * Live Fuel Finder stations within map bounds.
 * Returns null when credentials are missing; throws on hard API failures
 * (caller may fall back to mocks).
 */
export async function fetchFuelFinderStations(
  bounds: MapBounds
): Promise<FuelFinderFetchResult | null> {
  if (!isFuelFinderConfigured()) return null;

  const { stations: all, fetchedAt } = await getAllStationsCached();
  const centre: GeoPoint = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };

  const stations = all
    .filter((s) => inBounds(s.location, bounds))
    .map((s) => ({
      ...s,
      distanceOffRouteMiles: Number(
        haversineMiles(centre, s.location).toFixed(2)
      ),
    }))
    .sort((a, b) => a.distanceOffRouteMiles - b.distanceOffRouteMiles);

  return { stations, pricesFetchedAt: fetchedAt };
}
