import { describe, expect, it } from "vitest";
import {
  formatNominatimResult,
  isPostcodeResult,
  type NominatimResult,
} from "./placeSearch";

const postcodeHit: NominatimResult = {
  place_id: 381555054,
  lat: "51.35385",
  lon: "-0.19861",
  name: "SM2 6RG",
  type: "postcode",
  class: "place",
  addresstype: "postcode",
  display_name:
    "SM2 6RG, London Borough of Sutton, Greater London, England, United Kingdom",
  address: {
    postcode: "SM2 6RG",
    city_district: "London Borough of Sutton",
    city: "Greater London",
    state: "England",
    country: "United Kingdom",
  },
};

describe("isPostcodeResult", () => {
  it("detects postcode centroid hits", () => {
    expect(isPostcodeResult(postcodeHit)).toBe(true);
  });

  it("rejects road hits", () => {
    expect(
      isPostcodeResult({ ...postcodeHit, type: "residential", addresstype: "road" })
    ).toBe(false);
  });
});

describe("formatNominatimResult for postcodes", () => {
  it("shows the street and locality when the address is enriched", () => {
    const enriched: NominatimResult = {
      ...postcodeHit,
      address: {
        ...postcodeHit.address,
        road: "Chanctonbury Gardens",
        suburb: "Carshalton Beeches",
      },
    };

    const suggestion = formatNominatimResult(enriched);
    expect(suggestion.label).toBe("Chanctonbury Gardens");
    expect(suggestion.postcode).toBe("SM2 6RG");
    // Borough prefix is stripped, matching Google Maps style ("Sutton")
    expect(suggestion.secondary).toContain("Carshalton Beeches");
    expect(suggestion.secondary).toContain("Sutton");
    expect(suggestion.secondary).not.toContain("London Borough of");
  });

  it("falls back to the postcode as label when no street is available", () => {
    const suggestion = formatNominatimResult(postcodeHit);
    expect(suggestion.label).toBe("SM2 6RG");
    expect(suggestion.secondary).toContain("Sutton");
  });
});
