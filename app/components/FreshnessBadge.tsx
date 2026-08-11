import { cn } from "@/app/lib/utils";
import {
  formatPriceAge,
  freshnessTone,
  FRESHNESS_DOT_CLASSES,
  FRESHNESS_TONE_CLASSES,
} from "@/app/lib/freshness";

export { formatPriceAge, freshnessTone } from "@/app/lib/freshness";
export type { FreshnessTone } from "@/app/lib/freshness";

export function FreshnessBadge({
  source,
  pricesFetchedAt,
  now,
  className,
}: Readonly<{
  source: "live" | "mock" | null;
  pricesFetchedAt: number | null;
  /** Current clock (pass from a ticking parent — avoid Date.now in render) */
  now: number;
  className?: string;
}>) {
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
      label = `Checked ${age}`;
      title = `Fuel Finder national dataset last synced ${new Date(
        pricesFetchedAt!
      ).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}. Station “Changed” times are when a retailer last reported a price change.`;
      break;
    }
  }

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        FRESHNESS_TONE_CLASSES[tone],
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", FRESHNESS_DOT_CLASSES[tone])}
      />
      {label}
    </span>
  );
}
