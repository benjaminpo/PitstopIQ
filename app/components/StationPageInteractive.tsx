"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { StationContribute } from "@/app/components/StationContribute";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import { haversineMiles } from "@/app/lib/routing";
import { stationHref } from "@/app/lib/stationPath";
import { usePitstopStore } from "@/app/lib/store";
import type { FuelStation, FuelType, StationCommunitySummary } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

const StationLocationMap = dynamic(
  () => import("@/app/components/StationLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center rounded-xl bg-slate-900/80 text-sm text-slate-500 ring-1 ring-slate-700/60">
        Loading map…
      </div>
    ),
  }
);

const NEARBY_MAX_MILES = 3;
const NEARBY_LIMIT = 6;
/** ~3.5 mi pad so the Fuel Finder bounds query covers nearby forecourts */
const BOUNDS_PAD_DEG = 0.05;

function formatPrice(price: number | undefined): string {
  return price === undefined || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

function locationLabel(station: FuelStation): string {
  return [station.address, station.postcode].filter(Boolean).join(", ") || "—";
}

interface StationPageInteractiveProps {
  station: FuelStation;
  fuelType?: FuelType;
  initialCommunity?: StationCommunitySummary | null;
}

export function StationPageInteractive({
  station,
  fuelType = "E10",
  initialCommunity = null,
}: Readonly<StationPageInteractiveProps>) {
  const setCommunitySummary = usePitstopStore((s) => s.setCommunitySummary);
  const communityFromStore = usePitstopStore(
    (s) => s.communityByStationId[station.id]
  );
  const community = communityFromStore ?? initialCommunity ?? undefined;

  const [nearby, setNearby] = useState<
    Array<{ station: FuelStation; miles: number }>
  >([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);

  useEffect(() => {
    if (initialCommunity) {
      setCommunitySummary(station.id, initialCommunity);
    }
  }, [initialCommunity, setCommunitySummary, station.id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setNearbyLoading(true);
      try {
        const { lat, lng } = station.location;
        const params = new URLSearchParams({
          north: String(lat + BOUNDS_PAD_DEG),
          south: String(lat - BOUNDS_PAD_DEG),
          east: String(lng + BOUNDS_PAD_DEG),
          west: String(lng - BOUNDS_PAD_DEG),
        });
        const response = await fetch(`/api/fuel-finder?${params}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { stations?: FuelStation[] };
        const stations = body.stations ?? [];
        const ranked = stations
          .filter((s) => s.id !== station.id)
          .map((s) => ({
            station: s,
            miles: Number(
              haversineMiles(station.location, s.location).toFixed(2)
            ),
          }))
          .filter((entry) => entry.miles <= NEARBY_MAX_MILES)
          .sort((a, b) => a.miles - b.miles)
          .slice(0, NEARBY_LIMIT);
        if (!cancelled) setNearby(ranked);
      } catch {
        if (!cancelled) setNearby([]);
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [station]);

  const mapMarkers = useMemo(
    () => [
      { station, primary: true },
      ...nearby.map((entry) => ({ station: entry.station, primary: false })),
    ],
    [station, nearby]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <MapPin className="h-3.5 w-3.5" />
          Map
        </h2>
        <StationLocationMap
          markers={mapMarkers}
          className="h-64 w-full overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-700/60"
        />
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
        <StationContribute
          key={station.id}
          stationId={station.id}
          stationName={station.name}
          officialPrices={station.prices}
          community={community}
          className="mt-0 border-t-0 pt-0"
        />
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40 backdrop-blur-md sm:p-5">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <MapPin className="h-3.5 w-3.5" />
          Fuel stations nearby
        </h2>
        {nearbyLoading && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Finding nearby forecourts…
          </p>
        )}
        {!nearbyLoading && nearby.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            No other Fuel Finder stations within {NEARBY_MAX_MILES} miles.
          </p>
        )}
        {nearby.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {nearby.map(({ station: near, miles }) => {
              const nearPrice = near.prices[fuelType];
              return (
                <li
                  key={near.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-3.5 shadow-lg shadow-slate-950/30 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2.5">
                        <BrandLogo brand={near.brand} size="md" />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-100">
                            <Link
                              href={stationHref(near)}
                              className="transition hover:text-teal-200"
                            >
                              {near.name}
                            </Link>
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {near.brand}
                          </p>
                          <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-slate-500">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              {miles.toFixed(1)} mi · {locationLabel(near)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ALL_FUEL_TYPES.map((type) => {
                          const gradePrice = near.prices[type];
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
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-40">
                      <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-center ring-1 ring-slate-700/60">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          {FUEL_TYPE_SHORT[fuelType]}
                        </p>
                        <p className="font-mono text-lg font-semibold text-slate-100">
                          {formatPrice(nearPrice)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {miles.toFixed(1)} miles away
                        </p>
                      </div>
                      <Link
                        href={stationHref(near)}
                        className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
                      >
                        Station details
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
