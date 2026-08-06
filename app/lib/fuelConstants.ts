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

/** Fuel grades users can report / select for pump prices */
export const ALL_FUEL_TYPES: readonly FuelType[] = [
  "E10",
  "E5",
  "B7_Diesel",
  "B7_Premium",
];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  E10: "E10 Petrol",
  E5: "E5 Petrol",
  B7_Diesel: "Diesel",
  B7_Premium: "Premium Diesel",
};

/** Petrol vs diesel for vehicle / presets (not pump grade). */
export type VehicleFuelKind = "petrol" | "diesel";

export function vehicleFuelKind(fuel: FuelType): VehicleFuelKind {
  return fuel === "B7_Diesel" || fuel === "B7_Premium" ? "diesel" : "petrol";
}

export function vehicleFuelLabel(fuel: FuelType): string {
  return vehicleFuelKind(fuel) === "diesel" ? "Diesel" : "Petrol";
}

/** Standard + premium pump grades for a vehicle fuel family. */
export function fuelGradesForKind(
  kind: VehicleFuelKind
): readonly [FuelType, FuelType] {
  return kind === "diesel"
    ? ["B7_Diesel", "B7_Premium"]
    : ["E10", "E5"];
}

export function fuelGradesForVehicle(
  fuel: FuelType
): readonly [FuelType, FuelType] {
  return fuelGradesForKind(vehicleFuelKind(fuel));
}

/** Compact labels for station list price rows */
export const FUEL_TYPE_SHORT: Record<FuelType, string> = {
  E10: "E10",
  E5: "E5",
  B7_Diesel: "Diesel",
  B7_Premium: "Premium",
};

/** Vehicle preset fuel choices — petrol (E10) or diesel (B7). */
export const VEHICLE_FUEL_OPTIONS: readonly {
  value: FuelType;
  label: string;
  kind: VehicleFuelKind;
}[] = [
  { value: "E10", label: "Petrol", kind: "petrol" },
  { value: "B7_Diesel", label: "Diesel", kind: "diesel" },
];
