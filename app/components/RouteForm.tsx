"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";
import {
  ArrowUpDown,
  Crosshair,
  Clock,
  Fuel,
  Gauge,
  GripVertical,
  Loader2,
  Route,
} from "lucide-react";
import { NumberInput } from "@/app/components/NumberInput";
import { PlaceAutocomplete } from "@/app/components/PlaceAutocomplete";
import { VehiclePresets } from "@/app/components/VehiclePresets";
import { remainingRangeMiles } from "@/app/lib/detourCalculator";
import { usePitstopStore } from "@/app/lib/store";
import { formatPlaceSelection, type PlaceSuggestion } from "@/app/lib/placeSearch";
import type { RouteAvoidOptions } from "@/app/lib/routeAvoid";
import { VEHICLE_FUEL_OPTIONS, vehicleFuelKind } from "@/app/lib/fuelConstants";
import { cn } from "@/app/lib/utils";

const AVOID_OPTIONS: {
  key: keyof RouteAvoidOptions;
  label: string;
}[] = [
  { key: "motorways", label: "Motorways" },
  { key: "tolls", label: "Tolls" },
  { key: "ferries", label: "Ferries" },
];

type RouteEnd = "origin" | "destination";

interface RouteEndRowProps {
  end: RouteEnd;
  value: string;
  onChange: (value: string) => void;
  onSelectPlace: (place: PlaceSuggestion) => void;
  recentPlaces: PlaceSuggestion[];
  onClearRecent: () => void;
  locating: boolean;
  locatingThis: boolean;
  locationError: string | null;
  onLocate: () => void;
  canSwap: boolean;
  dragging: RouteEnd | null;
  dropTarget: RouteEnd | null;
  onDragStart: (end: RouteEnd) => (e: DragEvent) => void;
  onDragOver: (end: RouteEnd) => (e: DragEvent) => void;
  onDragLeave: (end: RouteEnd) => () => void;
  onDrop: (end: RouteEnd) => (e: DragEvent) => void;
  onDragEnd: () => void;
  onGripKeyDown: (e: KeyboardEvent) => void;
  gripAriaLabel: string;
}

