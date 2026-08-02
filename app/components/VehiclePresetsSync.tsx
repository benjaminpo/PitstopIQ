"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/app/lib/auth-client";
import { usePitstopStore } from "@/app/lib/store";
import type { VehiclePreset } from "@/app/lib/types";

type CloudPresetsResponse = {
  presets?: VehiclePreset[];
  activePresetId?: string | null;
  synced?: boolean;
  error?: string;
};

const PUSH_DEBOUNCE_MS = 400;

async function fetchCloudPresets(): Promise<CloudPresetsResponse | null> {
  try {
    const res = await fetch("/api/vehicle-presets");
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as CloudPresetsResponse;
  } catch {
    return null;
  }
}

async function pushCloudPresets(
  presets: VehiclePreset[],
  activePresetId: string | null
): Promise<boolean> {
  try {
    const res = await fetch("/api/vehicle-presets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presets, activePresetId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Keeps Zustand vehicle presets in sync with the signed-in user's cloud copy.
 * Guests stay on localStorage only. Mount once near the app root.
 */
export function VehiclePresetsSync() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;
  const replaceVehiclePresets = usePitstopStore((s) => s.replaceVehiclePresets);

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

      const cloud = await fetchCloudPresets();
      if (cancelled || !cloud) return;

      const cloudPresets = Array.isArray(cloud.presets) ? cloud.presets : [];
      const local = usePitstopStore.getState();

      skipPushRef.current = true;
      try {
        if (cloud.synced) {
          // Account already has a cloud copy (may be empty if user deleted all)
          replaceVehiclePresets(
            cloudPresets,
            cloud.activePresetId ?? null
          );
        } else {
          // First signed-in device: upload browser presets to the account
          await pushCloudPresets(
            local.vehiclePresets,
            local.activePresetId
          );
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
  }, [userId, isPending, replaceVehiclePresets]);

  // Push local mutations while signed in.
  useEffect(() => {
    if (!userId) return;

    const unsub = usePitstopStore.subscribe((state, prev) => {
      if (
        state.vehiclePresets === prev.vehiclePresets &&
        state.activePresetId === prev.activePresetId
      ) {
        return;
      }
      if (skipPushRef.current) return;
      if (syncedUserRef.current !== userId) return;

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        void pushCloudPresets(state.vehiclePresets, state.activePresetId);
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [userId]);

  return null;
}
