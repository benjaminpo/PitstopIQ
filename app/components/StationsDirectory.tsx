"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Ban,
  ChevronDown,
  Clock,
  Fuel,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { AppLogo } from "@/app/components/AppLogo";
import { AccountMenu } from "@/app/components/AccountMenu";
import { BrandLogo } from "@/app/components/BrandLogo";
import { FreshnessBadge } from "@/app/components/FreshnessBadge";
import { NavigateHere } from "@/app/components/NavigateHere";
import {
  BRAND_FILTER_OPTIONS,
  distinctBrandOptions,
  type BrandFilter,
} from "@/app/lib/brandCategory";
import {
  ALL_FUEL_TYPES,
  FUEL_TYPE_SHORT,
  UK_BOUNDS,
} from "@/app/lib/fuelConstants";
import {
  PRICE_FRESHNESS_OPTIONS,
  formatPriceAge,
  type PriceFreshnessFilter,
} from "@/app/lib/freshness";
import { isStationOpenNow } from "@/app/lib/stationFacilities";
import {
  DEFAULT_STATIONS_DIRECTORY_FILTERS,
  filterStationsDirectory,
  paginateStationsDirectory,
  sortStationsDirectory,
  stationNearbySearchHref,
  type SortDirection,
  type StationsDirectorySortKey,
} from "@/app/lib/stationsDirectory";
import type { FuelStation, FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

interface StationsResponse {
  stations: FuelStation[];
  source: "live" | "mock";
  pricesFetchedAt: number | null;
  count: number;
  error?: string;
}

const SORT_OPTIONS: { key: StationsDirectorySortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "name", label: "Name" },
  { key: "location", label: "Location" },
  { key: "updated", label: "Updated" },
];

