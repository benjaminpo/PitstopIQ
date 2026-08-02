/**
 * Resolve a forecourt brand string to logo presentation data.
 * Known brands get a domain (for favicon) + brand colours; others get a
 * deterministic lettermark from the brand name.
 */

export interface BrandLogoInfo {
  /** Stable id for caching / keys (e.g. "shell", "tesco") */
  id: string;
  /** Display label from the source brand string */
  label: string;
  /** 1–2 letter monogram fallback */
  initials: string;
  /** Brand-coloured badge background */
  bg: string;
  /** Monogram foreground */
  fg: string;
  /**
   * Brand website domain used to fetch a favicon logo.
   * Undefined → lettermark only (unless `src` is set).
   */
  domain?: string;
  /** Local / absolute logo asset — preferred over favicon when set */
  src?: string;
}

interface BrandDef {
  id: string;
  patterns: RegExp[];
  /** Favicon host; omit when Google has no usable mark */
  domain?: string;
  /** Bundled logo under /public (preferred over favicon) */
  src?: string;
  initials: string;
  bg: string;
  fg: string;
}

/** High-frequency UK forecourt brands — colours approximate retail identity. */
const KNOWN_BRANDS: BrandDef[] = [
  {
    id: "shell",
    patterns: [/\bshell\b/i],
    domain: "shell.co.uk",
    initials: "Sh",
    bg: "#FFD500",
    fg: "#DD1D21",
  },
  {
    id: "bp",
    patterns: [/\bbp\b/i],
    // bp.com returns Google's blank 16px stub; www.bp.com has the Helios mark
    domain: "www.bp.com",
    initials: "BP",
    bg: "#00A650",
    fg: "#FFFFFF",
  },
  {
    id: "esso",
    patterns: [/\besso\b/i],
    domain: "esso.co.uk",
    initials: "Es",
    bg: "#0033A0",
    fg: "#E31837",
  },
  {
    id: "texaco",
    patterns: [/\btexaco\b/i],
    // texaco.co.uk only yields a 32px stub — lubricants host has a sharp 128px star
    domain: "texaco-lubricants.com",
    initials: "Tx",
    bg: "#000000",
    fg: "#E31837",
  },
  {
    id: "total",
    patterns: [/\btotal\s*energies\b/i, /\btotal\b/i],
    domain: "totalenergies.uk",
    initials: "To",
    bg: "#ED1C24",
    fg: "#FFFFFF",
  },
  {
    id: "jet",
    patterns: [/\bjet\b/i],
    // Official UK Jet mark (2020) — blue wordmark + yellow swooshes
    src: "/brands/jet.svg",
    initials: "Jt",
    bg: "#154182",
    fg: "#FFCE3A",
  },
  {
    id: "gulf",
    patterns: [/\bgulf\b/i],
    // Public-domain Gulf Oil disc (Wikimedia Commons File:Gulf_Oil_logo.svg)
    src: "/brands/gulf.svg",
    initials: "Gu",
    bg: "#F7941D",
    fg: "#0055A5",
  },
  {
    id: "murco",
    patterns: [/\bmurco\b/i],
    domain: "certasenergy.co.uk",
    initials: "Mu",
    bg: "#003366",
    fg: "#FFFFFF",
  },
  {
    id: "applegreen",
    patterns: [/\bapplegreen\b/i],
    domain: "applegreenstores.com",
    initials: "Ag",
    bg: "#7AC143",
    fg: "#FFFFFF",
  },
  {
    id: "circlek",
    patterns: [/\bcircle\s*k\b/i],
    domain: "circlek.co.uk",
    initials: "CK",
    bg: "#DA291C",
    fg: "#FFFFFF",
  },
  {
    id: "tesco",
    patterns: [/\btesco\b/i],
    domain: "tesco.com",
    initials: "Te",
    bg: "#00539F",
    fg: "#FFFFFF",
  },
  {
    id: "asda",
    patterns: [/\basda\b/i],
    domain: "asda.com",
    initials: "As",
    bg: "#78BE20",
    fg: "#FFFFFF",
  },
  {
    id: "sainsburys",
    patterns: [/\bsainsbury'?s?\b/i],
    domain: "about.sainsburys.co.uk",
    initials: "Sa",
    bg: "#F06B00",
    fg: "#FFFFFF",
  },
  {
    id: "morrisons",
    patterns: [/\bmorrison'?s?\b/i],
    domain: "morrisons.com",
    initials: "Mo",
    bg: "#005B2F",
    fg: "#FFFFFF",
  },
  {
    id: "aldi",
    patterns: [/\baldi\b/i],
    domain: "aldi.co.uk",
    initials: "Al",
    bg: "#00005F",
    fg: "#FF6600",
  },
  {
    id: "lidl",
    patterns: [/\blidl\b/i],
    domain: "lidl.co.uk",
    initials: "Li",
    bg: "#0050AA",
    fg: "#FFED00",
  },
  {
    id: "costco",
    patterns: [/\bcostco\b/i],
    // Costco favicons are blank stubs — public-domain wordmark badge
    src: "/brands/costco.svg",
    initials: "Co",
    bg: "#E31837",
    fg: "#FFFFFF",
  },
  {
    id: "waitrose",
    patterns: [/\bwaitrose\b/i],
    domain: "waitrose.com",
    initials: "Wa",
    bg: "#8DC63F",
    fg: "#FFFFFF",
  },
  {
    id: "coop",
    patterns: [/\bco-?op\b/i, /\bcoop\b/i],
    domain: "coop.co.uk",
    initials: "Cp",
    bg: "#00B1E7",
    fg: "#FFFFFF",
  },
  {
    id: "moto",
    patterns: [/\bmoto\b/i],
    domain: "moto-way.com",
    initials: "Mt",
    bg: "#E30613",
    fg: "#FFFFFF",
  },
  {
    id: "welcomebreak",
    patterns: [/\bwelcome\s*break\b/i],
    domain: "welcomebreak.co.uk",
    initials: "WB",
    bg: "#003DA5",
    fg: "#FFFFFF",
  },
  {
    id: "roadchef",
    patterns: [/\broad\s*chef\b/i],
    domain: "roadchef.com",
    initials: "Rc",
    bg: "#E30613",
    fg: "#FFFFFF",
  },
  {
    id: "extra",
    patterns: [/\bextra\b/i],
    domain: "extraservices.co.uk",
    initials: "Ex",
    bg: "#1B4D3E",
    fg: "#FFFFFF",
  },
  {
    id: "harrisons",
    patterns: [/\bharrison'?s?\b/i],
    initials: "Ha",
    bg: "#1A1A1A",
    fg: "#F5C518",
  },
  {
    id: "valero",
    patterns: [/\bvalero\b/i],
    // Favicons are stubs — public-domain Valero V + ribbon (Wikimedia)
    src: "/brands/valero.png",
    initials: "Va",
    bg: "#0054A4",
    fg: "#FFD200",
  },
  {
    id: "qfuel",
    patterns: [/\bqfuel\b/i],
    domain: "q8.com",
    initials: "Qf",
    bg: "#6B2D8B",
    fg: "#FFFFFF",
  },
];

const FALLBACK_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#0F766E", fg: "#ECFDF5" },
  { bg: "#1D4ED8", fg: "#EFF6FF" },
  { bg: "#B45309", fg: "#FFFBEB" },
  { bg: "#9F1239", fg: "#FFF1F2" },
  { bg: "#5B21B6", fg: "#F5F3FF" },
  { bg: "#065F46", fg: "#ECFDF5" },
  { bg: "#075985", fg: "#F0F9FF" },
  { bg: "#854D0E", fg: "#FEFCE8" },
];

function hashString(value: string): number {
  let h = 0;
  for (const char of value) {
    h = Math.trunc(h * 31 + (char.codePointAt(0) ?? 0));
  }
  return Math.abs(h);
}

/** 1–2 letter initials from a brand label. */
export function brandInitials(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const word = parts[0]!;
  if (word.length === 1) return word.toUpperCase();
  // Prefer first two letters for single-word brands (Shell → SH, BP → BP)
  return word.slice(0, 2).toUpperCase();
}

/** Favicon URL for a brand domain (Google’s public favicon service). */
export function brandFaviconUrl(domain: string, size = 128): string {
  const params = new URLSearchParams({
    domain,
    sz: String(size),
  });
  return `https://www.google.com/s2/favicons?${params.toString()}`;
}

/**
 * Resolve logo info for a fuel brand / trading name.
 * Pass the station `brand` (preferred) or a brand filter option label.
 */
export function resolveBrandLogo(brand: string): BrandLogoInfo {
  const label = brand.trim() || "Unknown";
  const haystack = label.toLowerCase();

  for (const def of KNOWN_BRANDS) {
    if (def.patterns.some((re) => re.test(haystack))) {
      return {
        id: def.id,
        label,
        initials: def.initials,
        bg: def.bg,
        fg: def.fg,
        domain: def.domain,
        src: def.src,
      };
    }
  }

  const id = haystack || "unknown";
  const palette = FALLBACK_PALETTE[hashString(id) % FALLBACK_PALETTE.length]!;
  return {
    id,
    label,
    initials: brandInitials(label),
    bg: palette.bg,
    fg: palette.fg,
  };
}
