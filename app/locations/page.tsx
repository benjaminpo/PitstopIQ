import type { Metadata } from "next";
import Link from "next/link";
import { LocationsIndexView } from "@/app/components/LocationsIndexView";
import { loadLocationAreaSummaries } from "@/app/lib/loadLocations";
import { SITE_NAME } from "@/app/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Fuel prices by location",
  description: `Browse ${SITE_NAME} Fuel Finder petrol and diesel prices by UK postcode area.`,
  alternates: {
    canonical: "/locations",
  },
};

export default async function LocationsPage() {
  const loaded = await loadLocationAreaSummaries("E10");

  if (!loaded.ok) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-2xl font-semibold tracking-tight">
          Locations temporarily unavailable
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Live Fuel Finder data isn’t available right now. Try again in a
          minute, or browse the full station list.
        </p>
        <Link
          href="/stations"
          className="mt-6 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
        >
          All stations
        </Link>
      </main>
    );
  }

  return (
    <LocationsIndexView
      areas={loaded.areas}
      stationCount={loaded.stationCount}
      source={loaded.source}
    />
  );
}
