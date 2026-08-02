import { describe, expect, it } from "vitest";
import {
  ALL_FUEL_TYPES,
  DEFAULT_BASE_ROUTE_AVG_PRICE,
  DEFAULT_BOUNDS,
  FUEL_TYPE_LABELS,
} from "./fuelConstants";

describe("fuelConstants", () => {
  it("exposes default map bounds and route price", () => {
    expect(DEFAULT_BOUNDS.north).toBeGreaterThan(DEFAULT_BOUNDS.south);
    expect(DEFAULT_BOUNDS.east).toBeGreaterThan(DEFAULT_BOUNDS.west);
    expect(DEFAULT_BASE_ROUTE_AVG_PRICE).toBeGreaterThan(1);
  });

  it("lists the three UK grades with labels", () => {
    expect(ALL_FUEL_TYPES).toEqual(["E10", "E5", "B7_Diesel"]);
    expect(FUEL_TYPE_LABELS.E10).toMatch(/E10/);
    expect(FUEL_TYPE_LABELS.E5).toMatch(/E5/);
    expect(FUEL_TYPE_LABELS.B7_Diesel).toMatch(/Diesel/);
  });
});
