"use client";

import { Clock, Fuel, Wrench } from "lucide-react";
import {
  ALL_FUEL_TYPES,
  FUEL_TYPE_LABELS,
  FUEL_TYPE_SHORT,
} from "@/app/lib/fuelConstants";
import { formatPriceAge } from "@/app/lib/freshness";
import {
  formatAmenityLabel,
  formatOpeningHoursRows,
  stationClosureLabel,
} from "@/app/lib/stationFacilities";
import type { FuelStation, FuelType } from "@/app/lib/types";
import { StationClosureBadge } from "./StationClosureBadge";

interface StationDetailsProps {
  station: FuelStation;
  /** Current clock (epoch ms) for price update age */
  now?: number;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(3)}`;
}

function availablePrices(
  station: FuelStation
): Array<{ fuel: FuelType; price: number; updatedAt: number | null }> {
  const rows: Array<{
    fuel: FuelType;
    price: number;
    updatedAt: number | null;
  }> = [];
  for (const fuel of ALL_FUEL_TYPES) {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    rows.push({
      fuel,
      price,
      updatedAt:
        station.pricesUpdatedAt?.[fuel] ?? station.pricesLastUpdatedAt ?? null,
    });
  }
  return rows;
}

export function StationDetails({
  station,
  now,
}: Readonly<StationDetailsProps>) {
  const hourRows = station.openingHours
    ? formatOpeningHoursRows(station.openingHours)
    : [];
  const amenities = station.amenities ?? [];
  const hasClosure = stationClosureLabel(station) != null;
  const prices = availablePrices(station);

  if (
    hourRows.length === 0 &&
    amenities.length === 0 &&
    !hasClosure &&
    prices.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-700/70 pt-3">
      {hasClosure && (
        <section>
          <div className="flex flex-wrap gap-1.5">
            <StationClosureBadge station={station} />
          </div>
        </section>
      )}

      {prices.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Fuel className="h-3 w-3" />
            All fuel prices
          </h3>
          <dl className="mt-1.5 space-y-1.5">
            {prices.map((row) => (
              <div
                key={row.fuel}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <dt className="min-w-0 text-slate-400" title={FUEL_TYPE_LABELS[row.fuel]}>
                  <span className="font-medium text-slate-300">
                    {FUEL_TYPE_SHORT[row.fuel]}
                  </span>
                  <span className="ml-1.5 hidden text-[10px] text-slate-500 sm:inline">
                    {FUEL_TYPE_LABELS[row.fuel]}
                  </span>
                </dt>
                <dd className="shrink-0 text-right">
                  <span className="font-mono text-sm font-semibold text-slate-100">
                    {formatPrice(row.price)}
                  </span>
                  {now != null && row.updatedAt != null && (
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                      {formatPriceAge(row.updatedAt, now)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hourRows.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Clock className="h-3 w-3" />
            Opening hours
          </h3>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {hourRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="font-mono text-slate-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {amenities.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Wrench className="h-3 w-3" />
            Available facilities
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {amenities.map((id) => (
              <li
                key={id}
                className="rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-700/70"
              >
                {formatAmenityLabel(id)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
