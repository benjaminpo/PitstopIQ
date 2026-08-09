"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquareWarning,
  RefreshCw,
  Search,
} from "lucide-react";
import { googleMapsNavigateUrl } from "@/app/lib/mapsLinks";
import type { AdminMissingStationReport } from "@/app/lib/missingStationReports";

interface ReportsResponse {
  reports?: AdminMissingStationReport[];
  error?: string;
}

function formatReportedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function AdminMissingStationReports() {
  const [reports, setReports] = useState<AdminMissingStationReport[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/missing-station-reports", {
        cache: "no-store",
      });
      const body = (await response.json()) as ReportsResponse;
      if (!response.ok) {
        throw new Error(body.error || "Could not load missing station reports");
      }
      setReports(body.reports ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load missing station reports"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/missing-station-reports", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as ReportsResponse;
        if (!response.ok) {
          throw new Error(body.error || "Could not load missing station reports");
        }
        if (active) setReports(body.reports ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load missing station reports"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [
        report.name,
        report.brand,
        report.address,
        report.placeLabel,
        report.notes,
        report.userName,
        report.userEmail,
      ].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [query, reports]);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl shadow-slate-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-semibold text-white">
              Missing station reports
            </h1>
            {!loading && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {reports.length}
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
            Review stations submitted by users and open their reported location in
            Google Maps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-teal-600 hover:text-teal-200 disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {reports.length > 0 && (
        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search station, location or reporter"
            aria-label="Search missing station reports"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
          />
        </div>
      )}

      {loading && reports.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reports…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="py-10 text-center text-sm text-slate-500">
          No missing stations have been reported.
        </div>
      )}

      {!loading && !error && reports.length > 0 && visibleReports.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-500">
          No reports match your search.
        </div>
      )}

      {visibleReports.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {visibleReports.map((report) => (
            <article
              key={report.id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-100">
                    {report.name}
                  </h2>
                  {report.brand && (
                    <p className="mt-0.5 text-xs text-slate-400">{report.brand}</p>
                  )}
                </div>
                <a
                  href={googleMapsNavigateUrl({
                    location: { lat: report.lat, lng: report.lng },
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-teal-300 transition hover:border-teal-600 hover:bg-teal-950/30"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Map
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
                {(report.address || report.placeLabel) && (
                  <p>{report.address || report.placeLabel}</p>
                )}
                <p className="font-mono text-[11px] text-slate-500">
                  {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                </p>
                {report.notes && (
                  <p className="rounded-lg bg-slate-900 px-3 py-2 text-slate-300">
                    {report.notes}
                  </p>
                )}
              </div>

              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Reported by{" "}
                <span className="text-slate-300">{report.userName}</span>
                {report.userEmail && ` (${report.userEmail})`} ·{" "}
                {formatReportedAt(report.createdAt)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
