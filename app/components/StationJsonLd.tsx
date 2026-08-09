import { ALL_FUEL_TYPES, FUEL_TYPE_LABELS } from "@/app/lib/fuelConstants";
import { SITE_NAME, resolveSiteUrl } from "@/app/lib/site";
import { stationHref } from "@/app/lib/stationPath";
import type { FuelStation } from "@/app/lib/types";

/** GasStation / LocalBusiness JSON-LD for station detail pages. */
export function StationJsonLd({
  station,
}: Readonly<{ station: FuelStation }>) {
  const siteUrl = resolveSiteUrl();
  const url = `${siteUrl}${stationHref(station)}`;
  const locationLabel = [station.address, station.postcode]
    .filter(Boolean)
    .join(", ");

  const offers = ALL_FUEL_TYPES.flatMap((fuel) => {
    const price = station.prices[fuel];
    if (price == null || !Number.isFinite(price)) return [];
    return [
      {
        "@type": "Offer",
        name: FUEL_TYPE_LABELS[fuel],
        price: price.toFixed(3),
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
      },
    ];
  });

  const data = {
    "@context": "https://schema.org",
    "@type": "GasStation",
    "@id": url,
    name: station.name,
    brand: {
      "@type": "Brand",
      name: station.brand,
    },
    url,
    ...(locationLabel ? { description: `${station.brand} fuel station at ${locationLabel}` } : {}),
    address: {
      "@type": "PostalAddress",
      ...(station.address ? { streetAddress: station.address } : {}),
      ...(station.postcode ? { postalCode: station.postcode } : {}),
      addressCountry: "GB",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: station.location.lat,
      longitude: station.location.lng,
    },
    ...(offers.length > 0 ? { makesOffer: offers } : {}),
    isPartOf: {
      "@type": "WebApplication",
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
