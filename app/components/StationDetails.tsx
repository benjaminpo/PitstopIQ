"use client";

import { Clock, Wrench } from "lucide-react";
import {
  formatAmenityLabel,
  formatOpeningHoursRows,
  stationClosureLabel,
} from "@/app/lib/stationFacilities";
import type { FuelStation } from "@/app/lib/types";
import { StationClosureBadge } from "./StationClosureBadge";

interface StationDetailsProps {
  station: FuelStation;
}

export function StationDetails({ station }: Readonly<StationDetailsProps>) {
  const hourRows = station.openingHours
    ? formatOpeningHoursRows(station.openingHours)
    : [];
  const amenities = station.amenities ?? [];
  const hasClosure = stationClosureLabel(station) != null;

  if (hourRows.length === 0 && amenities.length === 0 && !hasClosure) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-700/70 pt-3">
      {hasClosure && (
        <section>
          <div className="flex flex-wrap gap-1.5">
            <StationClosureBadge station={station} />
          </div>
        </section>
      )}

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
    </div>
  );
}
