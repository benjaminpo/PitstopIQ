"use client";

import { ArrowRightLeft, Clock, Fuel, Route, Sparkles, Star, Users } from "lucide-react";
import { formatGbp } from "@/app/lib/detourCalculator";
import {
  FUEL_TYPE_LABELS,
  FUEL_TYPE_SHORT,
  fuelGradesForVehicle,
} from "@/app/lib/fuelConstants";
import {
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  FRESHNESS_DOT_CLASSES,
  STATION_AGE_TEXT_CLASSES,
} from "@/app/lib/freshness";
import type { FuelType, GeoPoint, StationWithCalculation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { NavigateHere } from "./NavigateHere";
import { StationContribute } from "./StationContribute";
import { StationDetails } from "./StationDetails";
import { StationWatchButton } from "./StationWatchButton";
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
  onSelectNearby?: (stationId: string) => void;
}

interface GradePriceRow {
  fuel: FuelType;
  price: number;
  fromCommunity: boolean;
  updatedAt: number | null;
}

function resolveGradePrices(
  item: StationWithCalculation,
  fuelType: FuelType
): GradePriceRow[] {
  const grades = fuelGradesForVehicle(fuelType);
  const community = item.community;
  const rows: GradePriceRow[] = [];

  for (const fuel of grades) {
    const communityPrice = community?.communityPrices[fuel];
    const fromCommunity =
      communityPrice != null && Number.isFinite(communityPrice);
    const official = item.station.prices[fuel];
    const price = fromCommunity ? communityPrice : official;
    if (price == null || !Number.isFinite(price)) continue;
    rows.push({
      fuel,
      price,
      fromCommunity,
      updatedAt: fromCommunity
        ? community?.communityPriceUpdatedAt[fuel] ?? null
        : item.station.pricesUpdatedAt?.[fuel] ??
          item.station.pricesLastUpdatedAt ??
          null,
    });
  }

  return rows;
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

function PriceFreshness({
  updatedAt,
  fromCommunity,
  now,
}: Readonly<{
  updatedAt: number | null;
  fromCommunity: boolean;
  now?: number;
}>) {
  const priceTone = now != null ? stationPriceTone(updatedAt, now) : null;

  if (fromCommunity) {
    return (
      <p
        className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-[10px] text-teal-400/90"
        title={
          now != null && priceTone != null
            ? stationPriceAgeTitle(updatedAt, priceTone)
            : undefined
        }
      >
        <span className="inline-flex items-center gap-1">
          <Users className="h-2.5 w-2.5" />
          members
        </span>
        {now != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              priceTone != null
                ? STATION_AGE_TEXT_CLASSES[priceTone]
                : "text-slate-500"
            )}
          >
            ·{" "}
            {updatedAt != null
              ? formatPriceAge(updatedAt, now)
              : "age unknown"}
          </span>
        )}
      </p>
    );
  }

  if (now == null || priceTone == null) return null;

  return (
    <p
      className={cn(
        "mt-0.5 flex items-center gap-1 font-mono text-[10px]",
        STATION_AGE_TEXT_CLASSES[priceTone]
      )}
      title={stationPriceAgeTitle(updatedAt, priceTone)}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          FRESHNESS_DOT_CLASSES[priceTone]
        )}
      />
      {updatedAt != null ? formatPriceAge(updatedAt, now) : "age unknown"}
    </p>
  );
}

export function StationCard({
  item,
  selected,
  isBest,
  origin,
  now,
  fuelType,
  onSelect,
  onSelectNearby,
}: Readonly<StationCardProps>) {
  const { station, calculation, pricePerLitre, priceFromCommunity, community } =
    item;
  const activeFuel = fuelType ?? "E10";
  const gradeRows = resolveGradePrices(item, activeFuel);
  const displayRows =
    gradeRows.length > 0
      ? gradeRows
      : [
          {
            fuel: activeFuel,
            price: pricePerLitre,
            fromCommunity: Boolean(priceFromCommunity),
            updatedAt: priceFromCommunity
              ? community?.communityPriceUpdatedAt[activeFuel] ?? null
              : station.pricesUpdatedAt?.[activeFuel] ??
                station.pricesLastUpdatedAt ??
                null,
          } satisfies GradePriceRow,
        ];
  const net = calculation.netAfterTime;
  const showNavigate = Boolean(selected || isBest);
  const avgRating = community?.avgRating;
  const ratingCount = community?.ratingCount ?? 0;

  return (
    <div
      id={`station-card-${station.id}`}
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
          <div className="flex min-w-0 items-start gap-2.5">
            <BrandLogo brand={station.brand} size="lg" className="mt-0.5" />
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
              {(station.address || station.postcode) && (
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {[station.address, station.postcode].filter(Boolean).join(" · ")}
                </p>
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
            <ul className="mt-0.5 space-y-1">
              {displayRows.map((row) => (
                <li key={row.fuel} title={FUEL_TYPE_LABELS[row.fuel]}>
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[10px] text-slate-500">
                      {FUEL_TYPE_SHORT[row.fuel]}
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-100">
                      £{row.price.toFixed(3)}
                    </span>
                  </div>
                  <PriceFreshness
                    updatedAt={row.updatedAt}
                    fromCommunity={row.fromCommunity}
                    now={now}
                  />
                </li>
              ))}
            </ul>
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
                "mt-0.5 font-mono text-base font-semibold sm:text-sm",
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
        <StationWatchButton
          stationId={station.id}
          stationName={station.name}
          stationBrand={station.brand}
          fuelType={activeFuel}
          baselinePrice={station.prices[activeFuel] ?? null}
        />
      )}

      {selected && (
        <StationDetails
          station={station}
          fuelType={activeFuel}
          onSelectNearby={onSelectNearby}
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
