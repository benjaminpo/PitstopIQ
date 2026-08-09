import { describe, expect, it } from "vitest";
import { applyConfirmedStationPrices, type ConfirmedStationMatch } from "./stationPriceMatches";
import type { FuelStation } from "./types";

const station: FuelStation = {
  id: "station-1",
  name: "Test Station",
  brand: "Test",
  postcode: "AB1 2CD",
  location: { lat: 52, lng: -1 },
  prices: { E10: 1.35, B7_Diesel: 1.42 },
  pricesUpdatedAt: { E10: 100, B7_Diesel: 100 },
  pricesLastUpdatedAt: 100,
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

function match(
  sourcePrices: ConfirmedStationMatch["sourcePrices"],
  confirmedAt: number
): ConfirmedStationMatch {
  return {
    id: String(confirmedAt),
    officialStationId: station.id,
    officialStationName: station.name,
    sourceStationId: `manual:${station.id}`,
    sourceStationName: station.name,
    sourcePostcode: station.postcode!,
    sourcePrices,
    officialPrices: station.prices,
    matchScore: 100,
    confirmedBy: "admin",
    confirmedAt,
  };
}

describe("applyConfirmedStationPrices", () => {
  it("overrides supplied grades and preserves other official prices", () => {
    const [updated] = applyConfirmedStationPrices(
      [station],
      [match({ E10: 1.399 }, 200)]
    );
    expect(updated.prices).toEqual({ E10: 1.399, B7_Diesel: 1.42 });
    expect(updated.pricesUpdatedAt).toEqual({ E10: 200, B7_Diesel: 100 });
    expect(updated.pricesLastUpdatedAt).toBe(200);
  });

  it("uses the newest confirmed record for a station", () => {
    const [updated] = applyConfirmedStationPrices(
      [station],
      [match({ E10: 1.39 }, 300), match({ E10: 1.38 }, 200)]
    );
    expect(updated.prices.E10).toBe(1.39);
  });
});
