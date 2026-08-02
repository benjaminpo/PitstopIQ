import { describe, expect, it } from "vitest";
import { parseUpsertBody } from "./stationContributions";

describe("parseUpsertBody", () => {
  it("accepts a price report", () => {
    const result = parseUpsertBody({
      stationId: "mock-tesco-slough",
      kind: "price",
      fuelType: "E10",
      pricePerLitre: 1.349,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("price");
      expect(result.value.pricePerLitre).toBe(1.349);
    }
  });

  it("accepts a review without a price", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "review",
      rating: 5,
      comment: "Friendly staff",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("review");
      expect(result.value.pricePerLitre).toBeUndefined();
      expect(result.value.rating).toBe(5);
    }
  });

  it("accepts rating-only review", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "review",
      rating: 4,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts clearing price or review", () => {
    expect(
      parseUpsertBody({ stationId: "abc", kind: "price", clear: true }).ok
    ).toBe(true);
    expect(
      parseUpsertBody({ stationId: "abc", kind: "review", clear: true }).ok
    ).toBe(true);
  });

  it("rejects review with neither rating nor comment", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "review",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects price without pricePerLitre", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      fuelType: "E10",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing kind", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      fuelType: "E10",
      pricePerLitre: 1.2,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range prices", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      fuelType: "E10",
      pricePerLitre: 0.1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid ratings", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "review",
      rating: 6,
    });
    expect(result.ok).toBe(false);
  });

  it("rounds price to 3dp", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      fuelType: "E5",
      pricePerLitre: 1.3496,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pricePerLitre).toBe(1.35);
  });
});
