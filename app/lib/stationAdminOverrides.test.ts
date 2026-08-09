import { describe, expect, it } from "vitest";
import {
  applyStationAdminOverrides,
  type StationAdminOverride,
} from "./stationAdminOverrides";
import type { FuelStation } from "./types";

const shell: FuelStation = {
  id: "ff-1",
  name: "Shell Reading",
  brand: "Shell",
  postcode: "RG1 1AA",
  location: { lat: 51.45, lng: -0.97 },
  prices: { E10: 1.4 },
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

const tesco: FuelStation = {
  id: "ff-2",
  name: "Tesco Extra",
  brand: "Tesco",
  postcode: "SL1 1XW",
  location: { lat: 51.51, lng: -0.59 },
  prices: { E10: 1.35 },
  distanceOffRouteMiles: 0,
  detourExtraSeconds: 0,
};

function override(
  partial: Partial<StationAdminOverride> & Pick<StationAdminOverride, "stationId">
): StationAdminOverride {
  return {
    brand: null,
    closed: false,
    note: null,
    updatedBy: "admin",
    updatedAt: 1,
    ...partial,
  };
}

describe("applyStationAdminOverrides", () => {
  it("replaces brand when an override is set", () => {
    const [updated] = applyStationAdminOverrides(
      [shell],
      [override({ stationId: "ff-1", brand: "BP" })]
    );
    expect(updated.brand).toBe("BP");
    expect(updated.name).toBe("Shell Reading");
  });

  it("hides closed stations by default", () => {
    const stations = applyStationAdminOverrides(
      [shell, tesco],
      [override({ stationId: "ff-1", closed: true })]
    );
    expect(stations.map((s) => s.id)).toEqual(["ff-2"]);
  });

  it("keeps closed stations when hideClosed is false", () => {
    const stations = applyStationAdminOverrides(
      [shell, tesco],
      [override({ stationId: "ff-1", closed: true, brand: "Esso" })],
      { hideClosed: false }
    );
    expect(stations).toHaveLength(2);
    expect(stations[0]).toMatchObject({ id: "ff-1", brand: "Esso" });
  });
});
