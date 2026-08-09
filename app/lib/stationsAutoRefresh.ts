/**
 * Quiet client-side polling for Fuel Finder prices.
 * Upstream is REST-only; this refreshes PitstopIQ’s cached pull while a page is open.
 */

/** How often open pages soft-refresh station prices. */
export const STATIONS_AUTO_REFRESH_MS = 3 * 60 * 1000;

/**
 * Call `refresh` on an interval while the tab is visible, and once when the
 * tab becomes visible again after being hidden.
 * Returns an unsubscribe / cleanup function.
 */
export function subscribeStationsAutoRefresh(
  refresh: () => void,
  options?: { intervalMs?: number }
): () => void {
  const intervalMs = options?.intervalMs ?? STATIONS_AUTO_REFRESH_MS;

  const tick = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    refresh();
  };

  const id = globalThis.setInterval(tick, intervalMs);

  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    globalThis.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
