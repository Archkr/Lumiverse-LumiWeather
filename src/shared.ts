import type {
  ReducedMotionMode,
  TemperatureUnit,
  WeatherCondition,
  WeatherLayerMode,
  WeatherPalette,
  WeatherPrefs,
  WeatherSourceMode,
  WeatherState,
} from "./types";

export const WEATHER_STATE_VAR = "weather_state_json";
export const WEATHER_MANUAL_STATE_VAR = "weather_manual_state_json";
export const WEATHER_TAG_NAME = "weather-state";

export const WEATHER_CONDITIONS: WeatherCondition[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
export const WEATHER_LAYERS: WeatherLayerMode[] = ["back", "front", "both"];
export const WEATHER_PALETTES: WeatherPalette[] = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
export const REDUCED_MOTION_VALUES: ReducedMotionMode[] = ["system", "always", "never"];
export const TEMPERATURE_UNITS: TemperatureUnit[] = ["fahrenheit", "celsius"];

export const DEFAULT_PREFS: WeatherPrefs = {
  effectsEnabled: true,
  layerMode: "both",
  intensity: 1,
  reducedMotion: "system",
  temperatureUnit: "fahrenheit",
  pauseEffects: false,
  widgetPosition: null,
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

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

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

function derivePalette(condition: WeatherCondition, dateValue: string, timeValue: string): WeatherPalette {
  if (condition === "storm") return "storm";
  if (condition === "fog") return "mist";
  if (condition === "snow") return "snow";

  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp !== null) {
    const hour = new Date(timestamp).getHours();
    if (hour < 6) return "night";
    if (hour < 10) return "dawn";
    if (hour < 18) return "day";
    if (hour < 21) return "dusk";
    return "night";
  }

  const hour = parseHourFromTimeString(timeValue);
  if (hour === null) return condition === "cloudy" || condition === "rain" ? "dusk" : "day";
  if (hour < 6) return "night";
  if (hour < 10) return "dawn";
  if (hour < 18) return "day";
  if (hour < 21) return "dusk";
  return "night";
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
    palette: derivePalette("clear", dateValue, timeValue),
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

  return {
    location: normalizeText(source.location, fallback.location, 72),
    date,
    time,
    condition,
    summary: normalizeText(source.summary, fallback.summary, 72),
    temperature: normalizeText(source.temperature, fallback.temperature, 16),
    intensity,
    wind: normalizeText(source.wind, fallback.wind, 32),
    palette,
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
    layerMode,
    intensity: clamp(parseNumeric(source.intensity) ?? DEFAULT_PREFS.intensity, 0.25, 1.5),
    reducedMotion: normalizeReducedMotion(source.reducedMotion, DEFAULT_PREFS.reducedMotion),
    temperatureUnit: normalizeTemperatureUnit(source.temperatureUnit, DEFAULT_PREFS.temperatureUnit),
    pauseEffects: typeof source.pauseEffects === "boolean" ? source.pauseEffects : DEFAULT_PREFS.pauseEffects,
    widgetPosition: position,
  };
}
