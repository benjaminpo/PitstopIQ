import { describe, expect, it } from "vitest";
import {
  addToRecentPlaces,
  MAX_RECENT_PLACES,
  sanitizeRecentPlaces,
} from "./locationHistory";
import type { PlaceSuggestion } from "./placeSearch";

function place(
  id: string,
  lat: number,
  lng: number,
  label = `Place ${id}`
): PlaceSuggestion {
  return { id, label, location: { lat, lng } };
}

describe("addToRecentPlaces", () => {
  it("prepends new places", () => {
    const history = [place("a", 51.5, -0.1)];
    const next = addToRecentPlaces(history, place("b", 52.0, -1.0));
    expect(next.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("moves an existing place (same id) to the front instead of duplicating", () => {
    const history = [place("a", 51.5, -0.1), place("b", 52.0, -1.0)];
    const next = addToRecentPlaces(history, place("b", 52.0, -1.0));
    expect(next.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("dedupes by near-identical coordinates even with different ids", () => {
    const history = [place("a", 51.50001, -0.10001)];
    const next = addToRecentPlaces(history, place("z", 51.5, -0.1));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("z");
  });

  it("keeps places at genuinely different coordinates", () => {
    const history = [place("a", 51.5, -0.1)];
    const next = addToRecentPlaces(history, place("z", 51.6, -0.1));
    expect(next).toHaveLength(2);
  });

  it("caps the list at MAX_RECENT_PLACES, dropping the oldest", () => {
    let history: PlaceSuggestion[] = [];
    for (let i = 0; i < MAX_RECENT_PLACES + 3; i++) {
      history = addToRecentPlaces(history, place(`p${i}`, 50 + i, 0));
    }
    expect(history).toHaveLength(MAX_RECENT_PLACES);
    expect(history[0].id).toBe(`p${MAX_RECENT_PLACES + 2}`);
    expect(history.some((p) => p.id === "p0")).toBe(false);
  });
});

describe("sanitizeRecentPlaces", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeRecentPlaces(undefined)).toEqual([]);
    expect(sanitizeRecentPlaces(null)).toEqual([]);
    expect(sanitizeRecentPlaces("junk")).toEqual([]);
    expect(sanitizeRecentPlaces({})).toEqual([]);
  });

  it("keeps only well-formed entries", () => {
    const good = place("a", 51.5, -0.1);
    const result = sanitizeRecentPlaces([
      good,
      null,
      42,
      { id: "b", label: "" },
      { id: "c", label: "No coords" },
      { id: "d", label: "Bad coords", location: { lat: NaN, lng: 0 } },
    ]);
    expect(result).toEqual([good]);
  });

  it("preserves optional fields and drops unexpected ones", () => {
    const result = sanitizeRecentPlaces([
      {
        id: "a",
        label: "Reading",
        secondary: "Berkshire",
        postcode: "RG1",
        location: { lat: 51.45, lng: -0.97 },
        rogue: "field",
      },
    ]);
    expect(result[0]).toEqual({
      id: "a",
      label: "Reading",
      secondary: "Berkshire",
      postcode: "RG1",
      location: { lat: 51.45, lng: -0.97 },
    });
  });

  it("caps oversized persisted lists", () => {
    const raw = Array.from({ length: 20 }, (_, i) => place(`p${i}`, 50 + i, 0));
    expect(sanitizeRecentPlaces(raw)).toHaveLength(MAX_RECENT_PLACES);
  });
});
