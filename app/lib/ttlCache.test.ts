import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./ttlCache";

function clock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("TtlCache", () => {
  it("returns stored values until they expire", () => {
    const c = clock();
    const cache = new TtlCache<string>({ ttlMs: 100, maxEntries: 10, now: c.now });
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");
    c.advance(99);
    expect(cache.get("a")).toBe("one");
    c.advance(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("returns undefined for unknown keys", () => {
    const cache = new TtlCache<number>({ ttlMs: 100, maxEntries: 10 });
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts the least recently used entry past maxEntries", () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1); // a is now most recent
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("overwrites an existing key without growing", () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
  });

  it("clamps maxEntries to at least one", () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 0 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    cache.set("b", 2);
    expect(cache.size).toBe(1);
  });

  it("loads once and serves later calls from cache", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 10 });
    const load = vi.fn().mockResolvedValue("value");
    await expect(cache.getOrLoad("k", load)).resolves.toBe("value");
    await expect(cache.getOrLoad("k", load)).resolves.toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 10 });
    let resolve!: (v: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        })
    );
    const first = cache.getOrLoad("k", load);
    const second = cache.getOrLoad("k", load);
    resolve("shared");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "shared",
      "shared",
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed loads", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 10 });
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("ok");
    await expect(cache.getOrLoad("k", load)).rejects.toThrow("upstream down");
    await expect(cache.getOrLoad("k", load)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
