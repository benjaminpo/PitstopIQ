/** Fuel grades commonly available at UK forecourts */
export type FuelType = "E10" | "E5" | "B7_Diesel" | "B7_Premium";

export interface VehicleProfile {
  fuelType: FuelType;
  /** Miles per UK imperial gallon */
  mpg: number;
  tankCapacityLitres: number;
  /** Current fill level as a percentage of tank capacity (0–100) */
  fillPercentage: number;
}

/** Named vehicle profile for quick switching (local + cloud when signed in) */
export interface VehiclePreset {
  id: string;
  name: string;
  fuelType: FuelType;
  mpg: number;
  tankCapacityLitres: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** One day's opening window from Fuel Finder `opening_times`. */
export interface StationDayHours {
  /** Local open time as HH:MM */
  open: string;
  /** Local close time as HH:MM */
  close: string;
  is24Hours: boolean;
}

export interface StationOpeningHours {
  usualDays: Partial<Record<Weekday, StationDayHours>>;
  bankHoliday?: StationDayHours | null;
}

export interface FuelStation {
  id: string;
  name: string;
  brand: string;
  /** Street / locality when provided by Fuel Finder (e.g. "Lower Bridge Street, Pontypool") */
  address?: string | null;
  /** UK postcode when provided by Fuel Finder */
  postcode?: string | null;
  location: GeoPoint;
  /** Price per litre in GBP for each available fuel grade */
  prices: Partial<Record<FuelType, number>>;
  /**
   * Epoch ms when each fuel grade was last reported.
   * Prefer this over `pricesLastUpdatedAt` when showing per-grade freshness.
   */
  pricesUpdatedAt?: Partial<Record<FuelType, number>>;
  /**
   * Epoch ms when the station last reported a price update
   * (latest across grades); null when the API didn't provide it.
   */
  pricesLastUpdatedAt?: number | null;
  /** Fuel Finder amenity identifiers (e.g. car_wash, customer_toilets) */
  amenities?: string[];
  /** Opening hours from Fuel Finder when provided */
  openingHours?: StationOpeningHours | null;
  /** Extra miles vs remaining on the direct route */
  distanceOffRouteMiles: number;
  /** Extra driving time vs the direct route (seconds, from OSRM or estimate) */
  detourExtraSeconds: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface DetourCalculationInput {
  vehicle: VehicleProfile;
  /** Station price for the selected fuel type (£/litre) */
  stationPricePerLitre: number;
  /** Average price along the base/direct route (£/litre) */
  baseRouteAvgPricePerLitre: number;
  /** Extra distance incurred by diverting to the station (miles) */
  distanceOffRouteMiles: number;
  /**
   * Litres planned to refill. When omitted, derived from
   * tankCapacity × (1 − fillPercentage / 100).
   */
  litresToRefill?: number;
  /** Extra driving time for the detour (minutes). Defaults to 0. */
  detourExtraMinutes?: number;
  /**
   * Opportunity cost of time (£/hour). Used to convert detour minutes
   * into a cash-equivalent cost. Defaults to 0 (ignore time).
   */
  valueOfTimeGbpPerHour?: number;
}

export type DetourStatus = "worth" | "neutral" | "false_economy";

export interface DetourCalculationResult {
  litresPerMile: number;
  detourLitresConsumed: number;
  detourFuelCost: number;
  litresToRefill: number;
  grossSavings: number;
  /** Fuel-only net: gross savings − detour fuel cost */
  netFinancialSaving: number;
  detourExtraMinutes: number;
  /** Opportunity cost of the extra driving time */
  timeCostGbp: number;
  /** Decision figure: fuel net − time cost */
  netAfterTime: number;
  status: DetourStatus;
}

/** Member-reported price / rating / comment aggregates for a forecourt */
export interface StationCommunitySummary {
  stationId: string;
  avgRating: number | null;
  ratingCount: number;
  commentCount: number;
  communityPrices: Partial<Record<FuelType, number>>;
  communityPriceUpdatedAt: Partial<Record<FuelType, number>>;
  recentComments: Array<{
    userName: string;
    comment: string;
    rating: number | null;
    fuelType: FuelType;
    pricePerLitre: number | null;
    updatedAt: number;
  }>;
}

export interface StationWithCalculation {
  station: FuelStation;
  calculation: DetourCalculationResult;
  pricePerLitre: number;
  /** True when pricePerLitre comes from a member report */
  priceFromCommunity?: boolean;
  community?: StationCommunitySummary;
}

export type StationSortKey = "netProfit" | "distance" | "price";

export interface RoutePlan {
  origin: string;
  destination: string;
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
}

/** Intermediate stop between origin and destination (Google Maps–style). */
export interface TripStop {
  id: string;
  label: string;
  coords: GeoPoint | null;
}

/** Max intermediate stops a trip can include. */
export const MAX_TRIP_STOPS = 5;

export interface AppCalculationParams {
  vehicle: VehicleProfile;
  baseRouteAvgPricePerLitre: number;
  litresToRefill: number;
  /** £/hour the driver assigns to their time */
  valueOfTimeGbpPerHour: number;
}
