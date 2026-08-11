import {
  locationAreaHref,
  postcodeArea,
  postcodeAreaKey,
  postcodeAreaLabel,
  postcodeOutcode,
} from "@/app/lib/postcodeAreas";
import { stationNearbySearchHref } from "@/app/lib/stationsDirectory";
import type { FuelStation, FuelType } from "@/app/lib/types";

export interface LocationAreaSummary {
  area: string;
  key: string;
  label: string;
  href: string;
  stationCount: number;
  /** Cheapest price for the highlight fuel, when any station has it */
  cheapestPrice: number | null;
  sampleTown: string | null;
}

export interface LocationAreaStationRow {
  station: FuelStation;
  outcode: string | null;
  town: string | null;
}

export interface LocationAreaDetail {
  area: string;
  key: string;
  label: string;
  href: string;
  stationCount: number;
  cheapestByFuel: Partial<Record<FuelType, number>>;
  averageByFuel: Partial<Record<FuelType, number>>;
  centroid: { lat: number; lng: number } | null;
  nearbySearchHref: string | null;
  stations: LocationAreaStationRow[];
}

/** Best-effort town from a Fuel Finder address ("Street, Town"). */
export function townFromAddress(
  address: string | null | undefined
): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const town = parts.at(-1)!;
  return town.length >= 2 ? town : null;
}

function cheapestPrice(
  stations: FuelStation[],
  fuel: FuelType
): number | null {
  let best: number | null = null;
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    if (best === null || price < best) best = price;
  }
  return best;
}

function averagePrice(
  stations: FuelStation[],
  fuel: FuelType
): number | null {
  const prices: number[] = [];
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    prices.push(price);
  }
  if (prices.length === 0) return null;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return Math.round((sum / prices.length) * 1000) / 1000;
}

function centroidOf(stations: FuelStation[]): {
  lat: number;
  lng: number;
} | null {
  if (stations.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const station of stations) {
    lat += station.location.lat;
    lng += station.location.lng;
  }
  return {
    lat: lat / stations.length,
    lng: lng / stations.length,
  };
}

function mostCommonTown(stations: FuelStation[]): string | null {
  const counts = new Map<string, number>();
  for (const station of stations) {
    const town = townFromAddress(station.address);
    if (!town) continue;
    const key = town.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  if (!bestKey) return null;
  const match = stations
    .map((s) => townFromAddress(s.address))
    .find((town) => town?.toLowerCase() === bestKey);
  return match ?? null;
}

/** Group live stations into UK postcode areas for the locations index. */
export function buildLocationAreaSummaries(
  stations: FuelStation[],
  highlightFuel: FuelType = "E10"
): LocationAreaSummary[] {
  const byArea = new Map<string, FuelStation[]>();
  for (const station of stations) {
    const area = postcodeArea(station.postcode);
    if (!area) continue;
    const list = byArea.get(area) ?? [];
    list.push(station);
    byArea.set(area, list);
  }

  const summaries: LocationAreaSummary[] = [];
  for (const [area, areaStations] of byArea) {
    summaries.push({
      area,
      key: postcodeAreaKey(area),
      label: postcodeAreaLabel(area),
      href: locationAreaHref(area),
      stationCount: areaStations.length,
      cheapestPrice: cheapestPrice(areaStations, highlightFuel),
      sampleTown: mostCommonTown(areaStations),
    });
  }

  return summaries.sort((a, b) => a.label.localeCompare(b.label));
}

/** Detail payload for `/locations/[areaKey]`. */
export function buildLocationAreaDetail(
  stations: FuelStation[],
  areaKey: string,
  sortFuel: FuelType = "E10"
): LocationAreaDetail | null {
  const needle = areaKey.trim().toUpperCase();
  if (!needle) return null;

  const areaStations = stations.filter(
    (station) => postcodeArea(station.postcode) === needle
  );
  if (areaStations.length === 0) return null;

  const sorted = [...areaStations].sort((a, b) => {
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
    const cheapest = cheapestPrice(areaStations, fuel);
    if (cheapest != null) cheapestByFuel[fuel] = cheapest;
    const average = averagePrice(areaStations, fuel);
    if (average != null) averageByFuel[fuel] = average;
  }

  const centroid = centroidOf(areaStations);
  const anchor = sorted[0]!;
  const nearbySearchHref = centroid
    ? stationNearbySearchHref({
        ...anchor,
        name: `${postcodeAreaLabel(needle)} fuel stations`,
        location: centroid,
      })
    : null;

  return {
    area: needle,
    key: postcodeAreaKey(needle),
    label: postcodeAreaLabel(needle),
    href: locationAreaHref(needle),
    stationCount: areaStations.length,
    cheapestByFuel,
    averageByFuel,
    centroid,
    nearbySearchHref,
    stations: sorted.map((station) => ({
      station,
      outcode: postcodeOutcode(station.postcode),
      town: townFromAddress(station.address),
    })),
  };
}

/** Group area summaries under A–Z letters for the index page. */
export function groupLocationAreasByLetter(
  summaries: LocationAreaSummary[]
): Array<{ letter: string; areas: LocationAreaSummary[] }> {
  const byLetter = new Map<string, LocationAreaSummary[]>();
  for (const summary of summaries) {
    const letter = summary.label.charAt(0).toUpperCase() || "#";
    const list = byLetter.get(letter) ?? [];
    list.push(summary);
    byLetter.set(letter, list);
  }
  return [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, areas]) => ({ letter, areas }));
}
