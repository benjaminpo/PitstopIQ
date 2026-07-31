import { describe, expect, it } from "vitest";
import { getAdSenseClient, getAdSensePublisherId } from "./adsense";

describe("adsense helpers", () => {
  it("normalizes pub- and ca-pub- client IDs", () => {
    const prev = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-1234567890123456";
    expect(getAdSenseClient()).toBe("ca-pub-1234567890123456");
    expect(getAdSensePublisherId()).toBe("pub-1234567890123456");

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "pub-1234567890123456";
    expect(getAdSenseClient()).toBe("ca-pub-1234567890123456");

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "";
    expect(getAdSenseClient()).toBeNull();

    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = prev;
  });
});
