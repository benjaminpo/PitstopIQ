"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { usePitstopStore } from "@/app/lib/store";
import { tripToShareUrl } from "@/app/lib/tripUrl";

/** Push the trip snapshot into the address bar so native share picks up vias. */
function syncTripUrlToAddressBar(url: string) {
  if (typeof window === "undefined") return;
  try {
    const next = new URL(url);
    const nextPath = `${next.pathname}${next.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== current) {
      window.history.replaceState(window.history.state, "", nextPath);
    }
  } catch {
    // ignore malformed URL — clipboard/share still get the string
  }
}

export function ShareTripButton() {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    // Read live store state (not a possibly-stale selector closure)
    const snap = usePitstopStore.getState().getTripSnapshot();
    const url = tripToShareUrl(snap);
    // Safari / some Web Share implementations share location.href instead of
    // the `url` field — sync the bar first so multi-stop `via` is included.
    syncTripUrlToAddressBar(url);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "PitstopIQ trip",
          text: `Fuel detour plan\n${url}`,
          url,
        });
        return;
      }
    } catch (err) {
      // User cancelled share sheet — fall through only on abort? skip copy
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: prompt
      window.prompt("Copy this trip link:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-teal-600/50 hover:bg-teal-950/40 hover:text-teal-200"
      aria-label="Share or copy trip link"
      title="Share trip link"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-teal-400" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
