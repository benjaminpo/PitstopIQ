import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  applyConfirmedStationPrices,
  confirmStationMatch,
  invalidateConfirmedStationMatchesCache,
  listConfirmedStationMatches,
  type ConfirmedStationMatch,
} from "./stationPriceMatches";
import type { FuelStation } from "./types";

vi.mock("@/app/lib/db", () => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  ensureBigintEpochColumns: vi.fn(),
}));

const mockedAll = vi.mocked(dbAll);
const mockedGet = vi.mocked(dbGet);
const mockedRun = vi.mocked(dbRun);
const mockedBigint = vi.mocked(ensureBigintEpochColumns);

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
    sourceUrl: "https://www.petrolprices.com/stations/test-station/",
    sourceStationName: station.name,
    sourcePostcode: station.postcode!,
    sourcePrices,
    officialPrices: station.prices,
    matchScore: 100,
    confirmedBy: "admin",
    confirmedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateConfirmedStationMatchesCache();
  mockedRun.mockResolvedValue(undefined);
  mockedBigint.mockResolvedValue(undefined);
});

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

  it("skips matches with empty source prices", () => {
    const [updated] = applyConfirmedStationPrices([station], [match({}, 200)]);
    expect(updated).toBe(station);
  });
});

describe("listConfirmedStationMatches / confirmStationMatch", () => {
  it("lists mapped confirmed matches", async () => {
    mockedAll.mockResolvedValue([
      {
        id: "m1",
        official_station_id: station.id,
        official_station_name: station.name,
        source_station_id: "pp-1",
        source_url: "https://example.com",
        source_station_name: "Source",
        source_postcode: "AB1 2CD",
        source_prices_json: JSON.stringify({ E10: 1.3 }),
        official_prices_json: JSON.stringify(station.prices),
        match_score: 90,
        confirmed_by: "admin",
        confirmed_at: "123",
      },
    ]);

    await expect(listConfirmedStationMatches()).resolves.toEqual([
      expect.objectContaining({
        id: "m1",
        officialStationId: station.id,
        sourcePrices: { E10: 1.3 },
        confirmedAt: 123,
      }),
    ]);
  });

  it("inserts a new confirmation", async () => {
    mockedGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: "new-id",
        official_station_id: station.id,
        official_station_name: station.name,
        source_station_id: "pp-1",
        source_url: "https://example.com/s",
        source_station_name: "Source",
        source_postcode: "AB1 2CD",
        source_prices_json: JSON.stringify({ E10: 1.31 }),
        official_prices_json: JSON.stringify(station.prices),
        match_score: 88,
        confirmed_by: "admin",
        confirmed_at: 10,
      });

    const result = await confirmStationMatch({
      source: {
        sourceId: "pp-1",
        sourceUrl: "https://example.com/s",
        name: "Source",
        brand: "Test",
        address: "1 High St",
        postcode: "AB1 2CD",
        lat: 52,
        lng: -1,
        prices: { E10: 1.31 },
        updatedAt: null,
      },
      station,
      score: 88,
      confirmedBy: "admin",
    });
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO station_price_match"),
      expect.any(Array)
    );
    expect(result.id).toBe("new-id");
  });

  it("updates an existing confirmation", async () => {
    mockedGet
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce({
        id: "existing",
        official_station_id: station.id,
        official_station_name: station.name,
        source_station_id: "pp-1",
        source_url: null,
        source_station_name: "Source",
        source_postcode: "AB1 2CD",
        source_prices_json: JSON.stringify({ E10: 1.32 }),
        official_prices_json: JSON.stringify(station.prices),
        match_score: 91,
        confirmed_by: "admin",
        confirmed_at: 11,
      });

    const result = await confirmStationMatch({
      source: {
        sourceId: "pp-1",
        sourceUrl: null,
        name: "Source",
        brand: "Test",
        address: "",
        postcode: "AB1 2CD",
        lat: null,
        lng: null,
        prices: { E10: 1.32 },
        updatedAt: null,
      },
      station,
      score: 91,
      confirmedBy: "admin",
    });
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE station_price_match"),
      expect.any(Array)
    );
    expect(result.id).toBe("existing");
  });

  it("throws when the saved row cannot be read back", async () => {
    mockedGet.mockResolvedValue(undefined);
    await expect(
      confirmStationMatch({
        source: {
          sourceId: "pp-1",
          sourceUrl: null,
          name: "Source",
          brand: "Test",
          address: "",
          postcode: "AB1 2CD",
          lat: null,
          lng: null,
          prices: { E10: 1.3 },
          updatedAt: null,
        },
        station,
        score: 50,
        confirmedBy: "admin",
      })
    ).rejects.toThrow("Confirmed station match was not saved");
  });
});
