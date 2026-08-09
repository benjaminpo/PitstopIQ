import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  STATIONS_AUTO_REFRESH_MS,
  subscribeStationsAutoRefresh,
} from "./stationsAutoRefresh";

function mockDocument(visibility: DocumentVisibilityState) {
  let current = visibility;
  const listeners = new Map<string, Set<EventListener>>();
  const doc = {
    get visibilityState() {
      return current;
    },
    setVisibility(next: DocumentVisibilityState) {
      current = next;
    },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    },
  };
  vi.stubGlobal("document", doc);
  return doc;
}

describe("subscribeStationsAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exports a multi-minute default interval", () => {
    expect(STATIONS_AUTO_REFRESH_MS).toBe(3 * 60 * 1000);
  });

  it("polls on the interval while visible", () => {
    mockDocument("visible");
    const refresh = vi.fn();
    const stop = subscribeStationsAutoRefresh(refresh, { intervalMs: 1000 });

    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(3);

    stop();
    vi.advanceTimersByTime(5000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("skips ticks while the tab is hidden", () => {
    const doc = mockDocument("visible");
    const refresh = vi.fn();
    const stop = subscribeStationsAutoRefresh(refresh, { intervalMs: 1000 });

    doc.setVisibility("hidden");
    vi.advanceTimersByTime(3000);
    expect(refresh).not.toHaveBeenCalled();

    stop();
  });

  it("refreshes when the tab becomes visible again", () => {
    const doc = mockDocument("visible");
    const refresh = vi.fn();
    const stop = subscribeStationsAutoRefresh(refresh, { intervalMs: 60_000 });

    doc.setVisibility("hidden");
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();

    doc.setVisibility("visible");
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
  });
});
