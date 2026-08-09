"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Ban,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { remainingRangeMiles } from "@/app/lib/detourCalculator";
import {
  BRAND_FILTER_OPTIONS,
  distinctBrandOptions,
  type BrandFilter,
} from "@/app/lib/brandCategory";
import {
  PRICE_FRESHNESS_OPTIONS,
  type PriceFreshnessFilter,
} from "@/app/lib/freshness";
import { usePitstopStore } from "@/app/lib/store";
import { CORRIDOR_MAX_DISTANCE_MILES } from "@/app/lib/routing";
import type { StationSortKey, StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { ReportMissingStation } from "./ReportMissingStation";
import { StationCard } from "./StationCard";

const SORT_OPTIONS: { key: StationSortKey; label: string }[] = [
  { key: "netProfit", label: "Net (inc. time)" },
  { key: "distance", label: "Distance" },
  { key: "price", label: "Price" },
];

function bestStationId(enriched: StationWithCalculation[]): string | null {
  if (enriched.length === 0) return null;
  let best = enriched[0];
  for (let i = 1; i < enriched.length; i++) {
    if (
      enriched[i].calculation.netAfterTime > best.calculation.netAfterTime
    ) {
      best = enriched[i];
    }
  }
  return best.station.id;
}

export function StationList() {
  const {
    sortKey,
    setSortKey,
    brandFilter,
    setBrandFilter,
    priceFreshnessFilter,
    setPriceFreshnessFilter,
    excludedBrands,
    toggleExcludedBrand,
    clearExcludedBrands,
    selectedStationId,
    setSelectedStationId,
    setSidebarOpen,
    getEnrichedStations,
    loadStations,
    loading,
    error,
    stations,
    dataSource,
    originCoords,
    destinationCoords,
    vehicle,
  } = usePitstopStore();

  const enriched = getEnrichedStations();
  const bestId = bestStationId(enriched);
  const tripReady = originCoords !== null && destinationCoords !== null;
  const filterLabel =
    BRAND_FILTER_OPTIONS.find((o) => o.key === brandFilter)?.label ?? "All";
  const freshnessLabel =
    PRICE_FRESHNESS_OPTIONS.find((o) => o.value === priceFreshnessFilter)
      ?.label ?? "Any time";
  const rangeMiles = remainingRangeMiles(vehicle);
  const brandOptions = distinctBrandOptions(stations);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const hiddenBrandsSuffix = (() => {
    if (excludedBrands.length === 0) return "";
    const noun = excludedBrands.length === 1 ? "brand" : "brands";
    return ` · ${excludedBrands.length} ${noun} hidden`;
  })();

  const selectStation = (stationId: string) => {
    setSelectedStationId(stationId);
    // Below the md breakpoint the sidebar overlays the map, so close it to
    // reveal the selected station and its detour route.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  };

  const handleSelect = (stationId: string) => {
    // Tapping the selected card again deselects it, restoring the direct route
    if (selectedStationId === stationId) {
      setSelectedStationId(null);
      return;
    }
    selectStation(stationId);
  };

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!dataSource) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [dataSource]);

  return (
    <div className="flex shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">Stations</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {loading
              ? "Fetching Fuel Finder prices…"
              : `${enriched.length} in range (≤${rangeMiles.toFixed(0)} mi) · ${stations.length} on corridor · ${filterLabel} · ${freshnessLabel.toLowerCase()} · ${SORT_OPTIONS.find((s) => s.key === sortKey)?.label.toLowerCase()}${hiddenBrandsSuffix}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-slate-900/80 p-1 ring-1 ring-slate-700/60">
            <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-500" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition",
                  sortKey === opt.key
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && dataSource === "mock" && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-950/50 px-3 py-2.5 ring-1 ring-amber-500/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-snug text-amber-200">
            <span className="font-semibold">Demo data.</span> These are made-up
            stations and prices for development — they are not real forecourts.
          </p>
        </div>
      )}

      <fieldset className="mb-3 flex flex-wrap gap-1.5 border-0 p-0">
        <legend className="sr-only">Brand filter</legend>
        {BRAND_FILTER_OPTIONS.map((opt) => {
          const active = brandFilter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              title={opt.hint}
              onClick={() => setBrandFilter(opt.key as BrandFilter)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                active
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                  : "bg-slate-900/80 text-slate-400 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {brandOptions.length > 0 && (
          <button
            type="button"
            onClick={() => setBrandPanelOpen((open) => !open)}
            title="Hide brands you can't or don't want to use (e.g. membership-only forecourts)"
            aria-expanded={brandPanelOpen}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
              excludedBrands.length > 0
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/25"
                : "bg-slate-900/80 text-slate-400 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Ban className="h-3 w-3" />
            Hide brands
            {excludedBrands.length > 0 && ` (${excludedBrands.length})`}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                brandPanelOpen && "rotate-180"
              )}
            />
          </button>
        )}
      </fieldset>

      <label className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 px-2.5 py-2 ring-1 ring-slate-700/60">
        <span>
          <span className="block text-[11px] font-semibold text-slate-300">
            Price last changed
          </span>
          <span className="block text-[10px] text-slate-500">
            Optional freshness filter
          </span>
        </span>
        <select
          value={priceFreshnessFilter}
          onChange={(event) =>
            setPriceFreshnessFilter(
              event.target.value as PriceFreshnessFilter
            )
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] font-medium text-slate-200 outline-none ring-teal-500/40 focus:border-teal-500/60 focus:ring-2"
          aria-label="Maximum price age"
        >
          {PRICE_FRESHNESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {brandPanelOpen && brandOptions.length > 0 && (
        <div className="mb-3 rounded-lg bg-slate-900/60 p-2.5 ring-1 ring-slate-700/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400">
              Tap a brand to hide its stations — handy for membership-only
              forecourts like Costco.
            </p>
            {excludedBrands.length > 0 && (
              <button
                type="button"
                onClick={clearExcludedBrands}
                className="shrink-0 text-[11px] font-semibold text-teal-300 transition hover:text-teal-200"
              >
                Show all
              </button>
            )}
          </div>
          <fieldset className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto border-0 p-0 pr-1">
            <legend className="sr-only">Hidden brands</legend>
            {brandOptions.map((opt) => {
              const hidden = excludedBrands.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={hidden}
                  onClick={() => toggleExcludedBrand(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
                    hidden
                      ? "bg-rose-500/15 text-rose-300 line-through ring-1 ring-rose-500/40 hover:bg-rose-500/25"
                      : "bg-slate-950/60 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <BrandLogo brand={opt.label} size="sm" />
                  {opt.label}
                  <span className="ml-1 text-[10px] text-slate-500">
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </fieldset>
        </div>
      )}

      {error && !loading && (
        <div className="mb-2 rounded-lg bg-rose-950/50 px-3 py-2.5 ring-1 ring-rose-500/30">
          <p className="text-xs leading-snug text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadStations()}
            disabled={!tripReady}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-500/40 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      )}

      {!loading && stations.length === 0 && !error && dataSource && (
        <div className="mb-3 space-y-3">
          <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
            No forecourts within {CORRIDOR_MAX_DISTANCE_MILES} mi of your driving
            route. Try a longer corridor trip or a different origin/destination.
          </p>
          <ReportMissingStation defaultOpen />
        </div>
      )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        priceFreshnessFilter !== "any" && (
          <div className="mb-3 space-y-3">
            <div className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
              <p>
                No matching stations reported a price change{" "}
                {freshnessLabel.toLowerCase()}. Stations only report when a
                price changes, so older prices may still be current.
              </p>
              <button
                type="button"
                onClick={() => setPriceFreshnessFilter("any")}
                className="mt-2 text-[12px] font-semibold text-teal-300 transition hover:text-teal-200"
              >
                Show prices of any age
              </button>
            </div>
            <ReportMissingStation />
          </div>
        )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        priceFreshnessFilter === "any" &&
        excludedBrands.length > 0 && (
          <div className="mb-3 space-y-3">
            <div className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
              <p>
                Every in-range forecourt is hidden by your brand exclusions
                {brandFilter !== "all"
                  ? ` or the ${filterLabel.toLowerCase()} filter`
                  : ""}
                .
              </p>
              <button
                type="button"
                onClick={clearExcludedBrands}
                className="mt-2 text-[12px] font-semibold text-teal-300 transition hover:text-teal-200"
              >
                Show all brands
              </button>
            </div>
            <ReportMissingStation />
          </div>
        )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        priceFreshnessFilter === "any" &&
        excludedBrands.length === 0 &&
        brandFilter !== "all" && (
          <div className="mb-3 space-y-3">
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
              No {filterLabel.toLowerCase()} forecourts within your{" "}
              {rangeMiles.toFixed(0)} mi remaining range. Try another brand filter
              or top up the fill %.
            </p>
            <ReportMissingStation />
          </div>
        )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        priceFreshnessFilter === "any" &&
        excludedBrands.length === 0 &&
        brandFilter === "all" && (
          <div className="mb-3 space-y-3">
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
              No corridor forecourts within your {rangeMiles.toFixed(0)} mi
              remaining range (from {vehicle.fillPercentage}% fill). Increase fill
              % or start closer to a station.
            </p>
            <ReportMissingStation />
          </div>
        )}

      {!loading && stations.length === 0 && !error && !dataSource && (
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
          Run a search to compare nearby forecourts.
        </p>
      )}

      <div className="space-y-2.5">
        {enriched.map((item) => (
          <StationCard
            key={item.station.id}
            item={item}
            isBest={item.station.id === bestId}
            origin={originCoords}
            now={now}
            fuelType={vehicle.fuelType}
            selected={selectedStationId === item.station.id}
            onSelect={() => handleSelect(item.station.id)}
            onSelectNearby={selectStation}
          />
        ))}
      </div>

      {!loading && dataSource && enriched.length > 0 && (
        <div className="mt-3">
          <ReportMissingStation />
        </div>
      )}
    </div>
  );
}
