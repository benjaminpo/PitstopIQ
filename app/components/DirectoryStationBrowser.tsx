"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Ban,
  ChevronDown,
  Clock,
  Fuel,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { DirectoryStationCard } from "@/app/components/DirectoryStationCard";
import {
  BRAND_FILTER_OPTIONS,
  distinctBrandOptions,
  type BrandFilter,
} from "@/app/lib/brandCategory";
import {
  ALL_FUEL_TYPES,
  FUEL_TYPE_SHORT,
} from "@/app/lib/fuelConstants";
import {
  PRICE_FRESHNESS_OPTIONS,
  type PriceFreshnessFilter,
} from "@/app/lib/freshness";
import { distinctAmenityOptions } from "@/app/lib/stationFacilities";
import {
  DEFAULT_STATIONS_DIRECTORY_FILTERS,
  filterStationsDirectory,
  paginateStationsDirectory,
  sortStationsDirectory,
  STATIONS_DIRECTORY_PAGE_SIZE,
  type SortDirection,
  type StationsDirectorySortKey,
} from "@/app/lib/stationsDirectory";
import type { FuelStation, FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

const SORT_OPTIONS: { key: StationsDirectorySortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "name", label: "Name" },
  { key: "location", label: "Location" },
  { key: "updated", label: "Changed" },
];

export interface DirectoryStationBrowserProps {
  stations: FuelStation[];
  pricesFetchedAt?: number | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingLabel?: string;
  /** All / supermarket / motorway / premium plus hide-brands. */
  showBrandFilters?: boolean;
  /** Rank badges (1-based across the full sorted list). */
  showRank?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Controlled fuel grade so parent snapshots stay in sync. */
  fuelType?: FuelType;
  onFuelTypeChange?: (fuel: FuelType) => void;
}

