import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateMpg,
  estimateTankCapacityLitres,
  formatRegistrationDisplay,
  isHybridFuel,
  mapFuelType,
  mergeLookup,
  normaliseRegistration,
} from "./vehicleLookup";

describe("normaliseRegistration", () => {
  it("strips spaces and uppercases", () => {
    expect(normaliseRegistration("ab12 cde")).toBe("AB12CDE");
    expect(normaliseRegistration("HY21-BRD")).toBe("HY21BRD");
  });

  it("rejects empty / invalid", () => {
    expect(normaliseRegistration("")).toBeNull();
    expect(normaliseRegistration("A")).toBeNull();
    expect(normaliseRegistration("TOO LONG PLATE!!")).toBeNull();
  });
});

describe("formatRegistrationDisplay", () => {
  it("formats current-style plates", () => {
    expect(formatRegistrationDisplay("AB12CDE")).toBe("AB12 CDE");
  });
});

describe("mapFuelType / isHybridFuel", () => {
  it("maps diesel and petrol", () => {
    expect(mapFuelType("DIESEL")).toBe("B7_Diesel");
    expect(mapFuelType("PETROL")).toBe("E10");
    expect(mapFuelType("HYBRID ELECTRIC")).toBe("E10");
  });

  it("detects hybrids", () => {
    expect(isHybridFuel("HYBRID ELECTRIC")).toBe(true);
    expect(isHybridFuel("PETROL/ELECTRIC")).toBe(true);
    expect(isHybridFuel("PETROL")).toBe(false);
  });

  it("returns null for pure EV", () => {
    expect(mapFuelType("ELECTRICITY")).toBeNull();
    expect(mapFuelType("ELECTRIC")).toBeNull();
  });
});

describe("estimateTankCapacityLitres", () => {
  it("uses make + weight for a Fiesta-sized petrol", () => {
    const tank = estimateTankCapacityLitres({
      make: "FORD",
      engineCapacityCc: 999,
      revenueWeight: 1280,
      fuelTypeRaw: "PETROL",
    });
    expect(tank).toBeGreaterThanOrEqual(40);
    expect(tank).toBeLessThanOrEqual(52);
  });

  it("gives larger tanks for heavy diesels", () => {
    const tank = estimateTankCapacityLitres({
      make: "LAND ROVER",
      engineCapacityCc: 2993,
      revenueWeight: 2400,
      fuelTypeRaw: "DIESEL",
    });
    expect(tank).toBeGreaterThanOrEqual(70);
  });

  it("shrinks slightly for hybrids", () => {
    const petrol = estimateTankCapacityLitres({
      make: "TOYOTA",
      engineCapacityCc: 1800,
      revenueWeight: 1450,
      fuelTypeRaw: "PETROL",
    });
    const hybrid = estimateTankCapacityLitres({
      make: "TOYOTA",
      engineCapacityCc: 1800,
      revenueWeight: 1450,
      fuelTypeRaw: "HYBRID ELECTRIC",
    });
    expect(hybrid).toBeLessThanOrEqual(petrol);
  });
});

describe("estimateMpg", () => {
  it("returns higher mpg for small diesels", () => {
    const diesel = estimateMpg({
      engineCapacityCc: 1500,
      fuelTypeRaw: "DIESEL",
    });
    const petrol = estimateMpg({
      engineCapacityCc: 1500,
      fuelTypeRaw: "PETROL",
    });
    expect(diesel).not.toBeNull();
    expect(petrol).not.toBeNull();
    expect(diesel!).toBeGreaterThan(petrol!);
  });

  it("boosts hybrid mpg", () => {
    const hybrid = estimateMpg({
      engineCapacityCc: 1800,
      fuelTypeRaw: "HYBRID ELECTRIC",
    });
    const petrol = estimateMpg({
      engineCapacityCc: 1800,
      fuelTypeRaw: "PETROL",
    });
    expect(hybrid!).toBeGreaterThan(petrol!);
  });
});

describe("lookupVehicle (mock mode)", () => {
  it("returns demo Fiesta for AA19AAA", async () => {
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("AA19 AAA");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vehicle.make).toBe("FORD");
      expect(result.vehicle.model).toBe("FIESTA");
      expect(result.vehicle.source).toBe("mock");
      expect(result.vehicle.tankCapacityLitres).toBeGreaterThan(0);
    }
  });

  it("rejects unknown plates in mock mode", async () => {
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("ZZ99ZZZ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("rejects invalid plates", async () => {
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});

describe("lookupVehicle (live DVLA)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("merges a successful DVLA response", async () => {
    vi.stubEnv("DVLA_API_KEY", "test-key");
    vi.stubEnv("VEHICLE_LOOKUP_ALLOW_MOCKS", "false");
    vi.stubEnv("NODE_ENV", "production");

    globalThis.fetch = vi.fn(async () =>
      Response.json({
        registrationNumber: "BK21XYZ",
        make: "BMW",
        fuelType: "DIESEL",
        engineCapacity: 1995,
        revenueWeight: 1700,
        monthOfFirstRegistration: "2021-04",
        taxStatus: "Taxed",
        taxDueDate: "2027-04-01",
        motStatus: "Valid",
        motExpiryDate: "2027-04-10",
        yearOfManufacture: 2021,
        colour: "BLUE",
      })
    ) as typeof fetch;

    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("BK21 XYZ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vehicle.make).toBe("BMW");
      expect(result.vehicle.fuelType).toBe("B7_Diesel");
      expect(result.vehicle.source).toBe("live");
      expect(result.vehicle.taxDueDate).toBe("2027-04-01");
    }
  });

  it("returns 404 when DVLA has no match", async () => {
    vi.stubEnv("DVLA_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "production");

    globalThis.fetch = vi.fn(async () =>
      new Response(null, { status: 404 })
    ) as typeof fetch;

    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("NF19XXX");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("mergeLookup", () => {
  it("merges DVLA + MOT and estimates tank", () => {
    const result = mergeLookup(
      "AA19AAA",
      {
        make: "FORD",
        fuelType: "PETROL",
        engineCapacity: 999,
        revenueWeight: 1280,
        monthOfFirstRegistration: "2019-03",
        taxDueDate: "2027-03-01",
        taxStatus: "Taxed",
        motExpiryDate: "2027-03-15",
        motStatus: "Valid",
        yearOfManufacture: 2019,
        colour: "RED",
      },
      {
        make: "FORD",
        model: "FIESTA",
        fuelType: "Petrol",
      },
      "mock"
    );

    expect(result.registration).toBe("AA19 AAA");
    expect(result.make).toBe("FORD");
    expect(result.model).toBe("FIESTA");
    expect(result.fuelType).toBe("E10");
    expect(result.hybrid).toBe(false);
    expect(result.taxDueDate).toBe("2027-03-01");
    expect(result.motExpiryDate).toBe("2027-03-15");
    expect(result.tankCapacityEstimated).toBe(true);
    expect(result.tankCapacityLitres).toBeGreaterThan(0);
    expect(result.mpg).not.toBeNull();
    expect(result.source).toBe("mock");
  });

  it("flags hybrid from fuel string", () => {
    const result = mergeLookup(
      "HY21BRD",
      { make: "TOYOTA", fuelType: "HYBRID ELECTRIC", engineCapacity: 1798 },
      { model: "COROLLA" },
      "live"
    );
    expect(result.hybrid).toBe(true);
    expect(result.fuelType).toBe("E10");
    expect(result.model).toBe("COROLLA");
  });
});
