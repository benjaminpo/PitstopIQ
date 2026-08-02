import type {
  DetourCalculationInput,
  DetourCalculationResult,
  DetourStatus,
} from "./types";

/** UK imperial gallon → litres (exact conversion factor) */
export const UK_GALLON_TO_LITRES = 4.54609;

/** Break-even band around £0.00 (± £0.50) */
export const NEUTRAL_THRESHOLD_GBP = 0.5;

/** Default opportunity cost of driving time (£/hour) */
export const DEFAULT_VALUE_OF_TIME_GBP_PER_HOUR = 12;

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
 * Litres still in the tank from current fill %.
 */
export function remainingFuelLitres(vehicle: {
  tankCapacityLitres: number;
  fillPercentage: number;
}): number {
  const fill =
    Math.max(0, Math.min(100, vehicle.fillPercentage)) / 100;
  return Math.max(0, vehicle.tankCapacityLitres * fill);
}

/**
 * Fraction of remaining fuel held back so you don’t plan to arrive on fumes.
 */
export const RANGE_RESERVE_FRACTION = 0.05;

/**
 * Usable driving range (miles) from current fill %, MPG, and a small reserve.
 */
export function remainingRangeMiles(
  vehicle: {
    mpg: number;
    tankCapacityLitres: number;
    fillPercentage: number;
  },
  reserveFraction = RANGE_RESERVE_FRACTION
): number {
  const usableLitres =
    remainingFuelLitres(vehicle) * (1 - Math.max(0, Math.min(0.5, reserveFraction)));
  if (usableLitres <= 0) return 0;
  return usableLitres / litresPerMile(vehicle.mpg);
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
 * Pure mathematical engine for detour net savings (fuel + optional time cost).
 *
 * Detour Fuel Consumed (L) = Extra Miles × (4.54609 / MPG)
 * Detour Fuel Cost (£)     = Detour Litres × Station Price/L
 * Gross Savings (£)        = (Base Avg Price − Station Price) × Litres to Refill
 * Net Financial Saving (£) = Gross Savings − Detour Fuel Cost
 * Time Cost (£)            = (Extra Minutes / 60) × Value of Time (£/h)
 * Net After Time (£)       = Net Financial Saving − Time Cost
 *
 * Status / ranking use Net After Time.
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

  const detourExtraMinutes = Math.max(0, input.detourExtraMinutes ?? 0);
  const valueOfTime = Math.max(0, input.valueOfTimeGbpPerHour ?? 0);
  const timeCostGbp = (detourExtraMinutes / 60) * valueOfTime;
  const netAfterTime = netFinancialSaving - timeCostGbp;

  return {
    litresPerMile: lpm,
    detourLitresConsumed,
    detourFuelCost,
    litresToRefill,
    grossSavings,
    netFinancialSaving,
    detourExtraMinutes,
    timeCostGbp,
    netAfterTime,
    status: classifyNetSaving(netAfterTime),
  };
}

/** Format GBP for UI badges and cards */
export function formatGbp(amount: number, digits = 2): string {
  let sign = "";
  if (amount > 0) sign = "+";
  else if (amount < 0) sign = "−";
  return `${sign}£${Math.abs(amount).toFixed(digits)}`;
}
