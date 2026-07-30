import { describe, expect, it } from "vitest";
import {
  calculateDetourSavings,
  formatGbp,
  litresPerMile,
  remainingFuelLitres,
  remainingRangeMiles,
  resolveLitresToRefill,
  UK_GALLON_TO_LITRES,
} from "./detourCalculator";
import type { VehicleProfile } from "./types";

const vehicle: VehicleProfile = {
  fuelType: "E10",
  mpg: 45,
  tankCapacityLitres: 55,
  fillPercentage: 25,
};

describe("litresPerMile", () => {
  it("uses the UK gallon conversion", () => {
    expect(litresPerMile(45)).toBeCloseTo(UK_GALLON_TO_LITRES / 45, 8);
  });

  it("rejects non-positive MPG", () => {
    expect(() => litresPerMile(0)).toThrow(/MPG/i);
    expect(() => litresPerMile(-10)).toThrow(/MPG/i);
  });
});

describe("resolveLitresToRefill", () => {
  it("derives from empty fraction when explicit litres omitted", () => {
    // 25% full → 75% empty × 55 L = 41.25
    expect(resolveLitresToRefill(55, 25)).toBeCloseTo(41.25, 5);
  });

  it("prefers explicit litres", () => {
    expect(resolveLitresToRefill(55, 25, 20)).toBe(20);
  });
});

describe("remainingRangeMiles", () => {
  it("scales with fill percentage and MPG", () => {
    const full = remainingRangeMiles({
      mpg: 45,
      tankCapacityLitres: 55,
      fillPercentage: 100,
    });
    const half = remainingRangeMiles({
      mpg: 45,
      tankCapacityLitres: 55,
      fillPercentage: 50,
    });
    expect(full).toBeGreaterThan(half);
    expect(half).toBeCloseTo(full / 2, 5);
  });

  it("is zero when the tank is empty", () => {
    expect(
      remainingRangeMiles({
        mpg: 45,
        tankCapacityLitres: 55,
        fillPercentage: 0,
      })
    ).toBe(0);
  });

  it("applies a 5% reserve by default", () => {
    const litres = remainingFuelLitres({
      tankCapacityLitres: 55,
      fillPercentage: 100,
    });
    const expected = (litres * 0.95) / litresPerMile(45);
    expect(
      remainingRangeMiles({
        mpg: 45,
        tankCapacityLitres: 55,
        fillPercentage: 100,
      })
    ).toBeCloseTo(expected, 8);
  });
});

describe("calculateDetourSavings", () => {
  it("computes fuel-only net and status for a clear win", () => {
    const result = calculateDetourSavings({
      vehicle,
      stationPricePerLitre: 1.3,
      baseRouteAvgPricePerLitre: 1.45,
      distanceOffRouteMiles: 1,
      litresToRefill: 40,
      detourExtraMinutes: 0,
      valueOfTimeGbpPerHour: 0,
    });

    // Gross = 0.15 × 40 = 6
    expect(result.grossSavings).toBeCloseTo(6, 5);
    expect(result.detourFuelCost).toBeCloseTo(
      litresPerMile(45) * 1 * 1.3,
      5
    );
    expect(result.netFinancialSaving).toBeCloseTo(
      result.grossSavings - result.detourFuelCost,
      5
    );
    expect(result.netAfterTime).toBeCloseTo(result.netFinancialSaving, 8);
    expect(result.status).toBe("worth");
  });

  it("subtracts time cost from the decision figure", () => {
    const result = calculateDetourSavings({
      vehicle,
      stationPricePerLitre: 1.3,
      baseRouteAvgPricePerLitre: 1.45,
      distanceOffRouteMiles: 1,
      litresToRefill: 40,
      detourExtraMinutes: 30,
      valueOfTimeGbpPerHour: 12,
    });

    // Time cost = 0.5 h × £12 = £6
    expect(result.timeCostGbp).toBeCloseTo(6, 5);
    expect(result.netAfterTime).toBeCloseTo(
      result.netFinancialSaving - 6,
      5
    );
  });

  it("classifies near-zero nets as neutral", () => {
    const result = calculateDetourSavings({
      vehicle,
      stationPricePerLitre: 1.4,
      baseRouteAvgPricePerLitre: 1.41,
      distanceOffRouteMiles: 0.1,
      litresToRefill: 10,
      valueOfTimeGbpPerHour: 0,
    });
    expect(Math.abs(result.netAfterTime)).toBeLessThanOrEqual(0.5);
    expect(result.status).toBe("neutral");
  });

  it("flags expensive detours as false economy", () => {
    const result = calculateDetourSavings({
      vehicle,
      stationPricePerLitre: 1.5,
      baseRouteAvgPricePerLitre: 1.4,
      distanceOffRouteMiles: 8,
      litresToRefill: 10,
      detourExtraMinutes: 40,
      valueOfTimeGbpPerHour: 20,
    });
    expect(result.netAfterTime).toBeLessThan(-0.5);
    expect(result.status).toBe("false_economy");
  });
});

describe("formatGbp", () => {
  it("formats signed GBP amounts", () => {
    expect(formatGbp(1.5)).toBe("+£1.50");
    expect(formatGbp(-2.25)).toBe("−£2.25");
    expect(formatGbp(0)).toBe("£0.00");
  });
});
