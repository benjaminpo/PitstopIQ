"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/app/lib/auth-client";
import type { PlaceSuggestion } from "@/app/lib/placeSearch";
import { usePitstopStore } from "@/app/lib/store";

type CloudRecentPlacesResponse = {
  places?: PlaceSuggestion[];
  synced?: boolean;
  error?: string;
};

const PUSH_DEBOUNCE_MS = 400;

async function fetchCloudRecentPlaces(): Promise<CloudRecentPlacesResponse | null> {
  try {
    const res = await fetch("/api/recent-places");
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as CloudRecentPlacesResponse;
  } catch {
    return null;
  }
}

async function pushCloudRecentPlaces(
  places: PlaceSuggestion[]
): Promise<boolean> {
  try {
    const res = await fetch("/api/recent-places", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ places }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Keeps Zustand recent place searches in sync with the signed-in user's cloud copy.
 * Guests stay on localStorage only. Mount once near the app root.
 */
export function RecentPlacesSync() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;
  const replaceRecentPlaces = usePitstopStore((s) => s.replaceRecentPlaces);

  const skipPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserRef = useRef<string | null>(null);

  // Pull from cloud when the user signs in (after localStorage rehydration).
  useEffect(() => {
    if (isPending || !userId) {
      if (!userId) syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === userId) return;

    let cancelled = false;

    const sync = async () => {
      // Wait for Zustand persist rehydration so we don't overwrite with defaults
      // before localStorage has loaded, then seed an empty cloud account.
      const persistApi = usePitstopStore.persist;
      if (persistApi.hasHydrated && !persistApi.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = persistApi.onFinishHydration(() => {
            unsub();
            resolve();
          });
        });
      }
      if (cancelled) return;

      const cloud = await fetchCloudRecentPlaces();
      if (cancelled || !cloud) return;

      const cloudPlaces = Array.isArray(cloud.places) ? cloud.places : [];
      const local = usePitstopStore.getState();

      skipPushRef.current = true;
      try {
        if (cloud.synced) {
          // Account already has a cloud copy (may be empty if user cleared all)
          replaceRecentPlaces(cloudPlaces);
        } else {
          // First signed-in device: upload browser history to the account
          await pushCloudRecentPlaces(local.recentPlaces);
        }
      } finally {
        // Allow the next tick so the apply/replace subscription does not re-push
        queueMicrotask(() => {
          skipPushRef.current = false;
        });
      }

      syncedUserRef.current = userId;
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [userId, isPending, replaceRecentPlaces]);

  // Push local mutations while signed in.
  useEffect(() => {
    if (!userId) return;

    const unsub = usePitstopStore.subscribe((state, prev) => {
      if (state.recentPlaces === prev.recentPlaces) return;
      if (skipPushRef.current) return;
      if (syncedUserRef.current !== userId) return;

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        void pushCloudRecentPlaces(state.recentPlaces);
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [userId]);

  return null;
}
