import { getAdSenseClient, isAdSenseEnabled } from "@/app/lib/adsense";

/**
 * Loads the AdSense library once for the whole app.
 * Only renders when NEXT_PUBLIC_ADSENSE_CLIENT is set (typically production).
 *
 * Uses a plain <script> tag (React hoists async scripts into <head>) rather
 * than next/script, which stamps a data-nscript attribute that adsbygoogle.js
 * rejects with "AdSense head tag doesn't support data-nscript attribute".
 */
export function GoogleAdSense() {
  if (!isAdSenseEnabled()) return null;

  const client = getAdSenseClient()!;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
    />
  );
}