export function DirectoryStationBrowser({
  stations,
  pricesFetchedAt = null,
  loading = false,
  error = null,
  onRetry,
  loadingLabel = "Fetching Fuel Finder prices…",
  showBrandFilters = true,
  showRank = false,
  searchPlaceholder = "Search name, brand, postcode, or address",
  emptyMessage = "No stations match these filters. Clear search, freshness, or open-now filters and try again.",
  fuelType: fuelTypeProp,
  onFuelTypeChange,
}: Readonly<DirectoryStationBrowserProps>) {
  const [query, setQuery] = useState(DEFAULT_STATIONS_DIRECTORY_FILTERS.query);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    DEFAULT_STATIONS_DIRECTORY_FILTERS.brandFilter
  );
  const [excludedBrands, setExcludedBrands] = useState<string[]>([]);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const [amenityFilter, setAmenityFilter] = useState<string[]>(
    DEFAULT_STATIONS_DIRECTORY_FILTERS.amenityFilter
  );
  const [amenityPanelOpen, setAmenityPanelOpen] = useState(false);
  const [internalFuelType, setInternalFuelType] = useState<FuelType>(
    fuelTypeProp ?? DEFAULT_STATIONS_DIRECTORY_FILTERS.fuelType
  );
  const [priceFreshnessFilter, setPriceFreshnessFilter] =
    useState<PriceFreshnessFilter>(
      DEFAULT_STATIONS_DIRECTORY_FILTERS.priceFreshnessFilter
    );
  const [openNowFilter, setOpenNowFilter] = useState(false);
  const [requireSelectedFuel, setRequireSelectedFuel] = useState(true);
  const [sortKey, setSortKey] = useState<StationsDirectorySortKey>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  const fuelType = fuelTypeProp ?? internalFuelType;
  const setFuelType = (next: FuelType) => {
    onFuelTypeChange?.(next);
    if (fuelTypeProp === undefined) setInternalFuelType(next);
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filterEpoch = useMemo(
    () =>
      [
        query,
        brandFilter,
        excludedBrands.join("\0"),
        fuelType,
        priceFreshnessFilter,
        openNowFilter,
        amenityFilter.join("\0"),
        requireSelectedFuel,
        sortKey,
        sortDirection,
      ].join("|"),
    [
      query,
      brandFilter,
      excludedBrands,
      fuelType,
      priceFreshnessFilter,
      openNowFilter,
      amenityFilter,
      requireSelectedFuel,
      sortKey,
      sortDirection,
    ]
  );
  const [pageFilterEpoch, setPageFilterEpoch] = useState(filterEpoch);
  if (pageFilterEpoch !== filterEpoch) {
    setPageFilterEpoch(filterEpoch);
    setPage(1);
  }

  const brandOptions = useMemo(
    () => (showBrandFilters ? distinctBrandOptions(stations) : []),
    [showBrandFilters, stations]
  );
  const amenityOptions = useMemo(
    () => distinctAmenityOptions(stations),
    [stations]
  );

  const filtered = useMemo(
    () =>
      filterStationsDirectory(
        stations,
        {
          query,
          brandFilter: showBrandFilters ? brandFilter : "all",
          excludedBrands: showBrandFilters ? excludedBrands : [],
          fuelType,
          priceFreshnessFilter,
          openNowFilter,
          amenityFilter,
          requireSelectedFuel,
        },
        new Date(now)
      ),
    [
      stations,
      query,
      showBrandFilters,
      brandFilter,
      excludedBrands,
      fuelType,
      priceFreshnessFilter,
      openNowFilter,
      amenityFilter,
      requireSelectedFuel,
      now,
    ]
  );

  const sorted = useMemo(
    () => sortStationsDirectory(filtered, sortKey, sortDirection, fuelType),
    [filtered, sortKey, sortDirection, fuelType]
  );

  const { page: safePage, pageCount, items: visible } = useMemo(
    () => paginateStationsDirectory(sorted, page),
    [sorted, page]
  );

  const changeSort = (key: StationsDirectorySortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "updated" ? "desc" : "asc");
  };

  const toggleExcludedBrand = (brandKey: string) => {
    setExcludedBrands((current) =>
      current.includes(brandKey)
        ? current.filter((key) => key !== brandKey)
        : [...current, brandKey]
    );
  };

  const toggleAmenityFilter = (amenityId: string) => {
    setAmenityFilter((current) =>
      current.includes(amenityId)
        ? current.filter((id) => id !== amenityId)
        : [...current, amenityId]
    );
  };

  const rankOffset = (safePage - 1) * STATIONS_DIRECTORY_PAGE_SIZE;

  return (
    <>
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search stations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none ring-teal-500/40 placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="flex flex-wrap gap-1.5 border-0 p-0">
              <legend className="sr-only">
                {showBrandFilters ? "Brand filter" : "List filters"}
              </legend>
              {showBrandFilters &&
                BRAND_FILTER_OPTIONS.map((opt) => {
                  const active = brandFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      title={opt.hint}
                      onClick={() => setBrandFilter(opt.key)}
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
              {showBrandFilters && brandOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBrandPanelOpen((open) => !open)}
                  aria-expanded={brandPanelOpen}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                    excludedBrands.length > 0
                      ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40"
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
              {amenityOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAmenityPanelOpen((open) => !open)}
                  aria-expanded={amenityPanelOpen}
                  title="Only show stations that list the selected facilities"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                    amenityFilter.length > 0
                      ? "bg-teal-600/20 text-teal-200 ring-1 ring-teal-500/40"
                      : "bg-slate-900/80 text-slate-400 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  Facilities
                  {amenityFilter.length > 0 && ` (${amenityFilter.length})`}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      amenityPanelOpen && "rotate-180"
                    )}
                  />
                </button>
              )}
            </fieldset>

            <button
              type="button"
              aria-pressed={openNowFilter}
              onClick={() => setOpenNowFilter((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ring-1",
                openNowFilter
                  ? "bg-teal-600/20 text-teal-200 ring-teal-500/40"
                  : "bg-slate-900/80 text-slate-400 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <Clock className="h-3 w-3" />
              Open now
            </button>

            <button
              type="button"
              aria-pressed={requireSelectedFuel}
              onClick={() => setRequireSelectedFuel((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ring-1",
                requireSelectedFuel
                  ? "bg-teal-600/20 text-teal-200 ring-teal-500/40"
                  : "bg-slate-900/80 text-slate-400 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <Fuel className="h-3 w-3" />
              Has {FUEL_TYPE_SHORT[fuelType]}
            </button>
          </div>

          {showBrandFilters && brandPanelOpen && brandOptions.length > 0 && (
            <div className="rounded-lg bg-slate-900/60 p-2.5 ring-1 ring-slate-700/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Tap a brand to hide it from results.
                </p>
                {excludedBrands.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcludedBrands([])}
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
                          ? "bg-rose-500/15 text-rose-300 line-through ring-1 ring-rose-500/40"
                          : "bg-slate-950/60 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800"
                      )}
                    >
                      <BrandLogo brand={opt.label} size="sm" />
                      {opt.label}
                      <span className="text-[10px] text-slate-500">
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </fieldset>
            </div>
          )}

          {amenityPanelOpen && amenityOptions.length > 0 && (
            <div className="rounded-lg bg-slate-900/60 p-2.5 ring-1 ring-slate-700/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Show only stations that list every selected facility.
                </p>
                {amenityFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmenityFilter([])}
                    className="shrink-0 text-[11px] font-semibold text-teal-300 transition hover:text-teal-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <fieldset className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto border-0 p-0 pr-1">
                <legend className="sr-only">Required facilities</legend>
                {amenityOptions.map((opt) => {
                  const active = amenityFilter.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleAmenityFilter(opt.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
                        active
                          ? "bg-teal-600/25 text-teal-100 ring-1 ring-teal-500/45"
                          : "bg-slate-950/60 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800"
                      )}
                    >
                      {opt.label}
                      <span className="text-[10px] text-slate-500">
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </fieldset>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                <span>Fuel</span>
                <select
                  value={fuelType}
                  onChange={(event) =>
                    setFuelType(event.target.value as FuelType)
                  }
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] font-medium text-slate-200 outline-none ring-teal-500/40 focus:border-teal-500/60 focus:ring-2"
                >
                  {ALL_FUEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FUEL_TYPE_SHORT[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                <span>Price age</span>
                <select
                  value={priceFreshnessFilter}
                  onChange={(event) =>
                    setPriceFreshnessFilter(
                      event.target.value as PriceFreshnessFilter
                    )
                  }
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] font-medium text-slate-200 outline-none ring-teal-500/40 focus:border-teal-500/60 focus:ring-2"
                >
                  {PRICE_FRESHNESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-900/80 p-1 ring-1 ring-slate-700/60">
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-500" />
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => changeSort(opt.key)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium transition",
                      active
                        ? "bg-slate-700 text-slate-100"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {opt.label}
                    {active && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>
          {loading
            ? "Loading Fuel Finder stations…"
            : `${sorted.length.toLocaleString()} matching · ${stations.length.toLocaleString()} loaded`}
        </p>
        {!loading && sorted.length > 0 && (
          <p>
            Page {safePage} of {pageCount.toLocaleString()}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/50 px-4 py-3 ring-1 ring-rose-500/30">
          <p className="text-sm text-rose-200">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-100 transition hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          )}
        </div>
      )}

      {loading && stations.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 px-4 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
          {loadingLabel}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-16 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2.5">
          {visible.map((station, index) => (
            <DirectoryStationCard
              key={station.id}
              station={station}
              fuelType={fuelType}
              rank={showRank ? rankOffset + index + 1 : undefined}
              now={now}
              pricesFetchedAt={pricesFetchedAt}
            />
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 pb-6">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {safePage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
