import { describe, expect, it } from "vitest";
import {
  formatPriceAge,
  freshnessTone,
  stationPriceAgeTitle,
  stationPriceTone,
} from "./freshness";

describe("formatPriceAge", () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);

  it("formats relative ages", () => {
    expect(formatPriceAge(now - 30_000, now)).toBe("just now");
    expect(formatPriceAge(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatPriceAge(now - 90 * 60_000, now)).toBe("1h 30m ago");
    expect(formatPriceAge(now - 2 * 60 * 60_000, now)).toBe("2h ago");
    expect(formatPriceAge(now - 26 * 60 * 60_000, now)).toBe("1d ago");
  });
});

describe("freshnessTone", () => {
  const now = 1_000_000_000_000;

  it("labels mock and unknown sources", () => {
    expect(freshnessTone("mock", null, now)).toBe("mock");
    expect(freshnessTone(null, null, now)).toBe("unknown");
    expect(freshnessTone("live", null, now)).toBe("unknown");
  });

  it("bands live ages", () => {
    expect(freshnessTone("live", now - 10 * 60_000, now)).toBe("fresh");
    expect(freshnessTone("live", now - 40 * 60_000, now)).toBe("aging");
    expect(freshnessTone("live", now - 55 * 60_000, now)).toBe("stale");
  });
});

describe("stationPriceTone", () => {
  const now = 1_000_000_000_000;
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it("is unknown when the station never reported an update time", () => {
    expect(stationPriceTone(null, now)).toBe("unknown");
    expect(stationPriceTone(undefined, now)).toBe("unknown");
  });

  it("bands report age at day/week scale", () => {
    expect(stationPriceTone(now - 2 * HOUR, now)).toBe("fresh");
    expect(stationPriceTone(now - 23 * HOUR, now)).toBe("fresh");
    expect(stationPriceTone(now - 2 * DAY, now)).toBe("aging");
    expect(stationPriceTone(now - 6 * DAY, now)).toBe("aging");
    expect(stationPriceTone(now - 8 * DAY, now)).toBe("stale");
    expect(stationPriceTone(now - 60 * DAY, now)).toBe("stale");
  });
});

describe("stationPriceAgeTitle", () => {
  const reportedAt = Date.UTC(2026, 6, 30, 12, 0, 0);

  it("warns when no update time was reported", () => {
    expect(stationPriceAgeTitle(null, "unknown")).toContain(
      "has not reported"
    );
    expect(stationPriceAgeTitle(undefined, "unknown")).toContain(
      "treat the price with caution"
    );
  });

  it("includes the report timestamp and tone-specific caveats", () => {
    expect(stationPriceAgeTitle(reportedAt, "fresh")).toMatch(
      /^Price last reported .+/
    );
    expect(stationPriceAgeTitle(reportedAt, "aging")).toContain(
      "more than a day old"
    );
    expect(stationPriceAgeTitle(reportedAt, "stale")).toContain(
      "over a week old"
    );
  });
});
