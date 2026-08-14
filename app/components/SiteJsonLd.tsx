import { buildSiteJsonLd, resolveSiteUrl } from "@/app/lib/site";

/** WebApplication, WebSite, Organization, and FAQ JSON-LD for the homepage. */
export function SiteJsonLd() {
  const data = buildSiteJsonLd(resolveSiteUrl());

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
