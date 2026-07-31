import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOUNDS,
  fetchNearbyFuelStations,
  FuelDataUnavailableError,
} from "./fuelApiAdapter";
import { fetchFuelFinderStations } from "./fuelFinderClient";

vi.mock("./fuelFinderClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fuelFinderClient")>();
  return {
    ...actual,
    isFuelFinderConfigured: () =>
      Boolean(process.env.FUEL_FINDER_CLIENT_ID),
    fetchFuelFinderStations: vi.fn(),
  };
});

const mockedLiveFetch = vi.mocked(fetchFuelFinderStations);

afterEach(() => {
  vi.unstubAllEnvs();
  mockedLiveFetch.mockReset();
});

describe("fetchNearbyFuelStations mock gating", () => {
  it("serves mock stations outside production when unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FUEL_FINDER_CLIENT_ID", "");

    const result = await fetchNearbyFuelStations(DEFAULT_BOUNDS);
    expect(result.source).toBe("mock");
    expect(result.stations.length).toBeGreaterThan(0);
  });

  it("throws in production when unconfigured instead of serving mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FUEL_FINDER_CLIENT_ID", "");
    vi.stubEnv("FUEL_FINDER_ALLOW_MOCKS", "");

    await expect(fetchNearbyFuelStations(DEFAULT_BOUNDS)).rejects.toThrow(
      FuelDataUnavailableError
    );
  });

  it("throws in production when the live fetch fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FUEL_FINDER_CLIENT_ID", "id");
    vi.stubEnv("FUEL_FINDER_ALLOW_MOCKS", "");
    mockedLiveFetch.mockRejectedValue(new Error("token revoked"));

    await expect(fetchNearbyFuelStations(DEFAULT_BOUNDS)).rejects.toThrow(
      FuelDataUnavailableError
    );
  });

  it("returns an honest empty live result instead of mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FUEL_FINDER_CLIENT_ID", "id");
    mockedLiveFetch.mockResolvedValue({
      stations: [],
      pricesFetchedAt: 123,
    });

    const result = await fetchNearbyFuelStations(DEFAULT_BOUNDS);
    expect(result.source).toBe("live");
    expect(result.stations).toEqual([]);
    expect(result.pricesFetchedAt).toBe(123);
  });

  it("allows mocks in production only with the explicit env override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FUEL_FINDER_CLIENT_ID", "");
    vi.stubEnv("FUEL_FINDER_ALLOW_MOCKS", "true");

    const result = await fetchNearbyFuelStations(DEFAULT_BOUNDS);
    expect(result.source).toBe("mock");
  });
});
