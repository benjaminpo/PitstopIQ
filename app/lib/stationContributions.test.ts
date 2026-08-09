import { describe, expect, it } from "vitest";
import { parseUpsertBody } from "./stationContributions";

describe("parseUpsertBody", () => {
  it("accepts a single-grade price report", () => {
    const result = parseUpsertBody({
      stationId: "mock-tesco-slough",
      kind: "price",
      fuelType: "E10",
      pricePerLitre: 1.349,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("price");
      expect(result.value.prices).toEqual({ E10: 1.349 });
    }
  });

  it("accepts multiple fuel grades in one report", () => {
    const result = parseUpsertBody({
      stationId: "mock-tesco-slough",
      kind: "price",
      prices: {
        E10: 1.349,
        E5: 1.449,
        B7_Diesel: 1.399,
        B7_Premium: 1.499,
        HVO: 1.599,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prices).toEqual({
        E10: 1.349,
        E5: 1.449,
        B7_Diesel: 1.399,
        B7_Premium: 1.499,
        HVO: 1.599,
      });
    }
  });

  it("accepts a partial multi-grade price report", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      prices: { E5: 1.5, B7_Diesel: 1.42 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prices).toEqual({ E5: 1.5, B7_Diesel: 1.42 });
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
      expect(result.value.prices).toBeUndefined();
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

  it("accepts clearing all prices or a single grade", () => {
    expect(
      parseUpsertBody({ stationId: "abc", kind: "price", clear: true }).ok
    ).toBe(true);
    const one = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      clear: true,
      fuelType: "E5",
    });
    expect(one.ok).toBe(true);
    if (one.ok) expect(one.value.clearFuelType).toBe("E5");
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

  it("rejects empty prices object", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      prices: {},
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

  it("rejects out-of-range grade inside prices map", () => {
    const result = parseUpsertBody({
      stationId: "abc",
      kind: "price",
      prices: { E10: 0.1 },
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
    if (result.ok) expect(result.value.prices?.E5).toBe(1.35);
  });
});
