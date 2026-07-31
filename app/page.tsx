"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Crosshair, Loader2, Menu, PanelLeftClose, Sparkles } from "lucide-react";
import { RouteForm } from "@/app/components/RouteForm";
import { SidebarAd } from "@/app/components/AdUnit";
import { ShareTripButton } from "@/app/components/ShareTripButton";
import { StationList } from "@/app/components/StationList";
import { TripUrlSync } from "@/app/components/TripUrlSync";
import { usePitstopStore } from "@/app/lib/store";
import { formatDuration } from "@/app/lib/routing";
import { parseTripSearchParams } from "@/app/lib/tripUrl";
import { cn } from "@/app/lib/utils";

const MapView = dynamic(() => import("@/app/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function HomePage() {
  const {
    sidebarOpen,
    setSidebarOpen,
    loadStations,
    locateCurrentPosition,
    locating,
    route,
    routing,
    routeError,
  } = usePitstopStore();

  const bootstrapped = useRef(false);

  useEffect(() => {
    // TripUrlSync applies shared links and triggers loadStations.
    // Only auto-load here when the URL has no trip params.
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (typeof window !== "undefined" && parseTripSearchParams(window.location.search)) {
      return;
    }
    void loadStations();
  }, [loadStations]);

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100">
      <TripUrlSync />

      {/* Atmospheric backdrop behind map */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(14,116,144,0.12),transparent_45%)]"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "relative z-20 flex h-full w-full max-w-[420px] shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-md transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "absolute md:static md:translate-x-0",
          !sidebarOpen && "md:hidden"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-md shadow-teal-950/50">
                <Sparkles className="h-4 w-4" />
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white">
                PitstopIQ
              </h1>
              <ShareTripButton />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Smart route cost calculator — know when a cheaper forecourt is
              worth the detour.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 md:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-5 py-4">
          <div className="shrink-0 overflow-y-auto max-h-[48%] pr-1">
            <RouteForm />
          </div>
          <div className="h-px shrink-0 bg-slate-800/80" />
          <StationList />
        </div>

        <SidebarAd />

        <footer className="border-t border-slate-800/80 px-5 py-3 text-[10px] text-slate-500">
          UK gallon = 4.54609 L · Net = gross savings − detour fuel cost · ±£0.50
          break-even band
        </footer>
      </aside>

      {/* Map pane */}
      <main className="relative z-10 min-w-0 flex-1">
        <div className="absolute left-3 top-3 z-[500] flex gap-2 md:left-4 md:top-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-sm font-medium text-slate-100 shadow-lg backdrop-blur hover:bg-slate-900"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
            <span className="hidden sm:inline">
              {sidebarOpen ? "Hide panel" : "Show panel"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void locateCurrentPosition("origin")}
            disabled={locating}
            className="flex items-center gap-2 rounded-lg border border-teal-700/50 bg-slate-950/90 px-3 py-2 text-sm font-medium text-teal-300 shadow-lg backdrop-blur hover:bg-teal-950/50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Use current location as origin"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {locating ? "Locating…" : "My location"}
            </span>
          </button>
        </div>

        <div className="absolute bottom-4 left-3 z-[500] flex flex-wrap gap-2 md:left-4">
          <LegendDot color="bg-emerald-400" label="Worth it" />
          <LegendDot color="bg-amber-400" label="Break-even ±£0.50" />
          <LegendDot color="bg-rose-400" label="False economy" />
        </div>

        <div className="absolute bottom-4 right-3 z-[500] md:right-4">
          {routing && (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
              Calculating driving route…
            </div>
          )}
          {!routing && route && (
            <div className="rounded-lg border border-teal-800/50 bg-slate-950/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
              <p className="font-semibold text-teal-300">Driving route</p>
              <p className="font-mono text-slate-300">
                {route.distanceMiles.toFixed(1)} mi ·{" "}
                {formatDuration(route.durationSeconds)}
              </p>
            </div>
          )}
          {!routing && routeError && (
            <div className="max-w-[220px] rounded-lg border border-amber-800/50 bg-slate-950/90 px-3 py-2 text-xs text-amber-300 shadow-lg backdrop-blur">
              {routeError} — showing straight line
            </div>
          )}
        </div>

        <MapView />
      </main>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] text-slate-300 shadow backdrop-blur">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}
