import { describe, expect, it } from "vitest";
import {
  classifyStationBrands,
  distinctBrandOptions,
  sanitizeExcludedBrands,
  stationBrandKey,
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

describe("stationBrandKey", () => {
  it("normalizes the brand for stable grouping", () => {
    expect(stationBrandKey({ brand: "Costco", name: "Costco Reading" })).toBe(
      "costco"
    );
    expect(
      stationBrandKey({ brand: "  COSTCO  ", name: "Costco Croydon" })
    ).toBe("costco");
  });

  it("collapses known-network variants onto one key", () => {
    expect(stationBrandKey({ brand: "BP", name: "BP Reading" })).toBe("bp");
    expect(
      stationBrandKey({
        brand: "BP - ROYAL BLUE SERVICE STATION",
        name: "Royal Blue",
      })
    ).toBe("bp");
    expect(
      stationBrandKey({ brand: "Bp Addington", name: "Bp Addington" })
    ).toBe("bp");
    expect(
      stationBrandKey({ brand: "Shell Select", name: "Shell Reading" })
    ).toBe("shell");
  });

  it("falls back to the trading name when brand is blank", () => {
    expect(stationBrandKey({ brand: "", name: "Village Garage" })).toBe(
      "village garage"
    );
    expect(stationBrandKey({ brand: " ", name: "" })).toBe("unknown");
  });
});

describe("distinctBrandOptions", () => {
  it("dedupes case-insensitively, counts stations, sorts by label", () => {
    const options = distinctBrandOptions([
      { brand: "Tesco", name: "Tesco Extra" },
      { brand: "COSTCO", name: "Costco Reading" },
      { brand: "Costco", name: "Costco Croydon" },
      { brand: "Shell", name: "Shell Select" },
    ]);
    expect(options.map((o) => o.key)).toEqual(["costco", "shell", "tesco"]);
    expect(options[0]).toMatchObject({ label: "Costco", count: 2 });
    expect(options[2]).toMatchObject({ label: "Tesco", count: 1 });
  });

  it("groups Fuel Finder brand_name variants under the canonical label", () => {
    const options = distinctBrandOptions([
      { brand: "BP", name: "BP Reading" },
      { brand: "BP - ROYAL BLUE SERVICE STATION", name: "Royal Blue" },
      { brand: "Bp Addington", name: "Bp Addington" },
      { brand: "Esso", name: "Esso Express" },
      { brand: "ESSO - HIGH STREET", name: "High Street" },
    ]);
    expect(options).toEqual([
      { key: "bp", label: "BP", count: 3 },
      { key: "esso", label: "Esso", count: 2 },
    ]);
  });
});

describe("sanitizeExcludedBrands", () => {
  it("keeps only unique lowercase non-empty strings", () => {
    expect(
      sanitizeExcludedBrands(["Costco", "costco", "  ", 42, "Shell"])
    ).toEqual(["costco", "shell"]);
  });

  it("returns empty for non-arrays", () => {
    expect(sanitizeExcludedBrands(undefined)).toEqual([]);
    expect(sanitizeExcludedBrands("costco")).toEqual([]);
  });
});
