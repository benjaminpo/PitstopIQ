import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandDetailView } from "@/app/components/BrandDetailView";
import { DataUnavailable } from "@/app/components/DataUnavailable";
import { loadBrandDetail } from "@/app/lib/loadBrands";
import { SITE_NAME } from "@/app/lib/site";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ brandKey: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { brandKey } = await params;
  const loaded = await loadBrandDetail(brandKey);
  if (!loaded.ok) {
    if (loaded.reason === "unavailable") {
      return {
        title: "Brand prices temporarily unavailable",
        description:
          "Live Fuel Finder brand prices are temporarily unavailable. Please try again shortly.",
      };
    }
    return {
      title: "Brand not found",
      description: "This fuel brand could not be found on PitstopIQ.",
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
    description: `Compare live Fuel Finder petrol and diesel prices at ${detail.label} stations across the UK.${priceBit} ${detail.stationCount} sites on ${SITE_NAME}.`,
    alternates: {
      canonical: detail.href,
    },
  };
}

export default async function BrandDetailPage({
  params,
}: Readonly<PageProps>) {
  const { brandKey } = await params;
  const loaded = await loadBrandDetail(brandKey);

  if (!loaded.ok) {
    if (loaded.reason === "unavailable") {
      return (
        <DataUnavailable
          title="Brand prices temporarily unavailable"
          description="Live Fuel Finder data isn’t available right now. Try again shortly."
          actions={[{ href: "/brands", label: "All brands", primary: true }]}
        />
      );
    }
    notFound();
  }

  return (
    <BrandDetailView
      detail={loaded.detail}
      source={loaded.source}
      pricesFetchedAt={loaded.pricesFetchedAt}
    />
  );
}
