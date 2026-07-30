import { describe, expect, it } from "vitest";
import {
  approximateDetourSeconds,
  downsampleRoute,
  filterToRouteCorridor,
  haversineMiles,
  milesFromOriginToStation,
  nearestOnRoute,
} from "./routing";
import type { GeoPoint } from "./types";

const origin: GeoPoint = { lat: 51.45, lng: -1.0 };
const mid: GeoPoint = { lat: 51.46, lng: -0.7 };
const dest: GeoPoint = { lat: 51.47, lng: -0.4 };
const route: GeoPoint[] = [origin, mid, dest];

describe("downsampleRoute", () => {
  it("returns the original route when already short enough", () => {
    expect(downsampleRoute(route, 250)).toBe(route);
  });

  it("keeps endpoints and stays in bounds", () => {
    const dense: GeoPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      lat: 51 + i / 10000,
      lng: -1 + i / 5000,
    }));
    const out = downsampleRoute(dense, 250);
    expect(out).toHaveLength(250);
    expect(out[0]).toEqual(dense[0]);
    expect(out[out.length - 1]).toEqual(dense[dense.length - 1]);
    for (const p of out) {
      expect(dense).toContainEqual(p);
    }
  });

  it("handles maxPoints < 2", () => {
    expect(downsampleRoute(route, 1)).toEqual([route[0]]);
  });
});

describe("nearestOnRoute / milesFromOriginToStation", () => {
  it("places a point on the start vertex at along=0", () => {
    const near = nearestOnRoute(origin, route);
    expect(near.alongRouteMiles).toBeCloseTo(0, 3);
    expect(near.distToRoute).toBeCloseTo(0, 3);
  });

  it("estimates station reach as along-route + spur", () => {
    const offRoute: GeoPoint = { lat: mid.lat + 0.02, lng: mid.lng };
    const miles = milesFromOriginToStation(offRoute, route, origin);
    const nearest = nearestOnRoute(offRoute, route);
    expect(miles).toBeCloseTo(
      nearest.alongRouteMiles + nearest.distToRoute,
      5
    );
    expect(miles).toBeGreaterThan(haversineMiles(origin, mid) * 0.5);
  });
});

describe("filterToRouteCorridor", () => {
  it("keeps near-route stations and drops far ones", () => {
    const near = { id: "near", location: { lat: mid.lat + 0.005, lng: mid.lng } };
    const far = { id: "far", location: { lat: mid.lat + 0.2, lng: mid.lng } };
    const kept = filterToRouteCorridor([near, far], route, 3);
    expect(kept.map((k) => k.station.id)).toEqual(["near"]);
  });
});

describe("approximateDetourSeconds", () => {
  it("returns 0 for non-positive miles", () => {
    expect(approximateDetourSeconds(0)).toBe(0);
    expect(approximateDetourSeconds(-1)).toBe(0);
  });

  it("uses route average speed when available", () => {
    // 70 miles in 1 hour → 70 mph; 7 extra miles → 0.1 h = 360 s
    const seconds = approximateDetourSeconds(7, {
      distanceMiles: 70,
      durationSeconds: 3600,
    });
    expect(seconds).toBe(360);
  });
});
