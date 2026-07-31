import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORRIDOR_MAX_DISTANCE_MILES,
  approximateDetourMiles,
  approximateDetourSeconds,
  boundsFromCoordinates,
  corridorPadDegrees,
  downsampleRoute,
  fetchDrivingRoute,
  fetchStationDetours,
  filterToRouteCorridor,
  formatDuration,
  haversineMiles,
  metersToMiles,
  milesFromOriginToStation,
  nearestOnRoute,
} from "./routing";
import type { GeoPoint } from "./types";

const origin: GeoPoint = { lat: 51.45, lng: -1.0 };
const mid: GeoPoint = { lat: 51.46, lng: -0.7 };
const dest: GeoPoint = { lat: 51.47, lng: -0.4 };
const route: GeoPoint[] = [origin, mid, dest];

describe("unit conversions", () => {
  it("converts meters to miles", () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 6);
    expect(metersToMiles(0)).toBe(0);
  });

  it("pads the corridor bbox beyond the corridor half-width", () => {
    const pad = corridorPadDegrees();
    expect(pad).toBeGreaterThan(CORRIDOR_MAX_DISTANCE_MILES / 69);
    expect(corridorPadDegrees(6.9)).toBeCloseTo(0.1 + 0.015, 6);
  });
});

describe("boundsFromCoordinates", () => {
  it("returns a zero box for an empty path", () => {
    expect(boundsFromCoordinates([])).toEqual({
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    });
  });

  it("wraps all points with the given padding", () => {
    const bounds = boundsFromCoordinates(route, 0.1);
    expect(bounds.north).toBeCloseTo(dest.lat + 0.1, 6);
    expect(bounds.south).toBeCloseTo(origin.lat - 0.1, 6);
    expect(bounds.east).toBeCloseTo(dest.lng + 0.1, 6);
    expect(bounds.west).toBeCloseTo(origin.lng - 0.1, 6);
  });

  it("defaults padding to the corridor pad", () => {
    const bounds = boundsFromCoordinates(route);
    expect(bounds.north).toBeCloseTo(dest.lat + corridorPadDegrees(), 6);
  });
});

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

  it("falls back to haversine when the route is too short", () => {
    const station = { lat: 51.5, lng: -0.9 };
    expect(milesFromOriginToStation(station, [origin], origin)).toBeCloseTo(
      haversineMiles(origin, station),
      5
    );
  });

  it("returns Infinity with no route and no origin", () => {
    expect(milesFromOriginToStation(mid, [], null)).toBe(Infinity);
    expect(nearestOnRoute(mid, []).distToRoute).toBe(Infinity);
  });

  it("measures straight-line distance to a single-point route", () => {
    const near = nearestOnRoute(mid, [origin]);
    expect(near.alongRouteMiles).toBe(0);
    expect(near.distToRoute).toBeCloseTo(haversineMiles(mid, origin), 6);
  });
});

describe("filterToRouteCorridor", () => {
  it("keeps near-route stations and drops far ones", () => {
    const near = {
      id: "near",
      location: { lat: mid.lat + 0.005, lng: mid.lng },
    };
    const far = { id: "far", location: { lat: mid.lat + 0.2, lng: mid.lng } };
    const kept = filterToRouteCorridor([near, far], route, 3);
    expect(kept.map((k) => k.station.id)).toEqual(["near"]);
  });
});

describe("approximateDetourMiles / seconds", () => {
  it("approximates detour as twice the perpendicular distance", () => {
    const onRoute = approximateDetourMiles(mid, route);
    expect(onRoute).toBeLessThan(0.5);
    expect(approximateDetourMiles(mid, [])).toBe(0);
  });

  it("returns 0 for non-positive miles", () => {
    expect(approximateDetourSeconds(0)).toBe(0);
    expect(approximateDetourSeconds(-1)).toBe(0);
  });

  it("uses route average speed when available", () => {
    expect(
      approximateDetourSeconds(7, {
        distanceMiles: 70,
        durationSeconds: 3600,
      })
    ).toBe(360);
  });

  it("falls back to 35 mph without route timing", () => {
    expect(approximateDetourSeconds(35)).toBe(3600);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(90)).toBe("2 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(5400)).toBe("1 h 30 min");
  });
});

describe("fetchDrivingRoute / fetchStationDetours", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a successful driving route response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        distanceMiles: 42,
        durationSeconds: 3600,
        coordinates: route,
        bounds: { north: 1, south: 0, east: 1, west: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDrivingRoute(origin, dest);
    expect(result.distanceMiles).toBe(42);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("viaLat");
  });

  it("requests a via waypoint for detour routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        distanceMiles: 48,
        durationSeconds: 4000,
        coordinates: route,
        bounds: { north: 1, south: 0, east: 1, west: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchDrivingRoute(origin, dest, mid);
    expect(String(fetchMock.mock.calls[0][0])).toContain("viaLat=");
    expect(String(fetchMock.mock.calls[0][0])).toContain("viaLng=");
  });

  it("throws when the route API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "No route" }),
      })
    );
    await expect(fetchDrivingRoute(origin, dest)).rejects.toThrow("No route");
  });

  it("returns OSRM detour metrics and supports legacy numeric shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          detours: {
            a: { miles: 2.5, extraSeconds: 180 },
            b: 4,
          },
        }),
      })
    );
    const stations = [
      { id: "a", location: mid },
      { id: "b", location: dest },
    ];
    const detours = await fetchStationDetours(origin, dest, stations, route, {
      distanceMiles: 30,
      durationSeconds: 2400,
    });
    expect(detours.a).toEqual({ miles: 2.5, extraSeconds: 180 });
    expect(detours.b.miles).toBe(4);
    expect(detours.b.extraSeconds).toBeGreaterThan(0);
  });

  it("falls back to approximation when the detours API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const stations = [{ id: "a", location: mid }];
    const detours = await fetchStationDetours(origin, dest, stations, route);
    expect(detours.a.miles).toBeTypeOf("number");
    expect(detours.a.extraSeconds).toBeTypeOf("number");
  });

  it("returns an empty map for no stations", async () => {
    expect(await fetchStationDetours(origin, dest, [], route)).toEqual({});
  });
});
