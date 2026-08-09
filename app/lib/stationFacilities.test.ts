import { describe, expect, it } from "vitest";
import {
  findNearbyStations,
  formatAmenityLabel,
  formatOpeningHoursRows,
  parseAmenities,
  parseOpeningTimes,
} from "./stationFacilities";
import type { StationWithCalculation } from "./types";

describe("parseAmenities", () => {
  it("normalises and dedupes amenity ids", () => {
    expect(
      parseAmenities(["Car_Wash", "car_wash", "customer_toilets", 12, ""])
    ).toEqual(["car_wash", "customer_toilets"]);
  });

  it("returns empty for non-arrays", () => {
    expect(parseAmenities(null)).toEqual([]);
    expect(parseAmenities("car_wash")).toEqual([]);
  });
});

describe("parseOpeningTimes", () => {
  it("parses usual days and bank holiday hours", () => {
    const hours = parseOpeningTimes({
      usual_days: {
        monday: { open: "06:00:00", close: "22:00:00", is_24_hours: false },
        tuesday: { open: "00:00:00", close: "00:00:00", is_24_hours: true },
      },
      bank_holiday: {
        type: "bank holiday",
        open_time: "08:00:00",
        close_time: "20:00:00",
        is_24_hours: false,
      },
    });

    expect(hours).toEqual({
      usualDays: {
        monday: { open: "06:00", close: "22:00", is24Hours: false },
        tuesday: { open: "00:00", close: "00:00", is24Hours: true },
      },
      bankHoliday: { open: "08:00", close: "20:00", is24Hours: false },
    });
  });

  it("returns null when nothing usable is present", () => {
    expect(parseOpeningTimes({})).toBeNull();
    expect(parseOpeningTimes(null)).toBeNull();
  });
});

describe("formatOpeningHoursRows", () => {
  it("groups consecutive identical days", () => {
    const weekday = { open: "06:00", close: "22:00", is24Hours: false };
    const weekend = { open: "07:00", close: "21:00", is24Hours: false };
    const rows = formatOpeningHoursRows({
      usualDays: {
        monday: weekday,
        tuesday: weekday,
        wednesday: weekday,
        thursday: weekday,
        friday: weekday,
        saturday: weekend,
        sunday: weekend,
      },
      bankHoliday: { open: "00:00", close: "00:00", is24Hours: true },
    });

    expect(rows).toEqual([
      { label: "Mon–Fri", value: "06:00–22:00" },
      { label: "Sat–Sun", value: "07:00–21:00" },
      { label: "Bank hol", value: "Open 24 hours" },
    ]);
  });
});

describe("formatAmenityLabel", () => {
  it("uses known labels and title-cases unknowns", () => {
    expect(formatAmenityLabel("car_wash")).toBe("Car wash");
    expect(formatAmenityLabel("ev_chargers")).toBe("Ev Chargers");
  });
});

describe("findNearbyStations", () => {
  function item(
    id: string,
    lat: number,
    lng: number
  ): StationWithCalculation {
    return {
      station: {
        id,
        name: id,
        brand: "Test",
        location: { lat, lng },
        prices: { E10: 1.4 },
        distanceOffRouteMiles: 0,
        detourExtraSeconds: 0,
      },
      calculation: {
        litresPerMile: 0,
        detourLitresConsumed: 0,
        detourFuelCost: 0,
        litresToRefill: 0,
        grossSavings: 0,
        netFinancialSaving: 0,
        detourExtraMinutes: 0,
        timeCostGbp: 0,
        netAfterTime: 0,
        status: "neutral",
      },
      pricePerLitre: 1.4,
    };
  }

  it("returns closest stations within the radius", () => {
    // ~0.7 mi north, ~2.1 mi north, ~5 mi east
    const origin = { lat: 51.5, lng: -0.1 };
    const nearby = findNearbyStations(
      origin,
      [
        item("near", 51.51, -0.1),
        item("mid", 51.53, -0.1),
        item("far", 51.5, 0.0),
        item("self", 51.5, -0.1),
      ],
      { excludeId: "self", maxMiles: 3, limit: 4 }
    );

    expect(nearby.map((n) => n.item.station.id)).toEqual(["near", "mid"]);
    expect(nearby[0].miles).toBeLessThan(nearby[1].miles);
  });
});
