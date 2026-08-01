import { describe, expect, it } from "vitest";
import { parseUpsertBody } from "./stationContributions";

describe("parseUpsertBody", () => {
  it("accepts a full contribution", () => {
    const result = parseUpsertBody({
      stationId: "mock-tesco-slough",
      fuelType: "E10",
      pricePerLitre: 1.349,
      rating: 4,
      comment: "Busy but cheap",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pricePerLitre).toBe(1.349);
      expect(result.value.rating).toBe(4);
      expect(result.value.comment).toBe("Busy but cheap");
    }
  });

  it("accepts rating-only", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "B7_Diesel",
      rating: 5,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects empty payloads", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "E10",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range prices", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "E10",
      pricePerLitre: 0.1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid ratings", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "E10",
      rating: 6,
    });
    expect(result.ok).toBe(false);
  });

  it("rounds price to 3dp", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "E5",
      pricePerLitre: 1.3496,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pricePerLitre).toBe(1.35);
  });
});
