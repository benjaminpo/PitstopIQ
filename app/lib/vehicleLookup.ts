import type { FuelType } from "@/app/lib/types";

const USER_AGENT = "PitstopIQ/1.0 (route fuel cost calculator)";

const DVLA_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const DVLA_TEST_URL =
  "https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const MOT_URL =
  "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

/** UK VRN: 2–8 alphanumeric chars after stripping spaces/hyphens. */
const VRN_PATTERN = /^[A-Z0-9]{2,8}$/;

export interface VehicleLookupResult {
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  fuelTypeRaw: string | null;
  /** App fuel grade suggested from the plate lookup */
  fuelType: FuelType | null;
  hybrid: boolean;
  /** First registration month/date (YYYY-MM or YYYY-MM-DD) */
  registeredDate: string | null;
  yearOfManufacture: number | null;
  engineCapacityCc: number | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  /** Litres — usually estimated; official APIs do not publish tank size */
  tankCapacityLitres: number;
  tankCapacityEstimated: boolean;
  /** Suggested UK imperial MPG when we can estimate */
  mpg: number | null;
  mpgEstimated: boolean;
  source: "live" | "mock";
}

export interface DvlaVehicleResponse {
  registrationNumber?: string;
  make?: string;
  colour?: string;
  fuelType?: string;
  monthOfFirstRegistration?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  revenueWeight?: number;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  motExpiryDate?: string;
}

export interface MotVehicleResponse {
  registration?: string;
  make?: string;
  model?: string;
  primaryColour?: string;
  fuelType?: string;
  engineSize?: string | number;
  registrationDate?: string;
  firstUsedDate?: string;
  manufactureDate?: string;
  motTests?: Array<{
    completedDate?: string;
    expiryDate?: string;
    testResult?: string;
  }>;
}

export function normaliseRegistration(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, "").toUpperCase();
  if (!VRN_PATTERN.test(cleaned)) return null;
  return cleaned;
}

const PREFIX_STYLE = /^[A-Z]{2}\d{2}[A-Z]{3}$/;
const SUFFIX_STYLE = /^[A-Z]\d{1,3}[A-Z]{3}$/;
const TRAILING_LETTERS = /[A-Z]+$/;

/** Format for display: "AB12 CDE" when the pattern fits, else raw. */
export function formatRegistrationDisplay(vrn: string): string {
  if (PREFIX_STYLE.test(vrn)) {
    return `${vrn.slice(0, 4)} ${vrn.slice(4)}`;
  }
  if (SUFFIX_STYLE.test(vrn)) {
    const match = TRAILING_LETTERS.exec(vrn);
    const letters = match?.[0] ?? "";
    return `${vrn.slice(0, vrn.length - letters.length)} ${letters}`.trim();
  }
  return vrn;
}

export function isHybridFuel(fuelRaw: string | null | undefined): boolean {
  if (!fuelRaw) return false;
  const f = fuelRaw.toUpperCase();
  return (
    f.includes("HYBRID") ||
    f.includes("PETROL/ELECTRIC") ||
    f.includes("DIESEL/ELECTRIC") ||
    f.includes("ELECTRIC DIESEL") ||
    (f.includes("ELECTRIC") && f.includes("/"))
  );
}

/** Map DVLA/DVSA fuel strings onto PitstopIQ pump grades. */
export function mapFuelType(fuelRaw: string | null | undefined): FuelType | null {
  if (!fuelRaw) return null;
  const f = fuelRaw.toUpperCase();

  if (f.includes("HVO") || f.includes("HYDROTREATED")) {
    return "HVO";
  }

  if (
    f.includes("DIESEL") ||
    f === "GAS DIESEL" ||
    f === "ELECTRIC DIESEL"
  ) {
    return "B7_Diesel";
  }

  if (
    f.includes("PETROL") ||
    f.includes("HYBRID") ||
    f === "GAS" ||
    f === "GAS BI-FUEL" ||
    f === "LPG" ||
    f === "CNG" ||
    f === "LNG"
  ) {
    return "E10";
  }

  // Pure EV — no liquid fuel; leave unset so the user picks deliberately.
  if (f.includes("ELECTRIC") || f.includes("FUEL CELL")) {
    return null;
  }

  return null;
}

