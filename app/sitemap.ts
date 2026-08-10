import type { MetadataRoute } from "next";
import {
  fetchAllFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import { buildBrandSummaries } from "@/app/lib/brandsDirectory";
import { buildLocationAreaSummaries } from "@/app/lib/locationsDirectory";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import { resolveSiteUrl } from "@/app/lib/site";
import { stationHref } from "@/app/lib/stationPath";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/stations`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/locations`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/brands`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];

  try {
    const { stations: raw, pricesFetchedAt } = await fetchAllFuelStations();
    let stations = raw;
    try {
      const overrides = await listStationAdminOverrides();
      stations = applyStationAdminOverrides(stations, overrides);
    } catch (error) {
      console.warn("[sitemap] Could not load admin overrides", error);
    }

    const stationLastMod = pricesFetchedAt
      ? new Date(pricesFetchedAt)
      : lastModified;

    for (const area of buildLocationAreaSummaries(stations)) {
      entries.push({
        url: `${siteUrl}${area.href}`,
        lastModified: stationLastMod,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }

    for (const brand of buildBrandSummaries(stations)) {
      entries.push({
        url: `${siteUrl}${brand.href}`,
        lastModified: stationLastMod,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }

    for (const station of stations) {
      entries.push({
        url: `${siteUrl}${stationHref(station)}`,
        lastModified: stationLastMod,
        changeFrequency: "hourly",
        priority: 0.6,
      });
    }
  } catch (error) {
    if (!(error instanceof FuelDataUnavailableError)) {
      console.warn("[sitemap] Could not include station URLs", error);
    }
  }

  return entries;
}
