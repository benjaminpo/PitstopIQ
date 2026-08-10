import type { Metadata } from "next";
import { BrandsIndexView } from "@/app/components/BrandsIndexView";
import { DataUnavailable } from "@/app/components/DataUnavailable";
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
      <DataUnavailable
        title="Brands temporarily unavailable"
        description="Live Fuel Finder data isn’t available right now. Try again in a minute, or browse by location."
        actions={[
          { href: "/locations", label: "Locations", primary: true },
          { href: "/stations", label: "All stations" },
        ]}
      />
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
