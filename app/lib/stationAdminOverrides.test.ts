import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  applyStationAdminOverrides,
  invalidateStationAdminOverridesCache,
  listStationAdminOverrides,
  upsertStationAdminOverride,
  type StationAdminOverride,
} from "./stationAdminOverrides";
import type { FuelStation } from "./types";

vi.mock("@/app/lib/db", () => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  ensureBigintEpochColumns: vi.fn(),
}));

const mockedAll = vi.mocked(dbAll);
const mockedGet = vi.mocked(dbGet);
const mockedRun = vi.mocked(dbRun);
const mockedBigint = vi.mocked(ensureBigintEpochColumns);

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

beforeEach(() => {
  vi.clearAllMocks();
  invalidateStationAdminOverridesCache();
  mockedRun.mockResolvedValue(undefined);
  mockedBigint.mockResolvedValue(undefined);
});

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

  it("leaves stations without a brand override unchanged", () => {
    const stations = applyStationAdminOverrides(
      [shell],
      [override({ stationId: "ff-1", note: "check pumps" })]
    );
    expect(stations[0]).toBe(shell);
  });
});

describe("listStationAdminOverrides / upsertStationAdminOverride", () => {
  it("lists mapped overrides", async () => {
    mockedAll.mockResolvedValue([
      {
        station_id: "ff-1",
        brand: " BP ",
        closed: 1,
        note: " note ",
        updated_by: "admin",
        updated_at: "100",
      },
    ]);

    await expect(listStationAdminOverrides()).resolves.toEqual([
      {
        stationId: "ff-1",
        brand: "BP",
        closed: true,
        note: "note",
        updatedBy: "admin",
        updatedAt: 100,
      },
    ]);
  });

  it("deletes a row when clearing all override fields", async () => {
    const result = await upsertStationAdminOverride({
      stationId: "ff-1",
      brand: "  ",
      closed: false,
      note: null,
      updatedBy: "admin",
    });
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM station_admin_override"),
      ["ff-1"]
    );
    expect(result).toMatchObject({
      stationId: "ff-1",
      brand: null,
      closed: false,
      note: null,
    });
  });

  it("inserts a new override", async () => {
    mockedGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        station_id: "ff-1",
        brand: "BP",
        closed: 0,
        note: null,
        updated_by: "admin",
        updated_at: 50,
      });

    const result = await upsertStationAdminOverride({
      stationId: "ff-1",
      brand: "BP",
      closed: false,
      updatedBy: "admin",
    });
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO station_admin_override"),
      expect.arrayContaining(["ff-1", "BP"])
    );
    expect(result.brand).toBe("BP");
  });

  it("updates an existing override", async () => {
    mockedGet
      .mockResolvedValueOnce({ station_id: "ff-1" })
      .mockResolvedValueOnce({
        station_id: "ff-1",
        brand: "Esso",
        closed: 1,
        note: "closed",
        updated_by: "admin",
        updated_at: 60,
      });

    const result = await upsertStationAdminOverride({
      stationId: "ff-1",
      brand: "Esso",
      closed: true,
      note: "closed",
      updatedBy: "admin",
    });
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE station_admin_override"),
      expect.arrayContaining(["Esso", 1, "closed", "admin"])
    );
    expect(result).toMatchObject({ brand: "Esso", closed: true, note: "closed" });
  });

  it("returns a cleared shape when the saved row is missing", async () => {
    mockedGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    const result = await upsertStationAdminOverride({
      stationId: "ff-9",
      brand: "BP",
      closed: false,
      updatedBy: "admin",
    });
    expect(result).toMatchObject({
      stationId: "ff-9",
      brand: null,
      closed: false,
      note: null,
    });
  });
});
