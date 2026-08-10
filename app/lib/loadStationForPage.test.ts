import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFuelStationByPathKey,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import { getCommunitySummaries } from "@/app/lib/stationContributions";
import {
  applyConfirmedStationPrices,
  listConfirmedStationMatches,
} from "@/app/lib/stationPriceMatches";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import { loadStationForPage } from "./loadStationForPage";
import type { FuelStation } from "./types";

vi.mock("@/app/lib/fuelApiAdapter", () => ({
  fetchFuelStationByPathKey: vi.fn(),
  FuelDataUnavailableError: class FuelDataUnavailableError extends Error {},
}));

vi.mock("@/app/lib/stationContributions", () => ({
  getCommunitySummaries: vi.fn(),
}));

vi.mock("@/app/lib/stationPriceMatches", () => ({
  applyConfirmedStationPrices: vi.fn((stations: FuelStation[]) => stations),
  listConfirmedStationMatches: vi.fn(),
}));

vi.mock("@/app/lib/stationAdminOverrides", () => ({
  applyStationAdminOverrides: vi.fn((stations: FuelStation[]) => stations),
  listStationAdminOverrides: vi.fn(),
}));

const station: FuelStation = {
  id: "ff-1",
  name: "Shell Reading",
  brand: "Shell",
  location: { lat: 51.45, lng: -0.97 },
  prices: { E10: 1.4 },
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

const mockedFetch = vi.mocked(fetchFuelStationByPathKey);
const mockedConfirmed = vi.mocked(listConfirmedStationMatches);
const mockedApplyConfirmed = vi.mocked(applyConfirmedStationPrices);
const mockedOverrides = vi.mocked(listStationAdminOverrides);
const mockedApplyOverrides = vi.mocked(applyStationAdminOverrides);
const mockedCommunity = vi.mocked(getCommunitySummaries);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApplyConfirmed.mockImplementation((stations) => stations);
  mockedApplyOverrides.mockImplementation((stations) => stations);
  mockedConfirmed.mockResolvedValue([]);
  mockedOverrides.mockResolvedValue([]);
  mockedCommunity.mockResolvedValue({});
});

describe("loadStationForPage", () => {
  it("returns not_found when the path key is unknown", async () => {
    mockedFetch.mockResolvedValue(null);
    await expect(loadStationForPage("missing")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("loads live station data with overlays and community", async () => {
    mockedFetch.mockResolvedValue({
      station,
      source: "live",
      pricesFetchedAt: 1000,
    });
    mockedCommunity.mockResolvedValue({
      "ff-1": { ratingAvg: 4.5, ratingCount: 2, tipCount: 1 },
    });

    await expect(loadStationForPage("shell-reading")).resolves.toEqual({
      ok: true,
      station,
      source: "live",
      pricesFetchedAt: 1000,
      community: { ratingAvg: 4.5, ratingCount: 2, tipCount: 1 },
    });
  });

  it("tolerates overlay and community failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedFetch.mockResolvedValue({
      station,
      source: "mock",
      pricesFetchedAt: null,
    });
    mockedConfirmed.mockRejectedValue(new Error("db down"));
    mockedOverrides.mockRejectedValue(new Error("db down"));
    mockedCommunity.mockRejectedValue(new Error("db down"));

    await expect(loadStationForPage("shell-reading")).resolves.toEqual({
      ok: true,
      station,
      source: "mock",
      pricesFetchedAt: null,
      community: null,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns unavailable when fuel data cannot be loaded", async () => {
    mockedFetch.mockRejectedValue(new FuelDataUnavailableError("offline"));
    await expect(loadStationForPage("shell-reading")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rethrows unexpected errors", async () => {
    mockedFetch.mockRejectedValue(new Error("boom"));
    await expect(loadStationForPage("shell-reading")).rejects.toThrow("boom");
  });

  it("returns not_found when overlays remove the station", async () => {
    mockedFetch.mockResolvedValue({
      station,
      source: "live",
      pricesFetchedAt: 1,
    });
    mockedApplyOverrides.mockReturnValue([]);
    await expect(loadStationForPage("shell-reading")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
