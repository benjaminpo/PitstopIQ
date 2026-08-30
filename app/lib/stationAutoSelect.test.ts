import { describe, expect, it } from "vitest";
import {
  shouldAutoSelectBestStation,
  tripStationsKey,
} from "./stationAutoSelect";

const origin = { lat: 51.35385, lng: -0.19861 };
const destination = { lat: 51.29606, lng: -0.3337 };

describe("tripStationsKey", () => {
  it("changes when an end of the trip moves", () => {
    const vias = [{ lat: 51.32, lng: -0.25 }];
    const a = tripStationsKey(origin, destination, vias);
    const b = tripStationsKey(origin, { lat: 51.3, lng: -0.4 }, vias);
    expect(a).not.toBe(b);
  });
});

describe("shouldAutoSelectBestStation", () => {
  const sameTripDefaults = {
    silent: false,
    isNewTrip: false,
    nearbySearch: false,
    priceFreshnessFilter: "any" as const,
    openNowFilter: false,
  };

  it("does not auto-select on a quiet or same-trip price refresh", () => {
    expect(
      shouldAutoSelectBestStation({ ...sameTripDefaults, silent: true })
    ).toBe(false);
    expect(shouldAutoSelectBestStation(sameTripDefaults)).toBe(false);
  });

  it("auto-selects once for a new trip so share URLs open the best station", () => {
    expect(
      shouldAutoSelectBestStation({ ...sameTripDefaults, isNewTrip: true })
    ).toBe(true);
  });

  it("auto-selects nearby searches and when freshness or open-now filters are on", () => {
    expect(
      shouldAutoSelectBestStation({ ...sameTripDefaults, nearbySearch: true })
    ).toBe(true);
    expect(
      shouldAutoSelectBestStation({
        ...sameTripDefaults,
        priceFreshnessFilter: "24h",
      })
    ).toBe(true);
    expect(
      shouldAutoSelectBestStation({ ...sameTripDefaults, openNowFilter: true })
    ).toBe(true);
  });
});
