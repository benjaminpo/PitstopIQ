import { describe, expect, it } from "vitest";
import { parseReplaceBody } from "./vehiclePresets";

describe("parseReplaceBody", () => {
  const sample = {
    id: "preset-petrol-hatch",
    name: "Petrol hatch",
    fuelType: "E10",
    mpg: 45,
    tankCapacityLitres: 55,
  };

  it("accepts a valid preset list with active id", () => {
    const result = parseReplaceBody({
      presets: [sample],
      activePresetId: "preset-petrol-hatch",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.presets).toHaveLength(1);
      expect(result.value.activePresetId).toBe("preset-petrol-hatch");
    }
  });

  it("accepts null activePresetId", () => {
    const result = parseReplaceBody({
      presets: [sample],
      activePresetId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.activePresetId).toBeNull();
  });

  it("accepts an empty list", () => {
    const result = parseReplaceBody({ presets: [], activePresetId: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.presets).toEqual([]);
      expect(result.value.activePresetId).toBeNull();
    }
  });

  it("rejects more than 8 presets", () => {
    const presets = Array.from({ length: 9 }, (_, i) => ({
      ...sample,
      id: `p-${i}`,
      name: `Car ${i}`,
    }));
    const result = parseReplaceBody({ presets, activePresetId: null });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate ids", () => {
    const result = parseReplaceBody({
      presets: [sample, { ...sample, name: "Copy" }],
      activePresetId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects activePresetId not in the list", () => {
    const result = parseReplaceBody({
      presets: [sample],
      activePresetId: "missing",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid fuel type", () => {
    const result = parseReplaceBody({
      presets: [{ ...sample, fuelType: "E85" }],
      activePresetId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing presets array", () => {
    expect(parseReplaceBody({}).ok).toBe(false);
    expect(parseReplaceBody(null).ok).toBe(false);
  });

  it("normalizes blank names", () => {
    const result = parseReplaceBody({
      presets: [{ ...sample, name: "   " }],
      activePresetId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.presets[0].name).toBe("My car");
  });
});
