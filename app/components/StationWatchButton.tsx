"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/app/lib/auth-client";
import { FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { FuelType } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import type { PriceWatch } from "@/app/lib/priceWatchTypes";

interface StationWatchButtonProps {
  stationId: string;
  stationName: string;
  stationBrand: string;
  fuelType: FuelType;
  /** Current £/L for the watched grade (becomes the baseline). */
  baselinePrice: number | null;
  className?: string;
  stopPropagation?: boolean;
}

export function StationWatchButton({
  stationId,
  stationName,
  stationBrand,
  fuelType,
  baselinePrice,
  className,
  stopPropagation = true,
}: Readonly<StationWatchButtonProps>) {
  const { data: session, isPending } = useSession();
  const [watch, setWatch] = useState<PriceWatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const loggedIn = Boolean(session?.user);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/price-watches?evaluate=0");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { watches?: PriceWatch[] };
        const match =
          data.watches?.find(
            (w) => w.stationId === stationId && w.fuelType === fuelType
          ) ?? null;
        if (!cancelled) setWatch(match);
      } catch {
        // Ignore — watch UI stays optional.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn, stationId, fuelType]);

  const onToggle = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!session?.user) return;
    if (baselinePrice == null || !Number.isFinite(baselinePrice)) {
      setError("No live price for this grade yet.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (watch) {
        const res = await fetch(
          `/api/price-watches/${encodeURIComponent(watch.id)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Could not remove watch");
          return;
        }
        setWatch(null);
        return;
      }

      const res = await fetch("/api/price-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          stationName,
          stationBrand,
          fuelType,
          baselinePrice,
        }),
      });
      const data = (await res.json()) as {
        watch?: PriceWatch;
        error?: string;
      };
      if (!res.ok || !data.watch) {
        setError(data.error ?? "Could not create watch");
        return;
      }
      setWatch(data.watch);
    } catch {
      setError("Could not update watch");
    } finally {
      setLoading(false);
    }
  };

  if (isPending || (loggedIn && !checked)) {
    return (
      <div
        className={cn(
          "mt-3 flex items-center justify-center rounded-lg bg-slate-900/50",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <p className={cn("mt-3 text-[11px] text-slate-500", className)}>
        <Link
          href="/login"
          className="font-semibold text-teal-300 hover:text-teal-200"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
          }}
        >
          Sign in
        </Link>{" "}
        to get alerts when {FUEL_TYPE_SHORT[fuelType]} drops here.
      </p>
    );
  }

  const watching = Boolean(watch);

  return (
    <div className={cn("mt-3 space-y-1", className)}>
      <button
        type="button"
        onClick={(e) => void onToggle(e)}
        disabled={loading || (baselinePrice == null && !watching)}
        className={cn(
          "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          watching
            ? "bg-amber-950/50 text-amber-200 ring-1 ring-amber-600/40 hover:bg-amber-950/80"
            : "bg-slate-800 text-slate-100 ring-1 ring-slate-600/60 hover:bg-slate-700"
        )}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {!loading && watching && <BellOff className="h-3.5 w-3.5" />}
        {!loading && !watching && <Bell className="h-3.5 w-3.5" />}
        {watching
          ? `Watching ${FUEL_TYPE_SHORT[fuelType]}`
          : `Watch ${FUEL_TYPE_SHORT[fuelType]} price`}
      </button>
      {error && <p className="text-[11px] text-rose-300/90">{error}</p>}
      {watching && watch && (
        <p className="text-[10px] leading-snug text-slate-500">
          Alert in Account when price drops ≥ £
          {watch.thresholdGbp.toFixed(2)}/L from £
          {watch.baselinePrice.toFixed(3)}.
        </p>
      )}
    </div>
  );
}
