/** Age thresholds for live Fuel Finder cache freshness (1h server TTL). */
const FRESH_MS = 30 * 60 * 1000;
const AGING_MS = 50 * 60 * 1000;

export function formatPriceAge(fetchedAt: number, now: number): string {
  const delta = Math.max(0, now - fetchedAt);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export type FreshnessTone = "fresh" | "aging" | "stale" | "mock" | "unknown";

/**
 * Per-station price report age bands. Retailers must report changes within
 * 30 min, but a price can legitimately hold for days — so flag at day/week
 * scale rather than the dataset-sync scale above.
 */
const STATION_FRESH_MS = 24 * 60 * 60 * 1000;
const STATION_AGING_MS = 7 * 24 * 60 * 60 * 1000;

export type PriceFreshnessFilter = "any" | "24h" | "2d" | "3d" | "7d";

export const PRICE_FRESHNESS_OPTIONS: Array<{
  value: PriceFreshnessFilter;
  label: string;
  maxAgeMs: number | null;
}> = [
  { value: "any", label: "Any time", maxAgeMs: null },
  { value: "24h", label: "Within 24 hours", maxAgeMs: STATION_FRESH_MS },
  { value: "2d", label: "Within 2 days", maxAgeMs: 2 * 24 * 60 * 60 * 1000 },
  { value: "3d", label: "Within 3 days", maxAgeMs: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Within 7 days", maxAgeMs: STATION_AGING_MS },
];

export function matchesPriceFreshness(
  updatedAt: number | null | undefined,
  filter: PriceFreshnessFilter,
  now: number
): boolean {
  if (filter === "any") return true;
  if (updatedAt == null || !Number.isFinite(updatedAt)) return false;
  const maxAgeMs =
    PRICE_FRESHNESS_OPTIONS.find((option) => option.value === filter)
      ?.maxAgeMs ?? null;
  return maxAgeMs != null && now - updatedAt <= maxAgeMs;
}

/**
 * Tone for an individual station's last price report.
 * "unknown" when the station never reported an update time.
 */
export function stationPriceTone(
  priceLastUpdatedAt: number | null | undefined,
  now: number
): FreshnessTone {
  if (priceLastUpdatedAt == null) return "unknown";
  const age = now - priceLastUpdatedAt;
  if (age <= STATION_FRESH_MS) return "fresh";
  if (age <= STATION_AGING_MS) return "aging";
  return "stale";
}

export function freshnessTone(
  source: "live" | "mock" | null,
  pricesFetchedAt: number | null,
  now: number
): FreshnessTone {
  if (source === "mock") return "mock";
  if (source !== "live" || pricesFetchedAt == null) return "unknown";
  const age = now - pricesFetchedAt;
  if (age <= FRESH_MS) return "fresh";
  if (age <= AGING_MS) return "aging";
  return "stale";
}

export const FRESHNESS_TONE_CLASSES: Record<FreshnessTone, string> = {
  fresh: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35",
  aging: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35",
  stale: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/35",
  mock: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/35",
  unknown: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-600/40",
};

export const FRESHNESS_DOT_CLASSES: Record<FreshnessTone, string> = {
  fresh: "bg-emerald-400",
  aging: "bg-amber-400",
  stale: "bg-rose-400",
  mock: "bg-slate-400",
  unknown: "bg-slate-500",
};

/** Inline text colours for per-station price age on dark surfaces (cards). */
export const STATION_AGE_TEXT_CLASSES: Record<FreshnessTone, string> = {
  fresh: "text-slate-400",
  aging: "text-amber-400",
  stale: "text-rose-400",
  mock: "text-slate-400",
  unknown: "text-slate-500",
};

/** Inline text colours for per-station price age on light surfaces (map popups). */
export const STATION_AGE_TEXT_CLASSES_LIGHT: Record<FreshnessTone, string> = {
  fresh: "text-slate-500",
  aging: "text-amber-600",
  stale: "text-rose-600",
  mock: "text-slate-500",
  unknown: "text-slate-500",
};

function absoluteStamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Relative label for when the retailer last changed this price. */
export function formatPriceChangedLabel(
  changedAt: number | null | undefined,
  now: number
): string {
  if (changedAt == null || !Number.isFinite(changedAt)) {
    return "Changed unknown";
  }
  return `Changed ${formatPriceAge(changedAt, now)}`;
}

/**
 * Relative label for when PitstopIQ last synced Fuel Finder.
 * Null when sync time is unavailable (e.g. mock / not loaded yet).
 */
export function formatPriceCheckedLabel(
  checkedAt: number | null | undefined,
  now: number
): string | null {
  if (checkedAt == null || !Number.isFinite(checkedAt)) return null;
  return `Checked ${formatPriceAge(checkedAt, now)}`;
}

/**
 * One-line official price freshness: "Changed 3d ago · Checked 12m ago".
 * Retailers only report when a price changes; "Checked" is the dataset sync.
 */
export function formatOfficialPriceAgeLine(
  changedAt: number | null | undefined,
  checkedAt: number | null | undefined,
  now: number
): string {
  const changed = formatPriceChangedLabel(changedAt, now);
  const checked = formatPriceCheckedLabel(checkedAt, now);
  return checked ? `${changed} · ${checked}` : changed;
}

/** Tooltip/help text for a station's price age tone. */
export function stationPriceAgeTitle(
  priceLastUpdatedAt: number | null | undefined,
  tone: FreshnessTone,
  pricesFetchedAt?: number | null
): string {
  const checkedBit =
    pricesFetchedAt != null && Number.isFinite(pricesFetchedAt)
      ? ` Dataset last checked ${absoluteStamp(pricesFetchedAt)}.`
      : "";

  if (priceLastUpdatedAt == null) {
    return `This station has not reported when its price last changed — treat the price with caution.${checkedBit}`;
  }
  const stamp = absoluteStamp(priceLastUpdatedAt);
  if (tone === "stale") {
    return `Price last changed ${stamp} — over a week without a reported change, may be out of date.${checkedBit}`;
  }
  if (tone === "aging") {
    return `Price last changed ${stamp} — more than a day without a reported change. Stations only report when a price changes.${checkedBit}`;
  }
  return `Price last changed ${stamp}.${checkedBit}`;
}
