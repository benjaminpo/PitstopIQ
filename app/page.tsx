import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { HomeApp } from "@/app/components/HomeApp";
import { SiteJsonLd } from "@/app/components/SiteJsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/app/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <SiteJsonLd />
      <HomeApp />
      <Analytics />
    </>
  );
}
