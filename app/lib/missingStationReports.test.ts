import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  createMissingStationReport,
  parseMissingStationBody,
} from "./missingStationReports";

vi.mock("@/app/lib/db", () => ({
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  ensureBigintEpochColumns: vi.fn(),
}));

const mockedGet = vi.mocked(dbGet);
const mockedRun = vi.mocked(dbRun);
const mockedBigint = vi.mocked(ensureBigintEpochColumns);

beforeEach(() => {
  vi.clearAllMocks();
  mockedRun.mockResolvedValue(undefined);
  mockedBigint.mockResolvedValue(undefined);
});

describe("parseMissingStationBody", () => {
  it("requires name and coordinates", () => {
    expect(parseMissingStationBody({})).toEqual({
      ok: false,
      error: "Station name is required",
    });
    expect(
      parseMissingStationBody({ name: "Tesco", lat: "x", lng: 0 })
    ).toEqual({ ok: false, error: "Location is required" });
  });

  it("accepts a valid report", () => {
    const parsed = parseMissingStationBody({
      name: "  Local Garage  ",
      brand: "Independent",
      address: "1 High St",
      notes: "Open 24h",
      lat: 51.45,
      lng: -0.97,
      placeLabel: "Reading, UK",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.name).toBe("Local Garage");
    expect(parsed.value.brand).toBe("Independent");
    expect(parsed.value.lat).toBe(51.45);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      parseMissingStationBody({ name: "X", lat: 100, lng: 0 })
    ).toEqual({ ok: false, error: "Invalid coordinates" });
  });

  it("rejects malformed payloads and normalises optional fields", () => {
    expect(parseMissingStationBody(null)).toEqual({
      ok: false,
      error: "Invalid payload",
    });
    expect(parseMissingStationBody([])).toEqual({
      ok: false,
      error: "Invalid payload",
    });

    const parsed = parseMissingStationBody({
      name: "Station",
      brand: "   ",
      address: 123,
      notes: " note ",
      lat: "51.5",
      lng: "-0.12",
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Station",
        brand: null,
        address: null,
        notes: "note",
        lat: 51.5,
        lng: -0.12,
        placeLabel: null,
      },
    });
  });
});

describe("createMissingStationReport", () => {
  it("initialises storage and inserts a normalised row", async () => {
    mockedGet.mockResolvedValueOnce(undefined);

    const row = await createMissingStationReport("user-1", {
      name: "Local Garage",
      lat: 51.5,
      lng: -0.12,
    });

    expect(mockedBigint).toHaveBeenCalledWith("missing_station_report", [
      "created_at",
    ]);
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO missing_station_report"),
      expect.arrayContaining([
        row.id,
        "user-1",
        "Local Garage",
        null,
        null,
        null,
        51.5,
        -0.12,
        null,
        row.created_at,
      ])
    );
    expect(row).toMatchObject({
      user_id: "user-1",
      name: "Local Garage",
      brand: null,
      address: null,
      notes: null,
      place_label: null,
    });
  });

  it("rate-limits reports submitted too close together", async () => {
    mockedGet.mockResolvedValueOnce({ created_at: Date.now() - 1_000 });

    await expect(
      createMissingStationReport("user-1", {
        name: "Another Garage",
        lat: 51.5,
        lng: -0.12,
      })
    ).rejects.toThrow("Please wait a moment");

    expect(mockedRun).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO missing_station_report"),
      expect.any(Array)
    );
  });
});