const MAKE_TANK_BASE: Record<string, number> = {
  SMART: 35,
  FIAT: 40,
  MINI: 40,
  TOYOTA: 45,
  HONDA: 45,
  SUZUKI: 42,
  HYUNDAI: 50,
  KIA: 50,
  NISSAN: 50,
  MAZDA: 51,
  FORD: 52,
  VAUXHALL: 52,
  VOLKSWAGEN: 55,
  SEAT: 50,
  SKODA: 55,
  PEUGEOT: 50,
  CITROEN: 50,
  RENAULT: 50,
  BMW: 60,
  AUDI: 60,
  MERCEDES: 65,
  "MERCEDES-BENZ": 65,
  VOLVO: 60,
  JAGUAR: 65,
  LAND: 70,
  "LAND ROVER": 70,
  ROVER: 55,
  JEEP: 70,
  TESLA: 0,
  LEXUS: 55,
  PORSCHE: 65,
  BENTLEY: 85,
  ROLLS: 90,
};

/** Weight (kg) bands → [minLitres, maxLitres] applied to the make baseline. */
const WEIGHT_BANDS: Array<[number, number, number]> = [
  [1200, 0, 42],
  [1400, 45, 52],
  [1600, 50, 999],
  [1800, 55, 999],
  [2100, 60, 999],
  [2500, 68, 999],
  [Number.POSITIVE_INFINITY, 75, 999],
];

const CC_BANDS: Array<[number, number, number]> = [
  [1000, 0, 40],
  [1400, 42, 50],
  [1800, 50, 999],
  [2500, 55, 999],
  [Number.POSITIVE_INFINITY, 65, 999],
];

function tankFromMake(make: string): number {
  for (const [key, value] of Object.entries(MAKE_TANK_BASE)) {
    if (make.includes(key)) return value;
  }
  return 50;
}

function applyBand(
  litres: number,
  value: number,
  bands: Array<[number, number, number]>
): number {
  for (const [limit, minL, maxL] of bands) {
    if (value < limit) {
      return Math.min(Math.max(litres, minL), maxL);
    }
  }
  return litres;
}

function isPureElectric(fuelTypeRaw: string | null | undefined): boolean {
  const f = (fuelTypeRaw ?? "").toUpperCase();
  return (
    f.includes("ELECTRIC") &&
    !isHybridFuel(fuelTypeRaw) &&
    !f.includes("DIESEL")
  );
}

/**
 * Estimate tank capacity (litres). Official DVLA/MOT APIs do not return this —
 * we derive a practical default from weight, engine size, make, and fuel.
 */
export function estimateTankCapacityLitres(input: {
  make?: string | null;
  engineCapacityCc?: number | null;
  revenueWeight?: number | null;
  fuelTypeRaw?: string | null;
}): number {
  if (isPureElectric(input.fuelTypeRaw)) return 40;

  const make = (input.make ?? "").toUpperCase();
  const cc = input.engineCapacityCc ?? 0;
  const weight = input.revenueWeight ?? 0;
  let litres = tankFromMake(make);

  if (weight > 0) litres = applyBand(litres, weight, WEIGHT_BANDS);
  else if (cc > 0) litres = applyBand(litres, cc, CC_BANDS);

  if (
    mapFuelType(input.fuelTypeRaw) === "B7_Diesel" ||
    mapFuelType(input.fuelTypeRaw) === "HVO"
  ) {
    litres = Math.round(litres * 1.08);
  }
  if (isHybridFuel(input.fuelTypeRaw)) {
    litres = Math.round(litres * 0.92);
  }

  return Math.max(25, Math.min(120, Math.round(litres)));
}

function mpgForDiesel(cc: number): number {
  if (cc < 1600) return 62;
  if (cc < 2200) return 55;
  return 45;
}

function mpgForPetrol(cc: number): number {
  if (cc < 1200) return 52;
  if (cc < 1600) return 45;
  if (cc < 2000) return 38;
  return 32;
}

/** Rough UK-imperial combined MPG suggestion from fuel + engine size. */
export function estimateMpg(input: {
  engineCapacityCc?: number | null;
  fuelTypeRaw?: string | null;
}): number | null {
  const mapped = mapFuelType(input.fuelTypeRaw);
  if (!mapped) return null;

  const cc = input.engineCapacityCc ?? 1600;
  let mpg =
    mapped === "B7_Diesel" || mapped === "HVO"
      ? mpgForDiesel(cc)
      : mpgForPetrol(cc);

  if (isHybridFuel(input.fuelTypeRaw)) mpg = Math.round(mpg * 1.25);
  return Math.max(15, Math.min(120, Math.round(mpg)));
}

