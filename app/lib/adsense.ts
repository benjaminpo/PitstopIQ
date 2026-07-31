/**
 * AdSense client ID, e.g. "ca-pub-1234567890123456"
 * Set NEXT_PUBLIC_ADSENSE_CLIENT in env (and Vercel).
 */
export function getAdSenseClient(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
  if (!raw) return null;
  // Accept either ca-pub-… or pub-…
  if (raw.startsWith("ca-pub-")) return raw;
  if (raw.startsWith("pub-")) return `ca-${raw}`;
  return null;
}

/** Publisher ID without the ca- prefix, for ads.txt */
export function getAdSensePublisherId(): string | null {
  const client = getAdSenseClient();
  if (!client) return null;
  return client.replace(/^ca-/, "");
}

export function isAdSenseEnabled(): boolean {
  return Boolean(getAdSenseClient());
}
