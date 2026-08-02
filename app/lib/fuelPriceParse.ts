/**
 * Parse Fuel Finder / CMA price_last_updated strings to epoch ms.
 * Handles ISO 8601, legacy CMA "dd/MM/yyyy HH:mm:ss", and JS Date.toString forms.
 */
export function parsePriceLastUpdated(
  raw: string | null | undefined
): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const ukFormat =
    /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      trimmed
    );
  if (ukFormat) {
    const [, dd, mm, yyyy, hh, min, ss] = ukFormat;
    // Digit captures always yield a finite epoch (Date.UTC overflows invalid calendar days).
    return Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, ss ? +ss : 0);
  }

  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? t : undefined;
}

/** Convert API/CSV price (usually pence, sometimes £) to £/litre */
export function parsePriceToGbpPerLitre(
  raw: string | number | null | undefined
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Values under ~10 are almost certainly already in pounds
  if (n < 10) return Number(n.toFixed(3));
  return Number((n / 100).toFixed(3));
}