export function mergeLookup(
  registration: string,
  dvla: DvlaVehicleResponse | null,
  mot: MotVehicleResponse | null,
  source: "live" | "mock"
): VehicleLookupResult {
  const fuelTypeRaw = dvla?.fuelType ?? mot?.fuelType ?? null;
  const make = dvla?.make ?? mot?.make ?? null;
  const engineCapacityCc =
    dvla?.engineCapacity ??
    (mot?.engineSize != null ? Number(mot.engineSize) || null : null);

  const latestMot = mot?.motTests?.[0];
  const motExpiryDate =
    dvla?.motExpiryDate ?? latestMot?.expiryDate ?? null;

  const registeredDate =
    dvla?.monthOfFirstRegistration ??
    mot?.registrationDate ??
    mot?.firstUsedDate ??
    null;

  const yearOfManufacture =
    dvla?.yearOfManufacture ??
    (mot?.manufactureDate
      ? Number(mot.manufactureDate.slice(0, 4)) || null
      : null);

  const tankCapacityLitres = estimateTankCapacityLitres({
    make,
    engineCapacityCc,
    revenueWeight: dvla?.revenueWeight ?? null,
    fuelTypeRaw,
  });

  const mpg = estimateMpg({ engineCapacityCc, fuelTypeRaw });

  return {
    registration: formatRegistrationDisplay(registration),
    make,
    model: mot?.model ?? null,
    colour: dvla?.colour ?? mot?.primaryColour ?? null,
    fuelTypeRaw,
    fuelType: mapFuelType(fuelTypeRaw),
    hybrid: isHybridFuel(fuelTypeRaw),
    registeredDate,
    yearOfManufacture,
    engineCapacityCc,
    taxStatus: dvla?.taxStatus ?? null,
    taxDueDate: dvla?.taxDueDate ?? null,
    motStatus: dvla?.motStatus ?? (latestMot ? latestMot.testResult ?? null : null),
    motExpiryDate,
    tankCapacityLitres,
    tankCapacityEstimated: true,
    mpg,
    mpgEstimated: mpg != null,
    source,
  };
}

/** DVLA UAT-style fixtures for local/demo use when no API key is configured. */
const MOCK_VEHICLES: Record<
  string,
  { dvla: DvlaVehicleResponse; mot?: MotVehicleResponse }
> = {
  AA19AAA: {
    dvla: {
      registrationNumber: "AA19AAA",
      make: "FORD",
      colour: "RED",
      fuelType: "PETROL",
      engineCapacity: 999,
      revenueWeight: 1280,
      yearOfManufacture: 2019,
      monthOfFirstRegistration: "2019-03",
      taxStatus: "Taxed",
      taxDueDate: "2027-03-01",
      motStatus: "Valid",
      motExpiryDate: "2027-03-15",
    },
    mot: {
      registration: "AA19AAA",
      make: "FORD",
      model: "FIESTA",
      fuelType: "Petrol",
      primaryColour: "Red",
      engineSize: 999,
      registrationDate: "2019-03-12",
    },
  },
  AA19DSL: {
    dvla: {
      registrationNumber: "AA19DSL",
      make: "VOLKSWAGEN",
      colour: "BLACK",
      fuelType: "DIESEL",
      engineCapacity: 1968,
      revenueWeight: 1680,
      yearOfManufacture: 2019,
      monthOfFirstRegistration: "2019-06",
      taxStatus: "Taxed",
      taxDueDate: "2027-06-01",
      motStatus: "Valid",
      motExpiryDate: "2027-06-20",
    },
    mot: {
      registration: "AA19DSL",
      make: "VOLKSWAGEN",
      model: "GOLF",
      fuelType: "Diesel",
      engineSize: 1968,
      registrationDate: "2019-06-08",
    },
  },
  AA19MOT: {
    dvla: {
      registrationNumber: "AA19MOT",
      make: "AUDI",
      colour: "WHITE",
      fuelType: "PETROL",
      engineCapacity: 1984,
      revenueWeight: 1620,
      yearOfManufacture: 2016,
      monthOfFirstRegistration: "2016-09",
      taxStatus: "Taxed",
      taxDueDate: "2027-09-01",
      motStatus: "Valid",
      motExpiryDate: "2027-09-10",
    },
    mot: {
      registration: "AA19MOT",
      make: "AUDI",
      model: "A4",
      fuelType: "Petrol",
      engineSize: 1984,
      registrationDate: "2016-09-01",
    },
  },
  HY21BRD: {
    dvla: {
      registrationNumber: "HY21BRD",
      make: "TOYOTA",
      colour: "SILVER",
      fuelType: "HYBRID ELECTRIC",
      engineCapacity: 1798,
      revenueWeight: 1450,
      yearOfManufacture: 2021,
      monthOfFirstRegistration: "2021-05",
      taxStatus: "Taxed",
      taxDueDate: "2027-05-01",
      motStatus: "Valid",
      motExpiryDate: "2027-05-12",
    },
    mot: {
      registration: "HY21BRD",
      make: "TOYOTA",
      model: "COROLLA",
      fuelType: "Hybrid Electric (Clean)",
      engineSize: 1798,
      registrationDate: "2021-05-04",
    },
  },
};

