"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FuelStation,
  FuelType,
  GeoPoint,
  StationCommunitySummary,
  StationSortKey,
  StationWithCalculation,
  TripStop,
  VehiclePreset,
  VehicleProfile,
} from "./types";
import { MAX_TRIP_STOPS } from "./types";
import {
  calculateDetourSavings,
  DEFAULT_VALUE_OF_TIME_GBP_PER_HOUR,
  remainingRangeMiles,
} from "./detourCalculator";
import { computeBaselineRoutePrice } from "./baselinePrice";
import { DEFAULT_BASE_ROUTE_AVG_PRICE, vehicleFuelKind } from "./fuelConstants";
import {
  matchesPriceFreshness,
  type PriceFreshnessFilter,
} from "./freshness";
import {
  getBrowserPosition,
  reverseGeocode,
} from "./geolocation";
import { isStationOpenNow } from "./stationFacilities";
import {
  approximateDetourSeconds,
  corridorPadDegrees,
  downsampleRoute,
  filterToRouteCorridor,
  fetchDrivingRoute,
  fetchStationDetours,
  milesFromOriginToStation,
  type DrivingRoute,
} from "./routing";
import type { TripSnapshot } from "./tripUrl";
import {
  DEFAULT_ROUTE_AVOID,
  normalizeRouteAvoid,
  type RouteAvoidOptions,
} from "./routeAvoid";
import {
  sanitizeExcludedBrands,
  stationBrandKey,
  stationMatchesBrandFilter,
  type BrandFilter,
} from "./brandCategory";
import {
  addToRecentPlaces,
  sanitizeRecentPlaces,
} from "./locationHistory";
import type { PlaceSuggestion } from "./placeSearch";
import {
  emptyTripStop,
  insertPointOnNearestSegment,
  tripViaCoords,
  tripWaypointCoords,
} from "./tripPath";

export type LocateTarget =
  | "origin"
  | "destination"
  | "both"
  | `stop:${string}`;

function parseLocateStopId(target: LocateTarget): string | null {
  if (!target.startsWith("stop:")) return null;
  return target.slice(5) || null;
}

function isSameLocation(a: GeoPoint, b: GeoPoint): boolean {
  return (
    Math.abs(a.lat - b.lat) < 0.00001 &&
    Math.abs(a.lng - b.lng) < 0.00001
  );
}

const SETTINGS_STORAGE_KEY = "pitstopiq-vehicle-settings";
/** Max stations to refine with live OSRM A→station→B routing. */
const MAX_OSRM_CANDIDATES = 25;
const MAX_VEHICLE_PRESETS = 8;

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // non-JSON error body — fall through to the generic message
  }
  return "Failed to load stations";
}

function newPresetId(): string {
  return crypto.randomUUID();
}

function normalizePresetName(name: string): string {
  return name.trim().slice(0, 40) || "My car";
}

function presetMatchesVehicle(
  preset: VehiclePreset,
  vehicle: VehicleProfile
): boolean {
  return (
    vehicleFuelKind(preset.fuelType) === vehicleFuelKind(vehicle.fuelType) &&
    preset.mpg === vehicle.mpg &&
    preset.tankCapacityLitres === vehicle.tankCapacityLitres
  );
}

interface PitstopState {
  origin: string;
  destination: string;
  /** Null until the user picks a place, uses their location, or opens a shared link */
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
  /** Intermediate stops between origin and destination */
  stops: TripStop[];
  /** Google Maps–style avoid motorways / tolls / ferries */
  routeAvoid: RouteAvoidOptions;
  route: DrivingRoute | null;
  routing: boolean;
  routeError: string | null;
  /** Planned path with selected station inserted (map overlay) */
  detourRoute: DrivingRoute | null;
  detourRouting: boolean;
  detourRouteError: string | null;
  vehicle: VehicleProfile;
  /** Named MPG / tank / fuel profiles (localStorage; synced to DB when signed in) */
  vehiclePresets: VehiclePreset[];
  activePresetId: string | null;
  baseRouteAvgPricePerLitre: number;
  /** True when the user has manually edited the base price */
  basePriceManual: boolean;
  litresToRefill: number;
  /** Opportunity cost of driving time (£/hour); 0 ignores time */
  valueOfTimeGbpPerHour: number;
  stations: FuelStation[];
  dataSource: "live" | "mock" | null;
  /** Epoch ms when live Fuel Finder prices were last synced; null for mock */
  pricesFetchedAt: number | null;
  /** Member ratings / prices / comments keyed by station id */
  communityByStationId: Record<string, StationCommunitySummary>;
  selectedStationId: string | null;
  sortKey: StationSortKey;
  /** Forecourt brand bucket filter applied to scored stations */
  brandFilter: BrandFilter;
  /** Optional maximum age of the selected fuel grade's price report */
  priceFreshnessFilter: PriceFreshnessFilter;
  /** When true, only stations open right now (London local time) */
  openNowFilter: boolean;
  /** Brand keys hidden from results (e.g. membership-only forecourts) */
  excludedBrands: string[];
  /** Previously selected origin/destination places, most recent first */
  recentPlaces: PlaceSuggestion[];
  sidebarOpen: boolean;
  loading: boolean;
  locating: boolean;
  locatingTarget: LocateTarget | null;
  error: string | null;
  locationError: string | null;
  destinationLocationError: string | null;
  /** Errors for intermediate stops, keyed by stop id */
  stopLocationErrors: Record<string, string>;

