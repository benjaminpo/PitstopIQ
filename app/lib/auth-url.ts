/**
 * Better Auth requires an absolute http(s) base URL. `vercel pull` writes
 * sensitive project env as empty strings, and CI can surface other invalid
 * values — never pass those through to `new URL()`.
 */
export function resolveAuthBaseURL(
  fallback = "https://pitstopiq.vercel.app"
): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const raw of candidates) {
    const origin = toHttpOrigin(raw);
    if (origin) return origin;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return fallback;
}

function toHttpOrigin(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(
      raw.includes("://") ? raw.trim() : `https://${raw.trim()}`
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
