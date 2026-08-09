import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("formats suffix-style plates", () => {
    expect(formatRegistrationDisplay("A123BCD")).toBe("A123 BCD");
    expect(formatRegistrationDisplay("A1BCD")).toBe("A1 BCD");
  });

  it("returns the raw plate when no pattern matches", () => {
    expect(formatRegistrationDisplay("ABC1234")).toBe("ABC1234");
  });
});

describe("mapFuelType / isHybridFuel", () => {
  it("maps diesel and petrol", () => {
    expect(mapFuelType("DIESEL")).toBe("B7_Diesel");
    expect(mapFuelType("PETROL")).toBe("E10");
    expect(mapFuelType("HYBRID ELECTRIC")).toBe("E10");
    expect(mapFuelType("HVO")).toBe("HVO");
    expect(mapFuelType("HYDROTREATED VEGETABLE OIL")).toBe("HVO");
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

  it("uses engine capacity when weight is missing", () => {
    const tank = estimateTankCapacityLitres({
      make: "UNKNOWN MAKE",
      engineCapacityCc: 999,
      fuelTypeRaw: "PETROL",
    });
    expect(tank).toBeGreaterThanOrEqual(25);
    expect(tank).toBeLessThanOrEqual(50);
  });

  it("returns a default tank for pure EVs", () => {
    expect(
      estimateTankCapacityLitres({ make: "TESLA", fuelTypeRaw: "ELECTRIC" })
    ).toBe(40);
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

  it("covers large engine bands", () => {
    expect(estimateMpg({ engineCapacityCc: 3000, fuelTypeRaw: "DIESEL" })).toBe(
      45
    );
    expect(estimateMpg({ engineCapacityCc: 2500, fuelTypeRaw: "PETROL" })).toBe(
      32
    );
  });

  it("returns null for unmapped fuels", () => {
    expect(estimateMpg({ engineCapacityCc: 1600, fuelTypeRaw: "ELECTRIC" })).toBeNull();
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

  beforeEach(() => {
    vi.resetModules();
  });

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

  it("returns 502 when DVLA fails", async () => {
    vi.stubEnv("DVLA_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "production");
    globalThis.fetch = vi.fn(async () =>
      new Response("nope", { status: 500 })
    ) as typeof fetch;

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("BK21XYZ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    error.mockRestore();
  });

  it("returns 503 when live lookup is required but unconfigured", async () => {
    vi.stubEnv("VEHICLE_LOOKUP_ALLOW_MOCKS", "false");
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DVLA_API_KEY;
    delete process.env.MOT_HISTORY_API_KEY;

    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("AA19AAA");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("merges MOT History when credentials are set", async () => {
    vi.stubEnv("DVLA_API_KEY", "");
    vi.stubEnv("MOT_HISTORY_API_KEY", "mot-key");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "client");
    vi.stubEnv("MOT_HISTORY_CLIENT_SECRET", "secret");
    vi.stubEnv("MOT_HISTORY_TOKEN_URL", "https://token.example/oauth");
    vi.stubEnv("MOT_HISTORY_SCOPE", "https://scope.example");
    vi.stubEnv("NODE_ENV", "production");

    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("token.example")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      return Response.json({
        registration: "HY21BRD",
        make: "TOYOTA",
        model: "COROLLA",
        fuelType: "Hybrid Electric",
        engineSize: "1798",
        manufactureDate: "2021-01-15",
        registrationDate: "2021-05-04",
        motTests: [{ expiryDate: "2027-05-01", testResult: "PASSED" }],
      });
    }) as typeof fetch;

    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("HY21 BRD");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vehicle.make).toBe("TOYOTA");
      expect(result.vehicle.model).toBe("COROLLA");
      expect(result.vehicle.source).toBe("live");
      expect(result.vehicle.motExpiryDate).toBe("2027-05-01");
    }
  });

  it("returns 502 when the MOT token response is invalid", async () => {
    vi.stubEnv("MOT_HISTORY_API_KEY", "mot-key");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "client");
    vi.stubEnv("MOT_HISTORY_CLIENT_SECRET", "secret");
    vi.stubEnv("MOT_HISTORY_TOKEN_URL", "https://token.example/oauth");
    vi.stubEnv("MOT_HISTORY_SCOPE", "https://scope.example");
    vi.stubEnv("NODE_ENV", "production");

    globalThis.fetch = vi.fn(async () =>
      Response.json({ expires_in: 3600 })
    ) as typeof fetch;

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("HY21BRD");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    error.mockRestore();
  });

  it("returns 502 when MOT History returns an error", async () => {
    vi.stubEnv("MOT_HISTORY_API_KEY", "mot-key");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "client");
    vi.stubEnv("MOT_HISTORY_CLIENT_SECRET", "secret");
    vi.stubEnv("MOT_HISTORY_TOKEN_URL", "https://token.example/oauth");
    vi.stubEnv("MOT_HISTORY_SCOPE", "https://scope.example");
    vi.stubEnv("NODE_ENV", "production");

    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("token.example")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      return new Response("upstream", { status: 503 });
    }) as typeof fetch;

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { lookupVehicle } = await import("./vehicleLookup");
    const result = await lookupVehicle("HY21BRD");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    error.mockRestore();
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

  it("falls back to MOT fields when DVLA is missing", () => {
    const result = mergeLookup(
      "A1BCD",
      null,
      {
        make: "MINI",
        model: "COOPER",
        primaryColour: "GREEN",
        fuelType: "PETROL",
        engineSize: "bad",
        manufactureDate: "2010-06-01",
        firstUsedDate: "2010-07-01",
        motTests: [{ testResult: "PASSED", expiryDate: "2026-01-01" }],
      },
      "live"
    );
    expect(result.registration).toBe("A1 BCD");
    expect(result.make).toBe("MINI");
    expect(result.colour).toBe("GREEN");
    expect(result.engineCapacityCc).toBeNull();
    expect(result.yearOfManufacture).toBe(2010);
    expect(result.motStatus).toBe("PASSED");
  });
});
