import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbAll, dbGet, dbRun, ensureBigintEpochColumns } from "@/app/lib/db";
import {
  getUserVehiclePresets,
  parseReplaceBody,
  replaceUserVehiclePresets,
} from "./vehiclePresets";

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

  it("rejects non-string activePresetId", () => {
    expect(
      parseReplaceBody({ presets: [sample], activePresetId: 12 }).ok
    ).toBe(false);
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

  it("rejects invalid preset entries", () => {
    expect(parseReplaceBody({ presets: [null], activePresetId: null }).ok).toBe(
      false
    );
    expect(
      parseReplaceBody({ presets: [{ ...sample, id: "" }], activePresetId: null })
        .ok
    ).toBe(false);
    expect(
      parseReplaceBody({
        presets: [{ ...sample, id: "x".repeat(65) }],
        activePresetId: null,
      }).ok
    ).toBe(false);
    expect(
      parseReplaceBody({ presets: [{ ...sample, mpg: 0 }], activePresetId: null })
        .ok
    ).toBe(false);
    expect(
      parseReplaceBody({
        presets: [{ ...sample, tankCapacityLitres: 999 }],
        activePresetId: null,
      }).ok
    ).toBe(false);
  });

  it("normalizes blank names and rounds mpg/tank", () => {
    const result = parseReplaceBody({
      presets: [
        {
          ...sample,
          name: "   ",
          mpg: 45.16,
          tankCapacityLitres: 55.04,
        },
      ],
      activePresetId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.presets[0].name).toBe("My car");
      expect(result.value.presets[0].mpg).toBe(45.2);
      expect(result.value.presets[0].tankCapacityLitres).toBe(55);
    }
  });

  it("defaults missing name to My car", () => {
    const { name: _n, ...withoutName } = sample;
    const result = parseReplaceBody({
      presets: [withoutName],
      activePresetId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.presets[0].name).toBe("My car");
  });
});

describe("getUserVehiclePresets / replaceUserVehiclePresets", () => {
  beforeEach(() => {
    mockedAll.mockReset();
    mockedGet.mockReset();
    mockedRun.mockReset();
    mockedBigint.mockReset();
    mockedRun.mockResolvedValue(undefined);
    mockedBigint.mockResolvedValue(undefined);
  });

  it("returns unsynced empty state when settings row is missing", async () => {
    mockedAll.mockResolvedValue([]);
    mockedGet.mockResolvedValue(undefined);

    const result = await getUserVehiclePresets("user-1");
    expect(result).toEqual({
      presets: [],
      activePresetId: null,
      synced: false,
    });
    expect(mockedRun).toHaveBeenCalled();
    expect(mockedBigint).toHaveBeenCalled();
  });

  it("maps rows, drops unknown fuel types, and clears stale active ids", async () => {
    mockedAll.mockResolvedValue([
      {
        id: "p1",
        name: "Hatch",
        fuel_type: "E10",
        mpg: 40,
        tank_capacity_litres: 50,
      },
      {
        id: "bad",
        name: 12,
        fuel_type: "E85",
        mpg: 30,
        tank_capacity_litres: 40,
      },
      {
        id: true,
        name: null,
        fuel_type: "B7_Diesel",
        mpg: 35,
        tank_capacity_litres: 45,
      },
    ]);
    mockedGet.mockResolvedValue({ active_preset_id: "gone" });

    const result = await getUserVehiclePresets("user-1");
    expect(result.synced).toBe(true);
    expect(result.activePresetId).toBeNull();
    expect(result.presets).toEqual([
      {
        id: "p1",
        name: "Hatch",
        fuelType: "E10",
        mpg: 40,
        tankCapacityLitres: 50,
      },
      {
        id: "true",
        name: "My car",
        fuelType: "B7_Diesel",
        mpg: 35,
        tankCapacityLitres: 45,
      },
    ]);
  });

  it("keeps a matching active preset id", async () => {
    mockedAll.mockResolvedValue([
      {
        id: "p1",
        name: "",
        fuel_type: "E5",
        mpg: 40,
        tank_capacity_litres: 50,
      },
    ]);
    mockedGet.mockResolvedValue({ active_preset_id: "p1" });

    const result = await getUserVehiclePresets("user-1");
    expect(result.activePresetId).toBe("p1");
    expect(result.presets[0].name).toBe("My car");
  });

  it("inserts settings when replacing for a new user", async () => {
    mockedGet
      .mockResolvedValueOnce(undefined) // existing settings check in replace
      .mockResolvedValueOnce({ active_preset_id: "p1" }); // get after write
    mockedAll.mockResolvedValue([
      {
        id: "p1",
        name: "Hatch",
        fuel_type: "E10",
        mpg: 45,
        tank_capacity_litres: 55,
      },
    ]);

    const result = await replaceUserVehiclePresets("user-1", {
      presets: [
        {
          id: "p1",
          name: "Hatch",
          fuelType: "E10",
          mpg: 45,
          tankCapacityLitres: 55,
        },
      ],
      activePresetId: "p1",
    });

    expect(result.activePresetId).toBe("p1");
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM vehicle_preset"),
      ["user-1"]
    );
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO vehicle_preset"),
      expect.arrayContaining(["p1", "user-1", "Hatch", "E10", 45, 55, 0])
    );
    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_vehicle_settings"),
      expect.arrayContaining(["user-1", "p1"])
    );
  });

  it("updates settings when the user already has a settings row", async () => {
    mockedGet
      .mockResolvedValueOnce({ user_id: "user-1" })
      .mockResolvedValueOnce({ active_preset_id: null });
    mockedAll.mockResolvedValue([]);

    await replaceUserVehiclePresets("user-1", {
      presets: [],
      activePresetId: null,
    });

    expect(mockedRun).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_vehicle_settings"),
      [null, expect.any(Number), "user-1"]
    );
  });
});
