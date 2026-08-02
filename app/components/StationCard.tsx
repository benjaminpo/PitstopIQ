"use client";

import { ArrowRightLeft, Clock, Fuel, Route, Sparkles, Star, Users } from "lucide-react";
import { formatGbp } from "@/app/lib/detourCalculator";
import {
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  FRESHNESS_DOT_CLASSES,
  STATION_AGE_TEXT_CLASSES,
} from "@/app/lib/freshness";
import type { FuelType, GeoPoint, StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { NavigateHere } from "./NavigateHere";
import { StationContribute } from "./StationContribute";
import { StatusBadge } from "./StatusBadge";

interface StationCardProps {
  item: StationWithCalculation;
  selected?: boolean;
  /** Highest net-after-time station — always shows navigate CTAs */
  isBest?: boolean;
  origin?: GeoPoint | null;
  /** Current clock (epoch ms) for rendering price update age */
  now?: number;
  fuelType?: FuelType;
  onSelect?: () => void;
}

function formatExtraMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return "<1 min";
  return `+${m} min`;
}

function cardSurfaceClass(selected?: boolean, isBest?: boolean): string {
  if (selected) {
    return "border-teal-500/60 bg-teal-950/40 shadow-md shadow-teal-950/30";
  }
  if (isBest) {
    return "border-teal-700/40 bg-slate-900/50 hover:border-teal-600/50";
  }
  return "border-slate-700/70 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70";
}

function netColorClass(net: number): string {
  if (net > 0.5) return "text-emerald-400";
  if (net < -0.5) return "text-rose-400";
  return "text-amber-400";
}

export function StationCard({
  item,
  selected,
  isBest,
  origin,
  now,
  fuelType,
  onSelect,
}: Readonly<StationCardProps>) {
  const { station, calculation, pricePerLitre, priceFromCommunity, community } =
    item;
  const priceUpdatedAt = priceFromCommunity
    ? community?.communityPriceUpdatedAt[fuelType ?? "E10"] ?? null
    : station.pricesLastUpdatedAt;
  const priceTone = now != null ? stationPriceTone(priceUpdatedAt, now) : null;
  const net = calculation.netAfterTime;
  const showNavigate = Boolean(selected || isBest);
  const avgRating = community?.avgRating;
  const ratingCount = community?.ratingCount ?? 0;

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-3.5 text-left transition",
        cardSurfaceClass(selected, isBest)
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full cursor-pointer text-left"
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
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-xs text-slate-400">{station.brand}</p>
              {ratingCount > 0 && avgRating != null && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300/90">
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  {avgRating.toFixed(1)}
                  <span className="text-slate-500">({ratingCount})</span>
                </span>
              )}
            </div>
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
            {priceFromCommunity ? (
              <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-teal-400/90">
                <Users className="h-2.5 w-2.5" />
                members
              </p>
            ) : (
              now != null &&
              priceTone != null && (
                <p
                  className={cn(
                    "mt-0.5 flex items-center gap-1 font-mono text-[10px]",
                    STATION_AGE_TEXT_CLASSES[priceTone]
                  )}
                  title={stationPriceAgeTitle(priceUpdatedAt, priceTone)}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      FRESHNESS_DOT_CLASSES[priceTone]
                    )}
                  />
                  {priceUpdatedAt != null
                    ? formatPriceAge(priceUpdatedAt, now)
                    : "age unknown"}
                </p>
              )
            )}
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
                netColorClass(net)
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
      </button>

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

      {selected && (
        <StationContribute
          key={station.id}
          stationId={station.id}
          stationName={station.name}
          officialPrices={station.prices}
          community={community}
        />
      )}
    </div>
  );
}
