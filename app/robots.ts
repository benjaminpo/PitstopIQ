import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/app/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
