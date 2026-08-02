"use client";

import { Navigation } from "lucide-react";
import {
  appleMapsNavigateUrl,
  googleMapsNavigateUrl,
  type NavigateTarget,
} from "@/app/lib/mapsLinks";
import { cn } from "@/app/lib/utils";

interface NavigateHereProps {
  target: NavigateTarget;
  /** Emphasise as the primary “best station” action */
  primary?: boolean;
  /** Popup / light surfaces vs the dark sidebar */
  tone?: "dark" | "light";
  className?: string;
  /** Stop click bubbling when nested inside a selectable card */
  stopPropagation?: boolean;
}

function googleMapsClass(tone: "dark" | "light", primary: boolean): string {
  if (tone === "light") {
    return primary
      ? "bg-teal-600 text-white hover:bg-teal-500"
      : "bg-teal-700 text-white hover:bg-teal-600";
  }
  if (primary) {
    return "bg-teal-600 text-white shadow-md shadow-teal-950/40 hover:bg-teal-500";
  }
  return "bg-slate-800 text-slate-100 ring-1 ring-slate-600/60 hover:bg-slate-700";
}

function appleMapsClass(tone: "dark" | "light", primary: boolean): string {
  if (tone === "light") {
    return "bg-slate-200 text-slate-900 hover:bg-slate-300";
  }
  if (primary) {
    return "bg-slate-100 text-slate-900 hover:bg-white";
  }
  return "bg-slate-800 text-slate-100 ring-1 ring-slate-600/60 hover:bg-slate-700";
}

export function NavigateHere({
  target,
  primary = false,
  tone = "dark",
  className,
  stopPropagation = true,
}: Readonly<NavigateHereProps>) {
  const googleHref = googleMapsNavigateUrl(target);
  const appleHref = appleMapsNavigateUrl(target);

  const onLinkClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {primary && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
            tone === "light" ? "text-teal-800" : "text-teal-300/90"
          )}
        >
          <Navigation className="h-3 w-3" />
          Navigate here
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={googleHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLinkClick}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
            googleMapsClass(tone, primary)
          )}
        >
          Google Maps
        </a>
        <a
          href={appleHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLinkClick}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
            appleMapsClass(tone, primary)
          )}
        >
          Apple Maps
        </a>
      </div>
    </div>
  );
}
