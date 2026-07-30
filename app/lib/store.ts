"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FuelStation,
  FuelType,
  GeoPoint,
  StationSortKey,
  StationWithCalculation,
  VehicleProfile,
} from "./types";
import { calculateDetourSavings } from "./detourCalculator";
import { computeBaselineRoutePrice } from "./baselinePrice";
import { DEFAULT_BASE_ROUTE_AVG_PRICE } from "./fuelApiAdapter";
import {
  getBrowserPosition,
  reverseGeocode,
} from "./geolocation";
import {
  approximateDetourMiles,
  distanceToRouteMiles,
  fetchDrivingRoute,
  fetchStationDetours,
  type DrivingRoute,
} from "./routing";

const DEFAULT_ORIGIN: GeoPoint = { lat: 51.4543, lng: -0.9781 }; // Reading
const DEFAULT_DESTINATION: GeoPoint = { lat: 51.47, lng: -0.4543 }; // Heathrow

const SETTINGS_STORAGE_KEY = "pitstopiq-vehicle-settings";

interface PitstopState {
  origin: string;
  destination: string;
  originCoords: GeoPoint;
  destinationCoords: GeoPoint;
  route: DrivingRoute | null;
  routing: boolean;
  routeError: string | null;
  vehicle: VehicleProfile;
  baseRouteAvgPricePerLitre: number;
  /** True when the user has manually edited the base price */
  basePriceManual: boolean;
  litresToRefill: number;
  stations: FuelStation[];
  dataSource: "live" | "mock" | null;
  selectedStationId: string | null;
  sortKey: StationSortKey;
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
  setVehicle: (patch: Partial<VehicleProfile>) => void;
  setFuelType: (fuelType: FuelType) => void;
  setBaseRouteAvgPrice: (price: number) => void;
  resetBaseRouteAvgPrice: () => void;
  setLitresToRefill: (litres: number) => void;
  setSortKey: (key: StationSortKey) => void;
  setSelectedStationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  useCurrentLocation: (target?: "origin" | "destination") => Promise<void>;
  loadStations: () => Promise<void>;
  getEnrichedStations: () => StationWithCalculation[];
}

const defaultVehicle: VehicleProfile = {
  fuelType: "E10",
  mpg: 45,
  tankCapacityLitres: 55,
  fillPercentage: 25,
};

type PersistedSettings = Pick<PitstopState, "vehicle" | "litresToRefill">;

export const usePitstopStore = create<PitstopState>()(
  persist(
    (set, get) => ({
      origin: "Reading, UK",
      destination: "Heathrow Airport, UK",
      originCoords: DEFAULT_ORIGIN,
      destinationCoords: DEFAULT_DESTINATION,
      route: null,
      routing: false,
      routeError: null,
      vehicle: defaultVehicle,
      baseRouteAvgPricePerLitre: DEFAULT_BASE_ROUTE_AVG_PRICE,
      basePriceManual: false,
      litresToRefill: defaultVehicle.tankCapacityLitres,
      stations: [],
      dataSource: null,
      selectedStationId: null,
      sortKey: "netProfit",
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
      setSortKey: (sortKey) => set({ sortKey }),
      setSelectedStationId: (selectedStationId) => set({ selectedStationId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      useCurrentLocation: async (target = "origin") => {
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
        set({ loading: true, routing: true, error: null, routeError: null });
        try {
          const { originCoords, destinationCoords } = get();

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
              bounds: {
                north: Math.max(originCoords.lat, destinationCoords.lat) + 0.08,
                south: Math.min(originCoords.lat, destinationCoords.lat) - 0.08,
                east: Math.max(originCoords.lng, destinationCoords.lng) + 0.08,
                west: Math.min(originCoords.lng, destinationCoords.lng) - 0.08,
              },
            };
          }

          const params = new URLSearchParams({
            north: String(route.bounds.north),
            south: String(route.bounds.south),
            east: String(route.bounds.east),
            west: String(route.bounds.west),
          });
          const res = await fetch(`/api/fuel-finder?${params}`);
          if (!res.ok) throw new Error("Failed to load stations");
          const data = (await res.json()) as {
            stations: FuelStation[];
            source?: "live" | "mock";
          };

          const withApprox = data.stations
            .map((s) => ({
              ...s,
              distanceOffRouteMiles: approximateDetourMiles(
                s.location,
                route.coordinates
              ),
              _distToRoute: distanceToRouteMiles(s.location, route.coordinates),
            }))
            .sort((a, b) => a._distToRoute - b._distToRoute);

          const candidates = withApprox.slice(0, 25);
          const detours = await fetchStationDetours(
            originCoords,
            destinationCoords,
            candidates,
            route.coordinates
          );

          const stations: FuelStation[] = withApprox.map(
            ({ _distToRoute: _, ...s }) => ({
              ...s,
              distanceOffRouteMiles:
                detours[s.id] ??
                approximateDetourMiles(s.location, route.coordinates),
            })
          );

          set({
            stations,
            dataSource: data.source ?? null,
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
        } catch (e) {
          set({
            loading: false,
            routing: false,
            error: e instanceof Error ? e.message : "Unknown error",
          });
        }
      },

      getEnrichedStations: () => {
        const {
          stations,
          vehicle,
          baseRouteAvgPricePerLitre,
          litresToRefill,
          sortKey,
        } = get();

        const enriched: StationWithCalculation[] = stations
          .map((station) => {
            const pricePerLitre = station.prices[vehicle.fuelType];
            if (pricePerLitre === undefined) return null;

            const calculation = calculateDetourSavings({
              vehicle,
              stationPricePerLitre: pricePerLitre,
              baseRouteAvgPricePerLitre,
              distanceOffRouteMiles: station.distanceOffRouteMiles,
              litresToRefill,
            });

            return { station, calculation, pricePerLitre };
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
              return (
                b.calculation.netFinancialSaving -
                a.calculation.netFinancialSaving
              );
          }
        });

        return enriched;
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      partialize: (state): PersistedSettings => ({
        vehicle: state.vehicle,
        litresToRefill: state.litresToRefill,
      }),
      // Drop stale base price from older persisted payloads (£1.429 bug)
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") return persisted as PersistedSettings;
        const p = persisted as Record<string, unknown>;
        return {
          vehicle: p.vehicle as VehicleProfile,
          litresToRefill: p.litresToRefill as number,
        };
      },
      version: 2,
    }
  )
);
