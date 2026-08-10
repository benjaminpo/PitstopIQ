import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataUnavailable } from "@/app/components/DataUnavailable";
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
    if (loaded.reason === "unavailable") {
      return {
        title: "Location prices temporarily unavailable",
        description:
          "Live Fuel Finder location prices are temporarily unavailable. Please try again shortly.",
      };
    }
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
        <DataUnavailable
          title={`${label} prices temporarily unavailable`}
          description="Live Fuel Finder data isn’t available right now. Try again shortly."
          actions={[
            { href: "/locations", label: "All locations", primary: true },
          ]}
        />
      );
    }
    notFound();
  }

  return <LocationAreaView detail={loaded.detail} source={loaded.source} />;
}
