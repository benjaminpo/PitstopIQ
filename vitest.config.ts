import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Coverage counts every module in app/lib (plus the metadata routes) by
 * default, so new files are measured without editing this list.
 * Keep in sync with sonar.coverage.* in sonar-project.properties.
 */
const coverageInclude = [
  "app/lib/**/*.ts",
  "app/manifest.ts",
  "app/robots.ts",
  "app/sitemap.ts",
];

const coverageExclude = [
  "**/*.test.ts",
  // Runtime wiring / types only: DB + auth handles, Zustand store, browser APIs,
  // server data loaders that just compose tested helpers.
  "app/lib/db.ts",
  "app/lib/auth.ts",
  "app/lib/auth-client.ts",
  "app/lib/store.ts",
  "app/lib/types.ts",
  "app/lib/priceWatchTypes.ts",
  "app/lib/fuelDatasetCache.ts",
  "app/lib/geolocation.ts",
  "app/lib/loadBrands.ts",
  "app/lib/loadLocations.ts",
  // Known test debt: network/DB-heavy modules whose pure parsers are tested
  // but whose I/O paths are not yet. Remove from this list once covered.
  "app/lib/fuelFinderClient.ts",
  "app/lib/priceWatches.ts",
  "app/lib/stationContributions.ts",
];

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: coverageInclude,
      exclude: coverageExclude,
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
