import Link from "next/link";
import { ArrowLeft, Fuel, MapPin, Navigation } from "lucide-react";
import { AccountMenu } from "@/app/components/AccountMenu";
import { AppLogo } from "@/app/components/AppLogo";
import { BrandLogo } from "@/app/components/BrandLogo";
import { NavigateHere } from "@/app/components/NavigateHere";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { LocationAreaDetail } from "@/app/lib/locationsDirectory";
import { stationHref } from "@/app/lib/stationPath";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

function formatPrice(price: number | undefined | null): string {
  return price == null || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

interface LocationAreaViewProps {
  detail: LocationAreaDetail;
  sortFuel?: FuelType;
  source: "live" | "mock";
}

export function LocationAreaView({
  detail,
  sortFuel = "E10",
  source,
}: Readonly<LocationAreaViewProps>) {
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
              href="/locations"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All locations
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="PitstopIQ home">
                <AppLogo />
              </Link>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                {detail.label} fuel prices
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Live Fuel Finder prices for postcode area {detail.area}
                {source === "mock" ? " (demo data)" : ""}. Sorted by{" "}
                {FUEL_TYPE_SHORT[sortFuel]} cheapest first.
              </p>
            </div>
          </div>
          <AccountMenu />
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-4 shadow-lg shadow-slate-950/30 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cheapest in {detail.area}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_FUEL_TYPES.map((fuel) => {
                  const price = detail.cheapestByFuel[fuel];
                  if (price == null) return null;
                  return (
                    <span
                      key={fuel}
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-[11px] ring-1",
                        fuel === sortFuel
                          ? "bg-teal-500/15 text-teal-200 ring-teal-500/40"
                          : "bg-slate-900/80 text-slate-300 ring-slate-700/60"
                      )}
                    >
                      {FUEL_TYPE_SHORT[fuel]} {formatPrice(price)}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Fuel className="h-3 w-3" />
                {detail.stationCount.toLocaleString()} stations
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-44">
              {detail.nearbySearchHref && (
                <Link
                  href={detail.nearbySearchHref}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Compare nearby
                </Link>
              )}
              {detail.centroid && (
                <NavigateHere
                  target={{
                    location: detail.centroid,
                    name: `${detail.label} fuel stations`,
                  }}
                />
              )}
            </div>
          </div>
        </section>

        <ul className="space-y-2.5 pb-10">
          {detail.stations.map(({ station, outcode, town }) => {
            const price = station.prices[sortFuel];
            const place = [town, station.postcode].filter(Boolean).join(" · ");
            return (
              <li
                key={station.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-3.5 shadow-lg shadow-slate-950/30 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
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
                        <p className="mt-0.5 text-xs text-slate-400">
                          {station.brand}
                          {outcode ? ` · ${outcode}` : ""}
                        </p>
                        {place && (
                          <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-slate-500">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{place}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ALL_FUEL_TYPES.map((fuel) => {
                        const gradePrice = station.prices[fuel];
                        if (gradePrice == null) return null;
                        return (
                          <span
                            key={fuel}
                            className={cn(
                              "rounded-md px-2 py-0.5 font-mono text-[11px] ring-1",
                              fuel === sortFuel
                                ? "bg-teal-500/15 text-teal-200 ring-teal-500/40"
                                : "bg-slate-900/80 text-slate-300 ring-slate-700/60"
                            )}
                          >
                            {FUEL_TYPE_SHORT[fuel]} {formatPrice(gradePrice)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-40">
                    <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-center ring-1 ring-slate-700/60">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        {FUEL_TYPE_SHORT[sortFuel]}
                      </p>
                      <p className="font-mono text-lg font-semibold text-slate-100">
                        {formatPrice(price)}
                      </p>
                    </div>
                    <Link
                      href={stationHref(station)}
                      className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
                    >
                      Station details
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
          })}
        </ul>
      </div>
    </div>
  );
}
