import { clamp } from "./shared";
import { parseStoryDateTime } from "./time-utils";
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

export function isRealCalendarDate(value: string): boolean {
  return value === value.trim() && parseStoryDateTime(value, "00:00") !== null;
}

export function normalizeConditionToken(token: string): WeatherCondition | null {
  const normalized = token.trim().toLowerCase().replace(/\s+/g, " ");
  return CONDITION_ALIASES[normalized] ?? null;
}

/** Accepts `61F`, `16C`, `61 °F`, or `fahrenheit`/`celsius` suffixes. */
export function normalizeTemperatureToken(token: string): string {
  const match = token.trim().match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F(?:ahrenheit)?|C(?:elsius)?)$/i);
  if (!match) return "";
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return "";
  return `${Math.round(amount)}${match[2][0].toUpperCase() === "C" ? "C" : "F"}`;
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
    return { date: trimmed, condition: "clear", summary: "", temperature: "" };
  }

  const date = trimmed.slice(0, separatorIndex).trim();
  if (!isRealCalendarDate(date)) return null;

  let condition: WeatherCondition | null = null;
  let temperature = "";
  let temperatureOmitted = false;
  const summaryParts: string[] = [];

  for (const part of trimmed.slice(separatorIndex + 1).split(",")) {
    const token = part.trim();
    if (!token) {
      // Canonical serialization can leave an empty temperature slot to keep a
      // temperature-shaped summary (e.g. "30F") from becoming metadata.
      if (condition !== null) temperatureOmitted = true;
      continue;
    }

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
    if (candidateTemperature && !temperature && !temperatureOmitted) {
      temperature = candidateTemperature;
      continue;
    }

    summaryParts.push(token);
  }

  return {
    date,
    condition: condition ?? "clear",
    // Left empty when the input carries no summary. Filling in a default here
    // would store prose the source never wrote, and would make the serialized
    // form grow every time it was parsed and written back.
    summary: truncateForecastSummary(summaryParts.join(", ")),
    temperature,
  };
}

/**
 * Presentation-only fallback used where an entry is shown without a summary.
 * This is deliberately not applied during parsing so the stored model stays
 * faithful to the input.
 */
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
  const entries: ForecastEntry[] = [];
  const addInput = (candidate: unknown): void => {
    if (typeof candidate === "string") {
      for (const raw of splitForecastEntries(candidate)) {
        const entry = parseForecastEntry(raw);
        if (entry) entries.push(entry);
      }
    } else if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const entry = normalizeForecastObject(candidate as Record<string, unknown>);
      if (entry) entries.push(entry);
    }
  };

  if (Array.isArray(input)) input.forEach(addInput);
  else addInput(input);

  const byDate = new Map<string, ForecastEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);

  const limit = Math.max(0, Math.round(clamp(maxDays, 0, MAX_FORECAST_DAYS)));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(0, limit);
}

function normalizeForecastObject(candidate: Record<string, unknown>): ForecastEntry | null {
  const read = (key: string): string => (typeof candidate[key] === "string" ? (candidate[key] as string).trim() : "");
  const date = read("date");
  if (!isRealCalendarDate(date)) return null;
  // Object fields already carry their roles. Re-parsing their prose as tag
  // fields would turn a summary such as "rain" or "30F" into metadata on reload.
  return {
    date,
    condition: normalizeConditionToken(read("condition")) ?? "clear",
    temperature: normalizeTemperatureToken(read("temperature")),
    summary: truncateForecastSummary(read("summary")),
  };
}

/**
 * Renders one entry in the canonical `date: condition, temperature, summary`
 * form. Faithful to the stored model, so parse and serialize round-trip exactly.
 */
export function formatForecastEntry(entry: ForecastEntry): string {
  const keepEmptyTemperature = !entry.temperature && !!normalizeTemperatureToken(entry.summary.split(",")[0]);
  const details = keepEmptyTemperature
    ? `${entry.condition}, , ${entry.summary}`
    : [entry.condition, entry.temperature, entry.summary].filter(Boolean).join(", ");
  return details ? `${entry.date}: ${details}` : entry.date;
}

/**
 * Presentation form for surfaces that show an entry to a reader. Falls back to a
 * condition-derived summary so a sparse entry still reads as a sentence.
 */
export function describeForecastEntry(entry: ForecastEntry): string {
  const summary = entry.summary || defaultForecastSummary(entry.condition);
  const details = [entry.condition, entry.temperature, summary].filter(Boolean).join(", ");
  return details ? `${entry.date}: ${details}` : entry.date;
}

/** Renders a projection back into the documented tag attribute form. */
export function serializeForecast(entries: ForecastEntry[]): string {
  return entries.map(formatForecastEntry).join(" | ");
}
