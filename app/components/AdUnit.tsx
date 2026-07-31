"use client";

import { useEffect, useRef } from "react";
import { getAdSenseClient } from "@/app/lib/adsense";
import { cn } from "@/app/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdUnitProps {
  /** Ad unit slot ID from the AdSense dashboard */
  slot: string;
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
  className?: string;
  /** Show a quiet placeholder while empty / in local dev */
  label?: boolean;
}

/**
 * Manual AdSense unit. Create the unit in AdSense, then pass its slot ID
 * via NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR (or prop).
 *
 * Ads usually only fill on a public HTTPS domain after AdSense approval.
 */
export function AdUnit({
  slot,
  format = "auto",
  className,
  label = true,
}: AdUnitProps) {
  const client = getAdSenseClient();
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !slot || pushed.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      // Script may not be ready yet — Auto ads / next visit still work
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/40",
        className
      )}
    >
      {label && (
        <p className="border-b border-slate-800/60 px-2 py-1 text-[9px] uppercase tracking-wide text-slate-600">
          Sponsored
        </p>
      )}
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Sidebar unit — slot from env so you can change it without redeploying code. */
export function SidebarAd() {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR?.trim() ?? "";
  if (!slot) return null;
  return <AdUnit slot={slot} format="auto" className="mx-5 mb-2 shrink-0" />;
}
