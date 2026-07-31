import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAdSenseClient,
  getAdSensePublisherId,
  isAdSenseEnabled,
} from "./adsense";

describe("adsense helpers", () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = prev;
  });

  it("normalizes pub- and ca-pub- client IDs", () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-1234567890123456";
    expect(getAdSenseClient()).toBe("ca-pub-1234567890123456");
    expect(getAdSensePublisherId()).toBe("pub-1234567890123456");

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "pub-1234567890123456";
    expect(getAdSenseClient()).toBe("ca-pub-1234567890123456");

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "";
    expect(getAdSenseClient()).toBeNull();
  });

  it("rejects client IDs with an unexpected prefix", () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "publisher-123";
    expect(getAdSenseClient()).toBeNull();
    expect(getAdSensePublisherId()).toBeNull();
  });

  it("reports whether AdSense is enabled", () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-1234567890123456";
    expect(isAdSenseEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "";
    expect(isAdSenseEnabled()).toBe(false);
  });
});