function allowMocks(): boolean {
  if (process.env.VEHICLE_LOOKUP_ALLOW_MOCKS === "true") return true;
  if (process.env.VEHICLE_LOOKUP_ALLOW_MOCKS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function hasDvlaKey(): boolean {
  return Boolean(process.env.DVLA_API_KEY?.trim());
}

function hasMotCredentials(): boolean {
  return Boolean(
    process.env.MOT_HISTORY_API_KEY?.trim() &&
      process.env.MOT_HISTORY_CLIENT_ID?.trim() &&
      process.env.MOT_HISTORY_CLIENT_SECRET?.trim() &&
      process.env.MOT_HISTORY_TOKEN_URL?.trim() &&
      process.env.MOT_HISTORY_SCOPE?.trim()
  );
}

let motTokenCache: { token: string; expiresAt: number } | null = null;

async function getMotAccessToken(): Promise<string> {
  const now = Date.now();
  if (motTokenCache && motTokenCache.expiresAt > now + 60_000) {
    return motTokenCache.token;
  }

  const tokenUrl = process.env.MOT_HISTORY_TOKEN_URL!.trim();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.MOT_HISTORY_CLIENT_ID!.trim(),
    client_secret: process.env.MOT_HISTORY_CLIENT_SECRET!.trim(),
    scope: process.env.MOT_HISTORY_SCOPE!.trim(),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`MOT token request failed (${res.status})`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("MOT token response missing access_token");
  }

  motTokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export async function fetchDvlaVehicle(
  registration: string
): Promise<DvlaVehicleResponse | null> {
  const apiKey = process.env.DVLA_API_KEY?.trim();
  if (!apiKey) return null;

  const useTest = process.env.DVLA_USE_TEST_ENV === "true";
  const url = useTest ? DVLA_TEST_URL : DVLA_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ registrationNumber: registration }),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DVLA lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as DvlaVehicleResponse;
}

export async function fetchMotVehicle(
  registration: string
): Promise<MotVehicleResponse | null> {
  if (!hasMotCredentials()) return null;

  const token = await getMotAccessToken();
  const apiKey = process.env.MOT_HISTORY_API_KEY!.trim();

  const res = await fetch(`${MOT_URL}/${encodeURIComponent(registration)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-API-Key": apiKey,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MOT lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as MotVehicleResponse;
}

function mockLookup(registration: string): VehicleLookupResult | null {
  const fixture = MOCK_VEHICLES[registration];
  if (!fixture) return null;
  return mergeLookup(registration, fixture.dvla, fixture.mot ?? null, "mock");
}

/**
 * Look up a UK registration. Uses DVLA (+ optional MOT History) when keys are
 * set; otherwise returns demo fixtures in non-production.
 */
export async function lookupVehicle(
  rawRegistration: string
): Promise<
  | { ok: true; vehicle: VehicleLookupResult }
  | { ok: false; error: string; status: number }
> {
  const registration = normaliseRegistration(rawRegistration);
  if (!registration) {
    return {
      ok: false,
      error: "Enter a valid UK registration plate (e.g. AB12 CDE).",
      status: 400,
    };
  }

  const liveAvailable = hasDvlaKey() || hasMotCredentials();

  if (!liveAvailable) {
    if (!allowMocks()) {
      return {
        ok: false,
        error:
          "Vehicle lookup is not configured. Set MOT History credentials (and optionally DVLA_API_KEY for tax/weight).",
        status: 503,
      };
    }
    const mocked = mockLookup(registration);
    if (!mocked) {
      return {
        ok: false,
        error: `No demo data for ${formatRegistrationDisplay(registration)}. Try AA19 AAA, AA19 DSL, AA19 MOT, or HY21 BRD.`,
        status: 404,
      };
    }
    return { ok: true, vehicle: mocked };
  }

  try {
    const [dvla, mot] = await Promise.all([
      hasDvlaKey() ? fetchDvlaVehicle(registration) : Promise.resolve(null),
      hasMotCredentials()
        ? fetchMotVehicle(registration)
        : Promise.resolve(null),
    ]);

    if (!dvla && !mot) {
      return {
        ok: false,
        error: `No vehicle found for ${formatRegistrationDisplay(registration)}.`,
        status: 404,
      };
    }

    return {
      ok: true,
      vehicle: mergeLookup(registration, dvla, mot, "live"),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vehicle lookup failed";
    console.error("[vehicleLookup]", message);
    return { ok: false, error: message, status: 502 };
  }
}