  setOrigin: (v: string) => void;
  setDestination: (v: string) => void;
  setOriginPlace: (label: string, coords: GeoPoint) => void;
  setDestinationPlace: (label: string, coords: GeoPoint) => void;
  swapEnds: () => void;
  addStop: () => string | null;
  /** Move the current destination to the waypoint list and add a new final destination. */
  addDestination: () => string | null;
  removeStop: (id: string) => void;
  /** Remove any itinerary row while keeping at least an origin and destination. */
  removeTripLocation: (key: string) => void;
  setStopLabel: (id: string, label: string) => void;
  setStopPlace: (id: string, label: string, coords: GeoPoint) => void;
  /** Reorder full itinerary: ["origin", stopId…, "destination"] */
  reorderTripEnds: (order: string[]) => void;
  setRouteAvoid: (patch: Partial<RouteAvoidOptions>) => void;
  setVehicle: (patch: Partial<VehicleProfile>) => void;
  setFuelType: (fuelType: FuelType) => void;
  setBaseRouteAvgPrice: (price: number) => void;
  resetBaseRouteAvgPrice: () => void;
  setLitresToRefill: (litres: number) => void;
  setValueOfTimeGbpPerHour: (gbpPerHour: number) => void;
  setSortKey: (key: StationSortKey) => void;
  setBrandFilter: (filter: BrandFilter) => void;
  setPriceFreshnessFilter: (filter: PriceFreshnessFilter) => void;
  setOpenNowFilter: (openNow: boolean) => void;
  toggleExcludedBrand: (brandKey: string) => void;
  clearExcludedBrands: () => void;
  setSelectedStationId: (id: string | null) => void;
  addRecentPlace: (place: PlaceSuggestion) => void;
  clearRecentPlaces: () => void;
  /** Replace recent places from cloud sync. */
  replaceRecentPlaces: (places: PlaceSuggestion[]) => void;
  loadDetourRoute: (stationId: string) => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  applyVehiclePreset: (id: string) => void;
  saveVehiclePreset: (
    name?: string,
    options?: { registration?: string | null }
  ) => string | null;
  updateVehiclePreset: (
    id: string,
    options?: { registration?: string | null; name?: string }
  ) => void;
  deleteVehiclePreset: (id: string) => void;
  renameVehiclePreset: (id: string, name: string) => void;
  /** Replace presets from cloud sync (does not mutate vehicle fields). */
  replaceVehiclePresets: (
    presets: VehiclePreset[],
    activePresetId: string | null
  ) => void;
  locateCurrentPosition: (target?: LocateTarget) => Promise<void>;
  /** Fetch corridor stations. Pass `{ silent: true }` for background price refresh. */
  loadStations: (options?: { silent?: boolean }) => Promise<void>;
  loadCommunitySummaries: (stationIds?: string[]) => Promise<void>;
  setCommunitySummary: (
    stationId: string,
    summary: StationCommunitySummary
  ) => void;
  getEnrichedStations: () => StationWithCalculation[];
  getTripSnapshot: () => TripSnapshot;
  applyTripSnapshot: (snap: Partial<TripSnapshot>) => void;
}

const defaultVehicle: VehicleProfile = {
  fuelType: "E10",
  mpg: 45,
  tankCapacityLitres: 40,
  fillPercentage: 25,
};

const defaultPresets: VehiclePreset[] = [
  {
    id: "preset-petrol-hatch",
    name: "Petrol hatch",
    fuelType: "E10",
    mpg: 45,
    tankCapacityLitres: 55,
  },
  {
    id: "preset-diesel-estate",
    name: "Diesel estate",
    fuelType: "B7_Diesel",
    mpg: 52,
    tankCapacityLitres: 65,
  },
];

type PersistedSettings = Pick<
  PitstopState,
  | "vehicle"
  | "litresToRefill"
  | "valueOfTimeGbpPerHour"
  | "vehiclePresets"
  | "activePresetId"
  | "brandFilter"
  | "priceFreshnessFilter"
  | "openNowFilter"
  | "excludedBrands"
  | "recentPlaces"
  | "routeAvoid"
>;

/**
 * Enriching stations runs per-station geometry and detour maths, and both the
 * map and the sidebar call it on every render (including a 30s clock tick).
 * Zustand replaces state slices immutably, so caching the last result keyed
 * on the input references is sound and keeps the returned array referentially
 * stable when nothing relevant changed.
 */
let enrichedStationsCache: {
  deps: readonly unknown[];
  value: StationWithCalculation[];
} | null = null;

/** Bumps on each loadStations call so a stale in-flight refresh can bail out. */
let loadStationsGeneration = 0;

