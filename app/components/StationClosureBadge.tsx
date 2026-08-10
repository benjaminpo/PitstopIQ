import { Ban } from "lucide-react";
import { stationClosureLabel } from "@/app/lib/stationFacilities";
import type { FuelStation } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

interface StationClosureBadgeProps {
  station: Pick<
    FuelStation,
    "temporaryClosure" | "permanentClosure" | "permanentClosureDate"
  >;
  className?: string;
}

/** Badge for Fuel Finder temporary / permanent closure flags. */
export function StationClosureBadge({
  station,
  className,
}: Readonly<StationClosureBadgeProps>) {
  const label = stationClosureLabel(station);
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-200 ring-1 ring-rose-500/40",
        className
      )}
    >
      <Ban className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
