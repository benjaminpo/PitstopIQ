"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ExternalLink,
  FileUp,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AppLogo } from "@/app/components/AppLogo";
import {
  parsePetrolPricesFile,
  suggestStationMatches,
  type PetrolPricesStation,
  type StationMatchSuggestion,
} from "@/app/lib/stationMatching";
import type { ConfirmedStationMatch } from "@/app/lib/stationPriceMatches";
import type { FuelStation, FuelType } from "@/app/lib/types";

interface AdminData {
  stations: FuelStation[];
  confirmed: ConfirmedStationMatch[];
  source: "live" | "mock";
  pricesFetchedAt: number | null;
}

type StationListSort =
  | "name"
  | "location"
  | FuelType
  | "pricesLastUpdatedAt";

const FUELS: Array<{ type: FuelType; label: string }> = [
  { type: "E10", label: "Unleaded" },
  { type: "E5", label: "Super" },
  { type: "B7_Diesel", label: "Diesel" },
  { type: "B7_Premium", label: "Premium D" },
];

const panelClass =
  "rounded-2xl border border-slate-800/80 bg-slate-900/50 shadow-xl shadow-slate-950/30";

function formatPrice(price: number | undefined): string {
  return price === undefined ? "—" : `${(price * 100).toFixed(1)}p`;
}

