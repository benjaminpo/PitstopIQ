import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disallows private paths and points at the sitemap", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pitstopiq.example");
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin", "/account", "/api/"],
        },
      ],
      sitemap: "https://pitstopiq.example/sitemap.xml",
      host: "https://pitstopiq.example",
    });
  });
});
