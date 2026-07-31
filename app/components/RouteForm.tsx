"use client";

import {
  Crosshair,
  Clock,
  Fuel,
  Gauge,
  Loader2,
  MapPinned,
  Navigation,
} from "lucide-react";
import { PlaceAutocomplete } from "@/app/components/PlaceAutocomplete";
import { VehiclePresets } from "@/app/components/VehiclePresets";
import { remainingRangeMiles } from "@/app/lib/detourCalculator";
import { usePitstopStore } from "@/app/lib/store";
import { formatPlaceSelection } from "@/app/lib/placeSearch";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

const FUEL_OPTIONS: { value: FuelType; label: string; hint: string }[] = [
  { value: "E10", label: "E10 Petrol", hint: "Standard" },
  { value: "E5", label: "E5 Petrol", hint: "Premium" },
  { value: "B7_Diesel", label: "B7 Diesel", hint: "Diesel" },
];

export function RouteForm() {
  const {
    origin,
    destination,
    vehicle,
    baseRouteAvgPricePerLitre,
    basePriceManual,
    litresToRefill,
    valueOfTimeGbpPerHour,
    recentPlaces,
    addRecentPlace,
    clearRecentPlaces,
    setOrigin,
    setDestination,
    setOriginPlace,
    setDestinationPlace,
    setVehicle,
    setFuelType,
    setBaseRouteAvgPrice,
    resetBaseRouteAvgPrice,
    setLitresToRefill,
    setValueOfTimeGbpPerHour,
    loadStations,
    locateCurrentPosition,
    loading,
    locating,
    locatingTarget,
    locationError,
    destinationLocationError,
  } = usePitstopStore();

  const maxRefill = vehicle.tankCapacityLitres;
  const refillPct = Math.round((litresToRefill / maxRefill) * 100);
  const locatingOrigin = locating && locatingTarget === "origin";
  const locatingDestination = locating && locatingTarget === "destination";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void loadStations();
      }}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <MapPinned className="h-3.5 w-3.5" />
              Origin
            </span>
            <button
              type="button"
              onClick={() => void locateCurrentPosition("origin")}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locatingOrigin ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {locatingOrigin ? "Locating…" : "Use my location"}
            </button>
          </div>
          <PlaceAutocomplete
            value={origin}
            onChange={setOrigin}
            onSelect={(place) => {
              addRecentPlace(place);
              setOriginPlace(formatPlaceSelection(place), place.location);
            }}
            recentPlaces={recentPlaces}
            onClearRecent={clearRecentPlaces}
            placeholder="Type a place, address, or postcode…"
            ariaLabel="Origin"
          />
          {locationError && (
            <p className="text-[11px] leading-snug text-rose-400">{locationError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Navigation className="h-3.5 w-3.5" />
              Destination
            </span>
            <button
              type="button"
              onClick={() => void locateCurrentPosition("destination")}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locatingDestination ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {locatingDestination ? "Locating…" : "Use my location"}
            </button>
          </div>
          <PlaceAutocomplete
            value={destination}
            onChange={setDestination}
            onSelect={(place) => {
              addRecentPlace(place);
              setDestinationPlace(formatPlaceSelection(place), place.location);
            }}
            recentPlaces={recentPlaces}
            onClearRecent={clearRecentPlaces}
            placeholder="Type a place, address, or postcode…"
            ariaLabel="Destination"
          />
          {destinationLocationError && (
            <p className="text-[11px] leading-snug text-rose-400">
              {destinationLocationError}
            </p>
          )}
        </div>
      </div>

      <VehiclePresets />

      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          <Fuel className="h-3.5 w-3.5" />
          Fuel type
        </span>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900/80 p-1 ring-1 ring-slate-700/60">
          {FUEL_OPTIONS.map((opt) => {
            const active = vehicle.fuelType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFuelType(opt.value)}
                className={cn(
                  "rounded-md px-2 py-2 text-center transition",
                  active
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <div className="text-[11px] font-semibold leading-tight">
                  {opt.label}
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-[10px]",
                    active ? "text-teal-100/80" : "text-slate-500"
                  )}
                >
                  {opt.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          <Gauge className="h-3.5 w-3.5" />
          Vehicle MPG
        </span>
        <div className="relative">
          <input
            type="number"
            min={1}
            max={150}
            step={0.1}
            value={vehicle.mpg}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) setVehicle({ mpg: next });
            }}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 pr-12 font-mono text-sm text-slate-100 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2"
            aria-label="Vehicle MPG"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            mpg
          </span>
        </div>
      </label>

      <label className="block space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Refill amount
          </span>
          <span className="font-mono text-sm font-semibold text-teal-300">
            {litresToRefill.toFixed(0)} L · {refillPct}%
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={maxRefill}
          step={1}
          value={litresToRefill}
          onChange={(e) => setLitresToRefill(Number(e.target.value))}
          className="w-full accent-teal-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>5 L</span>
          <span>{maxRefill} L tank</span>
        </div>
      </label>

      <label className="block space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Value of time
          </span>
          <span className="font-mono text-sm font-semibold text-teal-300">
            £{valueOfTimeGbpPerHour.toFixed(0)}/h
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={valueOfTimeGbpPerHour}
          onChange={(e) => setValueOfTimeGbpPerHour(Number(e.target.value))}
          className="w-full accent-teal-500"
          aria-label="Value of time in pounds per hour"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>£0 (ignore time)</span>
          <span>£60/h</span>
        </div>
        <p className="text-[10px] leading-snug text-slate-500">
          Extra detour minutes are priced at this rate and subtracted from fuel
          savings when ranking stations.
        </p>
      </label>

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Base route avg price (£/L)
          </span>
          {basePriceManual ? (
            <button
              type="button"
              onClick={() => resetBaseRouteAvgPrice()}
              className="text-[11px] font-semibold text-teal-300 hover:text-teal-200"
            >
              Use auto
            </button>
          ) : (
            <span className="text-[10px] text-slate-500">auto from corridor</span>
          )}
        </div>
        <input
          type="number"
          min={0.8}
          max={2.5}
          step={0.001}
          value={baseRouteAvgPricePerLitre}
          onChange={(e) => setBaseRouteAvgPrice(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2"
        />
        <p className="text-[10px] leading-snug text-slate-500">
          Compared against the median £/L of stations near your route — not a
          fixed national average.
        </p>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tank (L)
          </span>
          <input
            type="number"
            min={20}
            max={100}
            value={vehicle.tankCapacityLitres}
            onChange={(e) =>
              setVehicle({ tankCapacityLitres: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/40"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Fill %
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={vehicle.fillPercentage}
            onChange={(e) =>
              setVehicle({ fillPercentage: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/40"
          />
        </label>
      </div>
      <p className="-mt-3 text-[10px] leading-snug text-slate-500">
        Remaining range ≈{" "}
        <span className="font-mono text-slate-300">
          {remainingRangeMiles(vehicle).toFixed(0)} mi
        </span>{" "}
        — stations farther than that are hidden.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-950/40 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading Fuel Finder…" : "Find cheaper pit stops"}
      </button>
    </form>
  );
}
