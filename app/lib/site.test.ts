import { describe, expect, it, afterEach, vi } from "vitest";
import { resolveAuthBaseURL } from "./auth-url";
import {
  resolveSiteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from "./site";

describe("resolveSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/path");
    expect(resolveSiteUrl()).toBe("https://example.com");
  });

  it("accepts host-only NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "pitstopiq.example");
    expect(resolveSiteUrl()).toBe("https://pitstopiq.example");
  });

  it("falls back to the auth base URL for invalid values", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(resolveSiteUrl()).toBe(resolveAuthBaseURL());
  });

  it("falls back when the env URL is a non-http protocol", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://example.com");
    expect(resolveSiteUrl()).toBe(resolveAuthBaseURL());
  });

  it("falls back when NEXT_PUBLIC_SITE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(resolveSiteUrl()).toBe(resolveAuthBaseURL());
  });
});

describe("site copy", () => {
  it("exposes brand constants", () => {
    expect(SITE_NAME).toBe("PitstopIQ");
    expect(SITE_TAGLINE.length).toBeGreaterThan(0);
    expect(SITE_DESCRIPTION).toContain("Fuel Finder");
  });
});
