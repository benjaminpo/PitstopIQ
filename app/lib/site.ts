import { resolveAuthBaseURL } from "@/app/lib/auth-url";

/**
 * Canonical public origin for sitemap, Open Graph, and JSON-LD.
 * Prefer NEXT_PUBLIC_SITE_URL in production; fall back to the auth base URL.
 */
export function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      const url = new URL(
        fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`
      );
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }
  return resolveAuthBaseURL();
}

export const SITE_NAME = "PitstopIQ";

export const SITE_TAGLINE = "Smart UK fuel route cost calculator";

export const SITE_DESCRIPTION =
  "Compare live UK Fuel Finder forecourt prices along your route. PitstopIQ weighs detour miles, MPG, and your time so you only divert when cheaper fuel is a real saving.";
