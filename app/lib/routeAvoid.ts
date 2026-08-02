/** Google Maps–style route constraints (motorways / tolls / ferries). */
export interface RouteAvoidOptions {
  motorways: boolean;
  tolls: boolean;
  ferries: boolean;
}

export const DEFAULT_ROUTE_AVOID: RouteAvoidOptions = {
  motorways: false,
  tolls: false,
  ferries: false,
};

export function normalizeRouteAvoid(
  raw: Partial<RouteAvoidOptions> | null | undefined
): RouteAvoidOptions {
  return {
    motorways: Boolean(raw?.motorways),
    tolls: Boolean(raw?.tolls),
    ferries: Boolean(raw?.ferries),
  };
}

export function hasRouteAvoid(avoid: RouteAvoidOptions): boolean {
  return avoid.motorways || avoid.tolls || avoid.ferries;
}

/** OSRM `exclude=` class names for enabled avoids. */
export function osrmExcludeClasses(avoid: RouteAvoidOptions): string[] {
  const classes: string[] = [];
  if (avoid.motorways) classes.push("motorway");
  if (avoid.tolls) classes.push("toll");
  if (avoid.ferries) classes.push("ferry");
  return classes;
}

/**
 * Compact share-URL token, e.g. `motorway,toll`.
 * Empty string when nothing is avoided.
 */
export function serializeRouteAvoid(avoid: RouteAvoidOptions): string {
  return osrmExcludeClasses(avoid).join(",");
}

/** Parse `avoid=motorway,toll,ferry` (order-insensitive, unknown tokens ignored). */
export function parseRouteAvoidParam(
  raw: string | null | undefined
): RouteAvoidOptions | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const tokens = new Set(
    raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
  const avoid = normalizeRouteAvoid({
    motorways: tokens.has("motorway") || tokens.has("motorways"),
    tolls: tokens.has("toll") || tokens.has("tolls"),
    ferries: tokens.has("ferry") || tokens.has("ferries"),
  });
  return hasRouteAvoid(avoid) ? avoid : DEFAULT_ROUTE_AVOID;
}

export function routeAvoidEqual(
  a: RouteAvoidOptions,
  b: RouteAvoidOptions
): boolean {
  return (
    a.motorways === b.motorways &&
    a.tolls === b.tolls &&
    a.ferries === b.ferries
  );
}
