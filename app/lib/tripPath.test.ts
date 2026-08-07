import { describe, expect, it } from "vitest";
import {
  insertPointOnNearestSegment,
  tripViaCoords,
  tripWaypointCoords,
} from "./tripPath";
import type { TripStop } from "./types";

const origin = { lat: 51.45, lng: -0.97 };
const mid = { lat: 51.5, lng: -0.7 };
const dest = { lat: 51.47, lng: -0.45 };
const nearMid = { lat: 51.51, lng: -0.71 };

describe("tripWaypointCoords / tripViaCoords", () => {
  it("returns null without both ends", () => {
    expect(tripWaypointCoords(null, [], dest)).toBeNull();
    expect(tripWaypointCoords(origin, [], null)).toBeNull();
  });

  it("includes only resolved intermediate stops", () => {
    const stops: TripStop[] = [
      { id: "1", label: "A", coords: mid },
      { id: "2", label: "B", coords: null },
    ];
    expect(tripWaypointCoords(origin, stops, dest)).toEqual([
      origin,
      mid,
      dest,
    ]);
    expect(tripViaCoords(stops)).toEqual([mid]);
  });
});

describe("insertPointOnNearestSegment", () => {
  it("inserts onto the closest path segment", () => {
    const path = [origin, mid, dest];
    const result = insertPointOnNearestSegment(path, nearMid);
    expect(result).toHaveLength(4);
    // nearMid is closest to the origin→mid segment, so it lands before mid
    expect(result[0]).toEqual(origin);
    expect(result[1]).toEqual(nearMid);
    expect(result[2]).toEqual(mid);
    expect(result[3]).toEqual(dest);
  });

  it("handles a two-point path", () => {
    expect(insertPointOnNearestSegment([origin, dest], mid)).toEqual([
      origin,
      mid,
      dest,
    ]);
  });
});
