import { describe, expect, it } from "vitest";
import {
  GeolocationError,
  boundsAround,
  formatCoords,
  getBrowserPosition,
} from "./geolocation";

describe("formatCoords", () => {
  it("formats lat/lng to 5dp", () => {
    expect(formatCoords({ lat: 51.5074, lng: -0.1278 })).toBe(
      "51.50740, -0.12780"
    );
  });
});

describe("boundsAround", () => {
  it("builds a box with the default delta", () => {
    const box = boundsAround({ lat: 51.5, lng: -0.1 });
    expect(box.north).toBeCloseTo(51.62);
    expect(box.south).toBeCloseTo(51.38);
    expect(box.east).toBeCloseTo(0.02);
    expect(box.west).toBeCloseTo(-0.22);
  });

  it("accepts a custom delta", () => {
    expect(boundsAround({ lat: 10, lng: 20 }, 1)).toEqual({
      north: 11,
      south: 9,
      east: 21,
      west: 19,
    });
  });
});

describe("getBrowserPosition", () => {
  it("rejects when geolocation is unavailable", async () => {
    await expect(getBrowserPosition()).rejects.toBeInstanceOf(GeolocationError);
    await expect(getBrowserPosition()).rejects.toThrow(/not supported/i);
  });
});
