import {
  derivePalette,
  formatDate,
  formatTime,
  parseHourFromTimeString,
  parseStoryDateTime,
  seasonFromStoryDate,
} from "./time-utils";
import { normalizeForecast } from "./forecast-utils";
import type {
  ReducedMotionMode,
  TemperatureUnit,
  WeatherClockMode,
  WeatherCondition,
  WeatherLayerMode,
  WeatherPalette,
  WeatherPrefs,
  WeatherSeason,
  WeatherSourceMode,
  WeatherState,
  WeatherWindDirection,
} from "./types";

export {
  formatDate,
  formatTime,
  parseHourFromTimeString,
  parseStoryDateTime,
} from "./time-utils";

export const WEATHER_STATE_VAR = "weather_state_json";
export const WEATHER_MANUAL_STATE_VAR = "weather_manual_state_json";
export const WEATHER_TAG_NAME = "weather-state";

export const WEATHER_CONDITIONS: WeatherCondition[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
export const WEATHER_LAYERS: WeatherLayerMode[] = ["back", "front", "both"];
export const WEATHER_PALETTES: WeatherPalette[] = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
export const WEATHER_WIND_DIRECTIONS: WeatherWindDirection[] = [
  "none",
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
];
export const REDUCED_MOTION_VALUES: ReducedMotionMode[] = ["system", "always", "never"];
export const TEMPERATURE_UNITS: TemperatureUnit[] = ["fahrenheit", "celsius"];
export const WEATHER_SEASONS: WeatherSeason[] = ["spring", "summer", "autumn", "winter"];
export const WEATHER_CLOCK_MODES: WeatherClockMode[] = ["auto", "live", "story"];

export const DEFAULT_PREFS: WeatherPrefs = {
  effectsEnabled: true,
  lightningFlashEnabled: true,
  layerMode: "both",
  intensity: 1,
  reducedMotion: "system",
  temperatureUnit: "fahrenheit",
  pauseEffects: false,
  widgetPosition: null,
  clockMode: "auto",
  showForecast: true,
  transitionsEnabled: true,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

/**
 * Truncation used to be silent, so a model summary longer than the limit simply
 * lost its tail with no signal. Returns whether the value was actually cut so the
 * caller can surface it.
 */
function normalizeTextWithTruncation(
  value: unknown,
  fallback: string,
  maxLength: number,
): { text: string; truncated: boolean } {
  if (typeof value !== "string") return { text: fallback, truncated: false };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { text: fallback, truncated: false };
  return { text: trimmed.slice(0, maxLength), truncated: trimmed.length > maxLength };
}

export const SUMMARY_MAX_LENGTH = 96;

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
  snow: "snow",
  snowy: "snow",
  flurries: "snow",
  fog: "fog",
  mist: "fog",
  hazy: "fog",
};

function normalizeCondition(value: unknown, fallback: WeatherCondition): WeatherCondition {
  if (typeof value !== "string") return fallback;
  return CONDITION_ALIASES[value.trim().toLowerCase()] ?? fallback;
}

function normalizePalette(value: unknown, fallback: WeatherPalette): WeatherPalette {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return WEATHER_PALETTES.includes(normalized as WeatherPalette)
    ? (normalized as WeatherPalette)
    : fallback;
}

export function normalizeWindDirection(value: unknown, fallback: WeatherWindDirection): WeatherWindDirection {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const aliases: Record<string, WeatherWindDirection> = {
    none: "none",
    calm: "none",
    n: "north",
    north: "north",
    ne: "northeast",
    northeast: "northeast",
    e: "east",
    east: "east",
    se: "southeast",
    southeast: "southeast",
    s: "south",
    south: "south",
    sw: "southwest",
    southwest: "southwest",
    w: "west",
    west: "west",
    nw: "northwest",
    northwest: "northwest",
  };
  return aliases[normalized] ?? fallback;
}

function normalizeReducedMotion(value: unknown, fallback: ReducedMotionMode): ReducedMotionMode {
  return typeof value === "string" && REDUCED_MOTION_VALUES.includes(value as ReducedMotionMode)
    ? (value as ReducedMotionMode)
    : fallback;
}

function normalizeTemperatureUnit(value: unknown, fallback: TemperatureUnit): TemperatureUnit {
  return typeof value === "string" && TEMPERATURE_UNITS.includes(value as TemperatureUnit)
    ? (value as TemperatureUnit)
    : fallback;
}

function normalizeSource(value: unknown, fallback: WeatherSourceMode): WeatherSourceMode {
  return value === "manual" || value === "story" ? value : fallback;
}

function normalizeSeason(value: unknown, fallback: WeatherSeason): WeatherSeason {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return WEATHER_SEASONS.includes(normalized as WeatherSeason) ? (normalized as WeatherSeason) : fallback;
}

function normalizeClockMode(value: unknown, fallback: WeatherClockMode): WeatherClockMode {
  return typeof value === "string" && WEATHER_CLOCK_MODES.includes(value as WeatherClockMode)
    ? (value as WeatherClockMode)
    : fallback;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function makeDefaultWeatherState(now = Date.now()): WeatherState {
  const date = new Date(now);
  const dateValue = formatDate(date);
  const timeValue = formatTime(date);
  return {
    location: "Story setting",
    date: dateValue,
    time: timeValue,
    condition: "clear",
    summary: "Calm skies",
    temperature: "68F",
    intensity: 0.3,
    wind: "still",
    windDirection: "none",
    palette: derivePalette("clear", dateValue, timeValue),
    season: seasonFromStoryDate(dateValue, timeValue) ?? "spring",
    forecast: [],
    updatedAt: now,
    source: "story",
  };
}

export function normalizeWeatherState(input: unknown, previous?: WeatherState | null): WeatherState {
  const fallback = previous ?? makeDefaultWeatherState();
  const source = isRecord(input) ? input : {};
  const candidateDate = normalizeText(source.date, fallback.date, 24);
  const candidateTime = normalizeText(source.time, fallback.time, 16);
  const hasValidDateTime = parseStoryDateTime(candidateDate, candidateTime) !== null;
  const date = hasValidDateTime ? candidateDate : fallback.date;
  const time = hasValidDateTime ? candidateTime : fallback.time;
  const condition = normalizeCondition(source.condition, fallback.condition);
  const palette = normalizePalette(source.palette, derivePalette(condition, date, time));
  const intensity = clamp(parseNumeric(source.intensity) ?? fallback.intensity, 0, 1);
  const updatedAt = parseNumeric(source.updatedAt) ?? Date.now();
  const windDirectionValue = source.windDirection ?? source.wind_direction ?? source["wind-direction"];

  // A tag that omits the projection keeps the one already in play, so a single
  // day-to-day tag does not erase a multi-day outlook.
  const forecastValue = source.forecast ?? source.forecast_days ?? source.forecastDays;
  const forecast = forecastValue === undefined ? fallback.forecast : normalizeForecast(forecastValue);
  const derivedSeason = seasonFromStoryDate(date, time);
  const summary = normalizeTextWithTruncation(source.summary, fallback.summary, SUMMARY_MAX_LENGTH);

  return {
    location: normalizeText(source.location, fallback.location, 72),
    date,
    time,
    condition,
    summary: summary.truncated ? `${summary.text.trimEnd()}\u2026` : summary.text,
    temperature: normalizeText(source.temperature, fallback.temperature, 16),
    intensity,
    wind: normalizeText(source.wind, fallback.wind, 32),
    windDirection: normalizeWindDirection(windDirectionValue, fallback.windDirection),
    palette,
    season: normalizeSeason(source.season, derivedSeason ?? fallback.season),
    forecast,
    updatedAt,
    source: normalizeSource(source.source, fallback.source),
  };
}

export function normalizeWeatherTag(attrs: Record<string, string>, previous?: WeatherState | null): WeatherState {
  return normalizeWeatherState({ ...attrs, updatedAt: Date.now(), source: "story" }, previous);
}

export function formatTemperatureForUnit(value: string, unit: TemperatureUnit): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*([FC])(?:ahrenheit|elsius)?\b/i);
  if (!match) return trimmed;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return trimmed;

  const sourceUnit = match[2].toUpperCase() === "C" ? "celsius" : "fahrenheit";
  if (sourceUnit === unit) {
    return `${Math.round(amount)}${unit === "celsius" ? "C" : "F"}`;
  }

  const converted = unit === "celsius" ? (amount - 32) * (5 / 9) : amount * (9 / 5) + 32;
  return `${Math.round(converted)}${unit === "celsius" ? "C" : "F"}`;
}

