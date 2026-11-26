import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthBaseURL } from "./auth-url";

const KEYS = [
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_BETTER_AUTH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

const original = Object.fromEntries(
  KEYS.map((k) => [k, process.env[k]])
) as Record<(typeof KEYS)[number], string | undefined>;

afterEach(() => {
  // NODE_ENV is typed read-only, so it is set via vi.stubEnv instead.
  vi.unstubAllEnvs();
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("resolveAuthBaseURL", () => {
  it("accepts a valid BETTER_AUTH_URL", () => {
    process.env.BETTER_AUTH_URL = "https://pitstopiq.vercel.app";
    expect(resolveAuthBaseURL()).toBe("https://pitstopiq.vercel.app");
  });

  it("ignores empty vercel-pull placeholders", () => {
    process.env.BETTER_AUTH_URL = "";
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAuthBaseURL()).toBe("https://pitstopiq.vercel.app");
  });

  it("ignores non-http URLs (e.g. postgres connection strings)", () => {
    process.env.BETTER_AUTH_URL =
      "postgresql://user:pass@host/db?sslmode=require";
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAuthBaseURL()).toBe("https://pitstopiq.vercel.app");
  });

  it("uses localhost outside production when unset", () => {
    delete process.env.BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveAuthBaseURL()).toBe("http://localhost:3000");
  });
});
