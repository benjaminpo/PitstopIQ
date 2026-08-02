import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  getUserRecentPlaces,
  parseReplaceBody,
  replaceUserRecentPlaces,
} from "./recentPlaces";

vi.mock("@/app/lib/db", () => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  ensureBigintEpochColumns: vi.fn(),
}));

const mockedGet = vi.mocked(dbGet);
const mockedRun = vi.mocked(dbRun);
const mockedBigint = vi.mocked(ensureBigintEpochColumns);

const samplePlace = {
  id: "place-1",
  label: "Reading",
  secondary: "Berkshire",
  postcode: "RG1",
  location: { lat: 51.45, lng: -0.97 },
};

describe("parseReplaceBody", () => {
  it("accepts a valid places list", () => {
    const result = parseReplaceBody({ places: [samplePlace] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.places).toHaveLength(1);
      expect(result.value.places[0].label).toBe("Reading");
    }
  });

  it("accepts an empty list", () => {
    const result = parseReplaceBody({ places: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.places).toEqual([]);
  });

  it("rejects non-object bodies", () => {
    expect(parseReplaceBody(null).ok).toBe(false);
    expect(parseReplaceBody("junk").ok).toBe(false);
  });

  it("rejects missing places array", () => {
    const result = parseReplaceBody({});
    expect(result.ok).toBe(false);
  });

  it("rejects more than 8 places", () => {
    const places = Array.from({ length: 9 }, (_, i) => ({
      ...samplePlace,
      id: `p-${i}`,
      location: { lat: 50 + i, lng: 0 },
    }));
    const result = parseReplaceBody({ places });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid place entries", () => {
    const result = parseReplaceBody({
      places: [{ id: "x", label: "", location: { lat: 1, lng: 2 } }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("getUserRecentPlaces / replaceUserRecentPlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBigint.mockResolvedValue(undefined);
    mockedRun.mockResolvedValue(undefined);
  });

  it("returns unsynced empty list when no row exists", async () => {
    mockedGet.mockResolvedValueOnce(undefined);
    const result = await getUserRecentPlaces("user-1");
    expect(result).toEqual({ places: [], synced: false });
  });

  it("returns synced places from JSON", async () => {
    mockedGet.mockResolvedValueOnce({
      places_json: JSON.stringify([samplePlace]),
    });
    const result = await getUserRecentPlaces("user-1");
    expect(result.synced).toBe(true);
    expect(result.places).toHaveLength(1);
    expect(result.places[0].id).toBe("place-1");
  });

  it("inserts on first replace and returns synced data", async () => {
    mockedGet
      .mockResolvedValueOnce(undefined) // existing check
      .mockResolvedValueOnce({ places_json: JSON.stringify([samplePlace]) }); // get after write

    const result = await replaceUserRecentPlaces("user-1", {
      places: [samplePlace],
    });

    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_recent_places"),
      expect.arrayContaining(["user-1"])
    );
    expect(result.synced).toBe(true);
    expect(result.places[0].label).toBe("Reading");
  });

  it("updates existing row on replace", async () => {
    mockedGet
      .mockResolvedValueOnce({ user_id: "user-1" })
      .mockResolvedValueOnce({ places_json: JSON.stringify([]) });

    const result = await replaceUserRecentPlaces("user-1", { places: [] });

    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_recent_places"),
      expect.arrayContaining(["user-1"])
    );
    expect(result).toEqual({ places: [], synced: true });
  });
});
