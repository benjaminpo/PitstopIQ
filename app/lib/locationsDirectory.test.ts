import { describe, expect, it } from "vitest";
import {
  locationAreaHref,
  postcodeArea,
  postcodeAreaLabel,
  postcodeOutcode,
} from "./postcodeAreas";
import {
  buildLocationAreaDetail,
  buildLocationAreaSummaries,
  groupLocationAreasByLetter,
  townFromAddress,
} from "./locationsDirectory";
import type { FuelStation } from "./types";

function station(
  partial: Partial<FuelStation> & Pick<FuelStation, "id" | "name" | "postcode">
): FuelStation {
  return {
    brand: "Shell",
    location: { lat: 51.5, lng: -0.1 },
    prices: { E10: 1.45 },
    distanceOffRouteMiles: 0,
    detourExtraSeconds: 0,
    ...partial,
  };
}

describe("postcode helpers", () => {
  it("parses area and outcode", () => {
    expect(postcodeArea("SM2 6SX")).toBe("SM");
    expect(postcodeOutcode("SM2 6SX")).toBe("SM2");
    expect(postcodeArea("ec1a1bb")).toBe("EC");
    expect(postcodeOutcode("EC1A 1BB")).toBe("EC1A");
    expect(postcodeArea(null)).toBeNull();
    expect(postcodeAreaLabel("SM")).toBe("Sutton");
    expect(locationAreaHref("SM")).toBe("/locations/sm");
  });
});

describe("locationsDirectory", () => {
  const stations = [
    station({
      id: "a",
      name: "Shell Carshalton",
      postcode: "SM5 2AA",
      address: "High Street, Carshalton",
      prices: { E10: 1.42, B7_Diesel: 1.5 },
      location: { lat: 51.36, lng: -0.16 },
    }),
    station({
      id: "b",
      name: "Tesco Sutton",
      postcode: "SM1 1AA",
      address: "St Nicholas Way, Sutton",
      prices: { E10: 1.39 },
      location: { lat: 51.36, lng: -0.19 },
    }),
    station({
      id: "c",
      name: "BP Reading",
      postcode: "RG1 8EQ",
      address: "Vastern Road, Reading",
      prices: { E10: 1.41 },
      location: { lat: 51.45, lng: -0.97 },
    }),
  ];

  it("extracts town from address", () => {
    expect(townFromAddress("High Street, Carshalton")).toBe("Carshalton");
    expect(townFromAddress("Only street")).toBeNull();
  });

  it("summarises areas with cheapest price", () => {
    const summaries = buildLocationAreaSummaries(stations);
    expect(summaries.map((s) => s.area).sort()).toEqual(["RG", "SM"]);
    const sm = summaries.find((s) => s.area === "SM");
    expect(sm?.stationCount).toBe(2);
    expect(sm?.cheapestPrice).toBe(1.39);
    expect(sm?.label).toBe("Sutton");
    expect(sm?.href).toBe("/locations/sm");
  });

  it("builds area detail sorted by fuel price", () => {
    const detail = buildLocationAreaDetail(stations, "sm");
    expect(detail?.stationCount).toBe(2);
    expect(detail?.stations.map((row) => row.station.id)).toEqual(["b", "a"]);
    expect(detail?.cheapestByFuel.E10).toBe(1.39);
    expect(detail?.averageByFuel.E10).toBe(1.405);
    expect(detail?.nearbySearchHref).toContain("from=");
  });

  it("groups summaries alphabetically", () => {
    const groups = groupLocationAreasByLetter(
      buildLocationAreaSummaries(stations)
    );
    expect(groups.map((g) => g.letter)).toEqual(["R", "S"]);
  });
});
