import Link from "next/link";
import { Fuel } from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { DirectoryStationCard } from "@/app/components/DirectoryStationCard";
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
  sortFuel?: FuelType;
  source: "live" | "mock";
}

export function BrandDetailView({
  detail,
  sortFuel = "E10",
  source,
}: Readonly<BrandDetailViewProps>) {
  const fuelSnapshot = ALL_FUEL_TYPES.filter(
    (fuel) =>
      detail.cheapestByFuel[fuel] != null || detail.averageByFuel[fuel] != null
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
            {source === "mock" ? " (demo data)" : ""}, sorted by{" "}
            {FUEL_TYPE_SHORT[sortFuel]} cheapest first.
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

      {fuelSnapshot.length > 0 && (
        <section aria-label="Network price snapshot">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Network from / avg
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-0.5">
            {fuelSnapshot.map((fuel) => {
              const cheapest = detail.cheapestByFuel[fuel];
              const average = detail.averageByFuel[fuel];
              return (
                <li
                  key={fuel}
                  className={cn(
                    "min-w-[7.5rem] shrink-0 rounded-xl px-3 py-2.5 ring-1",
                    fuel === sortFuel
                      ? "bg-teal-500/10 ring-teal-500/35"
                      : "bg-slate-900/60 ring-slate-800/80"
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
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="space-y-2.5 pb-10">
        {detail.stations.map(({ station }, index) => (
          <DirectoryStationCard
            key={station.id}
            station={station}
            fuelType={sortFuel}
            rank={index + 1}
          />
        ))}
      </ul>

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
