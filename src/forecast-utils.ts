import { clamp } from "./shared";
import type { ForecastEntry, WeatherCondition } from "./types";

export const MAX_FORECAST_DAYS = 5;
export const MAX_FORECAST_SUMMARY_LENGTH = 48;

const CONDITION_ALIASES: Record<string, WeatherCondition> = {
  clear: "clear",
  sunny: "clear",
  bright: "clear",
  cloudy: "cloudy",
  overcast: "cloudy",
  "partly cloudy": "cloudy",
  rain: "rain",
  rainy: "rain",
  drizzle: "rain",
  storm: "storm",
  stormy: "storm",
  thunderstorm: "storm",
  thunder: "storm",
  snow: "snow",
  snowy: "snow",
  flurries: "snow",
  fog: "fog",
  mist: "fog",
  hazy: "fog",
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isRealCalendarDate(value: string): boolean {
  const match = value.match(DATE_PATTERN);
  if (!match) return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function normalizeConditionToken(token: string): WeatherCondition | null {
  const normalized = token.trim().toLowerCase().replace(/\s+/g, " ");
  return CONDITION_ALIASES[normalized] ?? null;
}

/** Accepts `61F`, `16C`, `61 °F`, or `fahrenheit`/`celsius` suffixes. */
export function normalizeTemperatureToken(token: string): string {
  const match = token.trim().match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F|C)(?:ahrenheit|elsius)?$/i);
  if (!match) return "";
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return "";
  return `${Math.round(amount)}${match[2].toUpperCase() === "C" ? "C" : "F"}`;
}

export function truncateForecastSummary(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed.length <= MAX_FORECAST_SUMMARY_LENGTH) return collapsed;
  return `${collapsed.slice(0, MAX_FORECAST_SUMMARY_LENGTH - 1).trimEnd()}\u2026`;
}

/**
 * Splits a raw forecast attribute into entries. Pipes are the documented
 * separator, but semicolons and newlines are accepted so a model that formats
 * loosely still produces a usable projection.
 */
export function splitForecastEntries(raw: string): string[] {
  return raw
    .split(/[|\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Parses `YYYY-MM-DD: condition, temperature, summary`. The date is required and
 * must be a real calendar date; the remaining fields are optional, so
 * `2026-01-17` alone is a valid entry. Unparseable entries return null rather
 * than failing the whole tag.
 */
export function parseForecastEntry(raw: string): ForecastEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const separatorIndex = trimmed.indexOf(":");
  // A bare date is a valid entry: it asserts the day exists with no detail yet.
  if (separatorIndex === -1) {
    if (!isRealCalendarDate(trimmed)) return null;
    return { date: trimmed, condition: "clear", summary: defaultForecastSummary("clear"), temperature: "" };
  }

  const date = trimmed.slice(0, separatorIndex).trim();
  if (!isRealCalendarDate(date)) return null;

  let condition: WeatherCondition | null = null;
  let temperature = "";
  const summaryParts: string[] = [];

  for (const part of trimmed.slice(separatorIndex + 1).split(",")) {
    const token = part.trim();
    if (!token) continue;

    // The summary starts at the first field that is neither a condition nor a
    // temperature, and every later field belongs to it.
    if (summaryParts.length > 0) {
      summaryParts.push(token);
      continue;
    }

    const candidateCondition = normalizeConditionToken(token);
    if (candidateCondition !== null && condition === null) {
      condition = candidateCondition;
      continue;
    }

    const candidateTemperature = normalizeTemperatureToken(token);
    if (candidateTemperature && !temperature) {
      temperature = candidateTemperature;
      continue;
    }

    summaryParts.push(token);
  }

  return {
    date,
    condition: condition ?? "clear",
    summary: truncateForecastSummary(summaryParts.join(", ")) || defaultForecastSummary(condition ?? "clear"),
    temperature,
  };
}

export function defaultForecastSummary(condition: WeatherCondition): string {
  switch (condition) {
    case "rain":
      return "Rain expected";
    case "storm":
      return "Storms expected";
    case "snow":
      return "Snow expected";
    case "fog":
      return "Low visibility";
    case "cloudy":
      return "Overcast";
    default:
      return "Clear skies";
  }
}

/**
 * Normalizes a forecast from a raw tag attribute string, an array of entry
 * objects, or a partial entry object. Later duplicates for the same date win,
 * entries are sorted by date, and the projection is capped at `MAX_FORECAST_DAYS`.
 */
export function normalizeForecast(input: unknown, maxDays = MAX_FORECAST_DAYS): ForecastEntry[] {
  const rawEntries: string[] = [];

  if (typeof input === "string") {
    rawEntries.push(...splitForecastEntries(input));
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") rawEntries.push(...splitForecastEntries(item));
      else if (item && typeof item === "object") rawEntries.push(serializeForecastObject(item as Record<string, unknown>));
    }
  } else if (input && typeof input === "object") {
    rawEntries.push(serializeForecastObject(input as Record<string, unknown>));
  }

  const byDate = new Map<string, ForecastEntry>();
  for (const raw of rawEntries) {
    const entry = parseForecastEntry(raw);
    if (entry) byDate.set(entry.date, entry);
  }

  const limit = Math.max(0, Math.round(clamp(maxDays, 0, MAX_FORECAST_DAYS)));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(0, limit);
}

function serializeForecastObject(candidate: Record<string, unknown>): string {
  const read = (key: string): string => (typeof candidate[key] === "string" ? (candidate[key] as string).trim() : "");
  const date = read("date");
  if (!date) return "";
  // The summary must stay last: the parser treats the first field that is neither
  // a condition nor a temperature as the start of the free-text summary.
  const details = [read("condition"), read("temperature"), read("summary")].filter(Boolean).join(", ");
  return details ? `${date}: ${details}` : date;
}

/** Renders one entry in the canonical `date: condition, temperature, summary` form. */
export function formatForecastEntry(entry: ForecastEntry): string {
  const details = [entry.condition, entry.temperature, entry.summary].filter(Boolean).join(", ");
  return details ? `${entry.date}: ${details}` : entry.date;
}

/** Renders a projection back into the documented tag attribute form. */
export function serializeForecast(entries: ForecastEntry[]): string {
  return entries.map(formatForecastEntry).join(" | ");
}
