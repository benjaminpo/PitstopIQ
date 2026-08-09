import { HomeApp } from "@/app/components/HomeApp";
import { SiteJsonLd } from "@/app/components/SiteJsonLd";

export default function HomePage() {
  return (
    <>
      <SiteJsonLd />
      <HomeApp />
    </>
  );
}
