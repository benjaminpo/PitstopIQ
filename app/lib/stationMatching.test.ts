import { describe, expect, it } from "vitest";
import {
  parsePetrolPricesFile,
  suggestStationMatches,
} from "./stationMatching";
import type { FuelStation } from "./types";

const official: FuelStation = {
  id: "ff-1",
  name: "Tesco Extra Slough",
  brand: "Tesco",
  address: "Wellington Street, Slough",
  postcode: "SL1 1XW",
  location: { lat: 51.51, lng: -0.59 },
  prices: { E10: 1.329, B7_Diesel: 1.389 },
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

describe("parsePetrolPricesFile", () => {
  it("accepts common CSV headings and converts pence to pounds", () => {
    const csv = [
      "station_id,station_name,brand,postcode,unleaded,diesel,updated_at",
      'pp-1,"Tesco Slough",Tesco,SL1 1XW,132.9,138.9,2026-08-09',
    ].join("\n");
    expect(parsePetrolPricesFile(csv, "prices.csv")).toEqual([
      expect.objectContaining({
        sourceId: "pp-1",
        name: "Tesco Slough",
        postcode: "SL1 1XW",
        prices: { E10: 1.329, B7_Diesel: 1.389 },
      }),
    ]);
  });

  it("accepts a JSON stations envelope", () => {
    const json = JSON.stringify({
      stations: [{ id: "pp-2", name: "Shell Reading", postcode: "RG1 1AA" }],
    });
    expect(parsePetrolPricesFile(json, "prices.json")).toHaveLength(1);
  });

  it("accepts PetrolPrices values above 350 pence", () => {
    const [station] = parsePetrolPricesFile(
      "name,postcode,unleaded\nTest Station,AB1 2CD,366.6",
      "prices.csv"
    );
    expect(station.prices.E10).toBe(3.666);
  });
});

describe("suggestStationMatches", () => {
  it("strongly matches stations sharing postcode and name", () => {
    const [source] = parsePetrolPricesFile(
      "name,brand,postcode,unleaded\nTesco Slough,Tesco,SL1 1XW,132.9",
      "prices.csv"
    );
    const [match] = suggestStationMatches([source], [official]);
    expect(match.station?.id).toBe("ff-1");
    expect(match.score).toBeGreaterThanOrEqual(70);
  });

  it("does not match distant stations without the same postcode", () => {
    const [source] = parsePetrolPricesFile(
      "name,postcode,latitude,longitude\nTesco Slough,AB1 2CD,57.1,-2.1",
      "prices.csv"
    );
    const [match] = suggestStationMatches([source], [official]);
    expect(match.station).toBeNull();
  });
});
