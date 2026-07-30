/** Fuel grades commonly available at UK forecourts */
export type FuelType = "E10" | "E5" | "B7_Diesel";

export interface VehicleProfile {
  fuelType: FuelType;
  /** Miles per UK imperial gallon */
  mpg: number;
  tankCapacityLitres: number;
  /** Current fill level as a percentage of tank capacity (0–100) */
  fillPercentage: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface FuelStation {
  id: string;
  name: string;
  brand: string;
  location: GeoPoint;
  /** Price per litre in GBP for each available fuel grade */
  prices: Partial<Record<FuelType, number>>;
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

export interface StationWithCalculation {
  station: FuelStation;
  calculation: DetourCalculationResult;
  pricePerLitre: number;
}

export type StationSortKey = "netProfit" | "distance" | "price";

export interface RoutePlan {
  origin: string;
  destination: string;
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
}

export interface AppCalculationParams {
  vehicle: VehicleProfile;
  baseRouteAvgPricePerLitre: number;
  litresToRefill: number;
  /** £/hour the driver assigns to their time */
  valueOfTimeGbpPerHour: number;
}
