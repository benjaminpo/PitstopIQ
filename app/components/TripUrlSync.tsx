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
 * Hydrate the store from ?from=&to=&via=&… on first load, then keep the address
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
      const shouldUseCurrentLocation =
        !fromUrl?.originCoords && !fromUrl?.destinationCoords;

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
        // Route ends / stops: write immediately so Share & the address bar
        // include `via` before the user can copy. Vehicle sliders stay debounced.
        const prev = lastWrittenRef.current;
        const routeChanged =
          prev == null ||
          prev.origin !== next.origin ||
          prev.destination !== next.destination ||
          prev.originCoords?.lat !== next.originCoords?.lat ||
          prev.originCoords?.lng !== next.originCoords?.lng ||
          prev.destinationCoords?.lat !== next.destinationCoords?.lat ||
          prev.destinationCoords?.lng !== next.destinationCoords?.lng ||
          (prev.stops?.length ?? 0) !== (next.stops?.length ?? 0) ||
          (prev.stops ?? []).some(
            (s, i) =>
              s.label !== next.stops?.[i]?.label ||
              s.coords?.lat !== next.stops?.[i]?.coords?.lat ||
              s.coords?.lng !== next.stops?.[i]?.coords?.lng
          );
        debounceTimer = setTimeout(
          () => {
            lastWrittenRef.current = next;
            writeTripUrl(next);
          },
          routeChanged ? 0 : 250
        );
      });

      if (shouldUseCurrentLocation) {
        void usePitstopStore.getState().locateCurrentPosition("both");
      }

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
