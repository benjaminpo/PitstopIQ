import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "app/lib/detourCalculator.ts",
        "app/lib/brandCategory.ts",
        "app/lib/routing.ts",
        "app/lib/tripUrl.ts",
        "app/lib/baselinePrice.ts",
        "app/lib/mapsLinks.ts",
        "app/lib/utils.ts",
        "app/lib/freshness.ts",
        "app/lib/adsense.ts",
        "app/lib/locationHistory.ts",
        "app/lib/fuelConstants.ts",
        "app/lib/fuelFinderCsv.ts",
        "app/lib/fuelPriceParse.ts",
        "app/lib/suppressedStations.ts",
        "app/lib/vehiclePresets.ts",
        "app/lib/vehicleLookup.ts",
        "app/lib/routeAvoid.ts",
        "app/lib/polyline6.ts",
        "app/lib/analytics.ts",
        "app/lib/brandLogo.ts",
        "app/lib/missingStationReports.ts",
        "app/lib/recentPlaces.ts",
        "app/lib/serverRouting.ts",
        "app/lib/stationAddress.ts",
        "app/lib/tripPath.ts",
        "app/lib/userName.ts",
      ],
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
