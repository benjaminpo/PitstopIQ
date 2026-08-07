"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Loader2, MapPinPlus } from "lucide-react";
import { PlaceAutocomplete } from "@/app/components/PlaceAutocomplete";
import { useSession } from "@/app/lib/auth-client";
import {
  formatPlaceSelection,
  type PlaceSuggestion,
} from "@/app/lib/placeSearch";
import { usePitstopStore } from "@/app/lib/store";
import type { GeoPoint } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-100 outline-none ring-teal-500/40 transition placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2";

interface ReportMissingStationProps {
  /** Compact trigger for list headers / empty states */
  className?: string;
  /** Start expanded (e.g. empty corridor) */
  defaultOpen?: boolean;
}

export function ReportMissingStation({
  className,
  defaultOpen = false,
}: Readonly<ReportMissingStationProps>) {
  const { data: session, isPending } = useSession();
  const recentPlaces = usePitstopStore((s) => s.recentPlaces);
  const addRecentPlace = usePitstopStore((s) => s.addRecentPlace);
  const clearRecentPlaces = usePitstopStore((s) => s.clearRecentPlaces);

  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [coords, setCoords] = useState<GeoPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const signedIn = Boolean(session?.user);
  const canSubmit =
    signedIn && name.trim().length > 0 && coords != null && !busy;

  const resetForm = () => {
    setName("");
    setBrand("");
    setAddress("");
    setNotes("");
    setPlaceQuery("");
    setPlaceLabel(null);
    setCoords(null);
  };

  const onSelectPlace = (place: PlaceSuggestion) => {
    addRecentPlace(place);
    const label = formatPlaceSelection(place);
    setPlaceQuery(label);
    setPlaceLabel(label);
    setCoords(place.location);
    if (!address.trim() && (place.secondary || place.postcode)) {
      setAddress(
        [place.secondary, place.postcode].filter(Boolean).join(", ")
      );
    }
    if (!name.trim() && place.label) {
      setName(place.label);
    }
  };

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!canSubmit || !coords) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/missing-station-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          lat: coords.lat,
          lng: coords.lng,
          placeLabel,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send report");
      }
      setSaved(true);
      resetForm();
      window.setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-700/70 bg-slate-900/50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-800/40"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
          <MapPinPlus className="h-3.5 w-3.5 text-teal-400" />
          Report a missing station
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700/60 px-3 py-3">
          {isPending && (
            <p className="text-[11px] text-slate-500">Checking sign-in…</p>
          )}
          {!isPending && !signedIn && (
            <p className="text-[11px] leading-snug text-slate-400">
              <Link
                href="/login"
                className="font-semibold text-teal-300 hover:text-teal-200"
              >
                Sign in
              </Link>{" "}
              to tell us about a forecourt that should be on this route.
            </p>
          )}
          {!isPending && signedIn && (
            <form className="space-y-2.5" onSubmit={(e) => void onSubmit(e)}>
              <p className="text-[11px] leading-snug text-slate-500">
                Know a pump near your route that Fuel Finder missed? We’ll review
                reports — this doesn’t add it to results immediately.
              </p>

              <label className="block space-y-1">
                <span className="text-[10px] font-medium tracking-wide text-slate-400">
                  Station name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="e.g. Tesco Extra Petrol"
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-medium tracking-wide text-slate-400">
                  Location
                </span>
                <PlaceAutocomplete
                  value={placeQuery}
                  onChange={(v) => {
                    setPlaceQuery(v);
                    setCoords(null);
                    setPlaceLabel(null);
                  }}
                  onSelect={onSelectPlace}
                  recentPlaces={recentPlaces}
                  onClearRecent={clearRecentPlaces}
                  placeholder="Search place, address, or postcode…"
                  ariaLabel="Missing station location"
                />
                {coords && (
                  <p className="font-mono text-[10px] text-teal-500/80">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                )}
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium tracking-wide text-slate-400">
                    Brand (optional)
                  </span>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    maxLength={80}
                    placeholder="Shell, BP…"
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium tracking-wide text-slate-400">
                    Address (optional)
                  </span>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={200}
                    placeholder="Street / postcode"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] font-medium tracking-wide text-slate-400">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Open hours, fuels, why it’s useful…"
                  className={cn(inputClass, "resize-y")}
                />
              </label>

              {error && (
                <p className="text-[11px] text-rose-400">{error}</p>
              )}
              {saved && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-300">
                  <Check className="h-3.5 w-3.5" />
                  Thanks — report sent
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPinPlus className="h-3.5 w-3.5" />
                )}
                {busy ? "Sending…" : "Submit report"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
