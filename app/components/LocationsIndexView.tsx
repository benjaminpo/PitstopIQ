import Link from "next/link";
import { ArrowLeft, Fuel, MapPin } from "lucide-react";
import { AccountMenu } from "@/app/components/AccountMenu";
import { AppLogo } from "@/app/components/AppLogo";
import {
  groupLocationAreasByLetter,
  type LocationAreaSummary,
} from "@/app/lib/locationsDirectory";

function formatPrice(price: number | null): string {
  return price == null || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

interface LocationsIndexViewProps {
  areas: LocationAreaSummary[];
  stationCount: number;
  source: "live" | "mock";
}

export function LocationsIndexView({
  areas,
  stationCount,
  source,
}: Readonly<LocationsIndexViewProps>) {
  const groups = groupLocationAreasByLetter(areas);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(14,116,144,0.12),transparent_45%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to planner
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="PitstopIQ home">
                <AppLogo />
              </Link>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Fuel prices by location
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Browse UK Fuel Finder forecourts by postcode area — like a local
                price checker for petrol and diesel near you.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/stations"
              className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-teal-600/50 hover:text-teal-200"
            >
              All stations
            </Link>
            <AccountMenu />
          </div>
        </header>

        <p className="text-xs text-slate-500">
          {areas.length.toLocaleString()} areas ·{" "}
          {stationCount.toLocaleString()} stations
          {source === "mock" ? " · demo data" : ""}
        </p>

        <nav aria-label="Jump to letter" className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <a
              key={group.letter}
              href={`#letter-${group.letter}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-xs font-semibold text-slate-300 ring-1 ring-slate-700/60 transition hover:bg-teal-950/50 hover:text-teal-200 hover:ring-teal-600/40"
            >
              {group.letter}
            </a>
          ))}
        </nav>

        <div className="space-y-8 pb-10">
          {groups.map((group) => (
            <section key={group.letter} id={`letter-${group.letter}`}>
              <h2 className="sticky top-0 z-[1] mb-3 bg-slate-950/90 py-1.5 text-sm font-semibold uppercase tracking-wide text-teal-300 backdrop-blur">
                {group.letter}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.areas.map((area) => (
                  <li key={area.key}>
                    <Link
                      href={area.href}
                      className="flex h-full flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5 transition hover:border-teal-700/50 hover:bg-teal-950/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {area.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {area.area}
                            {area.sampleTown ? ` · ${area.sampleTown}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-teal-200 ring-1 ring-slate-700/60">
                          {formatPrice(area.cheapestPrice)}
                        </span>
                      </div>
                      <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Fuel className="h-3 w-3" />
                        {area.stationCount.toLocaleString()} station
                        {area.stationCount === 1 ? "" : "s"}
                        <MapPin className="ml-1.5 h-3 w-3" />
                        E10 from
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
