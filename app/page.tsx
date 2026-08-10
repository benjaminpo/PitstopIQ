import { HomeApp } from "@/app/components/HomeApp";
import { SiteJsonLd } from "@/app/components/SiteJsonLd";
import { Analytics } from '@vercel/analytics/next';

export default function HomePage() {
  return (
    <>
      <SiteJsonLd />
      <HomeApp />
      <Analytics />
    </>
  );
}
