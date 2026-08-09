import { describe, expect, it } from "vitest";
import {
  ALL_FUEL_TYPES,
  DEFAULT_BASE_ROUTE_AVG_PRICE,
  DEFAULT_BOUNDS,
  FUEL_TYPE_LABELS,
  VEHICLE_FUEL_OPTIONS,
  fuelGradesForVehicle,
  vehicleFuelKind,
  vehicleFuelLabel,
} from "./fuelConstants";

describe("fuelConstants", () => {
  it("exposes default map bounds and route price", () => {
    expect(DEFAULT_BOUNDS.north).toBeGreaterThan(DEFAULT_BOUNDS.south);
    expect(DEFAULT_BOUNDS.east).toBeGreaterThan(DEFAULT_BOUNDS.west);
    expect(DEFAULT_BASE_ROUTE_AVG_PRICE).toBeGreaterThan(1);
  });

  it("lists the UK grades with labels", () => {
    expect(ALL_FUEL_TYPES).toEqual([
      "E10",
      "E5",
      "B7_Diesel",
      "B7_Premium",
      "HVO",
    ]);
    expect(FUEL_TYPE_LABELS.E10).toMatch(/E10/);
    expect(FUEL_TYPE_LABELS.E5).toMatch(/E5/);
    expect(FUEL_TYPE_LABELS.B7_Diesel).toMatch(/Diesel/);
    expect(FUEL_TYPE_LABELS.B7_Premium).toMatch(/Premium Diesel/);
    expect(FUEL_TYPE_LABELS.HVO).toBe("HVO");
  });

  it("maps vehicle fuel to petrol, diesel, or HVO", () => {
    expect(VEHICLE_FUEL_OPTIONS.map((o) => o.label)).toEqual([
      "Petrol",
      "Diesel",
      "HVO",
    ]);
    expect(vehicleFuelKind("E10")).toBe("petrol");
    expect(vehicleFuelKind("E5")).toBe("petrol");
    expect(vehicleFuelKind("B7_Diesel")).toBe("diesel");
    expect(vehicleFuelKind("B7_Premium")).toBe("diesel");
    expect(vehicleFuelKind("HVO")).toBe("hvo");
    expect(vehicleFuelLabel("E5")).toBe("Petrol");
    expect(vehicleFuelLabel("B7_Premium")).toBe("Diesel");
    expect(vehicleFuelLabel("HVO")).toBe("HVO");
  });

  it("returns pump grades for a vehicle fuel family", () => {
    expect(fuelGradesForVehicle("E10")).toEqual(["E10", "E5"]);
    expect(fuelGradesForVehicle("E5")).toEqual(["E10", "E5"]);
    expect(fuelGradesForVehicle("B7_Diesel")).toEqual([
      "B7_Diesel",
      "B7_Premium",
    ]);
    expect(fuelGradesForVehicle("B7_Premium")).toEqual([
      "B7_Diesel",
      "B7_Premium",
    ]);
    expect(fuelGradesForVehicle("HVO")).toEqual(["HVO"]);
  });
});
