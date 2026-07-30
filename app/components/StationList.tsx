"use client";

import { ArrowUpDown } from "lucide-react";
import { usePitstopStore } from "@/app/lib/store";
import type { StationSortKey } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { StationCard } from "./StationCard";

const SORT_OPTIONS: { key: StationSortKey; label: string }[] = [
  { key: "netProfit", label: "Net profit" },
  { key: "distance", label: "Distance" },
  { key: "price", label: "Price" },
];

export function StationList() {
  const {
    sortKey,
    setSortKey,
    selectedStationId,
    setSelectedStationId,
    getEnrichedStations,
    loading,
    error,
    stations,
    dataSource,
  } = usePitstopStore();

  const enriched = getEnrichedStations();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Stations</h2>
          <p className="text-xs text-slate-500">
            {loading
              ? "Fetching Fuel Finder prices (first load can take a minute)…"
              : `${enriched.length} · ${dataSource === "live" ? "live GOV data" : dataSource === "mock" ? "mock data" : "—"} · ${SORT_OPTIONS.find((s) => s.key === sortKey)?.label.toLowerCase()}`}
          </p>
        </div>
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

      {error && (
        <p className="mb-2 rounded-lg bg-rose-950/50 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </p>
      )}

      {!loading && stations.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
          Run a search to compare nearby forecourts.
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {enriched.map((item) => (
          <StationCard
            key={item.station.id}
            item={item}
            selected={selectedStationId === item.station.id}
            onSelect={() => setSelectedStationId(item.station.id)}
          />
        ))}
      </div>
    </div>
  );
}
