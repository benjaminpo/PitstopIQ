"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { FUEL_TYPE_SHORT } from "@/app/lib/fuelConstants";
import type { PriceAlertEvent, PriceWatch } from "@/app/lib/priceWatchTypes";
import { cn } from "@/app/lib/utils";

function formatDropTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PriceAlertsPanel() {
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [alerts, setAlerts] = useState<PriceAlertEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [watchesRes, alertsRes] = await Promise.all([
        fetch("/api/price-watches?evaluate=1"),
        fetch("/api/price-alerts?evaluate=1"),
      ]);
      if (!watchesRes.ok || !alertsRes.ok) {
        const errBody = (!watchesRes.ok ? await watchesRes.json() : await alertsRes.json()) as {
          error?: string;
        };
        setError(errBody.error ?? "Could not load alerts");
        return;
      }
      const watchesData = (await watchesRes.json()) as { watches?: PriceWatch[] };
      const alertsData = (await alertsRes.json()) as {
        alerts?: PriceAlertEvent[];
        unreadCount?: number;
      };
      setWatches(watchesData.watches ?? []);
      setAlerts(alertsData.alerts ?? []);
      setUnreadCount(alertsData.unreadCount ?? 0);
    } catch {
      setError("Could not load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markAllRead = async () => {
    setBusyId("mark-all");
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { unreadCount?: number };
        setUnreadCount(data.unreadCount ?? 0);
        setAlerts((prev) =>
          prev.map((a) =>
            a.readAt == null ? { ...a, readAt: Date.now() } : a
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const removeWatch = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/price-watches/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWatches((prev) => prev.filter((w) => w.id !== id));
        setAlerts((prev) => prev.filter((a) => a.watchId !== id));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading alerts…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-300"
        >
          {error}
        </p>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Price drops
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={busyId === "mark-all"}
              className="text-[11px] font-semibold text-teal-300 hover:text-teal-200 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No drops yet. Watch a station from the map — we&apos;ll flag it here
            when the price falls.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => {
              const drop = alert.oldPrice - alert.newPrice;
              const unread = alert.readAt == null;
              return (
                <li
                  key={alert.id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    unread
                      ? "border-teal-700/50 bg-teal-950/30"
                      : "border-slate-800/80 bg-slate-900/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {alert.stationName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {alert.stationBrand} · {FUEL_TYPE_SHORT[alert.fuelType]}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-semibold text-emerald-400">
                      −£{drop.toFixed(3)}
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    £{alert.oldPrice.toFixed(3)} → £{alert.newPrice.toFixed(3)}
                    <span className="text-slate-600"> · </span>
                    {formatDropTime(alert.droppedAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-100">Watched stations</h3>
        {watches.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Open a station on the map and tap{" "}
            <span className="font-semibold text-slate-300">Watch price</span>.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {watches.map((watch) => (
              <li
                key={watch.id}
                className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2.5"
              >
                <Bell className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {watch.stationName}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {FUEL_TYPE_SHORT[watch.fuelType]} · baseline £
                    {watch.baselinePrice.toFixed(3)} · alert ≥ £
                    {watch.thresholdGbp.toFixed(2)}
                    {watch.lastSeenPrice != null
                      ? ` · now £${watch.lastSeenPrice.toFixed(3)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeWatch(watch.id)}
                  disabled={busyId === watch.id}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-300/90 transition hover:bg-rose-950/40 disabled:opacity-50"
                  aria-label={`Stop watching ${watch.stationName}`}
                >
                  {busyId === watch.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