export const usePitstopStore = create<PitstopState>()(
  persist(
    (set, get) => ({
      origin: "",
      destination: "",
      originCoords: null,
      destinationCoords: null,
      stops: [],
      routeAvoid: DEFAULT_ROUTE_AVOID,
      route: null,
      routing: false,
      routeError: null,
      detourRoute: null,
      detourRouting: false,
      detourRouteError: null,
      vehicle: defaultVehicle,
      vehiclePresets: defaultPresets,
      activePresetId: "preset-petrol-hatch",
      baseRouteAvgPricePerLitre: DEFAULT_BASE_ROUTE_AVG_PRICE,
      basePriceManual: false,
      litresToRefill: defaultVehicle.tankCapacityLitres,
      valueOfTimeGbpPerHour: DEFAULT_VALUE_OF_TIME_GBP_PER_HOUR,
      stations: [],
      dataSource: null,
      pricesFetchedAt: null,
      communityByStationId: {},
      selectedStationId: null,
      sortKey: "netProfit",
      brandFilter: "all",
      priceFreshnessFilter: "any",
      openNowFilter: false,
      excludedBrands: [],
      recentPlaces: [],
      sidebarOpen: true,
      loading: false,
      locating: false,
      locatingTarget: null,
      error: null,
      locationError: null,
      destinationLocationError: null,
      stopLocationErrors: {},

      setOrigin: (origin) => set({ origin }),
      setDestination: (destination) => set({ destination }),
      setOriginPlace: (label, coords) => {
        set({
          origin: label,
          originCoords: coords,
          locationError: null,
        });
        void get().loadStations();
      },
      setDestinationPlace: (label, coords) => {
        set({
          destination: label,
          destinationCoords: coords,
          destinationLocationError: null,
        });
        void get().loadStations();
      },
      swapEnds: () => {
        const s = get();
        set({
          origin: s.destination,
          destination: s.origin,
          originCoords: s.destinationCoords,
          destinationCoords: s.originCoords,
          stops: [...s.stops].reverse(),
          locationError: null,
          destinationLocationError: null,
          stopLocationErrors: {},
        });
        void get().loadStations();
      },
      addStop: () => {
        const { stops } = get();
        if (stops.length >= MAX_TRIP_STOPS) return null;
        const stop = emptyTripStop();
        set({ stops: [...stops, stop] });
        return stop.id;
      },
      addDestination: () => {
        const { stops, destination, destinationCoords } = get();
        if (stops.length >= MAX_TRIP_STOPS) return null;

        const stop = {
          ...emptyTripStop(),
          label: destination,
          coords: destinationCoords,
        };
        set({
          stops: [...stops, stop],
          destination: "",
          destinationCoords: null,
          destinationLocationError: null,
        });
        return stop.id;
      },
      removeStop: (id) => {
        set((s) => {
          const restErrors = { ...s.stopLocationErrors };
          delete restErrors[id];
          return {
            stops: s.stops.filter((st) => st.id !== id),
            stopLocationErrors: restErrors,
          };
        });
        void get().loadStations();
      },
      removeTripLocation: (key) => {
        const keys = [
          "origin",
          ...get().stops.map((stop) => stop.id),
          "destination",
        ];
        if (keys.length <= 2 || !keys.includes(key)) return;
        get().reorderTripEnds(keys.filter((candidate) => candidate !== key));
      },
      setStopLabel: (id, label) => {
        set((s) => ({
          stops: s.stops.map((st) =>
            st.id === id ? { ...st, label } : st
          ),
        }));
      },
      setStopPlace: (id, label, coords) => {
        set((s) => {
          const restErrors = { ...s.stopLocationErrors };
          delete restErrors[id];
          return {
            stops: s.stops.map((st) =>
              st.id === id ? { ...st, label, coords } : st
            ),
            stopLocationErrors: restErrors,
          };
        });
        void get().loadStations();
      },
      reorderTripEnds: (order) => {
        const s = get();
        const byId = new Map(s.stops.map((st) => [st.id, st]));
        type Slot = { label: string; coords: GeoPoint | null; stopId?: string };
        const slots: Slot[] = [];
        for (const key of order) {
          if (key === "origin") {
            slots.push({ label: s.origin, coords: s.originCoords });
          } else if (key === "destination") {
            slots.push({ label: s.destination, coords: s.destinationCoords });
          } else {
            const stop = byId.get(key);
            if (stop) {
              slots.push({
                label: stop.label,
                coords: stop.coords,
                stopId: stop.id,
              });
            }
          }
        }
        if (slots.length < 2) return;
        const first = slots[0];
        const last = slots.at(-1);
        if (!first || !last) return;
        const middle = slots.slice(1, -1);
        set({
          origin: first.label,
          originCoords: first.coords,
          destination: last.label,
          destinationCoords: last.coords,
          stops: middle.map((slot) => ({
            id: slot.stopId ?? emptyTripStop().id,
            label: slot.label,
            coords: slot.coords,
          })),
          locationError: null,
          destinationLocationError: null,
          stopLocationErrors: {},
        });
        void get().loadStations();
      },
      setRouteAvoid: (patch) =>
        set((s) => ({
          routeAvoid: normalizeRouteAvoid({ ...s.routeAvoid, ...patch }),
        })),
      setVehicle: (patch) =>
        set((s) => {
          const vehicle = { ...s.vehicle, ...patch };
          const tank = Math.max(1, vehicle.tankCapacityLitres);
          vehicle.tankCapacityLitres = tank;
          vehicle.fillPercentage = Math.max(
            0,
            Math.min(100, vehicle.fillPercentage)
          );
          vehicle.mpg = Math.max(1, vehicle.mpg);
          return {
            vehicle,
            litresToRefill: Math.min(s.litresToRefill, tank),
          };
        }),
      setFuelType: (fuelType) => {
        const { stations, basePriceManual } = get();
        const vehicle = { ...get().vehicle, fuelType };
        const auto = computeBaselineRoutePrice(stations, fuelType);
        set({
          vehicle,
          ...(auto != null && !basePriceManual
            ? { baseRouteAvgPricePerLitre: auto }
            : {}),
        });
      },
      setBaseRouteAvgPrice: (baseRouteAvgPricePerLitre) =>
        set({ baseRouteAvgPricePerLitre, basePriceManual: true }),
      resetBaseRouteAvgPrice: () => {
        const { stations, vehicle } = get();
        const auto = computeBaselineRoutePrice(stations, vehicle.fuelType);
        set({
          basePriceManual: false,
          baseRouteAvgPricePerLitre:
            auto ?? DEFAULT_BASE_ROUTE_AVG_PRICE,
        });
      },
      setLitresToRefill: (litresToRefill) => set({ litresToRefill }),
      setValueOfTimeGbpPerHour: (valueOfTimeGbpPerHour) =>
        set({
          valueOfTimeGbpPerHour: Math.max(
            0,
            Math.min(200, valueOfTimeGbpPerHour)
          ),
        }),
      setSortKey: (sortKey) => set({ sortKey }),
      setBrandFilter: (brandFilter) => set({ brandFilter }),
      setPriceFreshnessFilter: (priceFreshnessFilter) => {
        set({ priceFreshnessFilter });
        const best = get().getEnrichedStations().reduce<
          StationWithCalculation | undefined
        >(
          (top, item) =>
            !top ||
            item.calculation.netAfterTime > top.calculation.netAfterTime
              ? item
              : top,
          undefined
        );
        get().setSelectedStationId(best?.station.id ?? null);
      },
      setOpenNowFilter: (openNowFilter) => {
        set({ openNowFilter });
        const best = get().getEnrichedStations().reduce<
          StationWithCalculation | undefined
        >(
          (top, item) =>
            !top ||
            item.calculation.netAfterTime > top.calculation.netAfterTime
              ? item
              : top,
          undefined
        );
        get().setSelectedStationId(best?.station.id ?? null);
      },
      toggleExcludedBrand: (brandKey) =>
        set((s) => ({
          excludedBrands: s.excludedBrands.includes(brandKey)
            ? s.excludedBrands.filter((k) => k !== brandKey)
            : [...s.excludedBrands, brandKey],
        })),
      clearExcludedBrands: () => set({ excludedBrands: [] }),
      setSelectedStationId: (selectedStationId) => {
        set({
          selectedStationId,
          detourRoute: null,
          detourRouteError: null,
          detourRouting: false,
        });
        if (selectedStationId) {
          void get().loadDetourRoute(selectedStationId);
        }
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      addRecentPlace: (place) =>
        set((s) => ({
          recentPlaces: addToRecentPlaces(s.recentPlaces, place),
        })),
      clearRecentPlaces: () => set({ recentPlaces: [] }),
      replaceRecentPlaces: (places) =>
        set({ recentPlaces: sanitizeRecentPlaces(places) }),

      loadDetourRoute: async (stationId) => {
        const {
          stations,
          originCoords,
          destinationCoords,
          stops,
          selectedStationId,
          routeAvoid,
        } = get();
        if (selectedStationId !== stationId) return;
        if (!originCoords || !destinationCoords) return;

        const station = stations.find((s) => s.id === stationId);
        if (!station) {
          set({
            detourRoute: null,
            detourRouting: false,
            detourRouteError: "Station not found",
          });
          return;
        }

        set({ detourRouting: true, detourRouteError: null });
        try {
          const nearbySearch =
            stops.length === 0 &&
            isSameLocation(originCoords, destinationCoords);
          let detourRoute: DrivingRoute;
          if (nearbySearch) {
            detourRoute = await fetchDrivingRoute(
              originCoords,
              station.location,
              null,
              routeAvoid
            );
          } else {
            const planned = tripWaypointCoords(
              originCoords,
              stops,
              destinationCoords
            );
            if (!planned) return;
            const withStation = insertPointOnNearestSegment(
              planned,
              station.location
            );
            detourRoute = await fetchDrivingRoute(
              withStation[0],
              withStation.at(-1)!,
              withStation.slice(1, -1),
              routeAvoid
            );
          }
          // Ignore stale responses if the user picked another station
          if (get().selectedStationId !== stationId) return;
          set({ detourRoute, detourRouting: false, detourRouteError: null });
        } catch (e) {
          if (get().selectedStationId !== stationId) return;
          set({
            detourRoute: null,
            detourRouting: false,
            detourRouteError:
              e instanceof Error
                ? e.message
                : "Could not calculate detour route",
          });
        }
      },

      applyVehiclePreset: (id) => {
        const preset = get().vehiclePresets.find((p) => p.id === id);
        if (!preset) return;
        const { stations, basePriceManual, litresToRefill, vehicle } = get();
        const next: VehicleProfile = {
          ...vehicle,
          fuelType: preset.fuelType,
          mpg: preset.mpg,
          tankCapacityLitres: preset.tankCapacityLitres,
        };
        const auto = computeBaselineRoutePrice(stations, next.fuelType);
        set({
          vehicle: next,
          activePresetId: preset.id,
          litresToRefill: Math.min(litresToRefill, next.tankCapacityLitres),
          ...(auto != null && !basePriceManual
            ? { baseRouteAvgPricePerLitre: auto }
            : {}),
        });
      },

      saveVehiclePreset: (name, options) => {
        const { vehicle, vehiclePresets } = get();
        if (vehiclePresets.length >= MAX_VEHICLE_PRESETS) return null;

        const registration = options?.registration?.trim()
          ? options.registration.trim().toUpperCase()
          : null;
        const id = newPresetId();
        const preset: VehiclePreset = {
          id,
          name: normalizePresetName(
            name ??
              `${vehicle.fuelType.replace("_", " ")} · ${vehicle.mpg} mpg`
          ),
          fuelType: vehicle.fuelType,
          mpg: vehicle.mpg,
          tankCapacityLitres: vehicle.tankCapacityLitres,
          registration,
        };
        set({
          vehiclePresets: [...vehiclePresets, preset],
          activePresetId: id,
        });
        return id;
      },

      updateVehiclePreset: (id, options) => {
        const { vehicle, vehiclePresets } = get();
        if (!vehiclePresets.some((p) => p.id === id)) return;
        const registration =
          options && "registration" in options
            ? options.registration?.trim()
              ? options.registration.trim().toUpperCase()
              : null
            : undefined;
        const name =
          options?.name != null
            ? normalizePresetName(options.name)
            : undefined;
        set({
          vehiclePresets: vehiclePresets.map((p) =>
            p.id === id
              ? {
                  ...p,
                  fuelType: vehicle.fuelType,
                  mpg: vehicle.mpg,
                  tankCapacityLitres: vehicle.tankCapacityLitres,
                  ...(registration !== undefined ? { registration } : {}),
                  ...(name !== undefined ? { name } : {}),
                }
              : p
          ),
          activePresetId: id,
        });
      },

      deleteVehiclePreset: (id) => {
        const { vehiclePresets, activePresetId } = get();
        const next = vehiclePresets.filter((p) => p.id !== id);
        set({
          vehiclePresets: next,
          activePresetId: activePresetId === id ? null : activePresetId,
        });
      },

      renameVehiclePreset: (id, name) => {
        const trimmed = normalizePresetName(name);
        set((s) => ({
          vehiclePresets: s.vehiclePresets.map((p) =>
            p.id === id ? { ...p, name: trimmed } : p
          ),
        }));
      },

      replaceVehiclePresets: (presets, activePresetId) => {
        const next = presets.slice(0, MAX_VEHICLE_PRESETS);
        const active =
          activePresetId && next.some((p) => p.id === activePresetId)
            ? activePresetId
            : null;
        set({ vehiclePresets: next, activePresetId: active });
      },

      locateCurrentPosition: async (target: LocateTarget = "origin") => {
        set({
          locating: true,
          locatingTarget: target,
          locationError: null,
          destinationLocationError: null,
        });
        try {
          const point = await getBrowserPosition();
          const label = await reverseGeocode(point);
          const stopId = parseLocateStopId(target);

          if (stopId) {
            set((s) => {
              const restErrors = { ...s.stopLocationErrors };
              delete restErrors[stopId];
              return {
                stops: s.stops.map((st) =>
                  st.id === stopId ? { ...st, label, coords: point } : st
                ),
                locating: false,
                locatingTarget: null,
                stopLocationErrors: restErrors,
              };
            });
            await get().loadStations();
          } else if (target === "both") {
            set({
              originCoords: point,
              origin: label,
              destinationCoords: point,
              destination: label,
              locating: false,
              locatingTarget: null,
              locationError: null,
              destinationLocationError: null,
            });
            await get().loadStations();
          } else if (target === "destination") {
            set({
              destinationCoords: point,
              destination: label,
              locating: false,
              locatingTarget: null,
              destinationLocationError: null,
            });
            await get().loadStations();
          } else {
            set({
              originCoords: point,
              origin: label,
              locating: false,
              locatingTarget: null,
              locationError: null,
            });
            await get().loadStations();
          }
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Could not get current location";
          const stopId = parseLocateStopId(target);
          if (stopId) {
            set({
              locating: false,
              locatingTarget: null,
              stopLocationErrors: {
                ...get().stopLocationErrors,
                [stopId]: message,
              },
            });
          } else if (target === "both") {
            set({
              locating: false,
              locatingTarget: null,
              locationError: message,
              destinationLocationError: message,
            });
          } else if (target === "destination") {
            set({
              locating: false,
              locatingTarget: null,
              destinationLocationError: message,
            });
          } else {
            set({
              locating: false,
              locatingTarget: null,
              locationError: message,
            });
          }
        }
      },

      loadStations: async (options) => {
        const silent = options?.silent === true;
        const { originCoords, destinationCoords, stops, routeAvoid, route: existingRoute } =
          get();
        // Nothing to search until both ends of the trip are chosen
        if (!originCoords || !destinationCoords) return;
        // Don't stack a quiet refresh on top of an in-progress full load
        if (silent && get().loading) return;

        const generation = ++loadStationsGeneration;
        const vias = tripViaCoords(stops);
        const reuseRoute =
          silent &&
          existingRoute != null &&
          existingRoute.coordinates.length > 1;

        if (!silent) {
          set({
            loading: true,
            routing: !reuseRoute,
            error: null,
            routeError: null,
            detourRoute: null,
            detourRouting: false,
            detourRouteError: null,
          });
        }

        try {
          let route: DrivingRoute;
          if (reuseRoute && existingRoute) {
            route = existingRoute;
          } else {
            try {
              if (silent) set({ routing: true });
              route = await fetchDrivingRoute(
                originCoords,
                destinationCoords,
                vias,
                routeAvoid
              );
              if (generation !== loadStationsGeneration) return;
              set({ route, routing: false, routeError: null });
            } catch (e) {
              if (generation !== loadStationsGeneration) return;
              set({
                route: null,
                routing: false,
                routeError:
                  e instanceof Error
                    ? e.message
                    : "Could not calculate driving route",
              });
              const fallbackPts = [
                originCoords,
                ...vias,
                destinationCoords,
              ];
              route = {
                distanceMiles: 0,
                durationSeconds: 0,
                coordinates: fallbackPts,
                bounds: (() => {
                  const pad = corridorPadDegrees();
                  let north = -Infinity;
                  let south = Infinity;
                  let east = -Infinity;
                  let west = Infinity;
                  for (const p of fallbackPts) {
                    north = Math.max(north, p.lat);
                    south = Math.min(south, p.lat);
                    east = Math.max(east, p.lng);
                    west = Math.min(west, p.lng);
                  }
                  return {
                    north: north + pad,
                    south: south - pad,
                    east: east + pad,
                    west: west - pad,
                  };
                })(),
              };
            }
          }

          const params = new URLSearchParams({
            north: String(route.bounds.north),
            south: String(route.bounds.south),
            east: String(route.bounds.east),
            west: String(route.bounds.west),
          });
          const res = await fetch(`/api/fuel-finder?${params}`);
          if (generation !== loadStationsGeneration) return;
          if (!res.ok) {
            throw new Error(await readApiErrorMessage(res));
          }
          const data = (await res.json()) as {
            stations: FuelStation[];
            source?: "live" | "mock";
            pricesFetchedAt?: number | null;
          };

          const corridor = filterToRouteCorridor(
            data.stations,
            route.coordinates
          );

          const withApprox = corridor.map(({ station: s, distToRoute }) => {
            // Prefer the measured perpendicular distance × 2 until OSRM refines it
            const miles = Number((distToRoute * 2).toFixed(2));
            return {
              ...s,
              distanceOffRouteMiles: miles,
              detourExtraSeconds: approximateDetourSeconds(miles, route),
            };
          });

          const candidates = withApprox.slice(0, MAX_OSRM_CANDIDATES);
          const detours = await fetchStationDetours(
            originCoords,
            destinationCoords,
            candidates,
            route.coordinates,
            route,
            routeAvoid,
            vias
          );
          if (generation !== loadStationsGeneration) return;

          const stations: FuelStation[] = withApprox.map((s) => {
            const metrics = detours[s.id];
            if (metrics) {
              return {
                ...s,
                distanceOffRouteMiles: metrics.miles,
                detourExtraSeconds: metrics.extraSeconds,
              };
            }
            return s;
          });

          const selectedStillVisible =
            get().selectedStationId != null &&
            stations.some((s) => s.id === get().selectedStationId);

          let selectedId = selectedStillVisible
            ? get().selectedStationId
            : null;

          set({
            stations,
            selectedStationId: selectedId,
            dataSource: data.source ?? null,
            pricesFetchedAt:
              typeof data.pricesFetchedAt === "number"
                ? data.pricesFetchedAt
                : null,
            loading: false,
            ...(!get().basePriceManual
              ? {
                  baseRouteAvgPricePerLitre:
                    computeBaselineRoutePrice(
                      stations,
                      get().vehicle.fuelType
                    ) ?? get().baseRouteAvgPricePerLitre,
                }
              : {}),
          });

          const nearbySearch =
            stops.length === 0 &&
            isSameLocation(originCoords, destinationCoords);
          const enriched = get().getEnrichedStations();
          if (
            selectedId &&
            !enriched.some((item) => item.station.id === selectedId)
          ) {
            selectedId = null;
            set({ selectedStationId: null });
          }
          const shouldAutoSelectBest =
            !silent &&
            (nearbySearch ||
              get().priceFreshnessFilter !== "any" ||
              get().openNowFilter);
          if (!selectedId && shouldAutoSelectBest) {
            let best: StationWithCalculation | undefined;
            for (const item of enriched) {
              if (
                !best ||
                item.calculation.netAfterTime >
                  best.calculation.netAfterTime
              ) {
                best = item;
              }
            }
            selectedId = best?.station.id ?? null;
            if (selectedId) set({ selectedStationId: selectedId });
          }

          // Quiet refresh keeps the current detour polyline to avoid map flicker
          if (selectedId && !silent) {
            void get().loadDetourRoute(selectedId);
          }
          void get().loadCommunitySummaries(stations.map((s) => s.id));
        } catch (e) {
          if (generation !== loadStationsGeneration) return;
          if (silent) {
            // Keep showing the last good data; only clear the spinner flag
            set({ loading: false, routing: false });
            return;
          }
          set({
            loading: false,
            routing: false,
            error: e instanceof Error ? e.message : "Unknown error",
          });
        }
      },

      loadCommunitySummaries: async (stationIds) => {
        const ids = stationIds ?? get().stations.map((s) => s.id);
        if (ids.length === 0) {
          set({ communityByStationId: {} });
          return;
        }
        try {
          // POST body — GET ?ids=… blows past CDN/proxy URI limits on long routes.
          const CHUNK = 100;
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += CHUNK) {
            chunks.push(ids.slice(i, i + CHUNK));
          }

          const parts = await Promise.all(
            chunks.map(async (chunk) => {
              const res = await fetch("/api/station-contributions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: chunk }),
              });
              if (!res.ok) return {} as Record<string, StationCommunitySummary>;
              const data = (await res.json()) as {
                summaries?: Record<string, StationCommunitySummary>;
              };
              return data.summaries ?? {};
            })
          );

          const summaries = Object.assign(
            {} as Record<string, StationCommunitySummary>,
            ...parts
          );
          set({ communityByStationId: summaries });
        } catch {
          // Community data is optional — keep scoring on official prices
        }
      },

      setCommunitySummary: (stationId, summary) => {
        set({
          communityByStationId: {
            ...get().communityByStationId,
            [stationId]: summary,
          },
        });
      },

      getEnrichedStations: () => {
        const {
          stations,
          vehicle,
          baseRouteAvgPricePerLitre,
          litresToRefill,
          valueOfTimeGbpPerHour,
          sortKey,
          brandFilter,
          priceFreshnessFilter,
          openNowFilter,
          excludedBrands,
          route,
          originCoords,
          communityByStationId,
        } = get();
        const freshnessMinute = Math.floor(Date.now() / 60_000);

        const deps = [
          stations,
          vehicle,
          baseRouteAvgPricePerLitre,
          litresToRefill,
          valueOfTimeGbpPerHour,
          sortKey,
          brandFilter,
          priceFreshnessFilter,
          openNowFilter,
          excludedBrands,
          route,
          originCoords,
          communityByStationId,
          freshnessMinute,
        ] as const;
        if (enrichedStationsCache?.deps.every((d, i) => d === deps[i])) {
          return enrichedStationsCache.value;
        }

        if (!originCoords) {
          enrichedStationsCache = { deps, value: [] };
          return enrichedStationsCache.value;
        }

        const rangeMiles = remainingRangeMiles(vehicle);
        const routeLine = downsampleRoute(
          route?.coordinates?.length
            ? route.coordinates
            : [originCoords]
        );

        const enriched = stations
          .filter((station) =>
            stationMatchesBrandFilter(station, brandFilter)
          )
          .filter(
            (station) => !excludedBrands.includes(stationBrandKey(station))
          )
          .filter((station) => {
            const community = communityByStationId[station.id];
            const communityPrice =
              community?.communityPrices[vehicle.fuelType];
            const usesCommunityPrice =
              communityPrice != null && Number.isFinite(communityPrice);
            const updatedAt = usesCommunityPrice
              ? community?.communityPriceUpdatedAt[vehicle.fuelType]
              : station.pricesUpdatedAt?.[vehicle.fuelType];
            return matchesPriceFreshness(
              updatedAt,
              priceFreshnessFilter,
              freshnessMinute * 60_000
            );
          })
          .filter(
            (station) =>
              !openNowFilter ||
              isStationOpenNow(
                station,
                new Date(freshnessMinute * 60_000)
              )
          )
          .filter((station) => {
            const milesTo = milesFromOriginToStation(
              station.location,
              routeLine,
              originCoords
            );
            return milesTo <= rangeMiles;
          })
          .map((station): StationWithCalculation | null => {
            const community = communityByStationId[station.id];
            const official = station.prices[vehicle.fuelType];
            const communityPrice = community?.communityPrices[vehicle.fuelType];
            const priceFromCommunity =
              communityPrice != null && Number.isFinite(communityPrice);
            const pricePerLitre = priceFromCommunity
              ? communityPrice
              : official;
            if (pricePerLitre === undefined) return null;

            const calculation = calculateDetourSavings({
              vehicle,
              stationPricePerLitre: pricePerLitre,
              baseRouteAvgPricePerLitre,
              distanceOffRouteMiles: station.distanceOffRouteMiles,
              litresToRefill,
              detourExtraMinutes: station.detourExtraSeconds / 60,
              valueOfTimeGbpPerHour,
            });

            return {
              station,
              calculation,
              pricePerLitre,
              priceFromCommunity,
              community,
            };
          })
          .filter((x): x is StationWithCalculation => x !== null);

        enriched.sort((a, b) => {
          switch (sortKey) {
            case "distance":
              return (
                a.station.distanceOffRouteMiles -
                b.station.distanceOffRouteMiles
              );
            case "price":
              return a.pricePerLitre - b.pricePerLitre;
            case "netProfit":
            default:
              return b.calculation.netAfterTime - a.calculation.netAfterTime;
          }
        });

        enrichedStationsCache = { deps, value: enriched };
        return enriched;
      },

      getTripSnapshot: () => {
        const s = get();
        return {
          origin: s.origin,
          destination: s.destination,
          originCoords: s.originCoords,
          destinationCoords: s.destinationCoords,
          stops: s.stops,
          routeAvoid: s.routeAvoid,
          vehicle: s.vehicle,
          litresToRefill: s.litresToRefill,
          valueOfTimeGbpPerHour: s.valueOfTimeGbpPerHour,
          baseRouteAvgPricePerLitre: s.baseRouteAvgPricePerLitre,
          basePriceManual: s.basePriceManual,
        };
      },

      applyTripSnapshot: (snap) => {
        const current = get();
        const vehicle: VehicleProfile = snap.vehicle
          ? {
              fuelType: snap.vehicle.fuelType,
              mpg: Math.max(1, snap.vehicle.mpg),
              tankCapacityLitres: Math.max(1, snap.vehicle.tankCapacityLitres),
              fillPercentage: Math.max(
                0,
                Math.min(100, snap.vehicle.fillPercentage)
              ),
            }
          : current.vehicle;

        const tank = vehicle.tankCapacityLitres;
        const litresToRefill = Math.min(
          snap.litresToRefill ?? current.litresToRefill,
          tank
        );

        set({
          ...(snap.origin != null ? { origin: snap.origin } : {}),
          ...(snap.destination != null
            ? { destination: snap.destination }
            : {}),
          ...(snap.originCoords ? { originCoords: snap.originCoords } : {}),
          ...(snap.destinationCoords
            ? { destinationCoords: snap.destinationCoords }
            : {}),
          ...(snap.stops != null
            ? {
                stops: snap.stops.slice(0, MAX_TRIP_STOPS).map((st) => ({
                  id: st.id || emptyTripStop().id,
                  label: st.label ?? "",
                  coords: st.coords ?? null,
                })),
              }
            : {}),
          ...(snap.routeAvoid
            ? { routeAvoid: normalizeRouteAvoid(snap.routeAvoid) }
            : {}),
          vehicle,
          litresToRefill,
          ...(snap.valueOfTimeGbpPerHour != null
            ? {
                valueOfTimeGbpPerHour: Math.max(
                  0,
                  Math.min(200, snap.valueOfTimeGbpPerHour)
                ),
              }
            : {}),
          ...(snap.basePriceManual && snap.baseRouteAvgPricePerLitre != null
            ? {
                basePriceManual: true,
                baseRouteAvgPricePerLitre: snap.baseRouteAvgPricePerLitre,
              }
            : {}),
          locationError: null,
          destinationLocationError: null,
          stopLocationErrors: {},
        });

        void get().loadStations();
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      partialize: (state): PersistedSettings => ({
        vehicle: state.vehicle,
        litresToRefill: state.litresToRefill,
        valueOfTimeGbpPerHour: state.valueOfTimeGbpPerHour,
        vehiclePresets: state.vehiclePresets,
        activePresetId: state.activePresetId,
        brandFilter: state.brandFilter,
        priceFreshnessFilter: state.priceFreshnessFilter,
        openNowFilter: state.openNowFilter,
        excludedBrands: state.excludedBrands,
        recentPlaces: state.recentPlaces,
        routeAvoid: state.routeAvoid,
      }),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object")
          return persisted as PersistedSettings;
        const p = persisted as Record<string, unknown>;
        const vehicle = (p.vehicle as VehicleProfile) ?? defaultVehicle;
        const rawPresets = Array.isArray(p.vehiclePresets)
          ? (p.vehiclePresets as VehiclePreset[])
          : defaultPresets;
        const vehiclePresets = rawPresets
          .filter(
            (pr) =>
              pr &&
              typeof pr.id === "string" &&
              typeof pr.name === "string" &&
              typeof pr.mpg === "number" &&
              typeof pr.tankCapacityLitres === "number" &&
              typeof pr.fuelType === "string"
          )
          .slice(0, MAX_VEHICLE_PRESETS);
        const activePresetId =
          typeof p.activePresetId === "string" &&
          vehiclePresets.some((pr) => pr.id === p.activePresetId)
            ? p.activePresetId
            : vehiclePresets.find((pr) => presetMatchesVehicle(pr, vehicle))
                ?.id ?? null;

        const brandFilterRaw = p.brandFilter;
        const brandFilter: BrandFilter =
          brandFilterRaw === "supermarket" ||
          brandFilterRaw === "motorway" ||
          brandFilterRaw === "premium" ||
          brandFilterRaw === "all"
            ? brandFilterRaw
            : "all";
        const freshnessRaw = p.priceFreshnessFilter;
        const priceFreshnessFilter: PriceFreshnessFilter =
          freshnessRaw === "24h" ||
          freshnessRaw === "2d" ||
          freshnessRaw === "3d" ||
          freshnessRaw === "7d" ||
          freshnessRaw === "any"
            ? freshnessRaw
            : "any";
        const openNowFilter = p.openNowFilter === true;

        return {
          vehicle,
          litresToRefill:
            typeof p.litresToRefill === "number"
              ? p.litresToRefill
              : defaultVehicle.tankCapacityLitres,
          valueOfTimeGbpPerHour:
            typeof p.valueOfTimeGbpPerHour === "number"
              ? p.valueOfTimeGbpPerHour
              : DEFAULT_VALUE_OF_TIME_GBP_PER_HOUR,
          vehiclePresets:
            vehiclePresets.length > 0 ? vehiclePresets : defaultPresets,
          activePresetId,
          brandFilter,
          priceFreshnessFilter,
          openNowFilter,
          excludedBrands: sanitizeExcludedBrands(p.excludedBrands),
          recentPlaces: sanitizeRecentPlaces(p.recentPlaces),
          routeAvoid: normalizeRouteAvoid(
            p.routeAvoid as Partial<RouteAvoidOptions> | undefined
          ),
        };
      },
      version: 10,
    }
  )
);
