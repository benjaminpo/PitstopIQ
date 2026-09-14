import type {
  FuelStation,
  FuelType,
  StationCommunitySummary,
} from "@/app/lib/types";

export interface ResolvedStationPrice {
  price: number | undefined;
  fromCommunity: boolean;
  updatedAt: number | null;
}

type OfficialStation = Pick<
  FuelStation,
  "prices" | "pricesUpdatedAt" | "pricesLastUpdatedAt"
>;

type CommunityPrices = Pick<
  StationCommunitySummary,
  "communityPrices" | "communityPriceUpdatedAt"
>;

function finitePrice(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

/** Per-grade Fuel Finder timestamp, falling back to the station's latest. */
export function officialFuelUpdatedAt(
  station: Pick<FuelStation, "pricesUpdatedAt" | "pricesLastUpdatedAt">,
  fuel: FuelType
): number | null {
  return station.pricesUpdatedAt?.[fuel] ?? station.pricesLastUpdatedAt ?? null;
}

function isOfficialNewer(
  officialUpdatedAt: number | null,
  communityUpdatedAt: number | null
): boolean {
  if (officialUpdatedAt == null) return false;
  if (communityUpdatedAt == null) return true;
  return officialUpdatedAt > communityUpdatedAt;
}

/**
 * Pick the displayed / scored pump price for one fuel grade.
 * Member reports win when they are at least as fresh as Fuel Finder;
 * the government API wins when it is strictly more recently updated.
 */
export function resolveStationFuelPrice(
  station: OfficialStation,
  community: CommunityPrices | null | undefined,
  fuel: FuelType
): ResolvedStationPrice {
  const officialPrice = finitePrice(station.prices[fuel]);
  const officialUpdatedAt = officialFuelUpdatedAt(station, fuel);
  const communityPrice = finitePrice(community?.communityPrices[fuel]);
  const communityUpdatedAt =
    community?.communityPriceUpdatedAt[fuel] ?? null;

  if (
    communityPrice != null &&
    officialPrice != null &&
    isOfficialNewer(officialUpdatedAt, communityUpdatedAt)
  ) {
    return {
      price: officialPrice,
      fromCommunity: false,
      updatedAt: officialUpdatedAt,
    };
  }

  if (communityPrice != null) {
    return {
      price: communityPrice,
      fromCommunity: true,
      updatedAt: communityUpdatedAt,
    };
  }

  return {
    price: officialPrice,
    fromCommunity: false,
    updatedAt: officialUpdatedAt,
  };
}
