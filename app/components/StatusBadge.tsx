import type { DetourStatus } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

export const STATUS_LABEL: Record<DetourStatus, string> = {
  worth: "Worth the detour",
  neutral: "Break-even",
  false_economy: "False economy",
};

export function statusBadgeClasses(status: DetourStatus): string {
  switch (status) {
    case "worth":
      return "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40";
    case "neutral":
      return "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40";
    case "false_economy":
      return "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/40";
  }
}

export function statusDotClasses(status: DetourStatus): string {
  switch (status) {
    case "worth":
      return "bg-emerald-400";
    case "neutral":
      return "bg-amber-400";
    case "false_economy":
      return "bg-rose-400";
  }
}

export function StatusBadge({
  status,
  className,
}: Readonly<{
  status: DetourStatus;
  className?: string;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
        statusBadgeClasses(status),
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClasses(status))} />
      {STATUS_LABEL[status]}
    </span>
  );
}
