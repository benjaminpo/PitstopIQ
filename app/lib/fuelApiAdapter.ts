import type { FuelStation, FuelType, MapBounds } from "./types";
import {
  fetchFuelFinderStations,
  isFuelFinderConfigured,
} from "./fuelFinderClient";

export {
  DEFAULT_BASE_ROUTE_AVG_PRICE,
  DEFAULT_BOUNDS,
} from "./fuelConstants";

export interface FuelApiAdapter {
  fetchNearbyFuelStations(bounds: MapBounds): Promise<FuelStation[]>;
}

type MockStationTemplate = {
  id: string;
  name: string;
  brand: string;
  address: string;
  postcode: string;
  latOffset: number;
  lngOffset: number;
  distanceOffRouteMiles: number;
  /** Rough detour minutes at ~35 mph for mock demos */
  detourExtraSeconds: number;
  prices: Partial<Record<FuelType, number>>;
  /** Simulated age of the price report, for demo realism */
  priceAgeMinutes: number;
  amenities?: string[];
  open24?: boolean;
};

const MOCK_STATION_TEMPLATES: MockStationTemplate[] = [
  {
    id: "mock-tesco-slough",
    name: "Tesco Extra Slough",
    brand: "Tesco",
    address: "Wellington Street, Slough",
    postcode: "SL1 1XW",
    latOffset: 0.018,
    lngOffset: -0.042,
    distanceOffRouteMiles: 1.2,
    detourExtraSeconds: 120,
    prices: { E10: 1.329, E5: 1.429, B7_Diesel: 1.389 },
    priceAgeMinutes: 45,
    amenities: ["customer_toilets", "car_wash", "water_filling"],
    open24: true,
  },
  {
    id: "mock-bp-heathrow",
    name: "BP Connect Heathrow",
    brand: "BP",
    address: "Bath Road, Heathrow",
    postcode: "TW6 2GA",
    latOffset: -0.012,
    lngOffset: 0.028,
    distanceOffRouteMiles: 3.8,
    detourExtraSeconds: 390,
    prices: { E10: 1.459, E5: 1.559, B7_Diesel: 1.499 },
    priceAgeMinutes: 130,
    amenities: ["customer_toilets", "adblue_pumps", "water_filling"],
  },
  {
    id: "mock-moto-m4",
    name: "Moto Reading Services M4",
    brand: "Moto",
    address: "M4 Junction 11, Reading",
    postcode: "RG2 0QG",
    latOffset: 0.015,
    lngOffset: -0.02,
    distanceOffRouteMiles: 0.4,
    detourExtraSeconds: 45,
    prices: { E10: 1.489, E5: 1.589, B7_Diesel: 1.529 },
    priceAgeMinutes: 25,
    amenities: ["customer_toilets", "car_wash", "adblue_packaged", "water_filling"],
    open24: true,
  },
  {
    id: "mock-shell-reading",
    name: "Shell Reading West",
    brand: "Shell",
    address: "Oxford Road, Reading",
    postcode: "RG30 1PR",
    latOffset: 0.032,
    lngOffset: -0.065,
    distanceOffRouteMiles: 2.4,
    detourExtraSeconds: 250,
    prices: { E10: 1.389, E5: 1.489, B7_Diesel: 1.419 },
    priceAgeMinutes: 310,
    amenities: ["customer_toilets", "adblue_pumps"],
  },
  {
    id: "mock-asda-bracknell",
    name: "Asda Bracknell",
    brand: "Asda",
    address: "The Peel Centre, Bracknell",
    postcode: "RG12 1QP",
    latOffset: -0.028,
    lngOffset: -0.038,
    distanceOffRouteMiles: 0.6,
    detourExtraSeconds: 60,
    prices: { E10: 1.299, E5: 1.399, B7_Diesel: 1.349 },
    priceAgeMinutes: 75,
    amenities: ["customer_toilets", "water_filling"],
    open24: true,
  },
  {
    id: "mock-esso-maidenhead",
    name: "Esso Maidenhead",
    brand: "Esso",
    address: "Bridge Road, Maidenhead",
    postcode: "SL6 1DN",
    latOffset: 0.008,
    lngOffset: 0.052,
    distanceOffRouteMiles: 4.5,
    detourExtraSeconds: 460,
    prices: { E10: 1.279, E5: 1.379, B7_Diesel: 1.329 },
    priceAgeMinutes: 220,
    amenities: ["water_filling"],
  },
  {
    id: "mock-sainsburys-windsor",
    name: "Sainsbury's Windsor",
    brand: "Sainsbury's",
    address: "Dedworth Road, Windsor",
    postcode: "SL4 1LH",
    latOffset: 0.022,
    lngOffset: 0.015,
    distanceOffRouteMiles: 1.9,
    detourExtraSeconds: 195,
    prices: { E10: 1.349, E5: 1.449, B7_Diesel: 1.379 },
    priceAgeMinutes: 15,
    amenities: ["customer_toilets", "car_wash"],
  },
  {
    id: "mock-morrisons-uxbridge",
    name: "Morrisons Uxbridge",
    brand: "Morrisons",
    address: "High Street, Uxbridge",
    postcode: "UB8 1QG",
    latOffset: -0.035,
    lngOffset: 0.048,
    distanceOffRouteMiles: 5.2,
    detourExtraSeconds: 535,
    prices: { E10: 1.319, E5: 1.419, B7_Diesel: 1.359 },
    priceAgeMinutes: 480,
    amenities: ["customer_toilets", "adblue_packaged"],
  },
];

