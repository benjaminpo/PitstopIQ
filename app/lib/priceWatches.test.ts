import { describe, expect, it } from "vitest";
import {
  parseCreateStationWatchBody,
  shouldFirePriceAlert,
} from "./priceWatches";

describe("shouldFirePriceAlert", () => {
  it("fires when the drop meets the threshold", () => {
    expect(shouldFirePriceAlert(1.45, 1.42, 0.02)).toBe(true);
    expect(shouldFirePriceAlert(1.45, 1.43, 0.02)).toBe(true);
  });

  it("does not fire for smaller drops", () => {
    expect(shouldFirePriceAlert(1.45, 1.44, 0.02)).toBe(false);
    expect(shouldFirePriceAlert(1.45, 1.45, 0.02)).toBe(false);
    expect(shouldFirePriceAlert(1.45, 1.5, 0.02)).toBe(false);
  });

  it("rejects non-finite inputs", () => {
    expect(shouldFirePriceAlert(Number.NaN, 1.4, 0.02)).toBe(false);
    expect(shouldFirePriceAlert(1.45, Number.POSITIVE_INFINITY, 0.02)).toBe(
      false
    );
  });
});

describe("parseCreateStationWatchBody", () => {
  const valid = {
    stationId: "station-1",
    stationName: "Tesco Extra",
    stationBrand: "Tesco",
    fuelType: "E10",
    baselinePrice: 1.399,
  };

  it("accepts a valid station watch", () => {
    const parsed = parseCreateStationWatchBody(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.stationId).toBe("station-1");
      expect(parsed.value.thresholdGbp).toBe(0.02);
      expect(parsed.value.baselinePrice).toBe(1.399);
    }
  });

  it("accepts a custom threshold", () => {
    const parsed = parseCreateStationWatchBody({
      ...valid,
      thresholdGbp: 0.05,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.thresholdGbp).toBe(0.05);
  });

  it("rejects bad fuel types and prices", () => {
    expect(
      parseCreateStationWatchBody({ ...valid, fuelType: "WATER" }).ok
    ).toBe(false);
    expect(
      parseCreateStationWatchBody({ ...valid, baselinePrice: 0.1 }).ok
    ).toBe(false);
    expect(parseCreateStationWatchBody({ ...valid, stationId: "" }).ok).toBe(
      false
    );
  });
});
