import { describe, expect, it } from "vitest";
import {
  BASEMAP_ATTRIBUTION,
  MAP_MAX_ZOOM,
  OPENFREEMAP_DARK_STYLE,
  PLANNER_BASEMAP_ATTRIBUTION,
} from "./mapTiles";

describe("mapTiles", () => {
  it("uses OpenFreeMap dark vector tiles (no CARTO raster watermark)", () => {
    expect(OPENFREEMAP_DARK_STYLE).toBe(
      "https://tiles.openfreemap.org/styles/dark"
    );
    expect(OPENFREEMAP_DARK_STYLE).not.toMatch(/cartocdn|dark_all/);
  });

  it("credits OpenStreetMap and OpenFreeMap", () => {
    expect(BASEMAP_ATTRIBUTION).toContain("openstreetmap.org/copyright");
    expect(BASEMAP_ATTRIBUTION).toContain("openfreemap.org");
    expect(BASEMAP_ATTRIBUTION).not.toContain("carto.com");
  });

  it("adds routing credits on the planner map", () => {
    expect(PLANNER_BASEMAP_ATTRIBUTION).toContain(BASEMAP_ATTRIBUTION);
    expect(PLANNER_BASEMAP_ATTRIBUTION).toContain("project-osrm.org");
    expect(PLANNER_BASEMAP_ATTRIBUTION).toContain("valhalla");
  });

  it("sets a finite max zoom so marker clusters can initialise", () => {
    expect(Number.isFinite(MAP_MAX_ZOOM)).toBe(true);
    expect(MAP_MAX_ZOOM).toBeGreaterThanOrEqual(14);
  });
});
