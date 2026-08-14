import { describe, expect, it, afterEach, vi } from "vitest";
import { resolveAuthBaseURL } from "./auth-url";
import {
  resolveSiteUrl,
  SITE_DESCRIPTION,
  SITE_FAQS,
  SITE_INTRO,
  SITE_NAME,
  SITE_TAGLINE,
  LEGAL_NAV,
  buildAiTxt,
  buildLlmsTxt,
  buildSiteJsonLd,
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
    expect(SITE_INTRO.length).toBeGreaterThan(0);
  });
});

describe("legal nav", () => {
  it("lists privacy, terms, and cookies", () => {
    expect(LEGAL_NAV.map((item) => item.href)).toEqual([
      "/privacy",
      "/terms",
      "/cookies",
    ]);
  });
});

describe("buildLlmsTxt", () => {
  it("summarises the product and lists main URLs", () => {
    const txt = buildLlmsTxt("https://pitstopiq.example/");
    expect(txt).toContain("# PitstopIQ");
    expect(txt).toContain("https://pitstopiq.example/stations");
    expect(txt).toContain("https://pitstopiq.example/privacy");
    expect(txt).not.toContain("https://pitstopiq.example//");
  });
});

describe("buildAiTxt", () => {
  it("allows crawlers and points at llms.txt", () => {
    const txt = buildAiTxt("https://pitstopiq.example");
    expect(txt).toContain("User-Agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("https://pitstopiq.example/llms.txt");
    expect(txt).toContain("https://pitstopiq.example/sitemap.xml");
  });
});

describe("buildSiteJsonLd", () => {
  it("emits Organization, WebSite, WebApplication, and FAQPage", () => {
    const data = buildSiteJsonLd("https://pitstopiq.example");
    const types = data["@graph"].map((node) => node["@type"]);
    expect(types).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
      "FAQPage",
    ]);
    const faq = data["@graph"][3] as {
      mainEntity: Array<{ name: string }>;
    };
    expect(faq.mainEntity).toHaveLength(SITE_FAQS.length);
    expect(faq.mainEntity[0]?.name).toBe(SITE_FAQS[0].question);
  });
});
