"use client";

import { useEffect, useState } from "react";
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
import { usePitstopStore } from "@/app/lib/store";
import { CORRIDOR_MAX_DISTANCE_MILES } from "@/app/lib/routing";
import type { StationSortKey, StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
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
  const rangeMiles = remainingRangeMiles(vehicle);
  const brandOptions = distinctBrandOptions(stations);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const hiddenBrandsSuffix =
    excludedBrands.length === 0
      ? ""
      : ` · ${excludedBrands.length} ${excludedBrands.length === 1 ? "brand" : "brands"} hidden`;

  const handleSelect = (stationId: string) => {
    // Tapping the selected card again deselects it, restoring the direct route
    if (selectedStationId === stationId) {
      setSelectedStationId(null);
      return;
    }
    setSelectedStationId(stationId);
    // Below the md breakpoint the sidebar overlays the map, so close it to
    // reveal the selected station and its detour route.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
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
              ? "Fetching Fuel Finder prices (first load can take a minute)…"
              : `${enriched.length} in range (≤${rangeMiles.toFixed(0)} mi) · ${stations.length} on corridor · ${filterLabel} · ${SORT_OPTIONS.find((s) => s.key === sortKey)?.label.toLowerCase()}${hiddenBrandsSuffix}`}
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

      <div
        className="mb-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Brand filter"
      >
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
      </div>

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
          <div
            className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1"
            role="group"
            aria-label="Hidden brands"
          >
            {brandOptions.map((opt) => {
              const hidden = excludedBrands.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={hidden}
                  onClick={() => toggleExcludedBrand(opt.key)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium transition",
                    hidden
                      ? "bg-rose-500/15 text-rose-300 line-through ring-1 ring-rose-500/40 hover:bg-rose-500/25"
                      : "bg-slate-950/60 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  {opt.label}
                  <span className="ml-1 text-[10px] text-slate-500">
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
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
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
          No forecourts within {CORRIDOR_MAX_DISTANCE_MILES} mi of your driving
          route. Try a longer corridor trip or a different origin/destination.
        </p>
      )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        excludedBrands.length > 0 && (
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
        )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        excludedBrands.length === 0 &&
        brandFilter !== "all" && (
          <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
            No {filterLabel.toLowerCase()} forecourts within your{" "}
            {rangeMiles.toFixed(0)} mi remaining range. Try another brand filter
            or top up the fill %.
          </p>
        )}

      {!loading &&
        stations.length > 0 &&
        enriched.length === 0 &&
        !error &&
        excludedBrands.length === 0 &&
        brandFilter === "all" && (
          <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
            No corridor forecourts within your {rangeMiles.toFixed(0)} mi
            remaining range (from {vehicle.fillPercentage}% fill). Increase fill
            % or start closer to a station.
          </p>
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
          />
        ))}
      </div>
    </div>
  );
}
