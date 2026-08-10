import { describe, expect, it } from "vitest";
import type { FuelStation } from "./types";
import {
  filterStationsDirectory,
  paginateStationsDirectory,
  sortStationsDirectory,
  stationMatchesDirectoryQuery,
  stationNearbySearchHref,
} from "./stationsDirectory";

function station(
  partial: Partial<FuelStation> & Pick<FuelStation, "id" | "name">
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

describe("stationMatchesDirectoryQuery", () => {
  it("matches name, brand, postcode, and address", () => {
    const s = station({
      id: "1",
      name: "Shell Bridge Street",
      brand: "Shell",
      postcode: "NP4 6JT",
      address: "Lower Bridge Street, Pontypool",
    });
    expect(stationMatchesDirectoryQuery(s, "bridge")).toBe(true);
    expect(stationMatchesDirectoryQuery(s, "np4")).toBe(true);
    expect(stationMatchesDirectoryQuery(s, "pontypool")).toBe(true);
    expect(stationMatchesDirectoryQuery(s, "tesco")).toBe(false);
    expect(stationMatchesDirectoryQuery(s, "")).toBe(true);
  });
});

describe("filterStationsDirectory", () => {
  const stations = [
    station({
      id: "shell",
      name: "Shell Open",
      brand: "Shell",
      prices: { E10: 1.4 },
      pricesUpdatedAt: { E10: Date.parse("2026-08-09T12:00:00Z") },
      amenities: ["customer_toilets", "car_wash"],
      openingHours: {
        usualDays: {
          sunday: { open: "00:00", close: "00:00", is24Hours: true },
        },
      },
    }),
    station({
      id: "tesco",
      name: "Tesco Extra",
      brand: "Tesco",
      prices: { E10: 1.35, B7_Diesel: 1.42 },
      pricesUpdatedAt: { E10: Date.parse("2026-08-01T12:00:00Z") },
      amenities: ["customer_toilets", "water_filling"],
      openingHours: {
        usualDays: {
          sunday: { open: "00:00", close: "00:00", is24Hours: false },
        },
      },
    }),
    station({
      id: "moto",
      name: "Moto Services",
      brand: "Moto",
      prices: { B7_Diesel: 1.5 },
      amenities: ["car_wash"],
    }),
  ];

  it("applies brand, fuel, freshness, open-now, and amenity filters", () => {
    const now = new Date("2026-08-09T18:00:00Z"); // Sunday evening London
    const filtered = filterStationsDirectory(
      stations,
      {
        query: "",
        brandFilter: "supermarket",
        excludedBrands: [],
        fuelType: "E10",
        priceFreshnessFilter: "any",
        openNowFilter: false,
        amenityFilter: [],
        requireSelectedFuel: true,
      },
      now
    );
    expect(filtered.map((s) => s.id)).toEqual(["tesco"]);

    const openNow = filterStationsDirectory(
      stations,
      {
        query: "",
        brandFilter: "all",
        excludedBrands: [],
        fuelType: "E10",
        priceFreshnessFilter: "any",
        openNowFilter: true,
        amenityFilter: [],
        requireSelectedFuel: false,
      },
      now
    );
    expect(openNow.map((s) => s.id)).toEqual(["shell"]);

    const fresh = filterStationsDirectory(
      stations,
      {
        query: "",
        brandFilter: "all",
        excludedBrands: [],
        fuelType: "E10",
        priceFreshnessFilter: "24h",
        openNowFilter: false,
        amenityFilter: [],
        requireSelectedFuel: false,
      },
      now
    );
    expect(fresh.map((s) => s.id)).toEqual(["shell"]);

    const withToiletsAndWash = filterStationsDirectory(
      stations,
      {
        query: "",
        brandFilter: "all",
        excludedBrands: [],
        fuelType: "E10",
        priceFreshnessFilter: "any",
        openNowFilter: false,
        amenityFilter: ["customer_toilets", "car_wash"],
        requireSelectedFuel: false,
      },
      now
    );
    expect(withToiletsAndWash.map((s) => s.id)).toEqual(["shell"]);
  });
});

describe("sortStationsDirectory", () => {
  it("sorts by price with missing prices last", () => {
    const stations = [
      station({ id: "b", name: "B", prices: { E10: 1.5 } }),
      station({ id: "a", name: "A", prices: { E10: 1.3 } }),
      station({ id: "c", name: "C", prices: {} }),
    ];
    expect(
      sortStationsDirectory(stations, "price", "asc", "E10").map((s) => s.id)
    ).toEqual(["a", "b", "c"]);
  });
});

describe("paginateStationsDirectory", () => {
  it("clamps the page and slices items", () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    expect(paginateStationsDirectory(items, 2, 50)).toEqual({
      page: 2,
      pageCount: 3,
      items: items.slice(50, 100),
    });
    expect(paginateStationsDirectory(items, 99, 50).page).toBe(3);
  });
});

describe("stationNearbySearchHref", () => {
  it("builds a same-origin nearby search URL", () => {
    const href = stationNearbySearchHref(
      station({
        id: "1",
        name: "Shell Bridge",
        location: { lat: 51.51234, lng: -0.12345 },
      })
    );
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("from")).toBe("51.51234,-0.12345");
    expect(params.get("to")).toBe("51.51234,-0.12345");
    expect(params.get("fromLabel")).toBe("Shell Bridge");
  });
});
