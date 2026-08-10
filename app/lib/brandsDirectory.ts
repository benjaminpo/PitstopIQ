import {
  classifyStationBrands,
  stationBrandKey,
} from "@/app/lib/brandCategory";
import { matchKnownBrand } from "@/app/lib/brandLogo";
import { townFromAddress } from "@/app/lib/locationsDirectory";
import type { FuelStation, FuelType } from "@/app/lib/types";

export type BrandBrowseCategory =
  | "supermarket"
  | "motorway"
  | "premium"
  | "other";

export const BRAND_BROWSE_CATEGORY_ORDER: BrandBrowseCategory[] = [
  "supermarket",
  "premium",
  "motorway",
  "other",
];

export const BRAND_BROWSE_CATEGORY_LABELS: Record<BrandBrowseCategory, string> =
  {
    supermarket: "Supermarket brands",
    premium: "Oil company & premium brands",
    motorway: "Motorway service brands",
    other: "Other brands",
  };

export interface BrandSummary {
  key: string;
  label: string;
  href: string;
  category: BrandBrowseCategory;
  stationCount: number;
  cheapestE10: number | null;
  cheapestDiesel: number | null;
  averageE10: number | null;
  averageDiesel: number | null;
}

export interface BrandStationRow {
  station: FuelStation;
  town: string | null;
}

export interface BrandDetail {
  key: string;
  label: string;
  href: string;
  category: BrandBrowseCategory;
  stationCount: number;
  cheapestByFuel: Partial<Record<FuelType, number>>;
  averageByFuel: Partial<Record<FuelType, number>>;
  stations: BrandStationRow[];
}

/** URL-safe brand key (`shell`, `sainsburys`, `welcome-break`). */
export function brandPathKey(key: string): string {
  const slug = key
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return slug || "unknown";
}

export function brandHref(key: string): string {
  return `/brands/${brandPathKey(key)}`;
}

function brandLabelFor(
  station: Pick<FuelStation, "brand" | "name">,
  key: string
): string {
  const raw = station.brand.trim() || station.name.trim();
  const known = matchKnownBrand(raw);
  if (known) return known.label;
  if (raw) return raw;
  return key === "unknown" ? "Unknown" : key;
}

function classifyBrandLabel(label: string): BrandBrowseCategory {
  const classes = classifyStationBrands({ brand: label, name: label });
  if (classes.supermarket) return "supermarket";
  if (classes.motorway) return "motorway";
  if (classes.premium) return "premium";
  return "other";
}

function priceStats(
  stations: FuelStation[],
  fuel: FuelType
): { cheapest: number | null; average: number | null } {
  const prices: number[] = [];
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    prices.push(price);
  }
  if (prices.length === 0) return { cheapest: null, average: null };
  let cheapest = prices[0]!;
  let sum = 0;
  for (const price of prices) {
    if (price < cheapest) cheapest = price;
    sum += price;
  }
  return {
    cheapest,
    average: Math.round((sum / prices.length) * 1000) / 1000,
  };
}

/** Group live stations into brand summaries for `/brands`. */
export function buildBrandSummaries(stations: FuelStation[]): BrandSummary[] {
  const byKey = new Map<string, FuelStation[]>();
  const labelByKey = new Map<string, string>();

  for (const station of stations) {
    const key = brandPathKey(stationBrandKey(station));
    const list = byKey.get(key) ?? [];
    list.push(station);
    byKey.set(key, list);
    if (!labelByKey.has(key)) {
      labelByKey.set(key, brandLabelFor(station, key));
    }
  }

  const summaries: BrandSummary[] = [];
  for (const [key, brandStations] of byKey) {
    const label = labelByKey.get(key) ?? key;
    const e10 = priceStats(brandStations, "E10");
    const diesel = priceStats(brandStations, "B7_Diesel");
    summaries.push({
      key,
      label,
      href: brandHref(key),
      category: classifyBrandLabel(label),
      stationCount: brandStations.length,
      cheapestE10: e10.cheapest,
      cheapestDiesel: diesel.cheapest,
      averageE10: e10.average,
      averageDiesel: diesel.average,
    });
  }

  return summaries.sort((a, b) => a.label.localeCompare(b.label));
}

/** Detail payload for `/brands/[brandKey]`. */
export function buildBrandDetail(
  stations: FuelStation[],
  brandKey: string,
  sortFuel: FuelType = "E10"
): BrandDetail | null {
  const needle = brandPathKey(brandKey);
  if (!needle) return null;

  const brandStations = stations.filter(
    (station) => brandPathKey(stationBrandKey(station)) === needle
  );
  if (brandStations.length === 0) return null;

  const label = brandLabelFor(brandStations[0]!, needle);
  const sorted = [...brandStations].sort((a, b) => {
    const pa = a.prices[sortFuel];
    const pb = b.prices[sortFuel];
    if (pa == null && pb == null) return a.name.localeCompare(b.name);
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });

  const fuels: FuelType[] = ["E10", "E5", "B7_Diesel", "B7_Premium", "HVO"];
  const cheapestByFuel: Partial<Record<FuelType, number>> = {};
  const averageByFuel: Partial<Record<FuelType, number>> = {};
  for (const fuel of fuels) {
    const stats = priceStats(brandStations, fuel);
    if (stats.cheapest != null) cheapestByFuel[fuel] = stats.cheapest;
    if (stats.average != null) averageByFuel[fuel] = stats.average;
  }

  return {
    key: needle,
    label,
    href: brandHref(needle),
    category: classifyBrandLabel(label),
    stationCount: brandStations.length,
    cheapestByFuel,
    averageByFuel,
    stations: sorted.map((station) => ({
      station,
      town: townFromAddress(station.address),
    })),
  };
}

/** Group brand summaries into supermarket / premium / motorway / other. */
export function groupBrandsByCategory(
  summaries: BrandSummary[]
): Array<{ category: BrandBrowseCategory; label: string; brands: BrandSummary[] }> {
  return BRAND_BROWSE_CATEGORY_ORDER.flatMap((category) => {
    const brands = summaries.filter((s) => s.category === category);
    if (brands.length === 0) return [];
    return [
      {
        category,
        label: BRAND_BROWSE_CATEGORY_LABELS[category],
        brands,
      },
    ];
  });
}
