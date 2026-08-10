/**
 * UK postcode outward area letters → common place name.
 * Covers mainland GB + NI areas used by Fuel Finder forecourts.
 */
export const POSTCODE_AREA_NAMES: Record<string, string> = {
  AB: "Aberdeen",
  AL: "St Albans",
  B: "Birmingham",
  BA: "Bath",
  BB: "Blackburn",
  BD: "Bradford",
  BH: "Bournemouth",
  BL: "Bolton",
  BN: "Brighton",
  BR: "Bromley",
  BS: "Bristol",
  BT: "Belfast",
  CA: "Carlisle",
  CB: "Cambridge",
  CF: "Cardiff",
  CH: "Chester",
  CM: "Chelmsford",
  CO: "Colchester",
  CR: "Croydon",
  CT: "Canterbury",
  CV: "Coventry",
  CW: "Crewe",
  DA: "Dartford",
  DD: "Dundee",
  DE: "Derby",
  DG: "Dumfries",
  DH: "Durham",
  DL: "Darlington",
  DN: "Doncaster",
  DT: "Dorchester",
  DY: "Dudley",
  E: "East London",
  EC: "East Central London",
  EH: "Edinburgh",
  EN: "Enfield",
  EX: "Exeter",
  FK: "Falkirk",
  FY: "Blackpool",
  G: "Glasgow",
  GL: "Gloucester",
  GU: "Guildford",
  HA: "Harrow",
  HD: "Huddersfield",
  HG: "Harrogate",
  HP: "Hemel Hempstead",
  HR: "Hereford",
  HS: "Outer Hebrides",
  HU: "Hull",
  HX: "Halifax",
  IG: "Ilford",
  IP: "Ipswich",
  IV: "Inverness",
  KA: "Kilmarnock",
  KT: "Kingston upon Thames",
  KW: "Kirkwall",
  KY: "Kirkcaldy",
  L: "Liverpool",
  LA: "Lancaster",
  LD: "Llandrindod Wells",
  LE: "Leicester",
  LL: "Llandudno",
  LN: "Lincoln",
  LS: "Leeds",
  LU: "Luton",
  M: "Manchester",
  ME: "Medway",
  MK: "Milton Keynes",
  ML: "Motherwell",
  N: "North London",
  NE: "Newcastle upon Tyne",
  NG: "Nottingham",
  NN: "Northampton",
  NP: "Newport",
  NR: "Norwich",
  NW: "North West London",
  OL: "Oldham",
  OX: "Oxford",
  PA: "Paisley",
  PE: "Peterborough",
  PH: "Perth",
  PL: "Plymouth",
  PO: "Portsmouth",
  PR: "Preston",
  RG: "Reading",
  RH: "Redhill",
  RM: "Romford",
  S: "Sheffield",
  SA: "Swansea",
  SE: "South East London",
  SG: "Stevenage",
  SK: "Stockport",
  SL: "Slough",
  SM: "Sutton",
  SN: "Swindon",
  SO: "Southampton",
  SP: "Salisbury",
  SR: "Sunderland",
  SS: "Southend-on-Sea",
  ST: "Stoke-on-Trent",
  SW: "South West London",
  SY: "Shrewsbury",
  TA: "Taunton",
  TD: "Galashiels",
  TF: "Telford",
  TN: "Tonbridge",
  TQ: "Torquay",
  TR: "Truro",
  TS: "Cleveland",
  TW: "Twickenham",
  UB: "Southall",
  W: "West London",
  WA: "Warrington",
  WC: "West Central London",
  WD: "Watford",
  WF: "Wakefield",
  WN: "Wigan",
  WR: "Worcester",
  WS: "Walsall",
  WV: "Wolverhampton",
  YO: "York",
  ZE: "Lerwick",
};

/** Normalise a UK postcode to uppercase alphanumerics only. */
export function normalizePostcode(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * Outward code (district), e.g. "SM2" from "SM2 6SX".
 * Returns null when the postcode is missing or malformed.
 */
export function postcodeOutcode(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) {
    const outward = trimmed.split(/\s+/)[0] ?? "";
    return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) ? outward : null;
  }
  const compact = trimmed.replace(/[^A-Z0-9]/g, "");
  // UK inward code is always the last 3 characters.
  if (compact.length < 5) return null;
  const outward = compact.slice(0, -3);
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) ? outward : null;
}

/**
 * Postcode area letters, e.g. "SM" from "SM2 6SX".
 */
export function postcodeArea(raw: string | null | undefined): string | null {
  const compact = normalizePostcode(raw);
  const match = /^([A-Z]{1,2})\d/.exec(compact);
  return match?.[1] ?? null;
}

export function postcodeAreaLabel(area: string): string {
  const key = area.trim().toUpperCase();
  return POSTCODE_AREA_NAMES[key] ?? key;
}

/** URL segment for an area page (`sm`, `ec`, `bt`). */
export function postcodeAreaKey(area: string): string {
  return area.trim().toLowerCase();
}

export function locationAreaHref(area: string): string {
  return `/locations/${postcodeAreaKey(area)}`;
}
