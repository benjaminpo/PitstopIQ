import { afterEach, describe, expect, it, vi } from "vitest";
import { getGaMeasurementId, isGoogleAnalyticsEnabled } from "./analytics";

describe("Google Analytics configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalises a valid GA4 measurement ID", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "  g-abc123  ");

    expect(getGaMeasurementId()).toBe("G-ABC123");
    expect(isGoogleAnalyticsEnabled()).toBe(true);
  });

  it("is disabled when the ID is missing or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    expect(getGaMeasurementId()).toBeNull();
    expect(isGoogleAnalyticsEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "GTM-ABC123");
    expect(getGaMeasurementId()).toBeNull();
    expect(isGoogleAnalyticsEnabled()).toBe(false);
  });
});
