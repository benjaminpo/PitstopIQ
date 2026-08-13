"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Fuel } from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { DirectoryStationBrowser } from "@/app/components/DirectoryStationBrowser";
import { formatDirectoryPrice } from "@/app/components/DirectoryUi";
import {
  BRAND_BROWSE_CATEGORY_LABELS,
  type BrandDetail,
} from "@/app/lib/brandsDirectory";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

interface BrandDetailViewProps {
  detail: BrandDetail;
  source: "live" | "mock";
  pricesFetchedAt?: number | null;
}

export function BrandDetailView({
  detail,
  source,
  pricesFetchedAt = null,
}: Readonly<BrandDetailViewProps>) {
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
        current="brands"
        backHref="/brands"
        backLabel="All brands"
        title={detail.label}
        description={
          <>
            Live Fuel Finder prices
            {source === "mock" ? " (demo data)" : ""}. Filter by location,
            freshness, and open hours — or sort by price, name, location, or last
            update.
          </>
        }
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/75 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="inline-flex self-start rounded-2xl bg-slate-900/80 p-2.5 ring-1 ring-slate-700/60">
          <BrandLogo brand={detail.label} size="lg" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal-400/90">
            {BRAND_BROWSE_CATEGORY_LABELS[detail.category]}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Fuel className="h-3.5 w-3.5" />
            {detail.stationCount.toLocaleString()} stations across the UK
          </p>
        </div>
      </section>

      {availableFuels.length > 0 && (
        <section aria-label="Network price snapshot">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort by fuel &amp; network from / avg
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
        showBrandFilters={false}
        showRank
        fuelType={fuelType}
        onFuelTypeChange={setFuelType}
        searchPlaceholder="Search name, postcode, or address"
        emptyMessage="No stations match these filters. Clear search or open-now / freshness filters and try again."
      />

      <p className="pb-6 text-center text-xs text-slate-500">
        <Link href="/brands" className="text-teal-400 hover:text-teal-300">
          All brands
        </Link>
        {" · "}
        <Link href="/stations" className="text-teal-400 hover:text-teal-300">
          All stations
        </Link>
        {" · "}
        <Link href="/" className="text-teal-400 hover:text-teal-300">
          Planner
        </Link>
      </p>
    </DirectoryShell>
  );
}
