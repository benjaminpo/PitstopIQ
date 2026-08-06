/** Build a single display address from Fuel Finder location fields. */
export function formatStationAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
}): string | null {
  const line1 = parts.addressLine1?.trim() || "";
  const line2 = parts.addressLine2?.trim() || "";
  const city = parts.city?.trim() || "";
  const joined = [line1, line2, city].filter(Boolean);
  return joined.length > 0 ? joined.join(", ") : null;
}
