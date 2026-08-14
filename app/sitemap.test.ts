import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import sitemap from "@/app/sitemap";
import type { FuelStation } from "@/app/lib/types";

vi.mock("@/app/lib/fuelApiAdapter", () => ({
  fetchAllFuelStations: vi.fn(),
  FuelDataUnavailableError: class FuelDataUnavailableError extends Error {},
}));

vi.mock("@/app/lib/stationAdminOverrides", () => ({
  applyStationAdminOverrides: vi.fn((stations: FuelStation[]) => stations),
  listStationAdminOverrides: vi.fn(),
}));

const station: FuelStation = {
  id: "ff-1",
  name: "Shell Reading",
  brand: "Shell",
  postcode: "RG1 1AA",
  location: { lat: 51.45, lng: -0.97 },
  prices: { E10: 1.4 },
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

const mockedFetch = vi.mocked(fetchAllFuelStations);
const mockedOverrides = vi.mocked(listStationAdminOverrides);
const mockedApply = vi.mocked(applyStationAdminOverrides);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApply.mockImplementation((stations) => stations);
  mockedOverrides.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("includes home, directory, locations, brands, and station URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pitstopiq.example");
    mockedFetch.mockResolvedValue({
      stations: [station],
      pricesFetchedAt: Date.parse("2026-08-01T12:00:00Z"),
      source: "live",
    });

    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      "https://pitstopiq.example",
      "https://pitstopiq.example/stations",
      "https://pitstopiq.example/locations",
      "https://pitstopiq.example/brands",
      "https://pitstopiq.example/privacy",
      "https://pitstopiq.example/terms",
      "https://pitstopiq.example/cookies",
      "https://pitstopiq.example/locations/rg",
      "https://pitstopiq.example/brands/shell",
      "https://pitstopiq.example/stations/ff-1-shell-reading",
    ]);
    expect(entries[9]?.changeFrequency).toBe("hourly");
  });

  it("still returns core pages when fuel data is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pitstopiq.example");
    mockedFetch.mockRejectedValue(new FuelDataUnavailableError("offline"));

    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      "https://pitstopiq.example",
      "https://pitstopiq.example/stations",
      "https://pitstopiq.example/locations",
      "https://pitstopiq.example/brands",
      "https://pitstopiq.example/privacy",
      "https://pitstopiq.example/terms",
      "https://pitstopiq.example/cookies",
    ]);
  });

  it("warns and continues when admin overrides fail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pitstopiq.example");
    mockedFetch.mockResolvedValue({
      stations: [station],
      pricesFetchedAt: null,
      source: "mock",
    });
    mockedOverrides.mockRejectedValue(new Error("db down"));

    const entries = await sitemap();
    expect(entries).toHaveLength(10);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns on unexpected fetch errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pitstopiq.example");
    mockedFetch.mockRejectedValue(new Error("network"));

    const entries = await sitemap();
    expect(entries).toHaveLength(7);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
