import type {
  DetourCalculationInput,
  DetourCalculationResult,
  DetourStatus,
} from "./types";

/** UK imperial gallon → litres (exact conversion factor) */
export const UK_GALLON_TO_LITRES = 4.54609;

/** Break-even band around £0.00 (± £0.50) */
export const NEUTRAL_THRESHOLD_GBP = 0.5;

/**
 * Litres burned per mile for a given UK MPG.
 * litresPerMile = 4.54609 / MPG
 */
export function litresPerMile(mpg: number): number {
  if (mpg <= 0) {
    throw new Error("MPG must be greater than zero");
  }
  return UK_GALLON_TO_LITRES / mpg;
}

/**
 * Resolve how many litres the driver intends to put in the tank.
 */
export function resolveLitresToRefill(
  tankCapacityLitres: number,
  fillPercentage: number,
  explicitLitres?: number
): number {
  if (explicitLitres !== undefined && explicitLitres >= 0) {
    return explicitLitres;
  }
  const emptyFraction = Math.max(0, Math.min(100, 100 - fillPercentage)) / 100;
  return tankCapacityLitres * emptyFraction;
}

function classifyNetSaving(net: number): DetourStatus {
  if (net > NEUTRAL_THRESHOLD_GBP) return "worth";
  if (net < -NEUTRAL_THRESHOLD_GBP) return "false_economy";
  return "neutral";
}

/**
 * Pure mathematical engine for detour net financial savings.
 *
 * Detour Fuel Consumed (L) = Extra Miles × (4.54609 / MPG)
 * Detour Fuel Cost (£)     = Detour Litres × Station Price/L
 * Gross Savings (£)        = (Base Avg Price − Station Price) × Litres to Refill
 * Net Financial Saving (£) = Gross Savings − Detour Fuel Cost
 */
export function calculateDetourSavings(
  input: DetourCalculationInput
): DetourCalculationResult {
  const { vehicle, stationPricePerLitre, baseRouteAvgPricePerLitre, distanceOffRouteMiles } =
    input;

  const lpm = litresPerMile(vehicle.mpg);
  const detourLitresConsumed = distanceOffRouteMiles * lpm;
  const detourFuelCost = detourLitresConsumed * stationPricePerLitre;

  const litresToRefill = resolveLitresToRefill(
    vehicle.tankCapacityLitres,
    vehicle.fillPercentage,
    input.litresToRefill
  );

  const priceDelta = baseRouteAvgPricePerLitre - stationPricePerLitre;
  const grossSavings = priceDelta * litresToRefill;
  const netFinancialSaving = grossSavings - detourFuelCost;

  return {
    litresPerMile: lpm,
    detourLitresConsumed,
    detourFuelCost,
    litresToRefill,
    grossSavings,
    netFinancialSaving,
    status: classifyNetSaving(netFinancialSaving),
  };
}

/** Format GBP for UI badges and cards */
export function formatGbp(amount: number, digits = 2): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${sign}£${Math.abs(amount).toFixed(digits)}`;
}
