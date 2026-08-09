import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/app/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  return [
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
  ];
}