export function normalizePrefs(input: unknown): WeatherPrefs {
  const source = isRecord(input) ? input : {};
  const position = isRecord(source.widgetPosition)
    ? {
        x: clamp(parseNumeric(source.widgetPosition.x) ?? 24, 0, 5000),
        y: clamp(parseNumeric(source.widgetPosition.y) ?? 96, 0, 5000),
      }
    : null;

  const layerMode = typeof source.layerMode === "string" && WEATHER_LAYERS.includes(source.layerMode as WeatherLayerMode)
    ? (source.layerMode as WeatherLayerMode)
    : DEFAULT_PREFS.layerMode;

  return {
    effectsEnabled: typeof source.effectsEnabled === "boolean" ? source.effectsEnabled : DEFAULT_PREFS.effectsEnabled,
    lightningFlashEnabled:
      typeof source.lightningFlashEnabled === "boolean"
        ? source.lightningFlashEnabled
        : DEFAULT_PREFS.lightningFlashEnabled,
    layerMode,
    intensity: clamp(parseNumeric(source.intensity) ?? DEFAULT_PREFS.intensity, 0.25, 1.5),
    reducedMotion: normalizeReducedMotion(source.reducedMotion, DEFAULT_PREFS.reducedMotion),
    temperatureUnit: normalizeTemperatureUnit(source.temperatureUnit, DEFAULT_PREFS.temperatureUnit),
    pauseEffects: typeof source.pauseEffects === "boolean" ? source.pauseEffects : DEFAULT_PREFS.pauseEffects,
    widgetPosition: position,
    clockMode: normalizeClockMode(source.clockMode, DEFAULT_PREFS.clockMode),
    showForecast: typeof source.showForecast === "boolean" ? source.showForecast : DEFAULT_PREFS.showForecast,
    transitionsEnabled:
      typeof source.transitionsEnabled === "boolean" ? source.transitionsEnabled : DEFAULT_PREFS.transitionsEnabled,
  };
}
