import type { FuelType } from "@/app/lib/types";

/** Default drop that triggers an in-app alert (£/L). */
export const DEFAULT_THRESHOLD_GBP = 0.02;
export const MIN_THRESHOLD_GBP = 0.01;
export const MAX_THRESHOLD_GBP = 0.2;
export const MAX_WATCHES_PER_USER = 25;

export type PriceWatchKind = "station" | "route";

export interface PriceWatch {
  id: string;
  userId: string;
  kind: PriceWatchKind;
  stationId: string;
  stationName: string;
  stationBrand: string;
  fuelType: FuelType;
  baselinePrice: number;
  thresholdGbp: number;
  lastSeenPrice: number | null;
  lastCheckedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PriceAlertEvent {
  id: string;
  userId: string;
  watchId: string;
  stationId: string;
  stationName: string;
  stationBrand: string;
  fuelType: FuelType;
  oldPrice: number;
  newPrice: number;
  droppedAt: number;
  readAt: number | null;
}

export interface CreateStationWatchInput {
  stationId: string;
  stationName: string;
  stationBrand: string;
  fuelType: FuelType;
  baselinePrice: number;
  thresholdGbp?: number;
}
