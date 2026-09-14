import { describe, expect, it } from "vitest";
import {
  officialFuelUpdatedAt,
  resolveStationFuelPrice,
} from "./stationPrice";
import type { FuelStation, StationCommunitySummary } from "./types";

const station: FuelStation = {
  id: "station-1",
  name: "Test Station",
  brand: "Test",
  location: { lat: 52, lng: -1 },
  prices: { E10: 1.35, B7_Diesel: 1.42 },
  pricesUpdatedAt: { E10: 200, B7_Diesel: 100 },
  pricesLastUpdatedAt: 200,
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

function community(
  prices: StationCommunitySummary["communityPrices"],
  updatedAt: StationCommunitySummary["communityPriceUpdatedAt"]
): StationCommunitySummary {
  return {
    stationId: station.id,
    avgRating: null,
    ratingCount: 0,
    commentCount: 0,
    communityPrices: prices,
    communityPriceUpdatedAt: updatedAt,
    recentComments: [],
  };
}

describe("officialFuelUpdatedAt", () => {
  it("prefers the per-grade timestamp", () => {
    expect(officialFuelUpdatedAt(station, "E10")).toBe(200);
    expect(officialFuelUpdatedAt(station, "B7_Diesel")).toBe(100);
  });

  it("falls back to the station's latest update", () => {
    expect(officialFuelUpdatedAt({ pricesLastUpdatedAt: 50 }, "E10")).toBe(50);
    expect(officialFuelUpdatedAt({}, "E10")).toBeNull();
  });
});

describe("resolveStationFuelPrice", () => {
  it("uses the Fuel Finder price when no member report exists", () => {
    expect(resolveStationFuelPrice(station, null, "E10")).toEqual({
      price: 1.35,
      fromCommunity: false,
      updatedAt: 200,
    });
  });

  it("uses the member report when it is newer than Fuel Finder", () => {
    expect(
      resolveStationFuelPrice(
        station,
        community({ E10: 1.29 }, { E10: 300 }),
        "E10"
      )
    ).toEqual({
      price: 1.29,
      fromCommunity: true,
      updatedAt: 300,
    });
  });

  it("uses the member report when both sources share the same timestamp", () => {
    expect(
      resolveStationFuelPrice(
        station,
        community({ E10: 1.29 }, { E10: 200 }),
        "E10"
      )
    ).toEqual({
      price: 1.29,
      fromCommunity: true,
      updatedAt: 200,
    });
  });

  it("uses Fuel Finder when the government API is more recently updated", () => {
    expect(
      resolveStationFuelPrice(
        station,
        community({ E10: 1.29 }, { E10: 150 }),
        "E10"
      )
    ).toEqual({
      price: 1.35,
      fromCommunity: false,
      updatedAt: 200,
    });
  });

  it("keeps the member report when Fuel Finder has no update time", () => {
    const undated: FuelStation = {
      ...station,
      pricesUpdatedAt: undefined,
      pricesLastUpdatedAt: null,
    };
    expect(
      resolveStationFuelPrice(
        undated,
        community({ E10: 1.29 }, { E10: 150 }),
        "E10"
      )
    ).toEqual({
      price: 1.29,
      fromCommunity: true,
      updatedAt: 150,
    });
  });

  it("uses Fuel Finder when the member report has no timestamp", () => {
    expect(
      resolveStationFuelPrice(
        station,
        community({ E10: 1.29 }, {}),
        "E10"
      )
    ).toEqual({
      price: 1.35,
      fromCommunity: false,
      updatedAt: 200,
    });
  });

  it("uses the member report when Fuel Finder has no price for that grade", () => {
    expect(
      resolveStationFuelPrice(
        station,
        community({ E5: 1.49 }, { E5: 50 }),
        "E5"
      )
    ).toEqual({
      price: 1.49,
      fromCommunity: true,
      updatedAt: 50,
    });
  });
});
