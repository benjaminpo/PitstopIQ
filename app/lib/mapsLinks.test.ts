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

  it("builds Apple Maps driving directions", () => {
    const url = appleMapsNavigateUrl({
      location,
      origin: { lat: 51.5, lng: -1.0 },
    });
    expect(url).toContain("https://maps.apple.com/?");
    expect(url).toContain("daddr=51.45%2C-0.97");
    expect(url).toContain("saddr=51.5%2C-1");
    expect(url).toContain("dirflg=d");
  });
});
