import type { FuelStation, FuelType, MapBounds } from "./types";
import {
  fetchFuelFinderStations,
  isFuelFinderConfigured,
} from "./fuelFinderClient";

export interface FuelApiAdapter {
  fetchNearbyFuelStations(bounds: MapBounds): Promise<FuelStation[]>;
}

/**
 * Mock forecourt generator — returns ≥5 stations with varied prices and
 * off-route distances so the app works without live API keys.
 */
function generateMockStations(bounds: MapBounds): FuelStation[] {
  const centreLat = (bounds.north + bounds.south) / 2;
  const centreLng = (bounds.east + bounds.west) / 2;

  const templates: Array<{
    id: string;
    name: string;
    brand: string;
    latOffset: number;
    lngOffset: number;
    distanceOffRouteMiles: number;
    /** Rough detour minutes at ~35 mph for mock demos */
    detourExtraSeconds: number;
    prices: Partial<Record<FuelType, number>>;
    /** Simulated age of the price report, for demo realism */
    priceAgeMinutes: number;
  }> = [
    {
      id: "mock-tesco-slough",
      name: "Tesco Extra Slough",
      brand: "Tesco",
      latOffset: 0.018,
      lngOffset: -0.042,
      distanceOffRouteMiles: 1.2,
      detourExtraSeconds: 120,
      prices: { E10: 1.329, E5: 1.429, B7_Diesel: 1.389 },
      priceAgeMinutes: 45,
    },
    {
      id: "mock-bp-heathrow",
      name: "BP Connect Heathrow",
      brand: "BP",
      latOffset: -0.012,
      lngOffset: 0.028,
      distanceOffRouteMiles: 3.8,
      detourExtraSeconds: 390,
      prices: { E10: 1.459, E5: 1.559, B7_Diesel: 1.499 },
      priceAgeMinutes: 130,
    },
    {
      id: "mock-moto-m4",
      name: "Moto Reading Services M4",
      brand: "Moto",
      latOffset: 0.015,
      lngOffset: -0.02,
      distanceOffRouteMiles: 0.4,
      detourExtraSeconds: 45,
      prices: { E10: 1.489, E5: 1.589, B7_Diesel: 1.529 },
      priceAgeMinutes: 25,
    },
    {
      id: "mock-shell-reading",
      name: "Shell Reading West",
      brand: "Shell",
      latOffset: 0.032,
      lngOffset: -0.065,
      distanceOffRouteMiles: 2.4,
      detourExtraSeconds: 250,
      prices: { E10: 1.389, E5: 1.489, B7_Diesel: 1.419 },
      priceAgeMinutes: 310,
    },
    {
      id: "mock-asda-bracknell",
      name: "Asda Bracknell",
      brand: "Asda",
      latOffset: -0.028,
      lngOffset: -0.038,
      distanceOffRouteMiles: 0.6,
      detourExtraSeconds: 60,
      prices: { E10: 1.299, E5: 1.399, B7_Diesel: 1.349 },
      priceAgeMinutes: 75,
    },
    {
      id: "mock-esso-maidenhead",
      name: "Esso Maidenhead",
      brand: "Esso",
      latOffset: 0.008,
      lngOffset: 0.052,
      distanceOffRouteMiles: 4.5,
      detourExtraSeconds: 460,
      prices: { E10: 1.279, E5: 1.379, B7_Diesel: 1.329 },
      priceAgeMinutes: 220,
    },
    {
      id: "mock-sainsburys-windsor",
      name: "Sainsbury's Windsor",
      brand: "Sainsbury's",
      latOffset: 0.022,
      lngOffset: 0.015,
      distanceOffRouteMiles: 1.9,
      detourExtraSeconds: 195,
      prices: { E10: 1.349, E5: 1.449, B7_Diesel: 1.379 },
      priceAgeMinutes: 15,
    },
    {
      id: "mock-morrisons-uxbridge",
      name: "Morrisons Uxbridge",
      brand: "Morrisons",
      latOffset: -0.035,
      lngOffset: 0.048,
      distanceOffRouteMiles: 5.2,
      detourExtraSeconds: 535,
      prices: { E10: 1.319, E5: 1.419, B7_Diesel: 1.359 },
      priceAgeMinutes: 480,
    },
  ];

  const now = Date.now();
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    brand: t.brand,
    location: {
      lat: centreLat + t.latOffset,
      lng: centreLng + t.lngOffset,
    },
    prices: t.prices,
    pricesLastUpdatedAt: now - t.priceAgeMinutes * 60_000,
    distanceOffRouteMiles: t.distanceOffRouteMiles,
    detourExtraSeconds: t.detourExtraSeconds,
  }));
}

/**
 * Prefers live UK Fuel Finder API when OAuth client credentials are set;
 * falls back to mocks on missing config or empty/failed responses.
 */
export async function fetchNearbyFuelStations(
  bounds: MapBounds
): Promise<{
  stations: FuelStation[];
  source: "live" | "mock";
  /** Epoch ms when live prices were last synced; null for mock */
  pricesFetchedAt: number | null;
}> {
  if (isFuelFinderConfigured()) {
    try {
      const live = await fetchFuelFinderStations(bounds);
      if (live && live.stations.length > 0) {
        return {
          stations: live.stations,
          source: "live",
          pricesFetchedAt: live.pricesFetchedAt,
        };
      }
      console.warn(
        "[fuelApiAdapter] Live Fuel Finder returned 0 stations in bounds — using mocks"
      );
    } catch (error) {
      console.warn("[fuelApiAdapter] Live Fuel Finder failed, using mocks:", error);
    }
  }

  return {
    stations: generateMockStations(bounds),
    source: "mock",
    pricesFetchedAt: null,
  };
}

export const fuelApiAdapter: FuelApiAdapter = {
  async fetchNearbyFuelStations(bounds) {
    const { stations } = await fetchNearbyFuelStations(bounds);
    return stations;
  },
};

/** Default map bounds around west London / M4 corridor */
export const DEFAULT_BOUNDS: MapBounds = {
  north: 51.55,
  south: 51.4,
  east: -0.35,
  west: -0.75,
};

/** Sensible default base-route average (£/L) before live prices load */
export const DEFAULT_BASE_ROUTE_AVG_PRICE = 1.55;
