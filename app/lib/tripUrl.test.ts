import { describe, expect, it } from "vitest";
import {
  buildTripSearchParams,
  parseTripSearchParams,
  tripFieldsEqual,
  tripToShareUrl,
  type TripSnapshot,
} from "./tripUrl";

const sample: TripSnapshot = {
  origin: "Reading, UK",
  destination: "Heathrow Airport, UK",
  originCoords: { lat: 51.4543, lng: -0.9781 },
  destinationCoords: { lat: 51.47, lng: -0.4543 },
  vehicle: {
    fuelType: "E10",
    mpg: 45,
    tankCapacityLitres: 55,
    fillPercentage: 25,
  },
  litresToRefill: 40,
  valueOfTimeGbpPerHour: 12,
  basePriceManual: false,
};

describe("trip URL round-trip", () => {
  it("serializes and parses core trip fields", () => {
    const params = buildTripSearchParams(sample);
    const parsed = parseTripSearchParams(`?${params.toString()}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.originCoords?.lat).toBeCloseTo(51.4543, 4);
    expect(parsed!.destinationCoords?.lng).toBeCloseTo(-0.4543, 4);
    expect(parsed!.origin).toBe("Reading, UK");
    expect(parsed!.vehicle?.fuelType).toBe("E10");
    expect(parsed!.vehicle?.mpg).toBe(45);
    expect(parsed!.litresToRefill).toBe(40);
    expect(parsed!.valueOfTimeGbpPerHour).toBe(12);
  });

  it("includes manual base price when set", () => {
    const withBase: TripSnapshot = {
      ...sample,
      basePriceManual: true,
      baseRouteAvgPricePerLitre: 1.349,
    };
    const parsed = parseTripSearchParams(
      `?${buildTripSearchParams(withBase).toString()}`
    );
    expect(parsed?.basePriceManual).toBe(true);
    expect(parsed?.baseRouteAvgPricePerLitre).toBeCloseTo(1.349, 3);
  });

  it("returns null for an empty query", () => {
    expect(parseTripSearchParams("")).toBeNull();
    expect(parseTripSearchParams("?")).toBeNull();
  });

  it("rejects invalid coordinates", () => {
    const parsed = parseTripSearchParams("?from=999,0&to=51.4,-0.4&mpg=40");
    // invalid from dropped; to + mpg still hydrate
    expect(parsed?.originCoords).toBeUndefined();
    expect(parsed?.destinationCoords).toEqual({ lat: 51.4, lng: -0.4 });
    expect(parsed?.vehicle?.mpg).toBe(40);
  });

  it("synthesizes labels from coordinates when omitted", () => {
    const parsed = parseTripSearchParams("?from=51.45,-0.97&to=51.47,-0.45");
    expect(parsed?.origin).toContain("51.4500");
    expect(parsed?.destination).toContain("51.4700");
  });
});

describe("tripFieldsEqual / tripToShareUrl", () => {
  it("detects equal snapshots", () => {
    expect(tripFieldsEqual(sample, { ...sample })).toBe(true);
    expect(
      tripFieldsEqual(sample, {
        ...sample,
        vehicle: { ...sample.vehicle, mpg: 50 },
      })
    ).toBe(false);
    expect(
      tripFieldsEqual(
        { ...sample, basePriceManual: true, baseRouteAvgPricePerLitre: 1.3 },
        { ...sample, basePriceManual: true, baseRouteAvgPricePerLitre: 1.4 }
      )
    ).toBe(false);
  });

  it("builds an absolute share URL", () => {
    const url = tripToShareUrl(sample, "https://pitstopiq.example/");
    expect(url.startsWith("https://pitstopiq.example/?")).toBe(true);
    expect(url).toContain("fuel=E10");
    expect(url).toContain("from=");
  });
});
