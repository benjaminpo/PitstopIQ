import { describe, expect, it } from "vitest";
import { parseMissingStationBody } from "./missingStationReports";

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
});
