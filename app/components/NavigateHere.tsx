"use client";

import { useSyncExternalStore } from "react";
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
  /** Mid-drive sticky bar uses a larger hit target */
  size?: "default" | "large";
  /** Override link label (defaults by size) */
  label?: string;
  className?: string;
  /** Stop click bubbling when nested inside a selectable card */
  stopPropagation?: boolean;
}

function googleMapsClass(
  tone: "dark" | "light",
  primary: boolean,
  size: "default" | "large"
): string {
  const padding =
    size === "large" ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs";
  if (tone === "light") {
    return cn(
      padding,
      primary
        ? "bg-teal-600 text-white hover:bg-teal-500"
        : "bg-teal-700 text-white hover:bg-teal-600"
    );
  }
  if (primary) {
    return cn(
      padding,
      "bg-teal-600 text-white shadow-md shadow-teal-950/40 hover:bg-teal-500"
    );
  }
  return cn(
    padding,
    "bg-slate-800 text-white ring-1 ring-slate-600/60 hover:bg-slate-700"
  );
}

function isAppleMapsDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function NavigateHere({
  target,
  primary = false,
  tone = "dark",
  size = "default",
  label,
  className,
  stopPropagation = true,
}: Readonly<NavigateHereProps>) {
  const googleHref = googleMapsNavigateUrl(target);
  const appleHref = appleMapsNavigateUrl(target);
  const showApple = useSyncExternalStore(
    () => () => {},
    isAppleMapsDevice,
    () => false
  );

  const onLinkClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const googleLabel =
    label ?? (size === "large" ? "Navigate in Google Maps" : "Google Maps");

  return (
    <div className={cn("space-y-1.5", className)}>
      <a
        href={googleHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onLinkClick}
        className={cn(
          "inline-flex w-full items-center justify-center gap-1.5 rounded-lg font-semibold !text-white transition",
          googleMapsClass(tone, primary, size)
        )}
      >
        {googleLabel}
      </a>
      {showApple && (
        <a
          href={appleHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLinkClick}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lg font-semibold transition",
            size === "large" ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs",
            tone === "light"
              ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
              : "bg-slate-900 text-slate-200 ring-1 ring-slate-600/60 hover:bg-slate-800"
          )}
        >
          Apple Maps
        </a>
      )}
    </div>
  );
}