function RouteEndRow({
  end,
  value,
  onChange,
  onSelectPlace,
  recentPlaces,
  onClearRecent,
  locating,
  locatingThis,
  locationError,
  onLocate,
  canSwap,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onGripKeyDown,
  gripAriaLabel,
}: Readonly<RouteEndRowProps>) {
  return (
    <div
      onDragOver={onDragOver(end)}
      onDragLeave={onDragLeave(end)}
      onDrop={onDrop(end)}
      className={cn(
        "rounded-xl transition",
        dropTarget === end && "bg-teal-950/40 ring-1 ring-teal-600/50",
        dragging === end && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          draggable={canSwap}
          onDragStart={onDragStart(end)}
          onDragEnd={onDragEnd}
          onKeyDown={onGripKeyDown}
          disabled={!canSwap}
          aria-label={gripAriaLabel}
          title="Drag to reorder"
          className={cn(
            "mt-7 shrink-0 rounded p-0.5 text-slate-500 outline-none ring-teal-500/40 focus-visible:ring-2",
            canSwap
              ? "cursor-grab active:cursor-grabbing hover:text-slate-300"
              : "cursor-default opacity-40"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5 py-1 pr-10">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onLocate}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locatingThis ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {locatingThis ? "Locating…" : "Use my location"}
            </button>
          </div>
          <PlaceAutocomplete
            value={value}
            onChange={onChange}
            onSelect={onSelectPlace}
            recentPlaces={recentPlaces}
            onClearRecent={onClearRecent}
            placeholder="Type a place, address, or postcode…"
            ariaLabel={end === "origin" ? "Origin" : "Destination"}
          />
          {locationError && (
            <p className="text-[11px] leading-snug text-rose-400">
              {locationError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function submitButtonLabel(loading: boolean, tripReady: boolean): string {
  if (loading) return "Loading Fuel Finder…";
  if (!tripReady) return "Choose origin & destination";
  return "Find cheaper pit stops";
}

export function RouteForm() {
  const {
    origin,
    destination,
    originCoords,
    destinationCoords,
    routeAvoid,
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
    swapEnds,
    setRouteAvoid,
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

  const [dragging, setDragging] = useState<RouteEnd | null>(null);
  const [dropTarget, setDropTarget] = useState<RouteEnd | null>(null);

  const maxRefill = vehicle.tankCapacityLitres;
  const refillPct = Math.round((litresToRefill / maxRefill) * 100);
  const tripReady = originCoords !== null && destinationCoords !== null;
  const locatingOrigin = locating && locatingTarget === "origin";
  const locatingDestination = locating && locatingTarget === "destination";
  const canSwap = Boolean(origin || destination);

  const clearDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const onDragStart = (end: RouteEnd) => (e: DragEvent) => {
    if (!canSwap) {
      e.preventDefault();
      return;
    }
    setDragging(end);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", end);
  };

  const onDragOver = (end: RouteEnd) => (e: DragEvent) => {
    if (!dragging || dragging === end) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(end);
  };

  const onDragLeave = (end: RouteEnd) => () => {
    setDropTarget((current) => (current === end ? null : current));
  };

  const onDrop = (end: RouteEnd) => (e: DragEvent) => {
    e.preventDefault();
    const from = dragging;
    clearDrag();
    if (from && from !== end) swapEnds();
  };

  const onDragEnd = () => {
    clearDrag();
  };

  const onGripKeyDown = (e: KeyboardEvent) => {
    if (!canSwap) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      swapEnds();
    }
  };

  const dragHandlers = {
    canSwap,
    dragging,
    dropTarget,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onGripKeyDown,
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void loadStations();
      }}
    >
      <div className="relative">
        {/* Shared Google Maps–style marker rail */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-[22px] top-9 flex w-2.5 flex-col items-center"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-400 ring-2 ring-teal-400/30" />
          <span className="w-px flex-1 bg-slate-600" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-rose-400 ring-2 ring-rose-400/30" />
        </div>

        {/* Floating swap control */}
        <div className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2">
          <button
            type="button"
            onClick={() => swapEnds()}
            disabled={!canSwap}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900 text-slate-300 shadow-lg shadow-slate-950/50 transition hover:border-teal-600/50 hover:bg-teal-950/70 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Swap origin and destination"
            title="Swap origin and destination"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <RouteEndRow
          end="origin"
          value={origin}
          onChange={setOrigin}
          onSelectPlace={(place) => {
            addRecentPlace(place);
            setOriginPlace(formatPlaceSelection(place), place.location);
          }}
          recentPlaces={recentPlaces}
          onClearRecent={clearRecentPlaces}
          locating={locating}
          locatingThis={locatingOrigin}
          locationError={locationError}
          onLocate={() => void locateCurrentPosition("origin")}
          gripAriaLabel="Drag to swap with destination"
          {...dragHandlers}
        />

        <RouteEndRow
          end="destination"
          value={destination}
          onChange={setDestination}
          onSelectPlace={(place) => {
            addRecentPlace(place);
            setDestinationPlace(formatPlaceSelection(place), place.location);
          }}
          recentPlaces={recentPlaces}
          onClearRecent={clearRecentPlaces}
          locating={locating}
          locatingThis={locatingDestination}
          locationError={destinationLocationError}
          onLocate={() => void locateCurrentPosition("destination")}
          gripAriaLabel="Drag to swap with origin"
          {...dragHandlers}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          <Route className="h-3.5 w-3.5" />
          Route options
        </legend>
        <div className="space-y-1.5 rounded-lg bg-slate-900/80 p-2 ring-1 ring-slate-700/60">
          <p className="px-2 text-xs font-medium tracking-wide text-slate-400">
            Avoid
          </p>
          {AVOID_OPTIONS.map((opt) => {
            const checked = routeAvoid[opt.key];
            const id = `avoid-${opt.key}`;
            return (
              <label
                key={opt.key}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition",
                  checked
                    ? "bg-teal-950/50 text-teal-100"
                    : "text-slate-300 hover:bg-slate-800/80"
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setRouteAvoid({ [opt.key]: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-teal-500"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <VehiclePresets />

      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          <Fuel className="h-3.5 w-3.5" />
          Fuel type
        </span>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900/80 p-1 ring-1 ring-slate-700/60">
          {VEHICLE_FUEL_OPTIONS.map((opt) => {
            const active = vehicleFuelKind(vehicle.fuelType) === opt.kind;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFuelType(opt.value)}
                className={cn(
                  "rounded-md px-2 py-2 text-center text-[11px] font-semibold transition",
                  active
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <label htmlFor="vehicle-mpg" className="block space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          <Gauge className="h-3.5 w-3.5" />
          Vehicle MPG
        </span>
        <div className="relative">
          <NumberInput
            id="vehicle-mpg"
            min={1}
            max={150}
            step={0.1}
            value={vehicle.mpg}
            onCommit={(mpg) => setVehicle({ mpg })}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 pr-12 font-mono text-sm text-slate-100 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2"
            aria-label="Vehicle MPG"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            mpg
          </span>
        </div>
      </label>

      <div className="block space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="refill-amount"
            className="text-xs font-medium tracking-wide text-slate-400"
          >
            Refill amount
          </label>
          <span className="font-mono text-sm font-semibold text-teal-300">
            {litresToRefill.toFixed(0)} L · {refillPct}%
          </span>
        </div>
        <input
          id="refill-amount"
          type="range"
          min={5}
          max={maxRefill}
          step={1}
          value={litresToRefill}
          onChange={(e) => setLitresToRefill(Number(e.target.value))}
          className="w-full accent-teal-500"
          aria-valuetext={`${litresToRefill.toFixed(0)} litres, ${refillPct}% of tank`}
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>5 L</span>
          <span>{maxRefill} L tank</span>
        </div>
      </div>

      <label htmlFor="value-of-time" className="block space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Value of time
          </span>
          <span className="font-mono text-sm font-semibold text-teal-300">
            £{valueOfTimeGbpPerHour.toFixed(0)}/h
          </span>
        </div>
        <input
          id="value-of-time"
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

      <label htmlFor="base-route-price" className="block space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-slate-400">
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
        <NumberInput
          id="base-route-price"
          min={0.8}
          max={2.5}
          step={0.001}
          value={baseRouteAvgPricePerLitre}
          onCommit={setBaseRouteAvgPrice}
          className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2"
          aria-label="Base route average price in pounds per litre"
        />
        <p className="text-[10px] leading-snug text-slate-500">
          Compared against the median £/L of stations near your route — not a
          fixed national average.
        </p>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label htmlFor="tank-capacity" className="block space-y-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-400">
            Tank (L)
          </span>
          <NumberInput
            id="tank-capacity"
            min={10}
            max={200}
            step={1}
            value={vehicle.tankCapacityLitres}
            onCommit={(tankCapacityLitres) =>
              setVehicle({ tankCapacityLitres })
            }
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/40"
            aria-label="Tank capacity in litres"
          />
        </label>
        <label htmlFor="fill-percentage" className="block space-y-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-400">
            Fill %
          </span>
          <NumberInput
            id="fill-percentage"
            min={0}
            max={100}
            step={1}
            value={vehicle.fillPercentage}
            onCommit={(fillPercentage) => setVehicle({ fillPercentage })}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/40"
            aria-label="Current fill percentage"
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
        disabled={loading || !tripReady}
        title={tripReady ? undefined : "Choose an origin and destination first"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-950/40 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitButtonLabel(loading, tripReady)}
      </button>
    </form>
  );
}
