import type { WeatherPalette } from "./types";

export type SolarPhase = "night" | "dawn" | "day" | "dusk";
export type WeatherSeasonName = "spring" | "summer" | "autumn" | "winter";

/**
 * Palettes that already encode a time-of-day phase. When a scene uses one of
 * these, the palette wins over any hour-derived phase so an explicit tag choice
 * is never overridden by arithmetic.
 */
export const TIME_PHASE_PALETTES = ["dawn", "day", "dusk", "night"] as const;

/** Mid-latitude default used when a scene date carries no latitude. */
export const DEFAULT_LATITUDE = 45;

const DAY_MS = 86_400_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatTime(date: Date): string {
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${pad2(date.getMinutes())} ${suffix}`;
}

export function parseHourFromTimeString(timeValue: string): number | null {
  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*:\s*(\d{2}))?\s*([AP]M)$/i);
  if (time12) {
    let hours = Number.parseInt(time12[1], 10);
    if (hours < 1 || hours > 12) return null;
    const minutes = Number.parseInt(time12[2], 10);
    const seconds = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (minutes > 59 || seconds > 59) return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours;
  }

  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!time24) return null;
  const hours = Number.parseInt(time24[1], 10);
  const minutes = Number.parseInt(time24[2], 10);
  const seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours;
}

export function parseStoryDateTime(dateValue: string, timeValue: string): number | null {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (time12) {
    hours = Number.parseInt(time12[1], 10);
    minutes = Number.parseInt(time12[2], 10);
    seconds = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59) return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (time24) {
    hours = Number.parseInt(time24[1], 10);
    minutes = Number.parseInt(time24[2], 10);
    seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
  } else {
    return null;
  }

  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes ||
    parsed.getSeconds() !== seconds
  ) {
    return null;
  }
  return parsed.getTime();
}

export function isTimePhasePalette(palette: WeatherPalette): boolean {
  return (TIME_PHASE_PALETTES as readonly string[]).includes(palette);
}

/** Day of year in the range 1-366, or null when the timestamp is not a real date. */
export function resolveDayOfYear(timestamp: number): number | null {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  if (!Number.isFinite(year)) return null;
  const startOfYear = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, date.getMonth(), date.getDate());
  const day = Math.round((current - startOfYear) / DAY_MS) + 1;
  return Number.isFinite(day) ? day : null;
}

/**
 * Solar declination in degrees. A standard low-order approximation that is
 * accurate to well under a degree across a calendar year, which is far tighter
 * than this scene model needs.
 */
export function resolveSolarDeclination(dayOfYear: number): number {
  const clamped = Math.min(Math.max(dayOfYear, 1), 366);
  return 23.44 * Math.sin(toRadians((360 / 365) * (clamped - 81)));
}

/**
 * Sunrise/sunset half-angle in degrees: the standard hour-angle solution.
 * Returns null for polar day/night, where the sun never crosses the horizon;
 * `resolvePolarState` distinguishes those two cases.
 */
export function resolveDayHalfAngle(latitude: number, declination: number): number | null {
  const cosHourAngle = -Math.tan(toRadians(latitude)) * Math.tan(toRadians(declination));
  if (!Number.isFinite(cosHourAngle) || cosHourAngle >= 1 || cosHourAngle <= -1) return null;
  return toDegrees(Math.acos(cosHourAngle));
}

export type PolarState = "day" | "night" | null;

/**
 * Distinguishes polar day (`cosHourAngle <= -1`: the sun stays up) from polar
 * night (`cosHourAngle >= 1`: the sun never rises). Returns null outside the
 * polar cases, where the regular hour-angle bands apply.
 */
export function resolvePolarState(latitude: number, declination: number): PolarState {
  const cosHourAngle = -Math.tan(toRadians(latitude)) * Math.tan(toRadians(declination));
  if (!Number.isFinite(cosHourAngle)) return null;
  if (cosHourAngle <= -1) return "day";
  if (cosHourAngle >= 1) return "night";
  return null;
}

export function resolveSeasonFromDayOfYear(dayOfYear: number): WeatherSeasonName {
  if (dayOfYear < 80 || dayOfYear >= 355) return "winter";
  if (dayOfYear < 172) return "spring";
  if (dayOfYear < 266) return "summer";
  return "autumn";
}

export interface SolarArc {
  phase: SolarPhase;
  /** Approximate sun altitude in degrees; negative below the horizon. */
  sunAltitude: number;
  season: WeatherSeasonName;
}

/**
 * Resolves the solar phase for a story date and time.
 *
 * `dateValue`/`timeValue` are the story strings from a weather tag, so this
 * shares `parseStoryDateTime` validation with the rest of normalization. The
 * `day` phase is returned when the pair cannot be parsed, matching the fallback
 * that `derivePalette` already used.
 */
export function resolveSolarArc(
  dateValue: string,
  timeValue: string,
  latitude = DEFAULT_LATITUDE,
): SolarArc {
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp === null) {
    return { phase: "day", sunAltitude: 0, season: "spring" };
  }

  const when = new Date(timestamp);
  const dayOfYear = resolveDayOfYear(timestamp) ?? 1;
  const declination = resolveSolarDeclination(dayOfYear);
  const polar = resolvePolarState(latitude, declination);
  const halfAngle = resolveDayHalfAngle(latitude, declination);

  const hourFraction = (when.getHours() + when.getMinutes() / 60 + when.getSeconds() / 3600) / 24;
  const sunAltitude = 90 * Math.cos(2 * Math.PI * (hourFraction - 0.5));
  const season = resolveSeasonFromDayOfYear(dayOfYear);

  // Polar day and polar night collapse to a single unambiguous phase.
  if (polar === "day" || polar === "night") {
    return { phase: polar, sunAltitude, season };
  }

  // Fraction of the day from solar noon to sunrise/sunset. The hour angle is in
  // degrees, so 15 degrees equals one hour; dividing by 360 yields a day fraction.
  const halfDayFraction = (halfAngle ?? 0) / 360;
  // Twilight tracks the seasonal swing in day length (broad near the solstices,
  // narrow near the equinoxes). Around half an hour at mid-latitude, which reads
  // as dawn/dusk without swallowing the daylight phase.
  const twilight = Math.min(0.02 + halfDayFraction * 0.16, 0.06);

  const dawnStart = 0.5 - halfDayFraction - twilight;
  const sunriseEnd = 0.5 - halfDayFraction + twilight;
  const sunsetStart = 0.5 + halfDayFraction - twilight;
  const duskEnd = 0.5 + halfDayFraction + twilight;

  let phase: SolarPhase;
  if (hourFraction < dawnStart || hourFraction >= duskEnd) phase = "night";
  else if (hourFraction < sunriseEnd) phase = "dawn";
  else if (hourFraction < sunsetStart) phase = "day";
  else phase = "dusk";

  return { phase, sunAltitude, season };
}

/**
 * Coarse 24-hour phase used only when a scene has no usable calendar date. Kept
 * deliberately separate from `resolveSolarArc` so the midnight-boundary behavior
 * that existing tags rely on cannot drift.
 */
export function phaseFromHour(hour: number | null): SolarPhase {
  if (hour === null) return "day";
  if (hour < 6) return "night";
  if (hour < 10) return "dawn";
  if (hour < 18) return "day";
  if (hour < 21) return "dusk";
  return "night";
}

/**
 * Single source of truth for the HUD's time phase. An explicit phase palette
 * always wins; otherwise the hour falls back to the coarse table.
 */
export function resolveHudTimePhase(palette: WeatherPalette, hour: number | null): SolarPhase {
  if (isTimePhasePalette(palette)) return palette as SolarPhase;
  return phaseFromHour(hour);
}

export function hourFromStoryTime(timeValue: string): number | null {
  return parseHourFromTimeString(timeValue);
}

/** Maps a coarse phase onto its phase palette. */
export function phaseToPalette(phase: SolarPhase): WeatherPalette {
  return phase;
}

/**
 * Derives a palette when the tag does not name one. Conditions with a dedicated
 * palette win; otherwise the hour resolves through `phaseFromHour`, so the
 * palette and the HUD's phase label share exactly one set of boundaries.
 */
export function derivePalette(condition: string, dateValue: string, timeValue: string): WeatherPalette {
  if (condition === "storm") return "storm";
  if (condition === "fog") return "mist";
  if (condition === "snow") return "snow";

  const hour = parseHourFromTimeString(timeValue);
  if (parseStoryDateTime(dateValue, timeValue) === null && hour === null) {
    return condition === "cloudy" || condition === "rain" ? "dusk" : "day";
  }
  return phaseToPalette(phaseFromHour(hour));
}

/** Season for a story date, or null when the pair is not a real calendar value. */
export function seasonFromStoryDate(dateValue: string, timeValue: string): WeatherSeasonName | null {
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp === null) return null;
  const dayOfYear = resolveDayOfYear(timestamp);
  return dayOfYear === null ? null : resolveSeasonFromDayOfYear(dayOfYear);
}
