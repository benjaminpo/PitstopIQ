import type { FuelType, MapBounds } from "./types";

/** Default map bounds around west London / M4 corridor */
export const DEFAULT_BOUNDS: MapBounds = {
  north: 51.55,
  south: 51.4,
  east: -0.35,
  west: -0.75,
};

/** Approximate UK bounding box for national station lists */
export const UK_BOUNDS: MapBounds = {
  north: 61,
  south: 49,
  east: 2.5,
  west: -9,
};

/** Sensible default base-route average (£/L) before live prices load */
export const DEFAULT_BASE_ROUTE_AVG_PRICE = 1.55;

/** Fuel grades users can report / select for pump prices */
export const ALL_FUEL_TYPES: readonly FuelType[] = [
  "E10",
  "E5",
  "B7_Diesel",
  "B7_Premium",
  "HVO",
];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  E10: "E10 Petrol",
  E5: "E5 Petrol",
  B7_Diesel: "Diesel",
  B7_Premium: "Premium Diesel",
  HVO: "HVO",
};

/** Petrol / diesel / HVO for vehicle / presets (not pump grade). */
export type VehicleFuelKind = "petrol" | "diesel" | "hvo";

export function vehicleFuelKind(fuel: FuelType): VehicleFuelKind {
  if (fuel === "HVO") return "hvo";
  if (fuel === "B7_Diesel" || fuel === "B7_Premium") return "diesel";
  return "petrol";
}

export function vehicleFuelLabel(fuel: FuelType): string {
  const kind = vehicleFuelKind(fuel);
  if (kind === "diesel") return "Diesel";
  if (kind === "hvo") return "HVO";
  return "Petrol";
}

/** Pump grades shown for a vehicle fuel family. */
export function fuelGradesForKind(
  kind: VehicleFuelKind
): readonly FuelType[] {
  if (kind === "diesel") return ["B7_Diesel", "B7_Premium"];
  if (kind === "hvo") return ["HVO"];
  return ["E10", "E5"];
}

export function fuelGradesForVehicle(
  fuel: FuelType
): readonly FuelType[] {
  return fuelGradesForKind(vehicleFuelKind(fuel));
}

/** Compact labels for station list price rows */
export const FUEL_TYPE_SHORT: Record<FuelType, string> = {
  E10: "E10",
  E5: "E5",
  B7_Diesel: "Diesel",
  B7_Premium: "Premium",
  HVO: "HVO",
};

/** Vehicle preset fuel choices — petrol, diesel, or HVO. */
export const VEHICLE_FUEL_OPTIONS: readonly {
  value: FuelType;
  label: string;
  kind: VehicleFuelKind;
}[] = [
  { value: "E10", label: "Petrol", kind: "petrol" },
  { value: "B7_Diesel", label: "Diesel", kind: "diesel" },
  { value: "HVO", label: "HVO", kind: "hvo" },
];
