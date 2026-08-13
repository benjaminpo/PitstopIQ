"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Fuel, Navigation } from "lucide-react";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { DirectoryStationBrowser } from "@/app/components/DirectoryStationBrowser";
import { formatDirectoryPrice } from "@/app/components/DirectoryUi";
import { NavigateHere } from "@/app/components/NavigateHere";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { LocationAreaDetail } from "@/app/lib/locationsDirectory";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

interface LocationAreaViewProps {
  detail: LocationAreaDetail;
  source: "live" | "mock";
  pricesFetchedAt?: number | null;
}

export function LocationAreaView({
  detail,
  source,
  pricesFetchedAt = null,
}: Readonly<LocationAreaViewProps>) {
  const availableFuels = useMemo(
    () =>
      ALL_FUEL_TYPES.filter(
        (fuel) =>
          detail.cheapestByFuel[fuel] != null ||
          detail.averageByFuel[fuel] != null
      ),
    [detail.cheapestByFuel, detail.averageByFuel]
  );

  const [fuelType, setFuelType] = useState<FuelType>(
    availableFuels[0] ?? "E10"
  );

  const stations = useMemo(
    () => detail.stations.map((row) => row.station),
    [detail.stations]
  );

  return (
    <DirectoryShell>
      <DirectoryHeader
        current="locations"
        backHref="/locations"
        backLabel="All locations"
        title={`${detail.label} fuel prices`}
        description={
          <>
            Live Fuel Finder prices for postcode area {detail.area}
            {source === "mock" ? " (demo data)" : ""}. Filter by brand,
            freshness, and open hours — or sort by price, name, location, or last
            update.
          </>
        }
      />

      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/75 p-4 shadow-lg shadow-slate-950/30 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Area {detail.area}
            </p>
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

      {availableFuels.length > 0 && (
        <section aria-label="Area price snapshot">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort by fuel &amp; area from / avg
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-0.5">
            {availableFuels.map((fuel) => {
              const cheapest = detail.cheapestByFuel[fuel];
              const average = detail.averageByFuel[fuel];
              const isActive = fuel === fuelType;
              return (
                <li key={fuel}>
                  <button
                    type="button"
                    onClick={() => setFuelType(fuel)}
                    aria-pressed={isActive}
                    className={cn(
                      "min-w-[7.5rem] shrink-0 rounded-xl px-3 py-2.5 text-left ring-1 transition",
                      isActive
                        ? "bg-teal-500/10 ring-teal-500/35"
                        : "bg-slate-900/60 ring-slate-800/80 hover:bg-slate-800/60 hover:ring-slate-700/80"
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {FUEL_TYPE_SHORT[fuel]}
                    </p>
                    <p className="mt-0.5 font-mono text-base font-semibold text-slate-100">
                      {formatDirectoryPrice(cheapest)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      avg {formatDirectoryPrice(average)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <DirectoryStationBrowser
        stations={stations}
        pricesFetchedAt={pricesFetchedAt}
        showBrandFilters
        showRank
        fuelType={fuelType}
        onFuelTypeChange={setFuelType}
        emptyMessage="No stations in this area match these filters. Clear search, brand exclusions, or open-now / freshness filters and try again."
      />

      <p className="pb-6 text-center text-xs text-slate-500">
        <Link href="/locations" className="text-teal-400 hover:text-teal-300">
          All locations
        </Link>
        {" · "}
        <Link href="/brands" className="text-teal-400 hover:text-teal-300">
          Brands
        </Link>
        {" · "}
        <Link href="/" className="text-teal-400 hover:text-teal-300">
          Planner
        </Link>
      </p>
    </DirectoryShell>
  );
}
