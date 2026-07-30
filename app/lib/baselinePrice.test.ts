import { describe, expect, it } from "vitest";
import { computeBaselineRoutePrice } from "./baselinePrice";
import type { FuelStation } from "./types";

function station(
  id: string,
  detour: number,
  e10: number
): FuelStation {
  return {
    id,
    name: id,
    brand: "Test",
    location: { lat: 51.4, lng: -0.5 },
    prices: { E10: e10 },
    distanceOffRouteMiles: detour,
    detourExtraSeconds: 0,
  };
}

describe("computeBaselineRoutePrice", () => {
  it("uses the median of on-corridor stations when enough exist", () => {
    const stations = [
      station("a", 0.5, 1.3),
      station("b", 1.0, 1.4),
      station("c", 1.5, 1.5),
      station("far", 10, 1.1), // excluded from on-route pool
    ];
    // on-route (≤2 mi): 1.3, 1.4, 1.5 → median 1.4
    expect(computeBaselineRoutePrice(stations, "E10")).toBe(1.4);
  });

  it("falls back to all stations when fewer than 3 on-route", () => {
    const stations = [
      station("a", 0.5, 1.2),
      station("b", 0.8, 1.4),
      station("far", 9, 1.6),
    ];
    // only 2 on-route → all three: 1.2, 1.4, 1.6 → median 1.4
    expect(computeBaselineRoutePrice(stations, "E10")).toBe(1.4);
  });

  it("returns null when no prices for the fuel type", () => {
    const stations = [station("a", 0.5, 1.3)];
    stations[0].prices = { E5: 1.5 };
    expect(computeBaselineRoutePrice(stations, "E10")).toBeNull();
  });
});
