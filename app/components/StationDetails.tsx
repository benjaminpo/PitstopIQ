"use client";

import { Clock, MapPin, Wrench } from "lucide-react";
import {
  findNearbyStations,
  formatAmenityLabel,
  formatOpeningHoursRows,
} from "@/app/lib/stationFacilities";
import { usePitstopStore } from "@/app/lib/store";
import type { FuelStation, FuelType } from "@/app/lib/types";
import { BrandLogo } from "./BrandLogo";

interface StationDetailsProps {
  station: FuelStation;
  fuelType: FuelType;
  onSelectNearby?: (stationId: string) => void;
}

export function StationDetails({
  station,
  fuelType,
  onSelectNearby,
}: Readonly<StationDetailsProps>) {
  const getEnrichedStations = usePitstopStore((s) => s.getEnrichedStations);
  const setSelectedStationId = usePitstopStore((s) => s.setSelectedStationId);
  const setSidebarOpen = usePitstopStore((s) => s.setSidebarOpen);

  const hourRows = station.openingHours
    ? formatOpeningHoursRows(station.openingHours)
    : [];
  const amenities = station.amenities ?? [];
  const nearby = findNearbyStations(
    station.location,
    getEnrichedStations(),
    { excludeId: station.id, maxMiles: 3, limit: 4 }
  );

  const selectNearby = (stationId: string) => {
    if (onSelectNearby) {
      onSelectNearby(stationId);
      return;
    }
    setSelectedStationId(stationId);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  };

  if (hourRows.length === 0 && amenities.length === 0 && nearby.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-700/70 pt-3">
      {hourRows.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Clock className="h-3 w-3" />
            Opening hours
          </h3>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {hourRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="font-mono text-slate-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {amenities.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Wrench className="h-3 w-3" />
            Available facilities
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {amenities.map((id) => (
              <li
                key={id}
                className="rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-700/70"
              >
                {formatAmenityLabel(id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <MapPin className="h-3 w-3" />
            Fuel stations nearby
          </h3>
          <ul className="mt-1.5 space-y-1">
            {nearby.map(({ item, miles }) => {
              const price = item.station.prices[fuelType] ?? item.pricePerLitre;
              return (
                <li key={item.station.id}>
                  <button
                    type="button"
                    onClick={() => selectNearby(item.station.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-950/50"
                  >
                    <BrandLogo brand={item.station.brand} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">
                        {item.station.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {miles.toFixed(1)} mi · {item.station.brand}
                      </p>
                    </div>
                    {price != null && Number.isFinite(price) && (
                      <span className="shrink-0 font-mono text-xs text-slate-300">
                        £{price.toFixed(3)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
