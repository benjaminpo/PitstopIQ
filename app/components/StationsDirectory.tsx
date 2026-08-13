"use client";

import { useEffect, useState } from "react";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { DirectoryStationBrowser } from "@/app/components/DirectoryStationBrowser";
import { FreshnessBadge } from "@/app/components/FreshnessBadge";
import { UK_BOUNDS } from "@/app/lib/fuelConstants";
import { subscribeStationsAutoRefresh } from "@/app/lib/stationsAutoRefresh";
import type { FuelStation } from "@/app/lib/types";

interface StationsResponse {
  stations: FuelStation[];
  source: "live" | "mock";
  pricesFetchedAt: number | null;
  count: number;
  error?: string;
}

export function StationsDirectory() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [pricesFetchedAt, setPricesFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadStations = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({
        north: String(UK_BOUNDS.north),
        south: String(UK_BOUNDS.south),
        east: String(UK_BOUNDS.east),
        west: String(UK_BOUNDS.west),
      });
      const response = await fetch(`/api/fuel-finder?${params}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as StationsResponse;
      if (!response.ok) {
        throw new Error(body.error || "Could not load stations");
      }
      setStations(body.stations ?? []);
      setSource(body.source);
      setPricesFetchedAt(body.pricesFetchedAt);
      if (silent) setError(null);
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load stations"
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    // Defer so loadStations' setState is not synchronous inside the effect body.
    queueMicrotask(() => {
      if (!cancelled) void loadStations();
    });
    const unsubscribe = subscribeStationsAutoRefresh(() => {
      void loadStations({ silent: true });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DirectoryShell>
      <DirectoryHeader
        current="stations"
        title="All stations"
        description="Browse UK Fuel Finder forecourts with live prices. Sort by price, name, location, or last update — and filter by brand, freshness, and open hours."
        trailing={
          source ? (
            <FreshnessBadge
              source={source}
              pricesFetchedAt={pricesFetchedAt}
              now={now}
            />
          ) : null
        }
      />

      <DirectoryStationBrowser
        stations={stations}
        pricesFetchedAt={pricesFetchedAt}
        loading={loading}
        error={error}
        onRetry={() => void loadStations()}
        loadingLabel="Fetching national Fuel Finder prices…"
        emptyMessage="No stations match these filters. Clear search, brand exclusions, or open-now / freshness filters and try again."
      />
    </DirectoryShell>
  );
}
