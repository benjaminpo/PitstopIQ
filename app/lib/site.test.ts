import { describe, expect, it, afterEach, vi } from "vitest";
import { resolveSiteUrl } from "./site";

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
});
