import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  resolveSiteUrl,
} from "@/app/lib/site";

/** WebApplication JSON-LD for the homepage. */
export function SiteJsonLd() {
  const siteUrl = resolveSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    alternateName: SITE_TAGLINE,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-GB",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
    },
    featureList: [
      "Live UK Fuel Finder forecourt prices",
      "Route corridor fuel comparison",
      "Detour cost vs MPG and time value",
        "Station opening hours and facilities",
        "HVO and diesel grade comparison",
      ],
    creator: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
