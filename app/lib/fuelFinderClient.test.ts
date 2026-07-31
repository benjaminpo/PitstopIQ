import { describe, expect, it } from "vitest";
import {
  parsePriceLastUpdated,
  parsePriceToGbpPerLitre,
} from "./fuelFinderClient";

describe("parsePriceLastUpdated", () => {
  it("parses ISO 8601 timestamps", () => {
    expect(parsePriceLastUpdated("2026-07-30T09:15:00Z")).toBe(
      Date.UTC(2026, 6, 30, 9, 15, 0)
    );
    expect(parsePriceLastUpdated("2026-07-30T09:15:00+00:00")).toBe(
      Date.UTC(2026, 6, 30, 9, 15, 0)
    );
  });

  it("parses legacy CMA dd/MM/yyyy HH:mm:ss timestamps as UTC", () => {
    expect(parsePriceLastUpdated("30/07/2026 09:15:00")).toBe(
      Date.UTC(2026, 6, 30, 9, 15, 0)
    );
    expect(parsePriceLastUpdated("30/07/2026 09:15")).toBe(
      Date.UTC(2026, 6, 30, 9, 15, 0)
    );
  });

  it("returns undefined for missing or malformed values", () => {
    expect(parsePriceLastUpdated(null)).toBeUndefined();
    expect(parsePriceLastUpdated(undefined)).toBeUndefined();
    expect(parsePriceLastUpdated("")).toBeUndefined();
    expect(parsePriceLastUpdated("   ")).toBeUndefined();
    expect(parsePriceLastUpdated("not a date")).toBeUndefined();
  });
});

describe("parsePriceToGbpPerLitre", () => {
  it("converts pence to pounds and passes pounds through", () => {
    expect(parsePriceToGbpPerLitre("132.9")).toBe(1.329);
    expect(parsePriceToGbpPerLitre(1.329)).toBe(1.329);
  });

  it("rejects missing or non-positive values", () => {
    expect(parsePriceToGbpPerLitre(null)).toBeUndefined();
    expect(parsePriceToGbpPerLitre("")).toBeUndefined();
    expect(parsePriceToGbpPerLitre(-1)).toBeUndefined();
  });
});
