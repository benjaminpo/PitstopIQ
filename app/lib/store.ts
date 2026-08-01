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
  VehiclePreset,
  VehicleProfile,
} from "./types";
import {
  calculateDetourSavings,
  DEFAULT_VALUE_OF_TIME_GBP_PER_HOUR,
  remainingRangeMiles,
} from "./detourCalculator";
import { computeBaselineRoutePrice } from "./baselinePrice";
import { DEFAULT_BASE_ROUTE_AVG_PRICE } from "./fuelApiAdapter";
import {
  getBrowserPosition,
  reverseGeocode,
} from "./geolocation";
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePresetName(name: string): string {
  return name.trim().slice(0, 40) || "My car";
}

function presetMatchesVehicle(
  preset: VehiclePreset,
  vehicle: VehicleProfile
): boolean {
  return (
    preset.fuelType === vehicle.fuelType &&
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
  route: DrivingRoute | null;
  routing: boolean;
  routeError: string | null;
  /** A→selected station→B geometry when a forecourt is selected */
  detourRoute: DrivingRoute | null;
  detourRouting: boolean;
  detourRouteError: string | null;
  vehicle: VehicleProfile;
  /** Named MPG / tank / fuel profiles kept in localStorage */
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
  /** Brand keys hidden from results (e.g. membership-only forecourts) */
  excludedBrands: string[];
  /** Previously selected origin/destination places, most recent first */
  recentPlaces: PlaceSuggestion[];
  sidebarOpen: boolean;
  loading: boolean;
  locating: boolean;
  locatingTarget: "origin" | "destination" | null;
  error: string | null;
  locationError: string | null;
  destinationLocationError: string | null;

  setOrigin: (v: string) => void;
  setDestination: (v: string) => void;
  setOriginPlace: (label: string, coords: GeoPoint) => void;
  setDestinationPlace: (label: string, coords: GeoPoint) => void;
  swapEnds: () => void;
  setVehicle: (patch: Partial<VehicleProfile>) => void;
  setFuelType: (fuelType: FuelType) => void;
  setBaseRouteAvgPrice: (price: number) => void;
  resetBaseRouteAvgPrice: () => void;
  setLitresToRefill: (litres: number) => void;
  setValueOfTimeGbpPerHour: (gbpPerHour: number) => void;
  setSortKey: (key: StationSortKey) => void;
  setBrandFilter: (filter: BrandFilter) => void;
  toggleExcludedBrand: (brandKey: string) => void;
  clearExcludedBrands: () => void;
  setSelectedStationId: (id: string | null) => void;
  addRecentPlace: (place: PlaceSuggestion) => void;
  clearRecentPlaces: () => void;
  loadDetourRoute: (stationId: string) => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  applyVehiclePreset: (id: string) => void;
  saveVehiclePreset: (name?: string) => string | null;
  updateVehiclePreset: (id: string) => void;
  deleteVehiclePreset: (id: string) => void;
  renameVehiclePreset: (id: string, name: string) => void;
  locateCurrentPosition: (target?: "origin" | "destination") => Promise<void>;
  loadStations: () => Promise<void>;
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
  | "excludedBrands"
  | "recentPlaces"
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

export const usePitstopStore = create<PitstopState>()(
  persist(
    (set, get) => ({
      origin: "",
      destination: "",
      originCoords: null,
      destinationCoords: null,
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
      excludedBrands: [],
      recentPlaces: [],
      sidebarOpen: true,
      loading: false,
      locating: false,
      locatingTarget: null,
      error: null,
      locationError: null,
      destinationLocationError: null,

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
          locationError: null,
          destinationLocationError: null,
        });
        void get().loadStations();
      },
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

      loadDetourRoute: async (stationId) => {
        const {
          stations,
          originCoords,
          destinationCoords,
          selectedStationId,
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
          const detourRoute = await fetchDrivingRoute(
            originCoords,
            destinationCoords,
            station.location
          );
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

      saveVehiclePreset: (name) => {
        const { vehicle, vehiclePresets } = get();
        if (vehiclePresets.length >= MAX_VEHICLE_PRESETS) return null;

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
        };
        set({
          vehiclePresets: [...vehiclePresets, preset],
          activePresetId: id,
        });
        return id;
      },

      updateVehiclePreset: (id) => {
        const { vehicle, vehiclePresets } = get();
        if (!vehiclePresets.some((p) => p.id === id)) return;
        set({
          vehiclePresets: vehiclePresets.map((p) =>
            p.id === id
              ? {
                  ...p,
                  fuelType: vehicle.fuelType,
                  mpg: vehicle.mpg,
                  tankCapacityLitres: vehicle.tankCapacityLitres,
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

      locateCurrentPosition: async (target = "origin") => {
        set({
          locating: true,
          locatingTarget: target,
          locationError: null,
          destinationLocationError: null,
        });
        try {
          const point = await getBrowserPosition();
          const label = await reverseGeocode(point);

          if (target === "destination") {
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
          set({
            locating: false,
            locatingTarget: null,
            ...(target === "destination"
              ? { destinationLocationError: message }
              : { locationError: message }),
          });
        }
      },

      loadStations: async () => {
        const { originCoords, destinationCoords } = get();
        // Nothing to search until both ends of the trip are chosen
        if (!originCoords || !destinationCoords) return;

        set({
          loading: true,
          routing: true,
          error: null,
          routeError: null,
          detourRoute: null,
          detourRouting: false,
          detourRouteError: null,
        });
        try {
          let route: DrivingRoute;
          try {
            route = await fetchDrivingRoute(originCoords, destinationCoords);
            set({ route, routing: false, routeError: null });
          } catch (e) {
            set({
              route: null,
              routing: false,
              routeError:
                e instanceof Error
                  ? e.message
                  : "Could not calculate driving route",
            });
            route = {
              distanceMiles: 0,
              durationSeconds: 0,
              coordinates: [originCoords, destinationCoords],
              bounds: (() => {
                const pad = corridorPadDegrees();
                return {
                  north:
                    Math.max(originCoords.lat, destinationCoords.lat) + pad,
                  south:
                    Math.min(originCoords.lat, destinationCoords.lat) - pad,
                  east:
                    Math.max(originCoords.lng, destinationCoords.lng) + pad,
                  west:
                    Math.min(originCoords.lng, destinationCoords.lng) - pad,
                };
              })(),
            };
          }

          const params = new URLSearchParams({
            north: String(route.bounds.north),
            south: String(route.bounds.south),
            east: String(route.bounds.east),
            west: String(route.bounds.west),
          });
          const res = await fetch(`/api/fuel-finder?${params}`);
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
            route
          );

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

          const selectedId = selectedStillVisible
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

          if (selectedId) {
            void get().loadDetourRoute(selectedId);
          }
          void get().loadCommunitySummaries(stations.map((s) => s.id));
        } catch (e) {
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
          const res = await fetch(
            `/api/station-contributions?ids=${encodeURIComponent(ids.join(","))}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            summaries?: Record<string, StationCommunitySummary>;
          };
          if (data.summaries) {
            set({ communityByStationId: data.summaries });
          }
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
          excludedBrands,
          route,
          originCoords,
          communityByStationId,
        } = get();

        const deps = [
          stations,
          vehicle,
          baseRouteAvgPricePerLitre,
          litresToRefill,
          valueOfTimeGbpPerHour,
          sortKey,
          brandFilter,
          excludedBrands,
          route,
          originCoords,
          communityByStationId,
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
        excludedBrands: state.excludedBrands,
        recentPlaces: state.recentPlaces,
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
          excludedBrands: sanitizeExcludedBrands(p.excludedBrands),
          recentPlaces: sanitizeRecentPlaces(p.recentPlaces),
        };
      },
      version: 7,
    }
  )
);
