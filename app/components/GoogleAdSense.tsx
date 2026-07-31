import Script from "next/script";
import { getAdSenseClient, isAdSenseEnabled } from "@/app/lib/adsense";

/**
 * Loads the AdSense library once for the whole app.
 * Only renders when NEXT_PUBLIC_ADSENSE_CLIENT is set (typically production).
 */
export function GoogleAdSense() {
  if (!isAdSenseEnabled()) return null;

  const client = getAdSenseClient()!;

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
