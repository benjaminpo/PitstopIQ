import { describe, expect, it } from "vitest";
import {
  brandFaviconUrl,
  brandInitials,
  KNOWN_BRAND_LABELS,
  resolveBrandLogo,
} from "./brandLogo";

describe("brandInitials", () => {
  it("uses first letters of multi-word brands", () => {
    expect(brandInitials("Welcome Break")).toBe("WB");
    expect(brandInitials("Circle K")).toBe("CK");
  });

  it("uses first two letters of a single word", () => {
    expect(brandInitials("Shell")).toBe("SH");
    expect(brandInitials("BP")).toBe("BP");
  });

  it("handles empty / punctuation-only", () => {
    expect(brandInitials("")).toBe("?");
    expect(brandInitials("---")).toBe("?");
  });
});

describe("resolveBrandLogo", () => {
  it("maps known UK forecourt brands", () => {
    expect(resolveBrandLogo("Shell").id).toBe("shell");
    expect(resolveBrandLogo("Shell").domain).toBe("shell.co.uk");
    expect(resolveBrandLogo("BP Express").id).toBe("bp");
    expect(resolveBrandLogo("BP").domain).toBe("www.bp.com");
    expect(resolveBrandLogo("Texaco").domain).toBe("texaco-lubricants.com");
    expect(resolveBrandLogo("Gulf").src).toBe("/brands/gulf.svg");
    expect(resolveBrandLogo("Gulf").domain).toBeUndefined();
    expect(resolveBrandLogo("Jet").src).toBe("/brands/jet.svg");
    expect(resolveBrandLogo("Jet").domain).toBeUndefined();
    expect(resolveBrandLogo("Valero").src).toBe("/brands/valero.png");
    expect(resolveBrandLogo("Tesco").id).toBe("tesco");
    expect(resolveBrandLogo("Sainsbury's").id).toBe("sainsburys");
    expect(resolveBrandLogo("Sainsbury's").domain).toBe(
      "about.sainsburys.co.uk"
    );
    expect(resolveBrandLogo("Costco").domain).toBeUndefined();
    expect(resolveBrandLogo("Costco").src).toBe("/brands/costco.svg");
    expect(resolveBrandLogo("Welcome Break").id).toBe("welcomebreak");
    expect(resolveBrandLogo("Circle K").id).toBe("circlek");
  });

  it("is case-insensitive and trims", () => {
    expect(resolveBrandLogo("  SHELL  ").id).toBe("shell");
  });

  it("falls back to a stable lettermark for unknown brands", () => {
    const a = resolveBrandLogo("Acme Fuels");
    const b = resolveBrandLogo("Acme Fuels");
    expect(a.id).toBe("acme fuels");
    expect(a.domain).toBeUndefined();
    expect(a.initials).toBe("AF");
    expect(a.bg).toBe(b.bg);
    expect(a.fg).toBe(b.fg);
  });
});

describe("KNOWN_BRAND_LABELS", () => {
  it("covers common UK forecourt brands for admin selection", () => {
    expect(KNOWN_BRAND_LABELS).toEqual(
      [...KNOWN_BRAND_LABELS].sort((a, b) => a.localeCompare(b))
    );
    expect(KNOWN_BRAND_LABELS).toContain("Shell");
    expect(KNOWN_BRAND_LABELS).toContain("Sainsbury's");
    expect(KNOWN_BRAND_LABELS).toContain("Independent");
    expect(resolveBrandLogo("Shell").id).toBe("shell");
    expect(resolveBrandLogo("Welcome Break").id).toBe("welcomebreak");
  });
});

describe("brandFaviconUrl", () => {
  it("builds a Google favicon URL", () => {
    expect(brandFaviconUrl("shell.co.uk", 64)).toBe(
      "https://www.google.com/s2/favicons?domain=shell.co.uk&sz=64"
    );
  });
});
