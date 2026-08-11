"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { NavigateHere } from "@/app/components/NavigateHere";
import { StationClosureBadge } from "@/app/components/StationClosureBadge";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import { formatOfficialPriceAgeLine } from "@/app/lib/freshness";
import {
  isStationOfficiallyClosed,
  isStationOpenNow,
} from "@/app/lib/stationFacilities";
import { stationHref } from "@/app/lib/stationPath";
import { stationNearbySearchHref } from "@/app/lib/stationsDirectory";
import type { FuelStation, FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

function formatPrice(price: number | undefined | null): string {
  return price == null || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

function locationLabel(station: FuelStation): string {
  return [station.address, station.postcode].filter(Boolean).join(", ") || "—";
}

type OpenStatus = "open" | "closed" | "unknown";

function openStatus(station: FuelStation, now: Date): OpenStatus {
  if (isStationOfficiallyClosed(station)) return "closed";
  if (!station.openingHours) return "unknown";
  return isStationOpenNow(station, now) ? "open" : "closed";
}

function openStatusLabel(status: OpenStatus): string {
  if (status === "open") return "Open now";
  if (status === "closed") return "Closed now";
  return "Hours unknown";
}

function openStatusClass(status: OpenStatus): string {
  if (status === "open") {
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  }
  if (status === "closed") {
    return "bg-rose-500/10 text-rose-300 ring-rose-500/30";
  }
  return "bg-slate-900/80 text-slate-500 ring-slate-700/60";
}

interface DirectoryStationCardProps {
  station: FuelStation;
  /** Fuel grade used for price highlighting (matches directory sort) */
  fuelType?: FuelType;
  /** Optional rank badge (brand cheapest-first lists) */
  rank?: number;
  /** Shared clock from parent list; falls back to a local ticker */
  now?: number;
  /** Dataset sync time — shown as “Checked …” beside price change age */
  pricesFetchedAt?: number | null;
}

/** Station card shared by All stations, brand detail, and location detail. */
export function DirectoryStationCard({
  station,
  fuelType = "E10",
  rank,
  now: nowProp,
  pricesFetchedAt,
}: Readonly<DirectoryStationCardProps>) {
  const [localNow, setLocalNow] = useState(() => Date.now());
  const now = nowProp ?? localNow;

  useEffect(() => {
    if (nowProp != null) return;
    const id = window.setInterval(() => setLocalNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [nowProp]);

  const status = openStatus(station, new Date(now));

  return (
    <li className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-3.5 shadow-lg shadow-slate-950/30 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            {rank != null && (
              <span className="mt-0.5 w-5 shrink-0 font-mono text-[10px] text-slate-600">
                {String(rank).padStart(2, "0")}
              </span>
            )}
            <BrandLogo brand={station.brand} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-100">
                <Link
                  href={stationHref(station)}
                  className="transition hover:text-teal-200"
                >
                  {station.name}
                </Link>
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{station.brand}</p>
              <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{locationLabel(station)}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <StationClosureBadge station={station} />
              {!isStationOfficiallyClosed(station) && (
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
                    openStatusClass(status)
                  )}
                >
                  {openStatusLabel(status)}
                </span>
              )}
            </div>
            <dl className="grid gap-1.5 sm:grid-cols-2">
              {ALL_FUEL_TYPES.map((type) => {
                const gradePrice = station.prices[type];
                if (gradePrice == null) return null;
                const gradeUpdatedAt =
                  station.pricesUpdatedAt?.[type] ??
                  station.pricesLastUpdatedAt ??
                  null;
                return (
                  <div
                    key={type}
                    className={cn(
                      "flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 ring-1",
                      type === fuelType
                        ? "bg-teal-500/10 ring-teal-500/35"
                        : "bg-slate-900/70 ring-slate-700/60"
                    )}
                  >
                    <dt className="text-[11px] text-slate-400">
                      {FUEL_TYPE_SHORT[type]}
                    </dt>
                    <dd className="text-right">
                      <span className="font-mono text-sm font-semibold text-slate-100">
                        {formatPrice(gradePrice)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                        {formatOfficialPriceAgeLine(
                          gradeUpdatedAt,
                          pricesFetchedAt,
                          now
                        )}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-40">
          <Link
            href={stationHref(station)}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
          >
            Station details
          </Link>
          <Link
            href={stationNearbySearchHref(station)}
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/60 transition hover:bg-slate-700"
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
}