/**
 * Mock forecourt generator — returns ≥5 stations with varied prices and
 * off-route distances so the app works without live API keys.
 */
function generateMockStations(bounds: MapBounds): FuelStation[] {
  const centreLat = (bounds.north + bounds.south) / 2;
  const centreLng = (bounds.east + bounds.west) / 2;
  const now = Date.now();

  return MOCK_STATION_TEMPLATES.map((t) => {
    const pricesUpdatedAt: Partial<Record<FuelType, number>> = {};
    const baseAge = now - t.priceAgeMinutes * 60_000;
    for (const fuel of Object.keys(t.prices) as FuelType[]) {
      // Spread mock ages slightly per grade so UI can show distinct times
      let offsetMins = 0;
      if (fuel === "E5") offsetMins = 40;
      else if (fuel === "B7_Diesel") offsetMins = 90;
      else if (fuel === "B7_Premium") offsetMins = 180;
      pricesUpdatedAt[fuel] = baseAge - offsetMins * 60_000;
    }
    const latest = Math.max(...Object.values(pricesUpdatedAt));
    const dayHours = t.open24
      ? { open: "00:00", close: "00:00", is24Hours: true as const }
      : { open: "06:00", close: "22:00", is24Hours: false as const };
    return {
      id: t.id,
      name: t.name,
      brand: t.brand,
      address: t.address,
      postcode: t.postcode,
      location: {
        lat: centreLat + t.latOffset,
        lng: centreLng + t.lngOffset,
      },
      prices: t.prices,
      pricesUpdatedAt,
      pricesLastUpdatedAt: latest,
      amenities: t.amenities,
      openingHours: {
        usualDays: {
          monday: dayHours,
          tuesday: dayHours,
          wednesday: dayHours,
          thursday: dayHours,
          friday: dayHours,
          saturday: dayHours,
          sunday: t.open24
            ? dayHours
            : { open: "07:00", close: "21:00", is24Hours: false },
        },
        bankHoliday: dayHours,
      },
      distanceOffRouteMiles: t.distanceOffRouteMiles,
      detourExtraSeconds: t.detourExtraSeconds,
    };
  });
}

/** Thrown when live data is unavailable and mock fallback is not allowed. */
export class FuelDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FuelDataUnavailableError";
  }
}

/**
 * Mock stations are demo data with made-up names and positions — never
 * serve them to real users. Dev builds (or an explicit env override for
 * preview deployments) may use them so the app works without credentials.
 */
function mockDataAllowed(): boolean {
  if (process.env.FUEL_FINDER_ALLOW_MOCKS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Live UK Fuel Finder stations when OAuth client credentials are set.
 * Outside production, falls back to mock demo stations on missing config
 * or failure; in production it throws FuelDataUnavailableError instead so
 * users are never shown fabricated forecourts.
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
      if (live) {
        // An empty list is an honest answer ("no forecourts here") —
        // never replace it with fake stations.
        return {
          stations: live.stations,
          source: "live",
          pricesFetchedAt: live.pricesFetchedAt,
        };
      }
    } catch (error) {
      console.warn("[fuelApiAdapter] Live Fuel Finder failed:", error);
      if (!mockDataAllowed()) {
        throw new FuelDataUnavailableError(
          "Live fuel prices are temporarily unavailable. Please try again in a minute."
        );
      }
      console.warn(
        "[fuelApiAdapter] Falling back to mock demo stations (non-production)"
      );
    }
  } else if (!mockDataAllowed()) {
    throw new FuelDataUnavailableError(
      "Live fuel prices are not configured on this server."
    );
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
