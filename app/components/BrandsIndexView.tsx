import Link from "next/link";
import { ArrowLeft, Fuel } from "lucide-react";
import { AccountMenu } from "@/app/components/AccountMenu";
import { AppLogo } from "@/app/components/AppLogo";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  groupBrandsByCategory,
  type BrandSummary,
} from "@/app/lib/brandsDirectory";

function formatPrice(price: number | null): string {
  return price == null || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

interface BrandsIndexViewProps {
  brands: BrandSummary[];
  stationCount: number;
  source: "live" | "mock";
}

export function BrandsIndexView({
  brands,
  stationCount,
  source,
}: Readonly<BrandsIndexViewProps>) {
  const groups = groupBrandsByCategory(brands);

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
                UK fuel station brands
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Compare live Fuel Finder petrol and diesel prices by brand —
                supermarket, oil majors, motorway operators, and independents.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/locations"
              className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-teal-600/50 hover:text-teal-200"
            >
              Locations
            </Link>
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
          {brands.length.toLocaleString()} brands ·{" "}
          {stationCount.toLocaleString()} stations
          {source === "mock" ? " · demo data" : ""}
        </p>

        <div className="space-y-10 pb-10">
          {groups.map((group) => (
            <section key={group.category} id={group.category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-300">
                {group.label}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.brands.map((brand) => (
                  <li key={brand.key}>
                    <Link
                      href={brand.href}
                      className="flex h-full flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5 transition hover:border-teal-700/50 hover:bg-teal-950/20"
                    >
                      <div className="flex items-start gap-2.5">
                        <BrandLogo brand={brand.label} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {brand.label}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Fuel className="h-3 w-3" />
                            {brand.stationCount.toLocaleString()} station
                            {brand.stationCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-slate-900/70 px-2.5 py-2 ring-1 ring-slate-800/80">
                          <dt className="text-slate-500">E10 from</dt>
                          <dd className="mt-0.5 font-mono text-sm font-semibold text-teal-200">
                            {formatPrice(brand.cheapestE10)}
                          </dd>
                          <dd className="mt-0.5 text-slate-500">
                            avg {formatPrice(brand.averageE10)}
                          </dd>
                        </div>
                        <div className="rounded-lg bg-slate-900/70 px-2.5 py-2 ring-1 ring-slate-800/80">
                          <dt className="text-slate-500">Diesel from</dt>
                          <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
                            {formatPrice(brand.cheapestDiesel)}
                          </dd>
                          <dd className="mt-0.5 text-slate-500">
                            avg {formatPrice(brand.averageDiesel)}
                          </dd>
                        </div>
                      </dl>
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
