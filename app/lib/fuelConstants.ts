import type { FuelType, MapBounds } from "./types";

/** Default map bounds around west London / M4 corridor */
export const DEFAULT_BOUNDS: MapBounds = {
  north: 51.55,
  south: 51.4,
  east: -0.35,
  west: -0.75,
};

/** Sensible default base-route average (£/L) before live prices load */
export const DEFAULT_BASE_ROUTE_AVG_PRICE = 1.55;

/** Fuel grades users can report / select */
export const ALL_FUEL_TYPES: readonly FuelType[] = ["E10", "E5", "B7_Diesel"];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  E10: "E10 Petrol",
  E5: "E5 Petrol",
  B7_Diesel: "B7 Diesel",
};
