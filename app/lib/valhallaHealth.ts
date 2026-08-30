"use client";

import { useEffect, useState } from "react";

export type ValhallaHealth = "unknown" | "ok" | "down";

export const VALHALLA_AVOID_OK_MESSAGE =
  "Avoid routing is available. Motorways, tolls, and ferries will be skipped where possible.";

export const VALHALLA_AVOID_DOWN_MESSAGE =
  "Avoid routing is unavailable right now. Routes will still use motorways, tolls, or ferries.";

export function avoidRoutingNotice(
  health: ValhallaHealth,
  avoidActive: boolean
): { tone: "ok" | "warn"; text: string } | null {
  if (!avoidActive || health === "unknown") return null;
  if (health === "ok") {
    return { tone: "ok", text: VALHALLA_AVOID_OK_MESSAGE };
  }
  return { tone: "warn", text: VALHALLA_AVOID_DOWN_MESSAGE };
}

let cached: ValhallaHealth | null = null;
let inflight: Promise<ValhallaHealth> | null = null;

export function resetValhallaHealthCache(): void {
  cached = null;
  inflight = null;
}

export function fetchValhallaHealth(): Promise<ValhallaHealth> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/osrm/valhalla", {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    })
      .then(async (res) => {
        if (!res.ok) return "down" as const;
        const data = (await res.json()) as { ok?: boolean };
        return data.ok === true ? "ok" : "down";
      })
      .catch(() => "down" as const)
      .then((health) => {
        cached = health;
        return health;
      });
  }
  return inflight;
}

/** Starts the Valhalla probe as soon as the planner mounts. */
export function useValhallaHealth(): ValhallaHealth {
  const [health, setHealth] = useState<ValhallaHealth>(cached ?? "unknown");
  useEffect(() => {
    let cancelled = false;
    void fetchValhallaHealth().then((next) => {
      if (!cancelled) setHealth(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return health;
}