function formatPrice(price: number | undefined): string {
  return price === undefined || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

function locationLabel(station: FuelStation): string {
  return [station.address, station.postcode].filter(Boolean).join(", ") || "—";
}

function openStatus(
  station: FuelStation,
  now: Date
): "open" | "closed" | "unknown" {
  if (!station.openingHours) return "unknown";
  return isStationOpenNow(station, now) ? "open" : "closed";
}

function openStatusLabel(status: "open" | "closed" | "unknown"): string {
  if (status === "open") return "Open now";
  if (status === "closed") return "Closed now";
  return "Hours unknown";
}

function openStatusClass(status: "open" | "closed" | "unknown"): string {
  if (status === "open") {
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  }
  if (status === "closed") {
    return "bg-rose-500/10 text-rose-300 ring-rose-500/30";
  }
  return "bg-slate-900/80 text-slate-500 ring-slate-700/60";
}

export function StationsDirectory() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [pricesFetchedAt, setPricesFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState(DEFAULT_STATIONS_DIRECTORY_FILTERS.query);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    DEFAULT_STATIONS_DIRECTORY_FILTERS.brandFilter
  );
  const [excludedBrands, setExcludedBrands] = useState<string[]>([]);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const [fuelType, setFuelType] = useState<FuelType>(
    DEFAULT_STATIONS_DIRECTORY_FILTERS.fuelType
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

  const loadStations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        north: String(UK_BOUNDS.north),
        south: String(UK_BOUNDS.south),
        east: String(UK_BOUNDS.east),
        west: String(UK_BOUNDS.west),
      });
      const response = await fetch(`/api/fuel-finder?${params}`);
      const body = (await response.json()) as StationsResponse;
      if (!response.ok) {
        throw new Error(body.error || "Could not load stations");
      }
      setStations(body.stations ?? []);
      setSource(body.source);
      setPricesFetchedAt(body.pricesFetchedAt);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load stations"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStations();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    query,
    brandFilter,
    excludedBrands,
    fuelType,
    priceFreshnessFilter,
    openNowFilter,
    requireSelectedFuel,
    sortKey,
    sortDirection,
  ]);

  const brandOptions = useMemo(
    () => distinctBrandOptions(stations),
    [stations]
  );

  const filtered = useMemo(
    () =>
      filterStationsDirectory(
        stations,
        {
          query,
          brandFilter,
          excludedBrands,
          fuelType,
          priceFreshnessFilter,
          openNowFilter,
          requireSelectedFuel,
        },
        new Date(now)
      ),
    [
      stations,
      query,
      brandFilter,
      excludedBrands,
      fuelType,
      priceFreshnessFilter,
      openNowFilter,
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

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(14,116,144,0.12),transparent_45%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to planner
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="PitstopIQ home">
                <AppLogo />
              </Link>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                All stations
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Browse UK Fuel Finder forecourts with live prices. Sort by price,
                name, location, or last update — and filter by brand, freshness,
                and open hours.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {source && (
              <FreshnessBadge
                source={source}
                pricesFetchedAt={pricesFetchedAt}
                now={now}
              />
            )}
            <button
              type="button"
              onClick={() => void loadStations()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-teal-600/50 hover:bg-teal-950/50 hover:text-teal-200 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <AccountMenu />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <span className="sr-only">Search stations</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, brand, postcode, or address"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none ring-teal-500/40 placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <fieldset className="flex flex-wrap gap-1.5 border-0 p-0">
                <legend className="sr-only">Brand filter</legend>
                {BRAND_FILTER_OPTIONS.map((opt) => {
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
                {brandOptions.length > 0 && (
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

            {brandPanelOpen && brandOptions.length > 0 && (
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

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                  Fuel
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
                  Price age
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
            <button
              type="button"
              onClick={() => void loadStations()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-100 transition hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        )}

        {loading && stations.length === 0 && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 px-4 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
            Fetching national Fuel Finder prices…
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-16 text-center text-sm text-slate-500">
            No stations match these filters. Clear search, brand exclusions, or
            open-now / freshness filters and try again.
          </div>
        )}

        {visible.length > 0 && (
          <ul className="space-y-2.5">
            {visible.map((station) => {
              const price = station.prices[fuelType];
              const updatedAt =
                station.pricesUpdatedAt?.[fuelType] ??
                station.pricesLastUpdatedAt;
              const status = openStatus(station, new Date(now));
              return (
                <li
                  key={station.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-3.5 shadow-lg shadow-slate-950/30 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2.5">
                        <BrandLogo brand={station.brand} size="md" />
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-slate-100">
                            {station.name}
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {station.brand}
                          </p>
                          <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-slate-500">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{locationLabel(station)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ALL_FUEL_TYPES.map((type) => {
                          const gradePrice = station.prices[type];
                          if (gradePrice == null) return null;
                          return (
                            <span
                              key={type}
                              className={cn(
                                "rounded-md px-2 py-0.5 font-mono text-[11px] ring-1",
                                type === fuelType
                                  ? "bg-teal-500/15 text-teal-200 ring-teal-500/40"
                                  : "bg-slate-900/80 text-slate-300 ring-slate-700/60"
                              )}
                            >
                              {FUEL_TYPE_SHORT[type]}{" "}
                              {formatPrice(gradePrice)}
                            </span>
                          );
                        })}
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
                            openStatusClass(status)
                          )}
                        >
                          {openStatusLabel(status)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-40">
                      <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-center ring-1 ring-slate-700/60">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          {FUEL_TYPE_SHORT[fuelType]}
                        </p>
                        <p className="font-mono text-lg font-semibold text-slate-100">
                          {formatPrice(price)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {updatedAt
                            ? `Updated ${formatPriceAge(updatedAt, now)}`
                            : "Update time unknown"}
                        </p>
                      </div>
                      <Link
                        href={stationNearbySearchHref(station)}
                        className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
                      >
                        Compare nearby
                      </Link>
                      <NavigateHere
                        target={{
                          location: station.location,
                          name: station.name,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
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
      </div>
    </div>
  );
}
