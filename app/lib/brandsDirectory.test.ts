import { describe, expect, it } from "vitest";
import {
  brandHref,
  brandPathKey,
  buildBrandDetail,
  buildBrandSummaries,
  groupBrandsByCategory,
} from "./brandsDirectory";
import type { FuelStation } from "./types";

function station(
  partial: Partial<FuelStation> & Pick<FuelStation, "id" | "name" | "brand">
): FuelStation {
  return {
    location: { lat: 51.5, lng: -0.1 },
    prices: { E10: 1.45 },
    distanceOffRouteMiles: 0,
    detourExtraSeconds: 0,
    ...partial,
  };
}

describe("brandsDirectory", () => {
  it("slugifies brand keys", () => {
    expect(brandPathKey("Shell")).toBe("shell");
    expect(brandPathKey("Welcome Break")).toBe("welcome-break");
    expect(brandHref("bp")).toBe("/brands/bp");
  });

  it("summarises brands with averages and categories", () => {
    const stations = [
      station({
        id: "1",
        name: "Tesco Extra",
        brand: "Tesco",
        prices: { E10: 1.39, B7_Diesel: 1.48 },
      }),
      station({
        id: "2",
        name: "Tesco Express",
        brand: "TESCO",
        prices: { E10: 1.41, B7_Diesel: 1.5 },
      }),
      station({
        id: "3",
        name: "Shell Garage",
        brand: "Shell",
        prices: { E10: 1.49 },
      }),
    ];

    const summaries = buildBrandSummaries(stations);
    const tesco = summaries.find((s) => s.key === "tesco");
    expect(tesco?.stationCount).toBe(2);
    expect(tesco?.category).toBe("supermarket");
    expect(tesco?.cheapestE10).toBe(1.39);
    expect(tesco?.averageE10).toBe(1.4);
    expect(tesco?.href).toBe("/brands/tesco");

    const shell = summaries.find((s) => s.key === "shell");
    expect(shell?.category).toBe("premium");

    const groups = groupBrandsByCategory(summaries);
    expect(groups.map((g) => g.category)).toEqual([
      "supermarket",
      "premium",
    ]);
  });

  it("builds brand detail sorted by price", () => {
    const stations = [
      station({
        id: "dear",
        name: "Shell Dear",
        brand: "Shell",
        prices: { E10: 1.5 },
        address: "High Street, Reading",
      }),
      station({
        id: "cheap",
        name: "Shell Cheap",
        brand: "Shell",
        prices: { E10: 1.4 },
        address: "Bath Road, Slough",
      }),
    ];
    const detail = buildBrandDetail(stations, "shell");
    expect(detail?.stations.map((row) => row.station.id)).toEqual([
      "cheap",
      "dear",
    ]);
    expect(detail?.cheapestByFuel.E10).toBe(1.4);
    expect(detail?.averageByFuel.E10).toBe(1.45);
  });
});
