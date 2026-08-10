import type { ReactNode } from "react";
import { ArrowRight, Fuel } from "lucide-react";
import { cn } from "@/app/lib/utils";

export function formatDirectoryPrice(price: number | undefined | null): string {
  return price == null || !Number.isFinite(price)
    ? "—"
    : `${(price * 100).toFixed(1)}p`;
}

/** Shared hover card shell for brand / location index grids. */
export function directoryCardClassName(className?: string): string {
  return cn(
    "group flex h-full flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5 transition hover:-translate-y-0.5 hover:border-teal-700/50 hover:bg-teal-950/20 hover:shadow-lg hover:shadow-teal-950/20",
    className
  );
}

interface DirectoryMetaBarProps {
  children: ReactNode;
  className?: string;
}

export function DirectoryMetaBar({
  children,
  className,
}: Readonly<DirectoryMetaBarProps>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DirectoryJumpChip({
  href,
  children,
  square = false,
}: Readonly<{ href: string; children: ReactNode; square?: boolean }>) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-slate-900/80 text-[11px] font-medium text-slate-300 ring-1 ring-slate-700/60 transition hover:bg-teal-950/50 hover:text-teal-200 hover:ring-teal-600/40",
        square ? "h-8 w-8 font-semibold" : "px-2.5 py-1.5"
      )}
    >
      {children}
    </a>
  );
}

export function DirectorySectionHeading({
  children,
  count,
}: Readonly<{
  children: ReactNode;
  count?: number;
}>) {
  return (
    <h2 className="sticky top-0 z-[1] mb-3 bg-slate-950/90 py-1.5 text-sm font-semibold uppercase tracking-wide text-teal-300 backdrop-blur">
      {children}
      {count != null && (
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">
          {count}
        </span>
      )}
    </h2>
  );
}

/** Compact index-card affordance reused by Brands / Locations. */
export function DirectoryCardChevron() {
  return (
    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-teal-400" />
  );
}

export function DirectoryStationCount({
  count,
}: Readonly<{ count: number }>) {
  return (
    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
      <Fuel className="h-3 w-3" />
      {count.toLocaleString()} {count === 1 ? "station" : "stations"}
    </p>
  );
}
