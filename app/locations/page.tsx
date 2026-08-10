import type { Metadata } from "next";
import { DataUnavailable } from "@/app/components/DataUnavailable";
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
      <DataUnavailable
        title="Locations temporarily unavailable"
        description="Live Fuel Finder data isn’t available right now. Try again in a minute, or browse the full station list."
        actions={[
          { href: "/stations", label: "All stations", primary: true },
          { href: "/brands", label: "Brands" },
        ]}
      />
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
