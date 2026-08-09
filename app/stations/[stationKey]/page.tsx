import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { StationJsonLd } from "@/app/components/StationJsonLd";
import { StationPageView } from "@/app/components/StationPageView";
import { ALL_FUEL_TYPES, FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import { loadStationForPage } from "@/app/lib/loadStationForPage";
import { SITE_NAME, resolveSiteUrl } from "@/app/lib/site";
import { stationHref, stationPathKey } from "@/app/lib/stationPath";
import type { FuelStation } from "@/app/lib/types";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ stationKey: string }>;
};

function locationBits(station: FuelStation): string {
  return [station.address, station.postcode].filter(Boolean).join(", ");
}

function priceSnippet(station: FuelStation): string {
  const parts: string[] = [];
  for (const fuel of ALL_FUEL_TYPES) {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    parts.push(`${FUEL_TYPE_SHORT[fuel]} ${(price * 100).toFixed(1)}p/L`);
    if (parts.length >= 3) break;
  }
  return parts.join(", ");
}

function stationTitle(station: FuelStation): string {
  const place = station.postcode || station.address;
  if (place) return `${station.name} fuel prices, ${place}`;
  return `${station.name} fuel prices`;
}

function stationDescription(station: FuelStation): string {
  const where = locationBits(station);
  const prices = priceSnippet(station);
  const base = where
    ? `Live UK Fuel Finder prices at ${station.name} (${station.brand}) — ${where}.`
    : `Live UK Fuel Finder prices at ${station.name} (${station.brand}).`;
  if (prices) return `${base} ${prices}. Compare nearby forecourts on ${SITE_NAME}.`;
  return `${base} Compare nearby forecourts on ${SITE_NAME}.`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { stationKey } = await params;
  const loaded = await loadStationForPage(stationKey);
  if (!loaded.ok) {
    return {
      title: "Station not found",
      description: "This fuel station could not be found on PitstopIQ.",
      robots: { index: false, follow: true },
    };
  }

  const { station } = loaded;
  const path = stationHref(station);
  const title = stationTitle(station);
  const description = stationDescription(station);
  const absoluteUrl = `${resolveSiteUrl()}${path}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: absoluteUrl,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StationDetailPage({
  params,
}: Readonly<PageProps>) {
  const { stationKey } = await params;
  const loaded = await loadStationForPage(stationKey);

  if (!loaded.ok) {
    if (loaded.reason === "unavailable") {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
          <h1 className="text-2xl font-semibold tracking-tight">
            Prices temporarily unavailable
          </h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Live Fuel Finder data isn’t available right now. Try again in a
            minute, or browse the station directory.
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

    notFound();
  }

  const { station, source, pricesFetchedAt, community } = loaded;
  const canonicalKey = stationPathKey(station);
  if (stationKey !== canonicalKey) {
    permanentRedirect(stationHref(station));
  }

  return (
    <>
      <StationJsonLd station={station} />
      <StationPageView
        station={station}
        source={source}
        pricesFetchedAt={pricesFetchedAt}
        community={community}
      />
    </>
  );
}
