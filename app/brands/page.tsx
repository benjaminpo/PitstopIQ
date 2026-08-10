import type { Metadata } from "next";
import Link from "next/link";
import { BrandsIndexView } from "@/app/components/BrandsIndexView";
import { loadBrandSummaries } from "@/app/lib/loadBrands";
import { SITE_NAME } from "@/app/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "UK fuel station brands",
  description: `Compare ${SITE_NAME} Fuel Finder petrol and diesel prices by brand — Tesco, Shell, BP, Asda, and more.`,
  alternates: {
    canonical: "/brands",
  },
};

export default async function BrandsPage() {
  const loaded = await loadBrandSummaries();

  if (!loaded.ok) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-2xl font-semibold tracking-tight">
          Brands temporarily unavailable
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Live Fuel Finder data isn’t available right now. Try again in a
          minute, or browse by location.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/locations"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
          >
            Locations
          </Link>
          <Link
            href="/stations"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-teal-600"
          >
            All stations
          </Link>
        </div>
      </main>
    );
  }

  return (
    <BrandsIndexView
      brands={loaded.brands}
      stationCount={loaded.stationCount}
      source={loaded.source}
    />
  );
}
