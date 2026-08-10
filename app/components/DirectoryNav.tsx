"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fuel, MapPin, Store } from "lucide-react";
import { cn } from "@/app/lib/utils";

export type DirectoryNavKey = "stations" | "locations" | "brands";

const LINKS: Array<{
  key: DirectoryNavKey;
  href: string;
  label: string;
  shortLabel: string;
  Icon: typeof Fuel;
}> = [
  { key: "stations", href: "/stations", label: "Stations", shortLabel: "Stations", Icon: Fuel },
  { key: "locations", href: "/locations", label: "Locations", shortLabel: "Areas", Icon: MapPin },
  { key: "brands", href: "/brands", label: "Brands", shortLabel: "Brands", Icon: Store },
];

function activeKey(pathname: string | null): DirectoryNavKey | null {
  if (!pathname) return null;
  if (pathname === "/stations" || pathname.startsWith("/stations/")) {
    return "stations";
  }
  if (pathname === "/locations" || pathname.startsWith("/locations/")) {
    return "locations";
  }
  if (pathname === "/brands" || pathname.startsWith("/brands/")) {
    return "brands";
  }
  return null;
}

interface DirectoryNavProps {
  /** Force active state when pathname is unavailable (e.g. static contexts) */
  current?: DirectoryNavKey | null;
  /** Compact segmented control for the planner sidebar */
  variant?: "pills" | "segment";
  className?: string;
  /** Hide icons (segment / tight spaces) */
  icons?: boolean;
}

export function DirectoryNav({
  current,
  variant = "pills",
  className,
  icons = true,
}: Readonly<DirectoryNavProps>) {
  const pathname = usePathname();
  const active = current ?? activeKey(pathname);

  if (variant === "segment") {
    return (
      <nav
        aria-label="Browse directory"
        className={cn(
          "inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/60 p-0.5",
          className
        )}
      >
        {LINKS.map(({ key, href, shortLabel }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition sm:px-2.5",
                isActive
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {shortLabel}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Browse directory"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {LINKS.map(({ key, href, label, Icon }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              isActive
                ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                : "border border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-teal-600/50 hover:bg-teal-950/50 hover:text-teal-200"
            )}
          >
            {icons && <Icon className="h-3.5 w-3.5" />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
