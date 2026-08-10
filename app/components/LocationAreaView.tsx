import Link from "next/link";
import { Fuel, Navigation } from "lucide-react";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { DirectoryStationCard } from "@/app/components/DirectoryStationCard";
import { formatDirectoryPrice } from "@/app/components/DirectoryUi";
import { NavigateHere } from "@/app/components/NavigateHere";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { LocationAreaDetail } from "@/app/lib/locationsDirectory";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

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
    <DirectoryShell>
      <DirectoryHeader
        current="locations"
        backHref="/locations"
        backLabel="All locations"
        title={`${detail.label} fuel prices`}
        description={
          <>
            Live Fuel Finder prices for postcode area {detail.area}
            {source === "mock" ? " (demo data)" : ""}. Sorted by{" "}
            {FUEL_TYPE_SHORT[sortFuel]} cheapest first.
          </>
        }
      />

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
                    {FUEL_TYPE_SHORT[fuel]} {formatDirectoryPrice(price)}
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
        {detail.stations.map(({ station }) => (
          <DirectoryStationCard
            key={station.id}
            station={station}
            fuelType={sortFuel}
          />
        ))}
      </ul>

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
