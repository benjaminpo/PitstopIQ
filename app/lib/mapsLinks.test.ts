import { describe, expect, it } from "vitest";
import { appleMapsNavigateUrl, googleMapsNavigateUrl } from "./mapsLinks";

describe("mapsLinks", () => {
  const location = { lat: 51.45, lng: -0.97 };

  it("builds Google Maps driving directions", () => {
    const url = googleMapsNavigateUrl({ location });
    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("destination=51.45%2C-0.97");
    expect(url).toContain("travelmode=driving");
    expect(url).not.toContain("origin=");
  });

  it("includes origin when provided", () => {
    const url = googleMapsNavigateUrl({
      location,
      origin: { lat: 51.5, lng: -1.0 },
    });
    expect(url).toContain("origin=51.5%2C-1");
  });

  it("builds Apple Maps driving directions with optional label", () => {
    const url = appleMapsNavigateUrl({
      location,
      name: "Tesco Extra",
      origin: { lat: 51.5, lng: -1.0 },
    });
    expect(url.startsWith("https://maps.apple.com/directions?")).toBe(true);
    expect(url).toContain("destination=51.45%2C-0.97");
    expect(url).toContain("mode=driving");
    expect(url).toContain("name=Tesco");
    expect(url).toContain("source=51.5%2C-1");
  });

  it("omits name and source when not provided", () => {
    const url = appleMapsNavigateUrl({ location });
    expect(url).toContain("destination=51.45%2C-0.97");
    expect(url).not.toContain("name=");
    expect(url).not.toContain("source=");
  });
});
