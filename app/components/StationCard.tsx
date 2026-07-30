"use client";

import { ArrowRightLeft, ExternalLink, Fuel, Route } from "lucide-react";
import { formatGbp } from "@/app/lib/detourCalculator";
import type { StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface StationCardProps {
  item: StationWithCalculation;
  selected?: boolean;
  onSelect?: () => void;
}

function googleMapsUrl(lat: number, lng: number, name?: string): string {
  const query = name
    ? `${name}@${lat},${lng}`
    : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function StationCard({ item, selected, onSelect }: StationCardProps) {
  const { station, calculation, pricePerLitre } = item;
  const net = calculation.netFinancialSaving;
  const mapsHref = googleMapsUrl(
    station.location.lat,
    station.location.lng,
    station.name
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-xl border p-3.5 text-left transition",
        selected
          ? "border-teal-500/60 bg-teal-950/40 shadow-md shadow-teal-950/30"
          : "border-slate-700/70 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {station.name}
          </p>
          <p className="text-xs text-slate-400">{station.brand}</p>
        </div>
        <StatusBadge status={calculation.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Fuel className="h-3 w-3" />
            Price
          </div>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
            £{pricePerLitre.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Route className="h-3 w-3" />
            Detour
          </div>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
            {station.distanceOffRouteMiles.toFixed(1)} mi
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <ArrowRightLeft className="h-3 w-3" />
            Net
          </div>
          <p
            className={cn(
              "mt-0.5 font-mono text-sm font-semibold",
              net > 0.5
                ? "text-emerald-400"
                : net < -0.5
                  ? "text-rose-400"
                  : "text-amber-400"
            )}
          >
            {formatGbp(net)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Detour fuel £{calculation.detourFuelCost.toFixed(2)} · Gross{" "}
        {formatGbp(calculation.grossSavings)}
      </p>

      {selected && (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
