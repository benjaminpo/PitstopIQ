import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE_AVOID,
  hasRouteAvoid,
  normalizeRouteAvoid,
  osrmExcludeClasses,
  parseRouteAvoidParam,
  routeAvoidEqual,
  serializeRouteAvoid,
} from "./routeAvoid";

describe("routeAvoid", () => {
  it("normalizes partial patches", () => {
    expect(normalizeRouteAvoid({ motorways: true })).toEqual({
      motorways: true,
      tolls: false,
      ferries: false,
    });
  });

  it("serializes and parses share tokens", () => {
    const avoid = { motorways: true, tolls: true, ferries: false };
    expect(serializeRouteAvoid(avoid)).toBe("motorway,toll");
    expect(parseRouteAvoidParam("motorway,toll")).toEqual(avoid);
    expect(parseRouteAvoidParam("MOTORWAYS,ferries")).toEqual({
      motorways: true,
      tolls: false,
      ferries: true,
    });
  });

  it("returns undefined for empty avoid params", () => {
    expect(parseRouteAvoidParam(null)).toBeUndefined();
    expect(parseRouteAvoidParam("")).toBeUndefined();
  });

  it("maps OSRM exclude classes and equality", () => {
    expect(osrmExcludeClasses(DEFAULT_ROUTE_AVOID)).toEqual([]);
    expect(
      osrmExcludeClasses({ motorways: true, tolls: false, ferries: true })
    ).toEqual(["motorway", "ferry"]);
    expect(hasRouteAvoid(DEFAULT_ROUTE_AVOID)).toBe(false);
    expect(
      routeAvoidEqual(DEFAULT_ROUTE_AVOID, { ...DEFAULT_ROUTE_AVOID })
    ).toBe(true);
  });
});
