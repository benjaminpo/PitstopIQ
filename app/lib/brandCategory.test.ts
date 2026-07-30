import { describe, expect, it } from "vitest";
import {
  classifyStationBrands,
  stationMatchesBrandFilter,
} from "./brandCategory";

describe("classifyStationBrands", () => {
  it("detects supermarket brands", () => {
    expect(
      classifyStationBrands({ brand: "Tesco", name: "Tesco Extra Slough" })
    ).toEqual({ supermarket: true, motorway: false, premium: false });

    expect(
      classifyStationBrands({ brand: "Asda", name: "Asda Bracknell" })
    ).toMatchObject({ supermarket: true, premium: false });
  });

  it("detects motorway service operators", () => {
    expect(
      classifyStationBrands({
        brand: "Moto",
        name: "Moto Reading Services M4",
      })
    ).toMatchObject({ motorway: true });

    expect(
      classifyStationBrands({
        brand: "Welcome Break",
        name: "Welcome Break Fleet",
      })
    ).toMatchObject({ motorway: true });
  });

  it("detects premium oil majors and excludes supermarket overlap", () => {
    expect(
      classifyStationBrands({ brand: "Shell", name: "Shell Reading West" })
    ).toEqual({ supermarket: false, motorway: false, premium: true });

    // Supermarket wins over premium classification
    expect(
      classifyStationBrands({
        brand: "Tesco",
        name: "Tesco Express Shell brand site",
      })
    ).toMatchObject({ supermarket: true, premium: false });
  });

  it("can mark Shell at an MSA as both motorway and premium", () => {
    const cats = classifyStationBrands({
      brand: "Shell",
      name: "Shell at Moto Warwick MSA",
    });
    expect(cats.motorway).toBe(true);
    expect(cats.premium).toBe(true);
    expect(cats.supermarket).toBe(false);
  });
});

describe("stationMatchesBrandFilter", () => {
  const tesco = { brand: "Tesco", name: "Tesco Extra" };
  const shell = { brand: "Shell", name: "Shell Select" };
  const moto = { brand: "Moto", name: "Moto Services" };

  it("passes everything for all", () => {
    expect(stationMatchesBrandFilter(tesco, "all")).toBe(true);
    expect(stationMatchesBrandFilter(shell, "all")).toBe(true);
  });

  it("filters by category", () => {
    expect(stationMatchesBrandFilter(tesco, "supermarket")).toBe(true);
    expect(stationMatchesBrandFilter(shell, "supermarket")).toBe(false);
    expect(stationMatchesBrandFilter(shell, "premium")).toBe(true);
    expect(stationMatchesBrandFilter(moto, "motorway")).toBe(true);
    expect(stationMatchesBrandFilter(tesco, "motorway")).toBe(false);
  });
});
