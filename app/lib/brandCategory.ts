import type { FuelStation } from "./types";

/** User-facing brand filter (single-select). */
export type BrandFilter = "all" | "supermarket" | "motorway" | "premium";

export const BRAND_FILTER_OPTIONS: {
  key: BrandFilter;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All", hint: "Every corridor station" },
  {
    key: "supermarket",
    label: "Supermarket",
    hint: "Tesco, Asda, Sainsbury’s, Morrisons…",
  },
  {
    key: "motorway",
    label: "Motorway",
    hint: "Moto, Welcome Break, Roadchef, MSA…",
  },
  {
    key: "premium",
    label: "Premium",
    hint: "Shell, BP, Esso, Texaco…",
  },
];

const SUPERMARKET_PATTERNS = [
  /\btesco\b/i,
  /\basda\b/i,
  /\bsainsbury'?s?\b/i,
  /\bmorrison'?s?\b/i,
  /\baldi\b/i,
  /\blidl\b/i,
  /\bcostco\b/i,
  /\bwaitrose\b/i,
  /\bco-?op\b/i,
  /\bcoop\b/i,
];

const MOTORWAY_PATTERNS = [
  /\bmoto\b/i,
  /\bwelcome\s*break\b/i,
  /\broad\s*chef\b/i,
  /\bextra\b.*\b(msa|services)\b/i,
  /\bmsa\b/i,
  /\bmotorway\b/i,
  /\bservice\s*area\b/i,
];

/** Oil majors / premium-leaning networks (not supermarket). */
const PREMIUM_PATTERNS = [
  /\bshell\b/i,
  /\bbp\b/i,
  /\besso\b/i,
  /\btexaco\b/i,
  /\btotal\b/i,
  /\bjet\b/i,
  /\bgulf\b/i,
  /\bmurco\b/i,
  /\bapplegreen\b/i,
  /\bcircle\s*k\b/i,
  /\bharrison'?s?\b/i,
  /\bqfuel\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Classify a forecourt from brand + trading name heuristics.
 * A station can belong to more than one bucket (e.g. Shell at a Moto MSA).
 */
export function classifyStationBrands(station: Pick<FuelStation, "brand" | "name">): {
  supermarket: boolean;
  motorway: boolean;
  premium: boolean;
} {
  const text = `${station.brand} ${station.name}`.trim();
  const supermarket = matchesAny(text, SUPERMARKET_PATTERNS);
  const motorway = matchesAny(text, MOTORWAY_PATTERNS);
  // Premium oil majors — exclude pure supermarket brands even if name overlaps
  const premium =
    !supermarket && matchesAny(text, PREMIUM_PATTERNS);

  return { supermarket, motorway, premium };
}

export function stationMatchesBrandFilter(
  station: Pick<FuelStation, "brand" | "name">,
  filter: BrandFilter
): boolean {
  if (filter === "all") return true;
  const cats = classifyStationBrands(station);
  return cats[filter];
}
