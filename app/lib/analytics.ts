/**
 * Google Analytics 4 measurement ID, e.g. "G-XXXXXXXXXX"
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID in env (and Vercel).
 */
export function getGaMeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  if (!raw) return null;
  // Accept G-… (GA4). Reject accidental GTM-… here — that needs a different snippet.
  if (/^G-[A-Z0-9]+$/i.test(raw)) return raw.toUpperCase();
  return null;
}

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(getGaMeasurementId());
}
