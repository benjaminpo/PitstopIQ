import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline6";

describe("decodePolyline", () => {
  it("decodes a short precision-6 polyline", () => {
    // Encoded from (38.5, -120.2) → (40.7, -120.95) → (43.252, -126.453)
    // with precision 1e5 in the classic Google sample; for 1e6 we use a
    // round-trip of known points via the inverse algorithm.
    const points = [
      { lat: 51.5, lng: -0.12 },
      { lat: 51.51, lng: -0.13 },
    ];
    const encoded = encodePolyline(points, 1e6);
    const decoded = decodePolyline(encoded, 1e6);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].lat).toBeCloseTo(51.5, 5);
    expect(decoded[0].lng).toBeCloseTo(-0.12, 5);
    expect(decoded[1].lat).toBeCloseTo(51.51, 5);
    expect(decoded[1].lng).toBeCloseTo(-0.13, 5);
  });

  it("returns an empty list for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

/** Minimal encoder for test round-trips (mirrors Google polyline algorithm). */
function encodePolyline(
  points: Array<{ lat: number; lng: number }>,
  precision: number
): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";

  const encodeSigned = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };

  for (const p of points) {
    const lat = Math.round(p.lat * precision);
    const lng = Math.round(p.lng * precision);
    encodeSigned(lat - prevLat);
    encodeSigned(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}
