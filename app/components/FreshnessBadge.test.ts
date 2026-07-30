import { describe, expect, it } from "vitest";
import {
  formatPriceAge,
  freshnessTone,
} from "@/app/components/FreshnessBadge";

describe("formatPriceAge", () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);

  it("formats relative ages", () => {
    expect(formatPriceAge(now - 30_000, now)).toBe("just now");
    expect(formatPriceAge(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatPriceAge(now - 90 * 60_000, now)).toBe("1h 30m ago");
    expect(formatPriceAge(now - 2 * 60 * 60_000, now)).toBe("2h ago");
  });
});

describe("freshnessTone", () => {
  const now = 1_000_000_000_000;

  it("labels mock and unknown sources", () => {
    expect(freshnessTone("mock", null, now)).toBe("mock");
    expect(freshnessTone(null, null, now)).toBe("unknown");
    expect(freshnessTone("live", null, now)).toBe("unknown");
  });

  it("bands live ages", () => {
    expect(freshnessTone("live", now - 10 * 60_000, now)).toBe("fresh");
    expect(freshnessTone("live", now - 40 * 60_000, now)).toBe("aging");
    expect(freshnessTone("live", now - 55 * 60_000, now)).toBe("stale");
  });
});
