import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocationAreaView } from "@/app/components/LocationAreaView";
import { loadLocationAreaDetail } from "@/app/lib/loadLocations";
import { postcodeAreaLabel } from "@/app/lib/postcodeAreas";
import { SITE_NAME } from "@/app/lib/site";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ areaKey: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { areaKey } = await params;
  const loaded = await loadLocationAreaDetail(areaKey);
  if (!loaded.ok) {
    return {
      title: "Location not found",
      description: "This postcode area could not be found on PitstopIQ.",
      robots: { index: false, follow: true },
    };
  }

  const { detail } = loaded;
  const cheapest = detail.cheapestByFuel.E10;
  const priceBit =
    cheapest != null
      ? ` E10 from ${(cheapest * 100).toFixed(1)}p/L.`
      : "";

  return {
    title: `${detail.label} fuel prices`,
    description: `Compare live Fuel Finder petrol and diesel prices in ${detail.label} (${detail.area}).${priceBit} ${detail.stationCount} stations on ${SITE_NAME}.`,
    alternates: {
      canonical: detail.href,
    },
  };
}

export default async function LocationAreaPage({
  params,
}: Readonly<PageProps>) {
  const { areaKey } = await params;
  const loaded = await loadLocationAreaDetail(areaKey);

  if (!loaded.ok) {
    if (loaded.reason === "unavailable") {
      const label = postcodeAreaLabel(areaKey);
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
          <h1 className="text-2xl font-semibold tracking-tight">
            {label} prices temporarily unavailable
          </h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Live Fuel Finder data isn’t available right now. Try again shortly.
          </p>
          <Link
            href="/locations"
            className="mt-6 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
          >
            All locations
          </Link>
        </main>
      );
    }
    notFound();
  }

  return <LocationAreaView detail={loaded.detail} source={loaded.source} />;
}
