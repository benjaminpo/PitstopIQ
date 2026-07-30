import { cn } from "@/app/lib/utils";

/** Age thresholds for live Fuel Finder cache freshness (1h server TTL). */
const FRESH_MS = 30 * 60 * 1000;
const AGING_MS = 50 * 60 * 1000;

export function formatPriceAge(
  fetchedAt: number,
  now = Date.now()
): string {
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

export function freshnessTone(
  source: "live" | "mock" | null,
  pricesFetchedAt: number | null,
  now = Date.now()
): FreshnessTone {
  if (source === "mock") return "mock";
  if (source !== "live" || pricesFetchedAt == null) return "unknown";
  const age = now - pricesFetchedAt;
  if (age <= FRESH_MS) return "fresh";
  if (age <= AGING_MS) return "aging";
  return "stale";
}

const TONE_CLASSES: Record<FreshnessTone, string> = {
  fresh: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35",
  aging: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35",
  stale: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/35",
  mock: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/35",
  unknown: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-600/40",
};

const DOT_CLASSES: Record<FreshnessTone, string> = {
  fresh: "bg-emerald-400",
  aging: "bg-amber-400",
  stale: "bg-rose-400",
  mock: "bg-slate-400",
  unknown: "bg-slate-500",
};

export function FreshnessBadge({
  source,
  pricesFetchedAt,
  now,
  className,
}: {
  source: "live" | "mock" | null;
  pricesFetchedAt: number | null;
  /** Current clock (pass from a ticking parent — avoid Date.now in render) */
  now: number;
  className?: string;
}) {
  const tone = freshnessTone(source, pricesFetchedAt, now);

  let label: string;
  let title: string;

  switch (tone) {
    case "mock":
      label = "Demo prices";
      title = "Using mock forecourt prices (Fuel Finder unavailable or empty)";
      break;
    case "unknown":
      label = "Prices unknown";
      title = "Price freshness is not available yet";
      break;
    default: {
      const age = formatPriceAge(pricesFetchedAt!, now);
      label = `Updated ${age}`;
      title = `Fuel Finder national dataset last synced ${new Date(
        pricesFetchedAt!
      ).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
      break;
    }
  }

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} />
      {label}
    </span>
  );
}
