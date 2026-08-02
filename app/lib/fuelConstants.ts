import type { MapBounds } from "./types";

/** Default map bounds around west London / M4 corridor */
export const DEFAULT_BOUNDS: MapBounds = {
  north: 51.55,
  south: 51.4,
  east: -0.35,
  west: -0.75,
};

/** Sensible default base-route average (£/L) before live prices load */
export const DEFAULT_BASE_ROUTE_AVG_PRICE = 1.55;
