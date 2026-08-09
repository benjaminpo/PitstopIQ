"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, MapPin, Star, Wrench } from "lucide-react";
import { AccountMenu } from "@/app/components/AccountMenu";
import { AppLogo } from "@/app/components/AppLogo";
import { BrandLogo } from "@/app/components/BrandLogo";
import { FreshnessBadge } from "@/app/components/FreshnessBadge";
import { NavigateHere } from "@/app/components/NavigateHere";
import { StationPageInteractive } from "@/app/components/StationPageInteractive";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import { formatPriceAge } from "@/app/lib/freshness";
import {
  formatAmenityLabel,
  formatOpeningHoursRows,
  isStationOpenNow,
} from "@/app/lib/stationFacilities";
import { stationNearbySearchHref } from "@/app/lib/stationsDirectory";
import type { FuelStation, FuelType, StationCommunitySummary } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

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

function primaryFuel(station: FuelStation): FuelType {
  for (const fuel of ALL_FUEL_TYPES) {
    const price = station.prices[fuel];
    if (price != null && Number.isFinite(price)) return fuel;
  }
  return "E10";
}

interface StationPageViewProps {
  station: FuelStation;
  source: "live" | "mock";
  pricesFetchedAt: number | null;
  community?: StationCommunitySummary | null;
}

export function StationPageView({
  station,
  source,
  pricesFetchedAt,
  community = null,
}: Readonly<StationPageViewProps>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const hourRows = station.openingHours
    ? formatOpeningHoursRows(station.openingHours)
    : [];
  const amenities = station.amenities ?? [];
  const status = openStatus(station, new Date(now));
  const fuelType = primaryFuel(station);
  const highlightPrice = station.prices[fuelType];
  const updatedAt =
    station.pricesUpdatedAt?.[fuelType] ?? station.pricesLastUpdatedAt;
  const avgRating = community?.avgRating;
  const ratingCount = community?.ratingCount ?? 0;
  const place = locationLabel(station);

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
              href="/stations"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all stations
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="PitstopIQ home">
                <AppLogo />
              </Link>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                {station.name}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                {station.brand}
                {place !== "—" ? ` · ${place}` : ""}. Live Fuel Finder prices,
                opening hours, facilities, and member updates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FreshnessBadge
              source={source}
              pricesFetchedAt={pricesFetchedAt}
              now={now}
            />
            <AccountMenu />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-3.5 shadow-lg shadow-slate-950/30 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2.5">
                <BrandLogo brand={station.brand} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {station.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{station.brand}</p>
                  <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-slate-500">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{place}</span>
                  </p>
                  {ratingCount > 0 && avgRating != null && (
                    <p className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] text-amber-300/90">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {avgRating.toFixed(1)}
                      <span className="text-slate-500">({ratingCount})</span>
                    </p>
                  )}
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
                      {FUEL_TYPE_SHORT[type]} {formatPrice(gradePrice)}
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
                  {formatPrice(highlightPrice)}
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
        </section>

        {(hourRows.length > 0 || amenities.length > 0) && (
          <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
            <div
              className={cn(
                "grid gap-5",
                hourRows.length > 0 && amenities.length > 0 && "sm:grid-cols-2"
              )}
            >
              {hourRows.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    Opening hours
                  </h2>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {hourRows.map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-slate-500">{row.label}</dt>
                        <dd className="font-mono text-slate-200">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {amenities.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Wrench className="h-3.5 w-3.5" />
                    Facilities
                  </h2>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {amenities.map((id) => (
                      <li
                        key={id}
                        className="rounded-md bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-slate-700/70"
                      >
                        {formatAmenityLabel(id)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <StationPageInteractive
          station={station}
          fuelType={fuelType}
          initialCommunity={community}
        />

        <p className="pb-6 text-center text-xs text-slate-500">
          <Link href="/stations" className="text-teal-400 hover:text-teal-300">
            Browse all UK stations
          </Link>
          {" · "}
          <Link href="/" className="text-teal-400 hover:text-teal-300">
            Back to planner
          </Link>
        </p>
      </div>
    </div>
  );
}
