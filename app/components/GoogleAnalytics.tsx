import Script from "next/script";
import {
  getGaMeasurementId,
  isGoogleAnalyticsEnabled,
} from "@/app/lib/analytics";

/**
 * Loads Google Analytics 4 (gtag.js) when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Measurement IDs look like G-XXXXXXXXXX (not GTM-… containers).
 */
export function GoogleAnalytics() {
  if (!isGoogleAnalyticsEnabled()) return null;

  const id = getGaMeasurementId()!;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
