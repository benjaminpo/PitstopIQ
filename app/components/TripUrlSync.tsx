"use client";

import { useEffect, useRef } from "react";
import { usePitstopStore } from "@/app/lib/store";
import {
  buildTripSearchParams,
  parseTripSearchParams,
  tripFieldsEqual,
  type TripSnapshot,
} from "@/app/lib/tripUrl";

function snapshotFromState(): TripSnapshot {
  return usePitstopStore.getState().getTripSnapshot();
}

function writeTripUrl(trip: TripSnapshot) {
  if (typeof window === "undefined") return;
  const params = buildTripSearchParams(trip);
  const next = `${window.location.pathname}?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current) return;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Hydrate the store from ?from=&to=&… on first load, then keep the address
 * bar in sync so the trip is bookmarkable / shareable.
 */
export function TripUrlSync() {
  const readyRef = useRef(false);
  const lastWrittenRef = useRef<TripSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const startSyncing = () => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;

      const fromUrl = parseTripSearchParams(window.location.search);
      if (fromUrl) {
        usePitstopStore.getState().applyTripSnapshot(fromUrl);
      }

      lastWrittenRef.current = snapshotFromState();
      // Ensure a clean URL even on first visit without params
      writeTripUrl(lastWrittenRef.current);

      const unsub = usePitstopStore.subscribe(() => {
        if (!readyRef.current) return;
        const next = snapshotFromState();
        if (
          lastWrittenRef.current &&
          tripFieldsEqual(lastWrittenRef.current, next)
        ) {
          return;
        }
        window.clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          lastWrittenRef.current = next;
          writeTripUrl(next);
        }, 250);
      });

      return unsub;
    };

    let unsubStore: (() => void) | undefined;

    const finish = () => {
      unsubStore = startSyncing();
    };

    if (usePitstopStore.persist.hasHydrated()) {
      finish();
    } else {
      const unsubHydration = usePitstopStore.persist.onFinishHydration(() => {
        finish();
      });
      return () => {
        cancelled = true;
        window.clearTimeout(debounceTimer);
        unsubHydration();
        unsubStore?.();
      };
    }

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      unsubStore?.();
    };
  }, []);

  return null;
}
