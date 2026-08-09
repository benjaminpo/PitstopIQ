"use client";

import { PanelLeftOpen } from "lucide-react";
import { NavigateHere } from "@/app/components/NavigateHere";
import { BrandLogo } from "@/app/components/BrandLogo";
import { formatGbp } from "@/app/lib/detourCalculator";
import { usePitstopStore } from "@/app/lib/store";
import { cn } from "@/app/lib/utils";

/**
 * Sticky mid-drive CTA: when a station is selected and the mobile panel is
 * closed, keep Navigate reachable without reopening the full sidebar.
 */
export function MobileSelectedStationBar() {
  const {
    selectedStationId,
    sidebarOpen,
    setSidebarOpen,
    getEnrichedStations,
    originCoords,
  } = usePitstopStore();

  if (sidebarOpen || !selectedStationId) return null;

  const item = getEnrichedStations().find(
    (s) => s.station.id === selectedStationId
  );
  if (!item) return null;

  const { station, calculation } = item;
  const net = calculation.netAfterTime;
  let netClass = "text-amber-300";
  if (net > 0.5) netClass = "text-emerald-400";
  else if (net < -0.5) netClass = "text-rose-400";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[520] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/60 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <BrandLogo brand={station.brand} size="lg" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">
              {station.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{station.brand}</p>
            <p className={cn("mt-1 font-mono text-base font-semibold", netClass)}>
              Net {formatGbp(net)}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {calculation.detourExtraMinutes < 0.5
                  ? "<1 min"
                  : `+${Math.round(calculation.detourExtraMinutes)} min`}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Open trip panel for station details"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
        <NavigateHere
          className="mt-3"
          primary
          size="large"
          label="Navigate"
          target={{
            location: station.location,
            name: station.name,
            origin: originCoords,
          }}
        />
      </div>
    </div>
  );
}
