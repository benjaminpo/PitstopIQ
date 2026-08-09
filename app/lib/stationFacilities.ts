import { haversineMiles } from "@/app/lib/routing";
import type {
  FuelStation,
  GeoPoint,
  StationDayHours,
  StationOpeningHours,
  StationWithCalculation,
  Weekday,
} from "@/app/lib/types";

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** Human labels for Fuel Finder amenity identifiers. */
export const AMENITY_LABELS: Record<string, string> = {
  adblue_packaged: "AdBlue (packaged)",
  adblue_pumps: "AdBlue pumps",
  car_wash: "Car wash",
  customer_toilets: "Toilets",
  water_filling: "Water",
};

export function formatAmenityLabel(id: string): string {
  const known = AMENITY_LABELS[id];
  if (known) return known;
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeClock(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDayHours(
  raw: unknown,
  openKey: "open" | "open_time",
  closeKey: "close" | "close_time"
): StationDayHours | null {
  const record = asRecord(raw);
  if (!record) return null;
  const is24Hours = Boolean(record.is_24_hours);
  const open = normalizeClock(record[openKey]);
  const close = normalizeClock(record[closeKey]);
  if (is24Hours) {
    return { open: open ?? "00:00", close: close ?? "00:00", is24Hours: true };
  }
  if (!open || !close) return null;
  return { open, close, is24Hours: false };
}

/** Parse Fuel Finder `amenities` arrays into stable unique ids. */
export function parseAmenities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const amenities: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    amenities.push(id);
  }
  return amenities;
}

/** Parse Fuel Finder `opening_times` into app opening hours. */
export function parseOpeningTimes(raw: unknown): StationOpeningHours | null {
  const root = asRecord(raw);
  if (!root) return null;

  const usualRaw = asRecord(root.usual_days) ?? {};
  const usualDays: Partial<Record<Weekday, StationDayHours>> = {};
  for (const day of WEEKDAYS) {
    const hours = parseDayHours(usualRaw[day], "open", "close");
    if (hours) usualDays[day] = hours;
  }

  const bankHoliday = parseDayHours(root.bank_holiday, "open_time", "close_time");
  if (Object.keys(usualDays).length === 0 && !bankHoliday) return null;

  return {
    usualDays,
    bankHoliday: bankHoliday ?? null,
  };
}

function dayHoursKey(hours: StationDayHours): string {
  if (hours.is24Hours) return "24h";
  return `${hours.open}-${hours.close}`;
}

function formatDayHoursValue(hours: StationDayHours): string {
  if (hours.is24Hours) return "Open 24 hours";
  if (hours.open === hours.close) return "Closed";
  return `${hours.open}–${hours.close}`;
}

export interface OpeningHoursRow {
  label: string;
  value: string;
}

function clockToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Whether a single day's hours cover `minutesOfDay` (0–1439). */
export function isDayHoursOpenAt(
  hours: StationDayHours,
  minutesOfDay: number
): boolean {
  if (hours.is24Hours) return true;
  if (hours.open === hours.close) return false;

  const open = clockToMinutes(hours.open);
  const close = clockToMinutes(hours.close);
  if (close > open) {
    return minutesOfDay >= open && minutesOfDay < close;
  }
  // Overnight window (e.g. 22:00–06:00)
  return minutesOfDay >= open || minutesOfDay < close;
}

function weekdayInTimeZone(date: Date, timeZone: string): Weekday {
  const label = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone,
  })
    .format(date)
    .toLowerCase();
  return label as Weekday;
}

function minutesOfDayInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? Number.NaN);
  const minute = Number(
    parts.find((p) => p.type === "minute")?.value ?? Number.NaN
  );
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

/**
 * True when the station's usual-day hours say it is open at `now`.
 * Stations without usable hours for today are treated as not open.
 * Bank holidays are not detected — usual weekday hours are used.
 */
export function isStationOpenNow(
  station: Pick<FuelStation, "openingHours">,
  now: Date = new Date(),
  timeZone = "Europe/London"
): boolean {
  const openingHours = station.openingHours;
  if (!openingHours) return false;
  const dayHours = openingHours.usualDays[weekdayInTimeZone(now, timeZone)];
  if (!dayHours) return false;
  return isDayHoursOpenAt(dayHours, minutesOfDayInTimeZone(now, timeZone));
}

/** Collapse consecutive identical weekday hours into compact rows. */
export function formatOpeningHoursRows(
  hours: StationOpeningHours
): OpeningHoursRow[] {
  const rows: OpeningHoursRow[] = [];
  let start: Weekday | null = null;
  let end: Weekday | null = null;
  let currentKey: string | null = null;
  let currentHours: StationDayHours | null = null;

  const flush = () => {
    if (!start || !end || !currentHours) return;
    const label =
      start === end
        ? WEEKDAY_SHORT[start]
        : `${WEEKDAY_SHORT[start]}–${WEEKDAY_SHORT[end]}`;
    rows.push({ label, value: formatDayHoursValue(currentHours) });
    start = null;
    end = null;
    currentKey = null;
    currentHours = null;
  };

  for (const day of WEEKDAYS) {
    const dayHours = hours.usualDays[day];
    if (!dayHours) {
      flush();
      continue;
    }
    const key = dayHoursKey(dayHours);
    if (currentKey === key && start && end) {
      end = day;
      continue;
    }
    flush();
    start = day;
    end = day;
    currentKey = key;
    currentHours = dayHours;
  }
  flush();

  if (hours.bankHoliday) {
    rows.push({
      label: "Bank hol",
      value: formatDayHoursValue(hours.bankHoliday),
    });
  }

  return rows;
}

export interface NearbyStationResult {
  item: StationWithCalculation;
  miles: number;
}

/** Other corridor stations near a selected forecourt, closest first. */
export function findNearbyStations(
  origin: GeoPoint,
  stations: StationWithCalculation[],
  options: { excludeId?: string; maxMiles?: number; limit?: number } = {}
): NearbyStationResult[] {
  const { excludeId, maxMiles = 3, limit = 4 } = options;
  return stations
    .flatMap((item) => {
      if (item.station.id === excludeId) return [];
      const miles = haversineMiles(origin, item.station.location);
      if (miles > maxMiles) return [];
      return [{ item, miles: Number(miles.toFixed(2)) }];
    })
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}

export function stationHasFacilitiesMeta(station: FuelStation): boolean {
  return Boolean(
    (station.amenities && station.amenities.length > 0) || station.openingHours
  );
}
