"use client";

import { ArrowRightLeft, Clock, Fuel, Route, Sparkles } from "lucide-react";
import { formatGbp } from "@/app/lib/detourCalculator";
import type { GeoPoint, StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { NavigateHere } from "./NavigateHere";
import { StatusBadge } from "./StatusBadge";

interface StationCardProps {
  item: StationWithCalculation;
  selected?: boolean;
  /** Highest net-after-time station — always shows navigate CTAs */
  isBest?: boolean;
  origin?: GeoPoint | null;
  onSelect?: () => void;
}

function formatExtraMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return "<1 min";
  return `+${m} min`;
}

export function StationCard({
  item,
  selected,
  isBest,
  origin,
  onSelect,
}: StationCardProps) {
  const { station, calculation, pricePerLitre } = item;
  const net = calculation.netAfterTime;
  const showNavigate = Boolean(selected || isBest);

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
          : isBest
            ? "border-teal-700/40 bg-slate-900/50 hover:border-teal-600/50"
            : "border-slate-700/70 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-100">
              {station.name}
            </p>
            {isBest && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 ring-1 ring-teal-500/35">
                <Sparkles className="h-2.5 w-2.5" />
                Best
              </span>
            )}
          </div>
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
          <p className="mt-0.5 flex items-center gap-0.5 font-mono text-[10px] text-slate-500">
            <Clock className="h-2.5 w-2.5" />
            {formatExtraMinutes(calculation.detourExtraMinutes)}
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
        Fuel {formatGbp(calculation.netFinancialSaving)}
        {calculation.timeCostGbp > 0
          ? ` · Time −£${calculation.timeCostGbp.toFixed(2)}`
          : ""}{" "}
        · Gross {formatGbp(calculation.grossSavings)}
      </p>

      {showNavigate && (
        <NavigateHere
          className="mt-3"
          primary={Boolean(isBest)}
          target={{
            location: station.location,
            name: station.name,
            origin,
          }}
        />
      )}
    </div>
  );
}
