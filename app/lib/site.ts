import { resolveAuthBaseURL } from "@/app/lib/auth-url";

/**
 * Canonical public origin for sitemap, Open Graph, and JSON-LD.
 * Prefer NEXT_PUBLIC_SITE_URL in production; fall back to the auth base URL.
 */
export function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      const url = new URL(
        fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`
      );
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }
  return resolveAuthBaseURL();
}

export const SITE_NAME = "PitstopIQ";

export const SITE_TAGLINE = "Smart UK fuel route cost calculator";

export const SITE_DESCRIPTION =
  "Compare live UK Fuel Finder forecourt prices along your route. PitstopIQ weighs detour miles, MPG, and your time so you only divert when cheaper fuel is a real saving.";

/** Short, crawlable homepage intro. Keep sentences short for reading ease. */
export const SITE_INTRO =
  "Compare live UK fuel prices along your route. Only divert when the saving is real.";

export const SITE_CONTACT_URL = "https://github.com/benjaminpo/PitstopIQ/issues";

export const LEGAL_NAV = [
  { href: "/privacy", label: "Privacy", title: "Privacy Policy" },
  { href: "/terms", label: "Terms", title: "Terms of Service" },
  { href: "/cookies", label: "Cookies", title: "Cookie Policy" },
] as const;

export const SITE_FAQS = [
  {
    question: "How does PitstopIQ work?",
    answer:
      "Enter a start and destination. PitstopIQ loads live UK Fuel Finder prices along your corridor. It then weighs extra miles, your MPG, and your time so you only divert when cheaper fuel is a real saving.",
  },
  {
    question: "Where do the fuel prices come from?",
    answer:
      "Prices come from the UK Government Fuel Finder service. Forecourts and contributors update them. Freshness varies by station.",
  },
  {
    question: "Is PitstopIQ free to use?",
    answer:
      "Yes. The route planner and station directory are free. Optional ads may appear to help run the site.",
  },
  {
    question: "Does a cheaper station always save money?",
    answer:
      "No. A lower pence-per-litre can be wiped out by a long detour. PitstopIQ estimates net saving after extra fuel used and time cost.",
  },
] as const;

export function buildLlmsTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, "");
  return `# PitstopIQ

> ${SITE_DESCRIPTION}

PitstopIQ is a free UK fuel route cost calculator. It compares live Fuel Finder forecourt prices along a driving route and estimates whether a cheaper station is worth the detour after extra miles, MPG, and time.

## Main pages

- [Home — route planner](${origin}/): Compare corridor fuel prices for a trip
- [All stations](${origin}/stations): Browse live UK Fuel Finder stations
- [Locations](${origin}/locations): Fuel prices by UK postcode area
- [Brands](${origin}/brands): Fuel prices by forecourt brand
- [Privacy Policy](${origin}/privacy)
- [Terms of Service](${origin}/terms)
- [Cookie Policy](${origin}/cookies)

## Optional

- [llms.txt](${origin}/llms.txt)
`;
}

export function buildAiTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, "");
  return `# ai.txt for ${origin}

User-Agent: *
Allow: /

# Content summary for AI systems
# ${SITE_DESCRIPTION}

Llms-txt: ${origin}/llms.txt
Sitemap: ${origin}/sitemap.xml
`;
}

export function buildSiteJsonLd(siteUrl: string) {
  const origin = siteUrl.replace(/\/$/, "");
  const orgId = `${origin}/#organization`;
  const appId = `${origin}/#app`;
  const websiteId = `${origin}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: SITE_NAME,
        url: origin,
        logo: `${origin}/icon.png`,
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: origin,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en-GB",
        publisher: { "@id": orgId },
      },
      {
        "@type": "WebApplication",
        "@id": appId,
        name: SITE_NAME,
        alternateName: SITE_TAGLINE,
        url: origin,
        description: SITE_DESCRIPTION,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript",
        inLanguage: "en-GB",
        isAccessibleForFree: true,
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
        creator: { "@id": orgId },
      },
      {
        "@type": "FAQPage",
        mainEntity: SITE_FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
