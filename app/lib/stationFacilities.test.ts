import { describe, expect, it } from "vitest";
import {
  findNearbyStations,
  formatAmenityLabel,
  formatOpeningHoursRows,
  formatPermanentClosureDate,
  distinctAmenityOptions,
  isDayHoursOpenAt,
  isStationOfficiallyClosed,
  isStationOpenNow,
  parseAmenities,
  parseOpeningTimes,
  sanitizeAmenityFilter,
  stationClosureLabel,
  stationHasRequiredAmenities,
} from "./stationFacilities";
import type { StationDayHours, StationWithCalculation } from "./types";

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

describe("isDayHoursOpenAt", () => {
  const daytime: StationDayHours = {
    open: "06:00",
    close: "22:00",
    is24Hours: false,
  };
  const overnight: StationDayHours = {
    open: "22:00",
    close: "06:00",
    is24Hours: false,
  };
  const closed: StationDayHours = {
    open: "00:00",
    close: "00:00",
    is24Hours: false,
  };
  const allDay: StationDayHours = {
    open: "00:00",
    close: "00:00",
    is24Hours: true,
  };

  it("handles daytime, overnight, closed, and 24h windows", () => {
    expect(isDayHoursOpenAt(daytime, 5 * 60 + 59)).toBe(false);
    expect(isDayHoursOpenAt(daytime, 6 * 60)).toBe(true);
    expect(isDayHoursOpenAt(daytime, 21 * 60 + 59)).toBe(true);
    expect(isDayHoursOpenAt(daytime, 22 * 60)).toBe(false);

    expect(isDayHoursOpenAt(overnight, 22 * 60)).toBe(true);
    expect(isDayHoursOpenAt(overnight, 3 * 60)).toBe(true);
    expect(isDayHoursOpenAt(overnight, 6 * 60)).toBe(false);
    expect(isDayHoursOpenAt(overnight, 12 * 60)).toBe(false);

    expect(isDayHoursOpenAt(closed, 12 * 60)).toBe(false);
    expect(isDayHoursOpenAt(allDay, 0)).toBe(true);
    expect(isDayHoursOpenAt(allDay, 23 * 60 + 59)).toBe(true);
  });
});

describe("isStationOpenNow", () => {
  it("uses usual hours for the local weekday", () => {
    const station = {
      openingHours: {
        usualDays: {
          monday: { open: "06:00", close: "22:00", is24Hours: false },
          sunday: { open: "00:00", close: "00:00", is24Hours: false },
        },
      },
    };

    // Monday 2026-08-10 12:00 London
    expect(
      isStationOpenNow(station, new Date("2026-08-10T11:00:00.000Z"))
    ).toBe(true);
    // Sunday 2026-08-09 12:00 London — marked closed
    expect(
      isStationOpenNow(station, new Date("2026-08-09T11:00:00.000Z"))
    ).toBe(false);
    expect(isStationOpenNow({}, new Date("2026-08-10T11:00:00.000Z"))).toBe(
      false
    );
  });

  it("treats official closures as closed even when hours say open", () => {
    const station = {
      openingHours: {
        usualDays: {
          monday: { open: "00:00", close: "00:00", is24Hours: true },
        },
      },
      temporaryClosure: true,
    };
    expect(
      isStationOpenNow(station, new Date("2026-08-10T11:00:00.000Z"))
    ).toBe(false);
  });
});

describe("station closure helpers", () => {
  it("detects temporary and permanent closures", () => {
    expect(isStationOfficiallyClosed({})).toBe(false);
    expect(isStationOfficiallyClosed({ temporaryClosure: true })).toBe(true);
    expect(isStationOfficiallyClosed({ permanentClosure: true })).toBe(true);
    expect(isStationOfficiallyClosed({ permanentClosure: false })).toBe(false);
  });

  it("formats permanent closure dates and labels", () => {
    expect(formatPermanentClosureDate("2026-03-01")).toBe("1 Mar 2026");
    expect(formatPermanentClosureDate(null)).toBeNull();
    expect(stationClosureLabel({ temporaryClosure: true })).toBe(
      "Temporarily closed"
    );
    expect(
      stationClosureLabel({
        permanentClosure: true,
        permanentClosureDate: "2026-03-01",
      })
    ).toBe("Permanently closed · 1 Mar 2026");
    expect(stationClosureLabel({ permanentClosure: true })).toBe(
      "Permanently closed"
    );
    expect(stationClosureLabel({})).toBeNull();
  });
});

describe("formatAmenityLabel", () => {
  it("uses known labels and title-cases unknowns", () => {
    expect(formatAmenityLabel("car_wash")).toBe("Car wash");
    expect(formatAmenityLabel("ev_chargers")).toBe("Ev Chargers");
  });
});

describe("amenity filter helpers", () => {
  it("requires every selected amenity", () => {
    const station = { amenities: ["customer_toilets", "car_wash"] };
    expect(stationHasRequiredAmenities(station, [])).toBe(true);
    expect(stationHasRequiredAmenities(station, ["car_wash"])).toBe(true);
    expect(
      stationHasRequiredAmenities(station, ["customer_toilets", "water_filling"])
    ).toBe(false);
  });

  it("lists distinct amenities with counts", () => {
    const options = distinctAmenityOptions([
      { amenities: ["car_wash", "customer_toilets"] },
      { amenities: ["customer_toilets"] },
      { amenities: undefined },
    ]);
    expect(options.map((o) => o.id)).toEqual([
      "customer_toilets",
      "car_wash",
    ]);
    expect(options[0].count).toBe(2);
    expect(options[1].count).toBe(1);
  });

  it("sanitizes persisted amenity filters", () => {
    expect(sanitizeAmenityFilter([" Car_Wash ", "car_wash", 1, ""])).toEqual([
      "car_wash",
    ]);
    expect(sanitizeAmenityFilter(null)).toEqual([]);
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