function formatUpdatedAt(timestamp: number | null | undefined): string {
  if (!timestamp) return "Update time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function PriceComparison({
  source,
  official,
}: Readonly<{ source: number | undefined; official: number | undefined }>) {
  const delta =
    source !== undefined && official !== undefined
      ? Math.round((source - official) * 1_000) / 10
      : null;
  return (
    <div className="min-w-[72px]">
      <div className="font-mono text-xs text-slate-100">
        {formatPrice(source)}
        <span className="text-slate-600"> / </span>
        {formatPrice(official)}
      </div>
      {delta !== null && (
        <div
          className={`mt-0.5 text-[10px] ${
            Math.abs(delta) < 0.05
              ? "text-emerald-400"
              : Math.abs(delta) <= 2
                ? "text-amber-400"
                : "text-rose-400"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}p
        </div>
      )}
    </div>
  );
}

export function AdminStationMatcher() {
  const [data, setData] = useState<AdminData | null>(null);
  const [sources, setSources] = useState<PetrolPricesStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "confirmed" | "unmatched">(
    "review"
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [manualPrices, setManualPrices] = useState<Partial<Record<FuelType, string>>>(
    {}
  );
  const [manualSourceUrl, setManualSourceUrl] = useState("");
  const [stationListQuery, setStationListQuery] = useState("");
  const [stationPage, setStationPage] = useState(1);
  const [stationSort, setStationSort] = useState<StationListSort>("name");
  const [stationSortDirection, setStationSortDirection] = useState<"asc" | "desc">(
    "asc"
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/station-matches", {
        cache: "no-store",
      });
      const body = (await response.json()) as AdminData & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load station data");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/station-matches", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as AdminData & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load station data");
        if (active) setData(body);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load data"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(
    () => suggestStationMatches(sources, data?.stations ?? []),
    [sources, data?.stations]
  );
  const confirmedKeys = useMemo(
    () =>
      new Set(
        (data?.confirmed ?? []).map(
          (match) => `${match.sourceStationId}:${match.officialStationId}`
        )
      ),
    [data?.confirmed]
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return suggestions.filter((suggestion) => {
      const isConfirmed = suggestion.station
        ? confirmedKeys.has(`${suggestion.source.sourceId}:${suggestion.station.id}`)
        : false;
      if (filter === "review" && (isConfirmed || !suggestion.station)) return false;
      if (filter === "confirmed" && !isConfirmed) return false;
      if (filter === "unmatched" && suggestion.station) return false;
      if (!needle) return true;
      return [
        suggestion.source.name,
        suggestion.source.postcode,
        suggestion.station?.name,
        suggestion.station?.postcode,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [confirmedKeys, filter, query, suggestions]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = parsePetrolPricesFile(await file.text(), file.name);
      if (parsed.length === 0) {
        throw new Error(
          "No valid stations found. Include name plus postcode or coordinates."
        );
      }
      setSources(parsed);
      setFilter("review");
    } catch (parseError) {
      setSources([]);
      setError(parseError instanceof Error ? parseError.message : "Could not read file");
    }
  };

  const confirm = async (suggestion: StationMatchSuggestion): Promise<boolean> => {
    if (!suggestion.station || saving) return false;
    setSaving(suggestion.source.sourceId);
    setError(null);
    try {
      const response = await fetch("/api/admin/station-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: suggestion.source,
          station: suggestion.station,
          score: suggestion.score,
        }),
      });
      const body = (await response.json()) as {
        match?: ConfirmedStationMatch;
        error?: string;
      };
      if (!response.ok || !body.match) {
        throw new Error(body.error || "Could not confirm match");
      }
      const savedMatch = body.match;
      setData((current) =>
        current
          ? {
              ...current,
              confirmed: [
                savedMatch,
                ...current.confirmed.filter((match) => match.id !== savedMatch.id),
              ],
              stations: current.stations.map((station) => {
                if (station.id !== savedMatch.officialStationId) return station;
                const pricesUpdatedAt = { ...station.pricesUpdatedAt };
                for (const fuel of Object.keys(savedMatch.sourcePrices) as FuelType[]) {
                  pricesUpdatedAt[fuel] = savedMatch.confirmedAt;
                }
                return {
                  ...station,
                  prices: { ...station.prices, ...savedMatch.sourcePrices },
                  pricesUpdatedAt,
                  pricesLastUpdatedAt: Math.max(
                    station.pricesLastUpdatedAt ?? 0,
                    savedMatch.confirmedAt
                  ),
                };
              }),
            }
          : current
      );
      window.localStorage.setItem(
        "pitstopiq-admin-price-updated",
        String(savedMatch.confirmedAt)
      );
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save match");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const stationResults = useMemo(() => {
    const needle = stationSearch.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (data?.stations ?? [])
      .filter((station) =>
        [station.name, station.brand, station.postcode, station.address].some((value) =>
          value?.toLowerCase().includes(needle)
        )
      )
      .slice(0, 8);
  }, [data?.stations, stationSearch]);

  const selectedStation =
    data?.stations.find((station) => station.id === selectedStationId) ?? null;
  const selectedSavedMatch = selectedStation
    ? data?.confirmed.find(
        (match) =>
          match.officialStationId === selectedStation.id &&
          match.sourceStationId === `manual:${selectedStation.id}`
      )
    : undefined;

  const selectStationForEditing = (station: FuelStation) => {
    setSelectedStationId(station.id);
    setStationSearch(
      `${station.name}${station.postcode ? ` · ${station.postcode}` : ""}`
    );
    const saved = data?.confirmed.find(
      (match) =>
        match.officialStationId === station.id &&
        match.sourceStationId === `manual:${station.id}`
    );
    const savedPrices: Partial<Record<FuelType, string>> = {};
    if (saved) {
      for (const { type } of FUELS) {
        const price = saved.sourcePrices[type];
        if (price !== undefined) savedPrices[type] = (price * 100).toFixed(1);
      }
    }
    setManualPrices(savedPrices);
    setManualSourceUrl(saved?.sourceUrl ?? "");
    requestAnimationFrame(() => {
      document
        .getElementById("manual-price-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const filteredStations = useMemo(() => {
    const needle = stationListQuery.trim().toLowerCase();
    if (!needle) return data?.stations ?? [];
    return (data?.stations ?? []).filter((station) =>
      [station.name, station.brand, station.postcode, station.address].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    );
  }, [data?.stations, stationListQuery]);
  const sortedStations = useMemo(() => {
    const valueFor = (station: FuelStation): string | number | null => {
      if (stationSort === "name") return station.name.toLowerCase();
      if (stationSort === "location") {
        return (station.postcode || station.address || "").toLowerCase() || null;
      }
      if (stationSort === "pricesLastUpdatedAt") {
        return station.pricesLastUpdatedAt ?? null;
      }
      return station.prices[stationSort] ?? null;
    };
    return [...filteredStations].sort((left, right) => {
      const a = valueFor(left);
      const b = valueFor(right);
      if (a === null && b === null) return left.name.localeCompare(right.name);
      if (a === null) return 1;
      if (b === null) return -1;
      const comparison =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b));
      return stationSortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredStations, stationSort, stationSortDirection]);
  const stationPageSize = 50;
  const stationPageCount = Math.max(
    1,
    Math.ceil(sortedStations.length / stationPageSize)
  );
  const visibleStations = sortedStations.slice(
    (stationPage - 1) * stationPageSize,
    stationPage * stationPageSize
  );

  const changeStationSort = (key: StationListSort) => {
    if (stationSort === key) {
      setStationSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setStationSort(key);
      setStationSortDirection(key === "pricesLastUpdatedAt" ? "desc" : "asc");
    }
    setStationPage(1);
  };

  const sortableHeading = (key: StationListSort, label: string) => (
    <button
      type="button"
      onClick={() => changeStationSort(key)}
      className="inline-flex items-center gap-1 transition hover:text-teal-300"
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${stationSort === key ? "text-teal-400" : "text-slate-700"}`}
      />
      {stationSort === key && (
        <span className="sr-only">
          {stationSortDirection === "asc" ? "ascending" : "descending"}
        </span>
      )}
    </button>
  );

  const petrolPricesUrlFor = (stationId: string) =>
    data?.confirmed.find(
      (match) => match.officialStationId === stationId && match.sourceUrl
    )?.sourceUrl ?? null;

  const saveManualPrices = async () => {
    if (!selectedStation) return;
    const sourceUrl = manualSourceUrl.trim();
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        if (
          url.protocol !== "https:" ||
          (url.hostname !== "petrolprices.com" &&
            !url.hostname.endsWith(".petrolprices.com"))
        ) {
          throw new Error();
        }
      } catch {
        setError("Enter a valid https://petrolprices.com station URL.");
        return;
      }
    }
    const prices: Partial<Record<FuelType, number>> = {};
    for (const { type } of FUELS) {
      const raw = manualPrices[type]?.trim();
      if (!raw) continue;
      const pence = Number(raw);
      if (!Number.isFinite(pence) || pence < 80 || pence > 350) {
        setError("Enter prices in pence per litre, between 80p and 350p.");
        return;
      }
      prices[type] = Math.round(pence * 10) / 1000;
    }
    if (Object.keys(prices).length === 0) {
      setError("Enter at least one PetrolPrices value.");
      return;
    }
    const source: PetrolPricesStation = {
      sourceId: `manual:${selectedStation.id}`,
      sourceUrl: sourceUrl || null,
      name: selectedStation.name,
      brand: selectedStation.brand,
      address: selectedStation.address ?? "",
      postcode: selectedStation.postcode ?? "",
      lat: selectedStation.location.lat,
      lng: selectedStation.location.lng,
      prices,
      updatedAt: new Date().toISOString(),
    };
    const saved = await confirm({
      source,
      station: selectedStation,
      score: 100,
      distanceMetres: 0,
    });
    if (saved) {
      setManualPrices(
        Object.fromEntries(
          Object.entries(prices).map(([fuel, price]) => [
            fuel,
            (price * 100).toFixed(1),
          ])
        )
      );
    }
  };

  const counts = {
    review: suggestions.filter(
      (item) =>
        item.station &&
        !confirmedKeys.has(`${item.source.sourceId}:${item.station.id}`)
    ).length,
    confirmed: suggestions.filter(
      (item) =>
        item.station &&
        confirmedKeys.has(`${item.source.sourceId}:${item.station.id}`)
    ).length,
    unmatched: suggestions.filter((item) => !item.station).length,
  };

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Back to PitstopIQ">
              <AppLogo size="sm" />
            </Link>
            <div className="hidden h-5 w-px bg-slate-800 sm:block" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                Station price matching
              </div>
              <p className="text-[11px] text-slate-500">Admin review workspace</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-teal-600 hover:text-teal-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6">
        <section id="manual-price-editor" className={`${panelClass} scroll-mt-4 p-5`}>
          <div>
            <h1 className="text-lg font-semibold text-white">
              Manually compare a PetrolPrices station
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              Find the station in PitstopIQ, enter the prices shown on PetrolPrices,
              review the difference, then save the check. Values are recorded for audit
              only and do not override public prices.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,1fr)_2fr]">
            <div className="relative">
              <label className="text-xs font-medium text-slate-300">
                1. Find a station
              </label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={stationSearch}
                  onChange={(event) => {
                    setStationSearch(event.target.value);
                    setSelectedStationId(null);
                  }}
                  placeholder="Name, postcode, brand or address"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
                />
              </div>
              {!selectedStation && stationResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl">
                  {stationResults.map((station) => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => selectStationForEditing(station)}
                      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-800"
                    >
                      <span className="block truncate text-xs font-medium text-slate-100">
                        {station.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {[station.brand, station.address, station.postcode]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStation && (
                <div className="mt-3 rounded-xl border border-teal-800/60 bg-teal-950/25 p-3">
                  <p className="text-xs font-semibold text-teal-100">
                    {selectedStation.name}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    {[selectedStation.brand, selectedStation.address, selectedStation.postcode]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">
                2. PetrolPrices station link
              </label>
              <div className="relative mt-1.5">
                <ExternalLink className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="url"
                  disabled={!selectedStation}
                  value={manualSourceUrl}
                  onChange={(event) => setManualSourceUrl(event.target.value)}
                  placeholder="https://www.petrolprices.com/..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600 disabled:opacity-50"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                Optional direct link to this station on petrolprices.com.
              </p>

              <label className="mt-4 block text-xs font-medium text-slate-300">
                3. Enter prices in pence per litre
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FUELS.map((fuel) => (
                  <label key={fuel.type} className="block">
                    <span className="text-[10px] text-slate-500">{fuel.label}</span>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        min="80"
                        max="350"
                        step="0.1"
                        inputMode="decimal"
                        disabled={!selectedStation}
                        value={manualPrices[fuel.type] ?? ""}
                        onChange={(event) =>
                          setManualPrices((current) => ({
                            ...current,
                            [fuel.type]: event.target.value,
                          }))
                        }
                        placeholder={
                          selectedStation?.prices[fuel.type]
                            ? (selectedStation.prices[fuel.type]! * 100).toFixed(1)
                            : "—"
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-7 font-mono text-sm outline-none focus:border-teal-600 disabled:opacity-50"
                      />
                      <span className="pointer-events-none absolute right-2 top-2.5 text-[10px] text-slate-500">
                        p
                      </span>
                    </div>
                    {selectedStation && (
                      <span className="mt-1 block text-[10px] text-slate-500">
                        Fuel Finder: {formatPrice(selectedStation.prices[fuel.type])}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedStation || saving !== null}
                onClick={() => void saveManualPrices()}
                className="mt-4 inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {saving?.startsWith("manual:") && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {selectedSavedMatch ? "Update price check" : "Save price check"}
              </button>
            </div>
          </div>

          <details className="mt-5 border-t border-slate-800 pt-4">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
              Have an authorised CSV or JSON export? Use bulk matching
            </summary>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-teal-600 hover:text-teal-200">
                <FileUp className="h-3.5 w-3.5" />
                Upload CSV or JSON
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="sr-only"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </label>
              <p className="text-[10px] text-slate-600">
                Supports station identity, coordinates and all four fuel grades.
              </p>
            </div>
          </details>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Stations", data?.stations.length ?? 0, "text-slate-100"],
            ["Saved checks", data?.confirmed.length ?? 0, "text-emerald-300"],
            ["Bulk review", counts.review, "text-amber-300"],
            ["Bulk unmatched", counts.unmatched, "text-rose-300"],
          ].map(([label, value, colour]) => (
            <div key={label} className={`${panelClass} px-4 py-3`}>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                {label}
              </p>
              <p className={`mt-1 text-2xl font-semibold ${colour}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className={panelClass}>
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Fuel Finder stations</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Dataset last refreshed:{" "}
                <span className="text-slate-300">
                  {formatUpdatedAt(data?.pricesFetchedAt)}
                </span>
                {" · "}The server checks for new official data every 15 minutes.
              </p>
            </div>
            <div className="flex gap-2">
              <label className="relative flex-1 lg:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  value={stationListQuery}
                  onChange={(event) => {
                    setStationListQuery(event.target.value);
                    setStationPage(1);
                  }}
                  placeholder="Filter stations, postcodes or brands"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-teal-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                title="Check for updated Fuel Finder data"
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-teal-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              Loading station list…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left">
                  <thead className="bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {sortableHeading("name", "Station")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {sortableHeading("location", "Location")}
                      </th>
                      {FUELS.map((fuel) => (
                        <th key={fuel.type} className="px-3 py-2.5 font-medium">
                          {sortableHeading(fuel.type, fuel.label)}
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-medium">
                        {sortableHeading("pricesLastUpdatedAt", "Price updated")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {visibleStations.map((station) => (
                      <tr key={station.id} className="transition hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => selectStationForEditing(station)}
                            className="block max-w-60 truncate text-left text-xs font-medium text-slate-100 transition hover:text-teal-300"
                          >
                            {station.name}
                          </button>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {station.brand || "Independent"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-64 truncate text-xs text-slate-300">
                            {station.address || "Address unavailable"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {station.postcode || "No postcode"}
                          </p>
                        </td>
                        {FUELS.map((fuel) => (
                          <td
                            key={fuel.type}
                            className="px-3 py-3 font-mono text-xs text-slate-200"
                            title={
                              station.pricesUpdatedAt?.[fuel.type]
                                ? `Updated ${formatUpdatedAt(station.pricesUpdatedAt[fuel.type])}`
                                : undefined
                            }
                          >
                            {formatPrice(station.prices[fuel.type])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-[10px] text-slate-400">
                          {formatUpdatedAt(station.pricesLastUpdatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {petrolPricesUrlFor(station.id) && (
                              <a
                                href={petrolPricesUrlFor(station.id)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-teal-600 hover:text-teal-200"
                              >
                                <ExternalLink className="h-3 w-3" />
                                PetrolPrices
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => selectStationForEditing(station)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-teal-600 hover:text-teal-200"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {visibleStations.length} of{" "}
                  {filteredStations.length.toLocaleString()} stations
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={stationPage <= 1}
                    onClick={() => setStationPage((page) => Math.max(1, page - 1))}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {stationPage} of {stationPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={stationPage >= stationPageCount}
                    onClick={() =>
                      setStationPage((page) => Math.min(stationPageCount, page + 1))
                    }
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className={panelClass}>
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Bulk match review</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Available when an authorised PetrolPrices export has been uploaded.
            </p>
          </div>
          <div className="flex flex-col gap-3 border-b border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(["review", "confirmed", "unmatched", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    filter === value
                      ? "bg-teal-900/70 text-teal-200 ring-1 ring-teal-700"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <label className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search station or postcode"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-teal-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                title="Refresh Fuel Finder stations"
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-teal-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              Loading UK Fuel Finder stations…
            </div>
          ) : sources.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
              <Check className="h-8 w-8 text-slate-700" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                Manual checks are ready above
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data?.confirmed.length
                  ? `${data.confirmed.length} price check${data.confirmed.length === 1 ? "" : "s"} saved.`
                  : `${data?.stations.length.toLocaleString() ?? 0} Fuel Finder stations are ready for comparison.`}
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-500">
              No stations match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">PetrolPrices station</th>
                    <th className="px-4 py-2.5 font-medium">Suggested Fuel Finder match</th>
                    {FUELS.map((fuel) => (
                      <th key={fuel.type} className="px-3 py-2.5 font-medium">
                        {fuel.label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-medium">Match</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {visible.map((suggestion) => {
                    const isConfirmed = suggestion.station
                      ? confirmedKeys.has(
                          `${suggestion.source.sourceId}:${suggestion.station.id}`
                        )
                      : false;
                    return (
                      <tr
                        key={suggestion.source.sourceId}
                        className="transition hover:bg-slate-800/30"
                      >
                        <td className="px-4 py-3">
                          <p className="max-w-56 truncate text-xs font-medium text-slate-100">
                            {suggestion.source.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {[suggestion.source.brand, suggestion.source.postcode]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {suggestion.station ? (
                            <>
                              <p className="max-w-56 truncate text-xs font-medium text-slate-200">
                                {suggestion.station.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {[suggestion.station.brand, suggestion.station.postcode]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-rose-300">No likely match</span>
                          )}
                        </td>
                        {FUELS.map((fuel) => (
                          <td key={fuel.type} className="px-3 py-3">
                            <PriceComparison
                              source={suggestion.source.prices[fuel.type]}
                              official={suggestion.station?.prices[fuel.type]}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              suggestion.score >= 80
                                ? "bg-emerald-950 text-emerald-300"
                                : suggestion.score >= 60
                                  ? "bg-amber-950 text-amber-300"
                                  : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {suggestion.score}%
                          </span>
                          {suggestion.distanceMetres !== null && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              {Math.round(suggestion.distanceMetres)}m
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={!suggestion.station || isConfirmed || saving !== null}
                            onClick={() => void confirm(suggestion)}
                            className={`inline-flex min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                              isConfirmed
                                ? "bg-emerald-950/60 text-emerald-300"
                                : "bg-teal-600 text-white hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500"
                            }`}
                          >
                            {saving === suggestion.source.sourceId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isConfirmed ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : null}
                            {isConfirmed ? "Confirmed" : "Confirm"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
            PetrolPrices / Fuel Finder · Prices shown as uploaded / official ·{" "}
            {data?.source === "mock" ? "development mock data" : "live official data"}
          </div>
        </section>
      </div>
    </main>
  );
}
