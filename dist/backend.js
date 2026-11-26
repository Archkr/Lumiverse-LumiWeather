// @bun
// src/time-utils.ts
var TIME_PHASE_PALETTES = ["dawn", "day", "dusk", "night"];
var DAY_MS = 86400000;
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatDate(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function formatTime(date) {
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${pad2(date.getMinutes())} ${suffix}`;
}
function parseHourFromTimeString(timeValue) {
  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*:\s*(\d{2}))?\s*([AP]M)$/i);
  if (time12) {
    let hours = Number.parseInt(time12[1], 10);
    if (hours < 1 || hours > 12)
      return null;
    const minutes = Number.parseInt(time12[2], 10);
    const seconds = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (minutes > 59 || seconds > 59)
      return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours < 12)
      hours += 12;
    if (meridiem === "AM" && hours === 12)
      hours = 0;
    return hours;
  }
  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!time24)
    return null;
  const hours = Number.parseInt(time24[1], 10);
  const minutes = Number.parseInt(time24[2], 10);
  const seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59)
    return null;
  return hours;
}
function parseStoryDateTime(dateValue, timeValue) {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch)
    return null;
  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*:\s*(\d{2}))?\s*([AP]M)$/i);
  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (time12) {
    hours = Number.parseInt(time12[1], 10);
    minutes = Number.parseInt(time12[2], 10);
    seconds = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59)
      return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours < 12)
      hours += 12;
    if (meridiem === "AM" && hours === 12)
      hours = 0;
  } else if (time24) {
    hours = Number.parseInt(time24[1], 10);
    minutes = Number.parseInt(time24[2], 10);
    seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59)
      return null;
  } else {
    return null;
  }
  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(hours, minutes, seconds, 0);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || parsed.getUTCHours() !== hours || parsed.getUTCMinutes() !== minutes || parsed.getUTCSeconds() !== seconds) {
    return null;
  }
  return parsed.getTime();
}
function isTimePhasePalette(palette) {
  return TIME_PHASE_PALETTES.includes(palette);
}
function resolveDayOfYear(timestamp) {
  if (!Number.isFinite(timestamp))
    return null;
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(year))
    return null;
  const startOfYear = new Date(0);
  startOfYear.setUTCFullYear(year, 0, 1);
  const current = new Date(0);
  current.setUTCFullYear(year, date.getUTCMonth(), date.getUTCDate());
  const day = Math.round((current.getTime() - startOfYear.getTime()) / DAY_MS) + 1;
  return Number.isFinite(day) ? day : null;
}
function resolveSeasonFromDayOfYear(dayOfYear) {
  if (dayOfYear < 80 || dayOfYear >= 355)
    return "winter";
  if (dayOfYear < 172)
    return "spring";
  if (dayOfYear < 266)
    return "summer";
  return "autumn";
}
function phaseFromHour(hour) {
  if (hour === null)
    return "day";
  if (hour < 6)
    return "night";
  if (hour < 10)
    return "dawn";
  if (hour < 18)
    return "day";
  if (hour < 21)
    return "dusk";
  return "night";
}
function resolveHudTimePhase(palette, hour) {
  if (isTimePhasePalette(palette))
    return palette;
  return phaseFromHour(hour);
}
function phaseToPalette(phase) {
  return phase;
}
function derivePalette(condition, dateValue, timeValue) {
  if (condition === "storm")
    return "storm";
  if (condition === "fog")
    return "mist";
  if (condition === "snow")
    return "snow";
  const hour = parseHourFromTimeString(timeValue);
  if (parseStoryDateTime(dateValue, timeValue) === null && hour === null) {
    return condition === "cloudy" || condition === "rain" ? "dusk" : "day";
  }
  return phaseToPalette(phaseFromHour(hour));
}
function seasonFromStoryDate(dateValue, timeValue) {
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp === null)
    return null;
  const dayOfYear = resolveDayOfYear(timestamp);
  return dayOfYear === null ? null : resolveSeasonFromDayOfYear(dayOfYear);
}
var SYNODIC_MONTH_DAYS = 29.530588853;
var SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
var NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
var LUNAR_PHASE_LABELS = {
  new: "New moon",
  "waxing-crescent": "Waxing crescent",
  "first-quarter": "First quarter",
  "waxing-gibbous": "Waxing gibbous",
  full: "Full moon",
  "waning-gibbous": "Waning gibbous",
  "last-quarter": "Last quarter",
  "waning-crescent": "Waning crescent"
};
function lunarPhaseFromFraction(cycleFraction) {
  const normalized = (cycleFraction % 1 + 1) % 1;
  if (normalized < 0.0625 || normalized >= 0.9375)
    return "new";
  if (normalized < 0.1875)
    return "waxing-crescent";
  if (normalized < 0.3125)
    return "first-quarter";
  if (normalized < 0.4375)
    return "waxing-gibbous";
  if (normalized < 0.5625)
    return "full";
  if (normalized < 0.6875)
    return "waning-gibbous";
  if (normalized < 0.8125)
    return "last-quarter";
  return "waning-crescent";
}
function resolveLunarPhase(dateValue, timeValue = "12:00 PM") {
  const timestamp = parseStoryDateTime(dateValue, timeValue) ?? parseStoryDateTime(dateValue, "12:00 PM");
  if (timestamp === null) {
    return {
      phase: "full",
      label: LUNAR_PHASE_LABELS.full,
      ageDays: 14.77,
      cycleFraction: 0.5,
      illumination: 1
    };
  }
  const elapsedMs = timestamp - NEW_MOON_EPOCH_MS;
  const cycleFraction = (elapsedMs / SYNODIC_MONTH_MS % 1 + 1) % 1;
  const ageDays = Number((cycleFraction * SYNODIC_MONTH_DAYS).toFixed(2));
  const illumination = Number(((1 - Math.cos(2 * Math.PI * cycleFraction)) / 2).toFixed(3));
  const phase = lunarPhaseFromFraction(cycleFraction);
  return {
    phase,
    label: LUNAR_PHASE_LABELS[phase],
    ageDays,
    cycleFraction: Number(cycleFraction.toFixed(4)),
    illumination
  };
}

// src/forecast-utils.ts
var MAX_FORECAST_DAYS = 5;
var MAX_FORECAST_SUMMARY_LENGTH = 48;
var CONDITION_ALIASES = {
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
  hazy: "fog"
};
function isRealCalendarDate(value) {
  return value === value.trim() && parseStoryDateTime(value, "00:00") !== null;
}
function normalizeConditionToken(token) {
  const normalized = token.trim().toLowerCase().replace(/\s+/g, " ");
  return CONDITION_ALIASES[normalized] ?? null;
}
function normalizeTemperatureToken(token) {
  const match = token.trim().match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F(?:ahrenheit)?|C(?:elsius)?)$/i);
  if (!match)
    return "";
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount))
    return "";
  return `${Math.round(amount)}${match[2][0].toUpperCase() === "C" ? "C" : "F"}`;
}
function truncateForecastSummary(value) {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed.length <= MAX_FORECAST_SUMMARY_LENGTH)
    return collapsed;
  return `${collapsed.slice(0, MAX_FORECAST_SUMMARY_LENGTH - 1).trimEnd()}\u2026`;
}
function splitForecastEntries(raw) {
  return raw.split(/[|\n;]+/).map((entry) => entry.trim()).filter(Boolean);
}
function parseForecastEntry(raw) {
  const trimmed = raw.trim();
  if (!trimmed)
    return null;
  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex === -1) {
    if (!isRealCalendarDate(trimmed))
      return null;
    return { date: trimmed, condition: "clear", summary: "", temperature: "" };
  }
  const date = trimmed.slice(0, separatorIndex).trim();
  if (!isRealCalendarDate(date))
    return null;
  let condition = null;
  let temperature = "";
  let temperatureOmitted = false;
  const summaryParts = [];
  for (const part of trimmed.slice(separatorIndex + 1).split(",")) {
    const token = part.trim();
    if (!token) {
      if (condition !== null)
        temperatureOmitted = true;
      continue;
    }
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
    summary: truncateForecastSummary(summaryParts.join(", ")),
    temperature
  };
}
function normalizeForecast(input, maxDays = MAX_FORECAST_DAYS) {
  const entries = [];
  const addInput = (candidate) => {
    if (typeof candidate === "string") {
      for (const raw of splitForecastEntries(candidate)) {
        const entry = parseForecastEntry(raw);
        if (entry)
          entries.push(entry);
      }
    } else if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const entry = normalizeForecastObject(candidate);
      if (entry)
        entries.push(entry);
    }
  };
  if (Array.isArray(input))
    input.forEach(addInput);
  else
    addInput(input);
  const byDate = new Map;
  for (const entry of entries)
    byDate.set(entry.date, entry);
  const limit = Math.max(0, Math.round(clamp(maxDays, 0, MAX_FORECAST_DAYS)));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(0, limit);
}
function normalizeForecastObject(candidate) {
  const read = (key) => typeof candidate[key] === "string" ? candidate[key].trim() : "";
  const date = read("date");
  if (!isRealCalendarDate(date))
    return null;
  return {
    date,
    condition: normalizeConditionToken(read("condition")) ?? "clear",
    temperature: normalizeTemperatureToken(read("temperature")),
    summary: truncateForecastSummary(read("summary"))
  };
}
function formatForecastEntry(entry) {
  const keepEmptyTemperature = !entry.temperature && !!normalizeTemperatureToken(entry.summary.split(",")[0]);
  const details = keepEmptyTemperature ? `${entry.condition}, , ${entry.summary}` : [entry.condition, entry.temperature, entry.summary].filter(Boolean).join(", ");
  return details ? `${entry.date}: ${details}` : entry.date;
}
function serializeForecast(entries) {
  return entries.map(formatForecastEntry).join(" | ");
}

// src/shared.ts
var WEATHER_STATE_VAR = "weather_state_json";
var WEATHER_MANUAL_STATE_VAR = "weather_manual_state_json";
var WEATHER_CONDITIONS = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
var WEATHER_LAYERS = ["back", "front", "both"];
var WEATHER_PALETTES = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
var WEATHER_EXPOSURES = ["outdoor", "sheltered", "indoor", "underground"];
var WEATHER_PHENOMENA = [
  "none",
  "aurora",
  "blossoms",
  "embers",
  "ashfall",
  "fireflies",
  "sandstorm"
];
var WEATHER_WIND_DIRECTIONS = [
  "none",
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest"
];
var REDUCED_MOTION_VALUES = ["system", "always", "never"];
var TEMPERATURE_UNITS = ["fahrenheit", "celsius"];
var WEATHER_SEASONS = ["spring", "summer", "autumn", "winter"];
var WEATHER_CLOCK_MODES = ["auto", "live", "story"];
var WEATHER_TRACKING_MODES = ["sidecar", "tags"];
var DEFAULT_PREFS = {
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
  trackingMode: "sidecar",
  sidecarConnectionId: null,
  sidecarModel: null,
  soundEnabled: false,
  wildlifeEnabled: true,
  soundVolume: 0.45,
  rainVolume: 1,
  windVolume: 1,
  thunderVolume: 1,
  ambienceVolume: 1
};
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function normalizeText(value, fallback, maxLength) {
  if (typeof value !== "string")
    return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}
function normalizeTextWithTruncation(value, fallback, maxLength) {
  if (typeof value !== "string")
    return { text: fallback, truncated: false };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed)
    return { text: fallback, truncated: false };
  const truncated = trimmed.length > maxLength;
  return { text: trimmed.slice(0, truncated ? maxLength - 1 : maxLength), truncated };
}
var SUMMARY_MAX_LENGTH = 96;
var CONDITION_ALIASES2 = {
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
  hazy: "fog"
};
function normalizeCondition(value, fallback) {
  if (typeof value !== "string")
    return fallback;
  return CONDITION_ALIASES2[value.trim().toLowerCase()] ?? fallback;
}
function normalizePalette(value, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return WEATHER_PALETTES.includes(normalized) ? normalized : fallback;
}
function normalizeWindDirection(value, fallback) {
  if (typeof value !== "string")
    return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const aliases = {
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
    northwest: "northwest"
  };
  return aliases[normalized] ?? fallback;
}
function normalizeReducedMotion(value, fallback) {
  return typeof value === "string" && REDUCED_MOTION_VALUES.includes(value) ? value : fallback;
}
function normalizeTemperatureUnit(value, fallback) {
  return typeof value === "string" && TEMPERATURE_UNITS.includes(value) ? value : fallback;
}
function normalizeSource(value, fallback) {
  return value === "manual" || value === "story" ? value : fallback;
}
function normalizeSeason(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return WEATHER_SEASONS.includes(normalized) ? normalized : null;
}
function normalizeClockMode(value, fallback) {
  return typeof value === "string" && WEATHER_CLOCK_MODES.includes(value) ? value : fallback;
}
function normalizeTrackingMode(value, fallback) {
  return typeof value === "string" && WEATHER_TRACKING_MODES.includes(value) ? value : fallback;
}
var EXPOSURE_ALIASES = {
  outdoor: "outdoor",
  outdoors: "outdoor",
  outside: "outdoor",
  exterior: "outdoor",
  open: "outdoor",
  exposed: "outdoor",
  "open air": "outdoor",
  sheltered: "sheltered",
  porch: "sheltered",
  canopy: "sheltered",
  awning: "sheltered",
  covered: "sheltered",
  veranda: "sheltered",
  balcony: "sheltered",
  gazebo: "sheltered",
  eaves: "sheltered",
  overhang: "sheltered",
  indoor: "indoor",
  indoors: "indoor",
  inside: "indoor",
  interior: "indoor",
  room: "indoor",
  cabin: "indoor",
  house: "indoor",
  building: "indoor",
  tavern: "indoor",
  hall: "indoor",
  underground: "underground",
  subterranean: "underground",
  cave: "underground",
  cavern: "underground",
  dungeon: "underground",
  cellar: "underground",
  tunnel: "underground",
  bunker: "underground",
  basement: "underground",
  crypt: "underground",
  mine: "underground"
};
function normalizeExposure(value, fallback = "outdoor") {
  if (typeof value !== "string")
    return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return EXPOSURE_ALIASES[normalized] ?? fallback;
}
var PHENOMENON_ALIASES = {
  none: "none",
  normal: "none",
  off: "none",
  clear: "none",
  aurora: "aurora",
  "aurora borealis": "aurora",
  "northern lights": "aurora",
  "polar lights": "aurora",
  "southern lights": "aurora",
  aether: "aurora",
  blossoms: "blossoms",
  blossom: "blossoms",
  "cherry blossoms": "blossoms",
  petals: "blossoms",
  sakura: "blossoms",
  "flower petals": "blossoms",
  floral: "blossoms",
  embers: "embers",
  ember: "embers",
  cinders: "embers",
  sparks: "embers",
  wildfire: "embers",
  ashfall: "ashfall",
  ash: "ashfall",
  "volcanic ash": "ashfall",
  soot: "ashfall",
  fallout: "ashfall",
  fireflies: "fireflies",
  firefly: "fireflies",
  "lightning bugs": "fireflies",
  bioluminescence: "fireflies",
  glowworms: "fireflies",
  wisps: "fireflies",
  spores: "fireflies",
  sandstorm: "sandstorm",
  "dust storm": "sandstorm",
  duststorm: "sandstorm",
  dust: "sandstorm",
  haboob: "sandstorm",
  sand: "sandstorm",
  grit: "sandstorm"
};
function normalizePhenomenon(value, fallback = "none") {
  if (typeof value !== "string")
    return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return PHENOMENON_ALIASES[normalized] ?? fallback;
}
function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed))
      return parsed;
  }
  return null;
}
function makeDefaultWeatherState(now = Date.now()) {
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
    seasonOverride: null,
    exposure: "outdoor",
    phenomenon: "none",
    forecast: [],
    updatedAt: now,
    source: "story"
  };
}
function normalizeWeatherState(input, previous) {
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
  const windDirectionValue = source.windDirection ?? source.winddirection ?? source.wind_direction ?? source["wind-direction"];
  const exposureValue = source.exposure ?? source.shelter ?? source.setting;
  const phenomenonValue = source.phenomenon ?? source.phenomena ?? source.anomaly;
  const forecastValue = source.forecast ?? source.forecast_days ?? source.forecastDays ?? source.forecastdays;
  const forecast = forecastValue === undefined ? fallback.forecast : normalizeForecast(forecastValue);
  const derivedSeason = seasonFromStoryDate(date, time);
  const seasonOverride = normalizeSeason(source.seasonOverride === undefined ? source.season : source.seasonOverride);
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
    season: seasonOverride ?? derivedSeason ?? fallback.season,
    seasonOverride,
    exposure: normalizeExposure(exposureValue, fallback.exposure ?? "outdoor"),
    phenomenon: normalizePhenomenon(phenomenonValue, fallback.phenomenon ?? "none"),
    forecast,
    updatedAt,
    source: normalizeSource(source.source, fallback.source)
  };
}
function normalizeWeatherTag(attrs, previous) {
  const normalizedAttrs = Object.fromEntries(Object.entries(attrs).map(([name, value]) => [name.toLowerCase(), value]));
  return normalizeWeatherState({ ...normalizedAttrs, updatedAt: Date.now(), source: "story" }, previous);
}
function normalizeStoredWeatherState(input) {
  const state = normalizeWeatherState(input);
  if (isRecord(input) && input.seasonOverride === undefined) {
    const derived = seasonFromStoryDate(state.date, state.time);
    state.seasonOverride = state.season === derived ? null : state.season;
  }
  return state;
}
function applyManualWeatherState(previous, patch, now = Date.now()) {
  const merged = { ...previous, ...patch, updatedAt: now, source: "manual" };
  if (patch.seasonOverride === undefined && patch.season !== undefined) {
    merged.seasonOverride = patch.season;
  }
  return normalizeWeatherState(merged, previous);
}
function normalizePrefs(input) {
  const source = isRecord(input) ? input : {};
  const position = isRecord(source.widgetPosition) ? {
    x: clamp(parseNumeric(source.widgetPosition.x) ?? 24, 0, 5000),
    y: clamp(parseNumeric(source.widgetPosition.y) ?? 96, 0, 5000)
  } : null;
  const layerMode = typeof source.layerMode === "string" && WEATHER_LAYERS.includes(source.layerMode) ? source.layerMode : DEFAULT_PREFS.layerMode;
  return {
    effectsEnabled: typeof source.effectsEnabled === "boolean" ? source.effectsEnabled : DEFAULT_PREFS.effectsEnabled,
    lightningFlashEnabled: typeof source.lightningFlashEnabled === "boolean" ? source.lightningFlashEnabled : DEFAULT_PREFS.lightningFlashEnabled,
    layerMode,
    intensity: clamp(parseNumeric(source.intensity) ?? DEFAULT_PREFS.intensity, 0.25, 1.5),
    reducedMotion: normalizeReducedMotion(source.reducedMotion, DEFAULT_PREFS.reducedMotion),
    temperatureUnit: normalizeTemperatureUnit(source.temperatureUnit, DEFAULT_PREFS.temperatureUnit),
    pauseEffects: typeof source.pauseEffects === "boolean" ? source.pauseEffects : DEFAULT_PREFS.pauseEffects,
    widgetPosition: position,
    clockMode: normalizeClockMode(source.clockMode, DEFAULT_PREFS.clockMode),
    showForecast: typeof source.showForecast === "boolean" ? source.showForecast : DEFAULT_PREFS.showForecast,
    transitionsEnabled: typeof source.transitionsEnabled === "boolean" ? source.transitionsEnabled : DEFAULT_PREFS.transitionsEnabled,
    trackingMode: normalizeTrackingMode(source.trackingMode, DEFAULT_PREFS.trackingMode ?? "sidecar"),
    sidecarConnectionId: typeof source.sidecarConnectionId === "string" && source.sidecarConnectionId.trim() ? source.sidecarConnectionId.trim() : null,
    sidecarModel: typeof source.sidecarModel === "string" && source.sidecarModel.trim() ? source.sidecarModel.trim() : null,
    soundEnabled: typeof source.soundEnabled === "boolean" ? source.soundEnabled : Boolean(DEFAULT_PREFS.soundEnabled),
    wildlifeEnabled: typeof source.wildlifeEnabled === "boolean" ? source.wildlifeEnabled : Boolean(DEFAULT_PREFS.wildlifeEnabled ?? true),
    soundVolume: clamp(parseNumeric(source.soundVolume) ?? (DEFAULT_PREFS.soundVolume ?? 0.45), 0, 1),
    rainVolume: clamp(parseNumeric(source.rainVolume) ?? (DEFAULT_PREFS.rainVolume ?? 1), 0, 1),
    windVolume: clamp(parseNumeric(source.windVolume) ?? (DEFAULT_PREFS.windVolume ?? 1), 0, 1),
    thunderVolume: clamp(parseNumeric(source.thunderVolume) ?? (DEFAULT_PREFS.thunderVolume ?? 1), 0, 1),
    ambienceVolume: clamp(parseNumeric(source.ambienceVolume) ?? (DEFAULT_PREFS.ambienceVolume ?? 1), 0, 1)
  };
}

// src/state-utils.ts
function selectEffectiveWeatherState(storyState, manualState) {
  return manualState ?? storyState;
}

// src/visual-tags.ts
var CONDITION_VISUAL_TAGS = {
  clear: (intensity) => intensity > 0.65 ? "crisp clear sky, vibrant atmospheric light" : "clear sky",
  cloudy: (intensity) => intensity > 0.65 ? "heavy overcast sky, dense cloud cover, diffused light" : "partly cloudy sky, soft clouds",
  rain: (intensity) => intensity > 0.72 ? "heavy rain, streaking raindrops, wet reflective surfaces, rain mist" : intensity < 0.35 ? "light drizzle, damp atmosphere, subtle raindrops" : "steady rain, falling raindrops, wet surfaces",
  storm: (intensity) => intensity > 0.75 ? "violent thunderstorm, dark cumulonimbus clouds, forked lightning flashes, torrential rain, dramatic storm lighting" : "thunderstorm, dark storm clouds, distant lightning, driving rain",
  snow: (intensity) => intensity > 0.72 ? "heavy snowfall, swirling blizzard flurries, frost-covered surfaces, wintry haze" : "falling snow, soft snowflakes, wintry atmosphere",
  fog: (intensity) => intensity > 0.7 ? "dense volumetric fog, thick low mist, shrouded silhouettes" : "atmospheric fog, low-lying mist, soft haze"
};
var PALETTE_VISUAL_TAGS = {
  dawn: "golden dawn lighting, warm sunrise horizon, soft morning glow",
  day: "natural daylight, balanced sky illumination",
  dusk: "warm dusk twilight, amber and violet sunset glow, long shadows",
  night: "night scene, deep nocturnal shadows",
  storm: "brooding slate-blue storm palette, high-contrast tempest lighting",
  mist: "muted pearl-grey mist palette, soft diffused contrast",
  snow: "crisp glacial blue-white palette, luminous wintry reflection"
};
var EXPOSURE_VISUAL_TAGS = {
  outdoor: "outdoor setting, open sky",
  sheltered: "sheltered under cover, semi-open overhang, weather visible beyond shelter",
  indoor: "indoor interior setting, weather visible through windowpane, condensation on glass",
  underground: "underground subterranean setting, cavern haze, floating dust motes"
};
var PHENOMENON_VISUAL_TAGS = {
  none: "",
  aurora: "aurora borealis, shimmering emerald and violet polar light ribbons in sky",
  blossoms: "drifting cherry blossom petals, floating pink sakura petals in the air",
  embers: "floating glowing embers, rising fiery cinders and warm sparks",
  ashfall: "falling volcanic ash, drifting grey soot flakes, hazy ash sky",
  fireflies: "glowing bioluminescent fireflies, soft drifting golden light motes",
  sandstorm: "swirling sandstorm, blowing ochre dust haze, airborne desert grit"
};
function buildWeatherVisualTags(state) {
  if (!state)
    return "";
  const exposure = state.exposure ?? "outdoor";
  const phenomenon = state.phenomenon ?? "none";
  const hour = parseHourFromTimeString(state.time);
  const phase = resolveHudTimePhase(state.palette, hour);
  const lunar = resolveLunarPhase(state.date, state.time);
  const segments = [];
  segments.push(EXPOSURE_VISUAL_TAGS[exposure]);
  if (exposure !== "underground") {
    segments.push(PALETTE_VISUAL_TAGS[state.palette]);
    if (phase === "night" && (state.condition === "clear" || state.condition === "cloudy")) {
      if (lunar.illumination >= 0.85) {
        segments.push("full moon, bright silver moonlight");
      } else if (lunar.illumination <= 0.12) {
        segments.push("new moon, dark starlit sky");
      } else {
        segments.push(`${lunar.label.toLowerCase()}, soft moonlight`);
      }
    }
    segments.push(CONDITION_VISUAL_TAGS[state.condition](state.intensity));
  }
  if (phenomenon !== "none") {
    segments.push(PHENOMENON_VISUAL_TAGS[phenomenon]);
  }
  if (exposure !== "underground" && exposure !== "indoor") {
    const windText = state.wind.trim().toLowerCase();
    if (/hurricane|violent|gale|hard|strong|gust/.test(windText)) {
      segments.push("strong wind, windswept motion");
    } else if (/breezy|windy|steady/.test(windText)) {
      segments.push("gentle wind drift");
    }
  }
  if (state.season && exposure !== "underground") {
    segments.push(`${state.season} season`);
  }
  return segments.filter(Boolean).join(", ");
}

// src/lumi-state.ts
var LUMI_STATE_PROTOCOL = "lumi_state.v1";
var LUMI_STATE_SCHEMA_VERSION = 1;
var LUMI_WEATHER_STATE_ENDPOINT = "lumi_weather.state.current";
function emptyLumiStateScene() {
  return { locations: [], times: [], cast: [], objects: [], conditions: [], threads: [] };
}
function makeWeatherLumiStateSnapshot(chatId, state, revision, extensionVersion, generatedAt = Date.now()) {
  const normalizedRevision = Math.max(0, Math.round(Number.isFinite(revision) ? revision : 0));
  const scene = emptyLumiStateScene();
  if (chatId && state) {
    const provenance = {
      extensionId: "lumi_weather",
      method: state.source,
      observedAt: state.updatedAt,
      confidence: state.source === "manual" ? 1 : 0.9
    };
    scene.locations.push({
      id: "scene-location",
      subject: { kind: "scene" },
      label: state.location,
      provenance
    });
    scene.times.push({
      id: "story-calendar",
      subject: { kind: "scene" },
      clock: "calendar",
      date: state.date,
      time: state.time,
      day: null,
      hour: null,
      running: null,
      timezone: null,
      provenance
    });
    const lunar = resolveLunarPhase(state.date, state.time);
    scene.conditions.push({
      id: "scene-weather",
      subject: { kind: "scene" },
      kind: "weather",
      label: state.condition,
      attributes: {
        summary: state.summary,
        temperature: state.temperature,
        intensity: state.intensity,
        wind: state.wind,
        windDirection: state.windDirection,
        palette: state.palette,
        season: state.season,
        exposure: state.exposure ?? "outdoor",
        phenomenon: state.phenomenon ?? "none",
        lunarPhase: lunar.phase,
        moonIllumination: lunar.illumination,
        visualTags: buildWeatherVisualTags(state),
        forecast: state.forecast.length > 0 ? serializeForecast(state.forecast) : null
      },
      provenance
    });
  }
  return {
    protocol: LUMI_STATE_PROTOCOL,
    schemaVersion: LUMI_STATE_SCHEMA_VERSION,
    source: {
      extensionId: "lumi_weather",
      extensionVersion,
      endpoint: LUMI_WEATHER_STATE_ENDPOINT
    },
    chatId,
    revision: chatId ? normalizedRevision : 0,
    freshness: chatId && state ? "fresh" : "unavailable",
    generatedAt,
    updatedAt: state?.updatedAt ?? null,
    visibility: "public",
    state: scene
  };
}

// src/tag-utils.ts
function buildWeatherTagRegex(flags = "ig") {
  return new RegExp(String.raw`<weather-state\b[^>]*?(?:\/>|>[\s\S]*?<\/weather-state>)`, flags);
}
function stripWeatherStateTags(content) {
  return content.replace(buildWeatherTagRegex(), "").replace(/\n{3,}/g, `

`).trim();
}
function parseTagAttributes(raw) {
  const attrs = {};
  const attributePattern = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = attributePattern.exec(raw)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}
function extractLastWeatherTag(content) {
  let lastMatch = null;
  for (const match of content.matchAll(buildWeatherTagRegex())) {
    const fullMatch = match[0] ?? "";
    const openingTag = fullMatch.match(/^<weather-state\b([^>]*)/i);
    lastMatch = {
      fullMatch,
      attrs: parseTagAttributes(openingTag?.[1] ?? "")
    };
  }
  return lastMatch;
}

// src/story-history.ts
var MESSAGE_WEATHER_METADATA_KEY = "lumi_weather";
var MILLISECOND_THRESHOLD = 1000000000000;
function normalizeMessageTimestamp(value) {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0)
    return null;
  const milliseconds = numeric >= MILLISECOND_THRESHOLD ? numeric : numeric * 1000;
  return Number.isFinite(milliseconds) ? milliseconds : null;
}
function resolveMessageTimestamp(message) {
  const swipeId = typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id) ? message.swipe_id : null;
  if (swipeId !== null && Array.isArray(message.swipe_dates)) {
    const swipeTimestamp = normalizeMessageTimestamp(message.swipe_dates[swipeId]);
    if (swipeTimestamp !== null)
      return swipeTimestamp;
  }
  return normalizeMessageTimestamp(message.send_date);
}
function readRawWeatherMetadata(message) {
  const fromMetadata = message.metadata?.[MESSAGE_WEATHER_METADATA_KEY];
  if (fromMetadata && typeof fromMetadata === "object" && !Array.isArray(fromMetadata)) {
    return fromMetadata;
  }
  const spindleMeta = message.extra?.spindle_metadata;
  if (spindleMeta && typeof spindleMeta === "object" && !Array.isArray(spindleMeta)) {
    const nested = spindleMeta[MESSAGE_WEATHER_METADATA_KEY];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested;
    }
  }
  return null;
}
function extractMessageWeatherMetadata(message) {
  const entry = readRawWeatherMetadata(message);
  if (!entry)
    return null;
  const swipeIndex = typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id) ? Math.max(0, Math.floor(message.swipe_id)) : 0;
  let candidate = null;
  if (entry.bySwipe && typeof entry.bySwipe === "object" && !Array.isArray(entry.bySwipe)) {
    const map = entry.bySwipe;
    candidate = map[String(swipeIndex)] ?? null;
  } else if (entry.state && typeof entry.state === "object" && swipeIndex === 0) {
    candidate = entry.state;
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const normalized = normalizeStoredWeatherState(candidate);
  return { ...normalized, source: "story" };
}
function buildMessageWeatherMetadata(existingMetadata, swipeId, state) {
  const base = existingMetadata && typeof existingMetadata === "object" ? { ...existingMetadata } : {};
  const existingEntry = base[MESSAGE_WEATHER_METADATA_KEY];
  const prevBySwipe = existingEntry && typeof existingEntry === "object" && !Array.isArray(existingEntry) && existingEntry.bySwipe && typeof existingEntry.bySwipe === "object" && !Array.isArray(existingEntry.bySwipe) ? { ...existingEntry.bySwipe } : {};
  const swipeIndex = typeof swipeId === "number" && Number.isFinite(swipeId) ? Math.max(0, Math.floor(swipeId)) : 0;
  const cleanSnapshot = { ...state, source: "story" };
  prevBySwipe[String(swipeIndex)] = cleanSnapshot;
  const nextEntry = {
    schemaVersion: 1,
    bySwipe: prevBySwipe,
    ...swipeIndex === 0 ? { state: cleanSnapshot } : {}
  };
  return {
    ...base,
    [MESSAGE_WEATHER_METADATA_KEY]: nextEntry
  };
}
function rebuildStoryWeatherState(messages, fallbackUpdatedAt = Date.now()) {
  const ordered = messages.map((message, originalIndex) => ({ message, originalIndex })).sort((left, right) => {
    const leftIndex = Number.isFinite(left.message.index_in_chat) ? left.message.index_in_chat : left.originalIndex;
    const rightIndex = Number.isFinite(right.message.index_in_chat) ? right.message.index_in_chat : right.originalIndex;
    return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
  });
  let state = null;
  for (const { message } of ordered) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant")
      continue;
    const fromMetadata = extractMessageWeatherMetadata(message);
    if (fromMetadata) {
      const updatedAt = resolveMessageTimestamp(message) ?? (fromMetadata.updatedAt > 0 ? fromMetadata.updatedAt : fallbackUpdatedAt);
      state = { ...fromMetadata, updatedAt, source: "story" };
      continue;
    }
    if (typeof message.content !== "string")
      continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag)
      continue;
    const updatedAt = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
    state = { ...normalizeWeatherTag(tag.attrs, state), updatedAt };
  }
  return state;
}
function hasSameForecast(left, right) {
  if (left.length !== right.length)
    return false;
  return left.every((entry, index) => {
    const other = right[index];
    return entry.date === other.date && entry.condition === other.condition && entry.summary === other.summary && entry.temperature === other.temperature;
  });
}
function hasSameStoryScene(left, right) {
  if (!left || !right)
    return left === right;
  return left.location === right.location && left.date === right.date && left.time === right.time && left.condition === right.condition && left.summary === right.summary && left.temperature === right.temperature && left.intensity === right.intensity && left.wind === right.wind && left.windDirection === right.windDirection && left.palette === right.palette && left.season === right.season && left.seasonOverride === right.seasonOverride && (left.exposure ?? "outdoor") === (right.exposure ?? "outdoor") && (left.phenomenon ?? "none") === (right.phenomenon ?? "none") && left.source === right.source && hasSameForecast(left.forecast, right.forecast);
}

// src/weather-prompt.ts
function buildWeatherTagExample() {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm" season="winter" exposure="outdoor" phenomenon="none" forecast="2026-01-16: rain, 58F, lingering showers | 2026-01-17: cloudy, 56F, cool overcast skies | 2026-01-18: clear, 57F, mild winter sunshine"></weather-state>';
}
function summarizeWeatherState(state, includeTagHint = true) {
  if (!state)
    return "No saved weather state yet.";
  const lunar = resolveLunarPhase(state.date, state.time);
  const lines = [
    `Location: ${state.location}`,
    `Date: ${state.date}`,
    `Time: ${state.time}`,
    `Condition: ${state.condition}`,
    `Summary: ${state.summary}`,
    `Temperature: ${state.temperature}`,
    `Intensity: ${state.intensity.toFixed(2)}`,
    `Wind: ${state.wind}`,
    `Wind direction: ${state.windDirection}`,
    `Palette: ${state.palette}`,
    `Season: ${state.season}`,
    `Exposure: ${state.exposure ?? "outdoor"}`,
    `Phenomenon: ${state.phenomenon ?? "none"}`,
    `Lunar phase: ${lunar.label} (${Math.round(lunar.illumination * 100)}% illuminated)`
  ];
  if (state.forecast.length > 0) {
    lines.push(`Forecast: ${state.forecast.map(formatForecastEntry).join(" | ")}`);
  } else if (includeTagHint) {
    lines.push("Forecast: Not set yet; create a near-term outlook in the next tag.");
  }
  return lines.join(" | ");
}
function buildTrackerMacro() {
  return [
    "IMPORTANT OUTPUT FORMAT:",
    "Write the visible reply first, then append exactly one final XML weather-state tag.",
    "Never omit the weather-state tag, even when the scene state stays unchanged.",
    "Treat date and time as story-continuity state, not as a timestamp for this reply.",
    "Copy the current date and time exactly unless the visible narrative explicitly establishes that time passed.",
    "Do not advance time merely because another message was sent, because dialogue occurred, or because real-world time passed.",
    "Brief dialogue and quick actions normally keep the exact same time; only advance it for narrated waits, travel, sleep, time skips, or other clear elapsed time.",
    "When time does advance, make the amount match the elapsed time established by the narrative.",
    "Preserve every other current scene field unless the visible narrative changes it; maintain the forecast as instructed below.",
    "Do not wrap the tag in markdown fences.",
    "Do not explain the tag or mention it in visible prose.",
    "Never place visible prose after the tag.",
    "Emit the tag as the very last text in the assistant message.",
    `Allowed conditions: ${WEATHER_CONDITIONS.join(", ")}`,
    `Allowed palettes: ${WEATHER_PALETTES.join(", ")}`,
    `Allowed seasons: ${WEATHER_SEASONS.join(", ")}`,
    `Allowed exposures: ${WEATHER_EXPOSURES.join(", ")}`,
    `Allowed phenomena: ${WEATHER_PHENOMENA.join(", ")}`,
    "Use location, date, time, condition, summary, temperature, intensity, wind, windDirection, palette, and forecast.",
    "windDirection is where the wind comes from and must be one of: none, north, northeast, east, southeast, south, southwest, west, northwest.",
    "season is optional and, when present, is one of: spring, summer, autumn, winter.",
    "exposure is optional (outdoor, sheltered, indoor, underground) and tracks whether the active scene is in open air, under cover/porch/canopy, inside a building looking through windows, or underground.",
    "phenomenon is optional (none, aurora, blossoms, embers, ashfall, fireflies, sandstorm) for special atmospheric effects.",
    "Include a non-empty forecast attribute in every weather-state tag, even when the visible narrative does not discuss future weather.",
    "Project the next three story calendar days by default, with at most five future days total. Use real YYYY-MM-DD calendar dates strictly after the date in this tag, in chronological order with no duplicate days.",
    "Separate forecast entries with a pipe and format each as date: condition, temperature, summary. Include a supported condition, a temperature with an F or C suffix, and a brief summary for each day; keep the scene's temperature unit.",
    "Use future weather established by the story when available. Otherwise create a plausible near-term outlook from the scene's location, season, current weather, and temperature; this is a projection of fictional story weather, not live forecast data.",
    "Copy existing future forecast entries unchanged unless the narrative establishes a weather change. Fill missing days in the default three-day horizon plausibly rather than leaving the forecast empty; preserve later saved days within the five-entry limit.",
    "When the story date advances, remove entries on or before that date, keep the remaining future outlook, and add missing days to restore the default three-day horizon. Base all forecast dates on the story date in this tag, never on the device date or the example date below.",
    "Stable weather is a valid projection; do not force changes or narrate future events merely to populate the forecast.",
    'Use forecast="" only when the user explicitly asks to clear the outlook.',
    "Exact wrapper example:",
    buildWeatherTagExample()
  ].join(`
`);
}
function buildStaticStateMacro() {
  return "Use the most recent assistant weather-state tag in chat history as the current scene reference.";
}
function buildPromptInstruction() {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    "Use the most recent assistant weather-state tag in chat history as the current scene reference.",
    "If a [LumiWeather Current Scene] reference is supplied after history, use it instead; it restores missing state or a manual override.",
    "If neither exists, establish the initial scene from the narrative."
  ].join(`
`);
}
function buildSceneInstruction(state) {
  return [
    "[LumiWeather Current Scene]",
    `Current scene: ${summarizeWeatherState(state)}`
  ].join(`
`);
}
function buildReadOnlySceneInstruction(state) {
  return [
    "[LumiWeather Current Scene]",
    `Current scene: ${summarizeWeatherState(state, false)}`,
    "Use this as natural environmental continuity; do not emit weather tags or meta-commentary."
  ].join(`
`);
}

// src/prompt-injection.ts
var WEATHER_INSTRUCTIONS_BREAKDOWN_NAME = "LumiWeather \u2014 Instructions";
var WEATHER_BREAKDOWN_NAME = "LumiWeather \u2014 Scene State";
function injectWeatherSceneState(messages, state) {
  const nextMessages = [...messages];
  if (!state) {
    return { messages: nextMessages, breakdown: [] };
  }
  let insertIndex = nextMessages.length;
  const last = nextMessages[nextMessages.length - 1];
  if (last && last.role === "assistant" && !last.__isChatHistory) {
    insertIndex = nextMessages.length - 1;
  }
  nextMessages.splice(insertIndex, 0, {
    role: "system",
    content: buildReadOnlySceneInstruction(state)
  });
  return {
    messages: nextMessages,
    breakdown: [{ messageIndex: insertIndex, name: WEATHER_BREAKDOWN_NAME }]
  };
}
function latestHistoryTag(messages) {
  for (let i = messages.length - 1;i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !message.__isChatHistory)
      continue;
    const content = typeof message.content === "string" ? message.content : message.content.flatMap((part) => ("text" in part) && typeof part.text === "string" ? [part.text] : []).join(`
`);
    const tag = extractLastWeatherTag(content);
    if (tag)
      return tag;
  }
  return null;
}
function injectWeatherInstruction(messages, instruction, state) {
  const firstSystemIndex = messages.findIndex((message) => message.role === "system");
  const messageIndex = firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0;
  const nextMessages = [...messages];
  nextMessages.splice(messageIndex, 0, { role: "system", content: instruction });
  const breakdown = [{ messageIndex, name: WEATHER_INSTRUCTIONS_BREAKDOWN_NAME }];
  const tag = latestHistoryTag(messages);
  if (state && (state.source === "manual" || !tag || !hasSameStoryScene(normalizeWeatherTag(tag.attrs, state), state))) {
    breakdown.push({ messageIndex: nextMessages.length, name: WEATHER_BREAKDOWN_NAME });
    nextMessages.push({ role: "system", content: buildSceneInstruction(state) });
  }
  return { messages: nextMessages, breakdown };
}

// src/sidecar-extractor.ts
var MAX_TURN_CHARS = 2400;
function truncateTurnText(text, maxChars = MAX_TURN_CHARS) {
  const cleaned = stripWeatherStateTags(text).trim();
  if (cleaned.length <= maxChars)
    return cleaned;
  const head = Math.floor(maxChars * 0.4);
  const tail = maxChars - head - 5;
  return `${cleaned.slice(0, head).trimEnd()}
...
${cleaned.slice(-tail).trimStart()}`;
}
function buildSidecarSystemPrompt() {
  return [
    "You are a silent story-scene tracker for a weather and time HUD.",
    "Given the previous scene state and the latest story messages, output ONLY a single raw JSON object with the updated scene state.",
    "Do not wrap the JSON in markdown fences, explanations, or commentary.",
    "",
    "Rules:",
    "- Copy every previous field unchanged unless the latest story text clearly changes it.",
    '- If a previous state already exists with a non-empty forecast and nothing changed in the latest messages (including time), you may return {"unchanged": true}.',
    "- Treat date and time as story continuity, NOT real-world wall-clock time. Brief dialogue or quick actions keep the exact same time; only advance time for narrated waits, travel, sleep, or explicit time skips.",
    "- When no previous state exists, establish a plausible initial scene (location, date, time, condition, summary, temperature, intensity, wind, windDirection, palette, season, exposure, phenomenon, forecast) grounded in the narrative.",
    "- Always maintain a 3-day fictional forecast (up to 5 days) with real YYYY-MM-DD dates strictly after the current date, keeping existing future forecast entries unchanged unless the story alters them and rolling past days off when the date advances.",
    "- Track exposure carefully: outdoor (open air), sheltered (porch/canopy/awning/veranda), indoor (inside a building/room/vehicle), underground (cave/dungeon/cellar/tunnel).",
    "",
    "JSON schema (omit unchanged fields if returning a delta, or include all fields):",
    "{",
    '  "location": "short place name",',
    '  "date": "YYYY-MM-DD",',
    '  "time": "h:mm AM/PM",',
    `  "condition": "${WEATHER_CONDITIONS.join(" | ")}",`,
    '  "summary": "brief atmospheric phrase (max 80 chars)",',
    '  "temperature": "integer + F or C (e.g. 64F or 18C)",',
    '  "intensity": 0.0 to 1.0,',
    '  "wind": "short wind description (e.g. still, light breeze, strong gusts)",',
    `  "windDirection": "${WEATHER_WIND_DIRECTIONS.join(" | ")}",`,
    `  "palette": "${WEATHER_PALETTES.join(" | ")}",`,
    `  "season": "${WEATHER_SEASONS.join(" | ")}",`,
    `  "exposure": "${WEATHER_EXPOSURES.join(" | ")}",`,
    `  "phenomenon": "${WEATHER_PHENOMENA.join(" | ")}",`,
    '  "forecast": [{ "date": "YYYY-MM-DD", "condition": "rain", "temperature": "60F", "summary": "brief outlook" }]',
    "}"
  ].join(`
`);
}
function serializePreviousState(state) {
  if (!state)
    return "None (establish the initial scene from the story excerpt below).";
  return JSON.stringify({
    location: state.location,
    date: state.date,
    time: state.time,
    condition: state.condition,
    summary: state.summary,
    temperature: state.temperature,
    intensity: Number(state.intensity.toFixed(2)),
    wind: state.wind,
    windDirection: state.windDirection,
    palette: state.palette,
    season: state.season,
    exposure: state.exposure ?? "outdoor",
    phenomenon: state.phenomenon ?? "none",
    forecast: state.forecast.map((entry) => formatForecastEntry(entry))
  });
}
function buildSidecarExtractionMessages(previousState, recentTurns) {
  const formattedTurns = recentTurns.map((turn) => {
    const text = truncateTurnText(turn.content);
    if (!text)
      return null;
    const speaker = turn.name?.trim() || (turn.role === "user" ? "User" : "Assistant");
    return `[${speaker} (${turn.role})]
${text}`;
  }).filter((entry) => entry !== null);
  const userContent = [
    `Previous scene state:
${serializePreviousState(previousState)}`,
    "",
    "Latest story excerpt:",
    formattedTurns.length > 0 ? formattedTurns.join(`

`) : "(empty)",
    "",
    "Return ONLY the JSON object."
  ].join(`
`);
  return [
    { role: "system", content: buildSidecarSystemPrompt() },
    { role: "user", content: userContent }
  ];
}
function flattenContent(value) {
  if (typeof value === "string")
    return value;
  if (Array.isArray(value)) {
    const parts = value.map((part) => {
      if (typeof part === "string")
        return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    }).filter(Boolean);
    return parts.length > 0 ? parts.join(`
`) : null;
  }
  return null;
}
function extractTextFromGenerationResult(raw) {
  if (typeof raw === "string")
    return raw;
  if (!raw || typeof raw !== "object")
    return null;
  const record = raw;
  const direct = flattenContent(record.content) ?? flattenContent(record.text) ?? flattenContent(record.output);
  if (direct !== null)
    return direct;
  if (record.message && typeof record.message === "object") {
    const msgContent = flattenContent(record.message.content);
    if (msgContent !== null)
      return msgContent;
  }
  if (Array.isArray(record.choices) && record.choices.length > 0) {
    const first = record.choices[0];
    if (first && typeof first === "object") {
      const choiceText = flattenContent(first.text) ?? (first.message && typeof first.message === "object" ? flattenContent(first.message.content) : null);
      if (choiceText !== null)
        return choiceText;
    }
  }
  if (record.result !== undefined) {
    return extractTextFromGenerationResult(record.result);
  }
  return null;
}
function extractJsonObject(rawText) {
  const withoutThinking = rawText.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "").trim();
  const unfenced = withoutThinking.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const tryParse = (candidate) => {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(unfenced);
  if (direct)
    return direct;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0;i < unfenced.length; i += 1) {
    const ch = unfenced[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0)
        start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const parsed = tryParse(unfenced.slice(start, i + 1));
        if (parsed)
          return parsed;
        start = -1;
      }
    }
  }
  return null;
}
function parseSidecarExtractionResponse(rawResponse, previousState, updatedAt = Date.now()) {
  const text = extractTextFromGenerationResult(rawResponse);
  if (!text)
    return null;
  const parsed = extractJsonObject(text);
  if (!parsed)
    return null;
  if (parsed.unchanged === true && previousState) {
    return {
      ...previousState,
      updatedAt,
      source: "story"
    };
  }
  const cleaned = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "unchanged" || value === null || value === undefined)
      continue;
    cleaned[key] = value;
  }
  if (Object.keys(cleaned).length === 0) {
    return previousState ? { ...previousState, updatedAt, source: "story" } : null;
  }
  const normalized = normalizeWeatherState({ ...cleaned, updatedAt, source: "story" }, previousState);
  const derived = seasonFromStoryDate(normalized.date, normalized.time);
  if (normalized.seasonOverride && normalized.seasonOverride === derived && !previousState?.seasonOverride) {
    normalized.seasonOverride = null;
  }
  return normalized;
}

// src/tag-dedupe.ts
function buildTagDedupeKey(attrs) {
  const normalized = [];
  for (const key of Object.keys(attrs)) {
    const namespacedKey = key.trim().toLowerCase();
    if (!namespacedKey)
      continue;
    const value = typeof attrs[key] === "string" ? attrs[key].trim() : String(attrs[key] ?? "");
    normalized.push([namespacedKey, value]);
  }
  normalized.sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
  return JSON.stringify(normalized);
}

// src/version.ts
var EXTENSION_VERSION = "1.7.0";
var LUMI_STATE_CAPABILITIES = [
  "scene_location",
  "calendar_time",
  "weather_conditions",
  "manual_override",
  "forecast",
  "solar_time",
  "lunar_phase",
  "exposure",
  "phenomenon",
  "visual_tags",
  "ambient_audio"
];

// src/backend.ts
var PREFS_FILE = "weather_prefs.json";
var WEATHER_REVISION_VAR = "lumi_weather_state_revision_v1";
var WEATHER_FORMAT_MACROS = ["story_weather_format", "weather_format"];
var WEATHER_TRACKER_MACROS = ["story_weather_tracker", "weather_tracker", "story_weather"];
var WEATHER_STATE_MACROS = ["story_weather_state", "weather_state"];
var WEATHER_VISUAL_TAGS_MACROS = ["story_weather_visual_tags", "weather_visual_tags"];
var TAG_DEDUPE_TTL_MS = 10 * 60 * 1000;
var HISTORY_RECONCILE_DELAY_MS = 150;
var sessions = new Map;
var processedTags = new Map;
var historyReconcileTimers = new Map;
var operationQueues = new Map;
var activeExtractions = new Map;
var suppressedMetadataEdits = new Map;
var METADATA_EDIT_SUPPRESS_MS = 2500;
var SIDECAR_TIMEOUT_MS = 25000;
function extractUserId(payload) {
  if (!payload || typeof payload !== "object")
    return null;
  const value = payload;
  const candidates = [value.userId, value.user_id];
  const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof found === "string" ? found : null;
}
function resolveUsersForChat(chatId, explicitUserId) {
  if (explicitUserId)
    return [explicitUserId];
  const matched = [...sessions.entries()].filter(([, session]) => session.activeChatId === chatId).map(([userId]) => userId);
  if (matched.length > 0)
    return matched;
  return sessions.size === 1 ? [...sessions.keys()] : [];
}
function cancelActiveExtraction(chatId) {
  const controller = activeExtractions.get(chatId);
  if (!controller)
    return;
  activeExtractions.delete(chatId);
  try {
    controller.abort();
  } catch {}
}
function isSuppressedMetadataEdit(chatId, messageId) {
  if (!messageId)
    return false;
  const key = `${chatId}:${messageId}`;
  const expiresAt = suppressedMetadataEdits.get(key);
  if (!expiresAt)
    return false;
  if (Date.now() > expiresAt) {
    suppressedMetadataEdits.delete(key);
    return false;
  }
  suppressedMetadataEdits.delete(key);
  return true;
}
async function listConnectionProfiles(userId) {
  if (typeof spindle.connections?.list !== "function")
    return [];
  try {
    const rawProfiles = await spindle.connections.list(userId);
    if (!Array.isArray(rawProfiles))
      return [];
    return rawProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name || profile.model || profile.id,
      provider: profile.provider || "",
      model: profile.model || "",
      isDefault: Boolean(profile.is_default)
    }));
  } catch (error) {
    spindle.log.warn(`LumiWeather could not list connection profiles: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
async function pushConnections(userId) {
  const profiles = await listConnectionProfiles(userId);
  send(userId, { type: "connections", profiles });
}
async function runSerialized(key, operation) {
  const previous = operationQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  operationQueues.set(key, next);
  try {
    return await next;
  } finally {
    if (operationQueues.get(key) === next)
      operationQueues.delete(key);
  }
}
function getSession(userId) {
  const existing = sessions.get(userId);
  if (existing)
    return existing;
  const next = { activeChatId: null, activeChatRequest: 0 };
  sessions.set(userId, next);
  return next;
}
function pruneProcessedTags(now = Date.now()) {
  for (const [key, tag] of processedTags) {
    if (now - tag.timestamp > TAG_DEDUPE_TTL_MS)
      processedTags.delete(key);
  }
}
function clearProcessedChatTags(chatId) {
  for (const [key, tag] of processedTags) {
    if (tag.chatId === chatId)
      processedTags.delete(key);
  }
}
function rememberHistoryTags(userId, chatId, messages) {
  pruneProcessedTags();
  for (const message of messages) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant" || !message.id || typeof message.content !== "string")
      continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag)
      continue;
    processedTags.set(JSON.stringify([userId, chatId, message.id]), {
      attrs: buildTagDedupeKey(tag.attrs),
      timestamp: Date.now(),
      chatId
    });
  }
}
function pushMacroValues() {
  const formatValue = buildWeatherTagExample();
  const trackerValue = buildTrackerMacro();
  const stateValue = buildStaticStateMacro();
  for (const macroName of WEATHER_FORMAT_MACROS)
    spindle.updateMacroValue(macroName, formatValue);
  for (const macroName of WEATHER_TRACKER_MACROS)
    spindle.updateMacroValue(macroName, trackerValue);
  for (const macroName of WEATHER_STATE_MACROS)
    spindle.updateMacroValue(macroName, stateValue);
  for (const macroName of WEATHER_VISUAL_TAGS_MACROS)
    spindle.updateMacroValue(macroName, "");
}
function extractChatId(payload) {
  if (!payload || typeof payload !== "object")
    return null;
  const value = payload;
  const nestedChat = value.chat && typeof value.chat === "object" ? value.chat : null;
  const candidates = [value.chatId, value.chat_id, nestedChat?.id];
  const chatId = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof chatId === "string" ? chatId : null;
}
function send(userId, message) {
  spindle.sendToFrontend(message, userId);
}
async function loadPrefs(userId) {
  try {
    const stored = await spindle.userStorage.getJson(PREFS_FILE, {
      userId,
      fallback: DEFAULT_PREFS
    });
    return normalizePrefs(stored);
  } catch {
    return normalizePrefs(DEFAULT_PREFS);
  }
}
async function savePrefs(userId, prefs) {
  await spindle.userStorage.setJson(PREFS_FILE, prefs, { userId });
}
async function loadStoryWeatherState(chatId) {
  const raw = await spindle.variables.local.get(chatId, WEATHER_STATE_VAR);
  if (!raw)
    return null;
  try {
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function saveStoryWeatherState(chatId, state) {
  await spindle.variables.local.set(chatId, WEATHER_STATE_VAR, JSON.stringify(state));
}
async function clearStoryWeatherState(chatId) {
  await spindle.variables.local.delete(chatId, WEATHER_STATE_VAR);
}
async function loadManualWeatherState(chatId) {
  const raw = await spindle.variables.local.get(chatId, WEATHER_MANUAL_STATE_VAR);
  if (!raw)
    return null;
  try {
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function saveManualWeatherState(chatId, state) {
  await spindle.variables.local.set(chatId, WEATHER_MANUAL_STATE_VAR, JSON.stringify(state));
}
async function clearManualWeatherState(chatId) {
  await spindle.variables.local.delete(chatId, WEATHER_MANUAL_STATE_VAR);
}
async function loadEffectiveWeatherState(chatId) {
  const storyState = await loadStoryWeatherState(chatId);
  const manualState = await loadManualWeatherState(chatId);
  return selectEffectiveWeatherState(storyState, manualState);
}
async function loadWeatherRevision(chatId) {
  const raw = await spindle.variables.local.get(chatId, WEATHER_REVISION_VAR);
  if (!raw)
    return 0;
  try {
    const parsed = JSON.parse(raw);
    const revision = Number(parsed?.revision);
    return Number.isFinite(revision) ? Math.max(0, Math.round(revision)) : 0;
  } catch {
    return 0;
  }
}
async function bumpWeatherRevision(chatId) {
  const current = await loadWeatherRevision(chatId);
  const revision = Math.max(Date.now(), current + 1);
  await spindle.variables.local.set(chatId, WEATHER_REVISION_VAR, JSON.stringify({ schemaVersion: 1, revision }));
  return revision;
}
async function publishWeatherState(chatId, state, revision, userId, activeChatRequest) {
  const resolvedState = chatId ? state === undefined ? await loadEffectiveWeatherState(chatId) : state : null;
  const storedRevision = chatId ? revision ?? await loadWeatherRevision(chatId) : 0;
  const resolvedRevision = storedRevision || resolvedState?.updatedAt || 0;
  if (userId !== undefined) {
    const session = getSession(userId);
    if (session.activeChatId !== chatId)
      return;
    if (activeChatRequest !== undefined && session.activeChatRequest !== activeChatRequest)
      return;
  }
  const visualTags = buildWeatherVisualTags(resolvedState);
  for (const macroName of WEATHER_VISUAL_TAGS_MACROS) {
    spindle.updateMacroValue(macroName, visualTags);
  }
  spindle.rpcPool.sync("state.current", makeWeatherLumiStateSnapshot(chatId, resolvedState, resolvedRevision, EXTENSION_VERSION), { requires: [] });
}
async function reconcileStoryWeatherState(userId, chatId, notifyFrontend = true, history) {
  const previousStory = await loadStoryWeatherState(chatId);
  const messages = history ?? await spindle.chat.getMessages(chatId);
  const rebuiltStory = rebuildStoryWeatherState(messages, previousStory?.updatedAt);
  const unchanged = hasSameStoryScene(previousStory, rebuiltStory) && previousStory?.updatedAt === rebuiltStory?.updatedAt;
  const nextStory = unchanged ? previousStory : rebuiltStory;
  const changed = nextStory !== previousStory;
  if (changed) {
    if (nextStory)
      await saveStoryWeatherState(chatId, nextStory);
    else
      await clearStoryWeatherState(chatId);
    clearProcessedChatTags(chatId);
  }
  const effective = await loadManualWeatherState(chatId) ?? nextStory;
  const revision = changed ? await bumpWeatherRevision(chatId) : await loadWeatherRevision(chatId);
  rememberHistoryTags(userId, chatId, messages);
  if (notifyFrontend) {
    await publishWeatherState(chatId, effective, revision, userId);
    if (getSession(userId).activeChatId === chatId) {
      send(userId, { type: "active_chat_state", chatId, state: effective });
    }
  }
  return effective;
}
function scheduleStoryWeatherReconcile(userId, chatId) {
  const key = `${userId}:${chatId}`;
  const existing = historyReconcileTimers.get(key);
  if (existing)
    clearTimeout(existing);
  historyReconcileTimers.set(key, setTimeout(() => {
    historyReconcileTimers.delete(key);
    runSerialized(`chat:${chatId}`, () => reconcileStoryWeatherState(userId, chatId)).catch((error) => {
      spindle.log.warn(`LumiWeather history reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, HISTORY_RECONCILE_DELAY_MS));
}
async function resolveActiveChatId(userId, candidate) {
  const session = getSession(userId);
  if (typeof candidate === "string" && candidate.trim()) {
    session.activeChatId = candidate;
    return candidate;
  }
  if (candidate === null) {
    session.activeChatId = null;
    return null;
  }
  if (session.activeChatId)
    return session.activeChatId;
  try {
    const activeChatRequest = session.activeChatRequest;
    const active = await spindle.chats.getActive(userId);
    if (session.activeChatRequest !== activeChatRequest)
      return session.activeChatId;
    session.activeChatId = active?.id ?? null;
    return session.activeChatId;
  } catch {
    return null;
  }
}
async function resolveWeatherEditChatId(userId, candidate) {
  if (typeof candidate === "string" && candidate.trim())
    return candidate;
  if (candidate === null)
    return null;
  return resolveActiveChatId(userId);
}
async function pushActiveChatState(userId, explicitChatId, requestId) {
  const session = getSession(userId);
  const activeChatRequest = ++session.activeChatRequest;
  const chatId = await resolveActiveChatId(userId, explicitChatId);
  if (session.activeChatRequest !== activeChatRequest)
    return;
  if (!chatId) {
    await publishWeatherState(null, null, 0, userId, activeChatRequest);
    send(userId, { type: "active_chat_state", chatId: null, state: null, requestId });
    return;
  }
  await runSerialized(`chat:${chatId}`, async () => {
    let state;
    try {
      state = await reconcileStoryWeatherState(userId, chatId, false);
    } catch (error) {
      spindle.log.warn(`LumiWeather could not verify chat history: ${error instanceof Error ? error.message : String(error)}`);
      state = await loadEffectiveWeatherState(chatId);
    }
    await publishWeatherState(chatId, state, undefined, userId, activeChatRequest);
    if (session.activeChatRequest !== activeChatRequest || session.activeChatId !== chatId)
      return;
    send(userId, {
      type: "active_chat_state",
      chatId,
      state,
      requestId
    });
  });
}
spindle.frontendCapabilities?.declare("message_tag_interceptor");
spindle.rpcPool.sync("contract.v1", {
  schemaVersion: 1,
  protocol: "lumi_state.v1",
  extension: "lumi_weather",
  extensionVersion: EXTENSION_VERSION,
  capabilities: [...LUMI_STATE_CAPABILITIES],
  endpoints: { public: "lumi_weather.state.current" },
  channels: [{
    endpoint: "lumi_weather.state.current",
    schema: "lumi_state.snapshot.v1",
    visibility: "public",
    requires: [],
    mode: "sync"
  }]
}, { requires: [] });
publishWeatherState(null);
for (const name of WEATHER_FORMAT_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Example weather-state tag format",
    returnType: "string",
    handler: ""
  });
}
for (const name of WEATHER_TRACKER_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Weather HUD scene tracking instructions",
    returnType: "string",
    handler: ""
  });
}
for (const name of WEATHER_STATE_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Current LumiWeather scene state summary",
    returnType: "string",
    handler: ""
  });
}
for (const name of WEATHER_VISUAL_TAGS_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Comma-separated visual art descriptors for the active weather scene",
    returnType: "string",
    handler: ""
  });
}
pushMacroValues();
function notifyExtractionStatus(chatId, status, userIds, detail) {
  for (const uid of userIds) {
    if (getSession(uid).activeChatId === chatId) {
      send(uid, { type: "extraction_status", chatId, status, detail });
    }
  }
}
async function extractWeatherForChat(options) {
  const { chatId, targetMessageId, fallbackContent, generationType, force = false } = options;
  if (typeof spindle.generate?.quiet !== "function")
    return null;
  const userIds = resolveUsersForChat(chatId, options.userId);
  const primaryUserId = options.userId ?? userIds[0];
  const prefs = await loadPrefs(primaryUserId ?? "");
  if (!force && (prefs.trackingMode ?? "sidecar") !== "sidecar")
    return null;
  cancelActiveExtraction(chatId);
  const controller = new AbortController;
  activeExtractions.set(chatId, controller);
  const timeout = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, SIDECAR_TIMEOUT_MS);
  try {
    const rawMessages = await spindle.chat.getMessages(chatId);
    if (controller.signal.aborted || activeExtractions.get(chatId) !== controller)
      return null;
    const ordered = rawMessages.map((entry, originalIndex) => ({ entry, originalIndex })).sort((left, right) => {
      const leftIndex = Number.isFinite(left.entry.index_in_chat) ? left.entry.index_in_chat : left.originalIndex;
      const rightIndex = Number.isFinite(right.entry.index_in_chat) ? right.entry.index_in_chat : right.originalIndex;
      return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
    }).map(({ entry }) => entry);
    let targetIndex = -1;
    if (targetMessageId) {
      targetIndex = ordered.findIndex((entry) => entry.id === targetMessageId);
    }
    if (targetIndex < 0) {
      for (let i = ordered.length - 1;i >= 0; i -= 1) {
        const entry = ordered[i];
        const role = entry.role ?? (entry.is_user ? "user" : "assistant");
        if (role === "assistant") {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex < 0)
      return null;
    const targetMessage = ordered[targetIndex];
    const targetContent = typeof targetMessage.content === "string" && targetMessage.content.trim() ? targetMessage.content : fallbackContent ?? "";
    if (!force && targetContent && extractLastWeatherTag(targetContent)) {
      return null;
    }
    const messagesBeforeTarget = ordered.slice(0, targetIndex);
    const priorFromHistory = rebuildStoryWeatherState(messagesBeforeTarget);
    const isRewrite = generationType === "swipe" || generationType === "regenerate";
    const previousState = priorFromHistory ?? (!isRewrite ? await loadStoryWeatherState(chatId) : null);
    const recentTurns = [];
    for (let i = Math.max(0, targetIndex - 2);i <= targetIndex; i += 1) {
      const entry = ordered[i];
      const role = entry.role ?? (entry.is_user ? "user" : "assistant");
      if (role !== "user" && role !== "assistant")
        continue;
      const content = i === targetIndex ? targetContent : typeof entry.content === "string" ? entry.content : "";
      if (!content.trim())
        continue;
      recentTurns.push({ role, name: entry.name, content });
    }
    if (recentTurns.length === 0)
      return null;
    notifyExtractionStatus(chatId, "running", userIds);
    const parameters = { temperature: 0.1, max_tokens: 450 };
    if (prefs.sidecarModel) {
      parameters.model = prefs.sidecarModel;
    }
    const rawResult = await spindle.generate.quiet({
      type: "quiet",
      messages: buildSidecarExtractionMessages(previousState, recentTurns),
      connection_id: prefs.sidecarConnectionId || undefined,
      reasoning: { source: "off" },
      parameters,
      userId: primaryUserId || undefined,
      signal: controller.signal
    });
    if (controller.signal.aborted || activeExtractions.get(chatId) !== controller)
      return null;
    const messageTimestamp = resolveMessageTimestamp(targetMessage) ?? Date.now();
    const extracted = parseSidecarExtractionResponse(rawResult, previousState, messageTimestamp);
    if (!extracted) {
      spindle.log.warn("LumiWeather sidecar returned an unparseable response; keeping previous scene state.");
      notifyExtractionStatus(chatId, "error", userIds, "Could not parse sidecar response");
      return null;
    }
    let finalEffective = null;
    await runSerialized(`chat:${chatId}`, async () => {
      if (controller.signal.aborted || activeExtractions.get(chatId) !== controller)
        return;
      if (targetMessage.id && typeof spindle.chat?.updateMessage === "function") {
        try {
          const nextMetadata = buildMessageWeatherMetadata(targetMessage.metadata, targetMessage.swipe_id, extracted);
          suppressedMetadataEdits.set(`${chatId}:${targetMessage.id}`, Date.now() + METADATA_EDIT_SUPPRESS_MS);
          await spindle.chat.updateMessage(chatId, targetMessage.id, {
            metadata: nextMetadata,
            skipChunkRebuild: true
          });
        } catch (error) {
          suppressedMetadataEdits.delete(`${chatId}:${targetMessage.id}`);
          spindle.log.warn(`LumiWeather could not save per-message metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const previousStored = await loadStoryWeatherState(chatId);
      const changed = !hasSameStoryScene(previousStored, extracted) || previousStored?.updatedAt !== extracted.updatedAt;
      if (changed) {
        await saveStoryWeatherState(chatId, extracted);
      }
      const revision = changed ? await bumpWeatherRevision(chatId) : await loadWeatherRevision(chatId);
      const effective = await loadManualWeatherState(chatId) ?? extracted;
      finalEffective = effective;
      if (userIds.length > 0) {
        for (const uid of userIds) {
          await publishWeatherState(chatId, effective, revision, uid);
          if (getSession(uid).activeChatId === chatId) {
            send(uid, { type: "weather_state", chatId, state: effective });
          }
        }
      } else {
        await publishWeatherState(chatId, effective, revision);
      }
      notifyExtractionStatus(chatId, "idle", userIds);
    });
    return finalEffective;
  } catch (error) {
    if (controller.signal.aborted || error instanceof Error && error.name === "AbortError") {
      notifyExtractionStatus(chatId, "idle", userIds);
      return null;
    }
    const reason = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWeather sidecar extraction failed: ${reason}`);
    notifyExtractionStatus(chatId, "error", userIds, reason);
    return null;
  } finally {
    clearTimeout(timeout);
    if (activeExtractions.get(chatId) === controller) {
      activeExtractions.delete(chatId);
    }
  }
}
spindle.registerInterceptor(async (messages, context) => {
  const chatId = extractChatId(context);
  const state = chatId ? await loadEffectiveWeatherState(chatId) : null;
  const userId = extractUserId(context) ?? (chatId ? resolveUsersForChat(chatId)[0] : undefined);
  const prefs = await loadPrefs(userId ?? "");
  if ((prefs.trackingMode ?? "sidecar") === "sidecar") {
    return injectWeatherSceneState(messages, state);
  }
  const instruction = buildPromptInstruction();
  return injectWeatherInstruction(messages, instruction, state);
}, 100);
var onEvent = spindle.on;
onEvent("GENERATION_ENDED", (payload, eventUserId) => {
  if (!payload || typeof payload !== "object")
    return;
  const event = payload;
  if (event.error || event.generationType === "impersonate")
    return;
  const chatId = typeof event.chatId === "string" && event.chatId.trim() ? event.chatId : null;
  if (!chatId)
    return;
  extractWeatherForChat({
    chatId,
    userId: eventUserId,
    targetMessageId: event.messageId,
    fallbackContent: event.content,
    generationType: event.generationType
  });
});
for (const event of ["MESSAGE_EDITED", "MESSAGE_DELETED", "MESSAGE_SWIPED", "SWIPE_EDITED"]) {
  onEvent(event, (payload, eventUserId) => {
    const value = payload && typeof payload === "object" ? payload : {};
    const chatId = extractChatId(payload) ?? extractChatId(value.message);
    if (!chatId)
      return;
    const msgObj = value.message && typeof value.message === "object" ? value.message : null;
    const messageId = typeof value.messageId === "string" ? value.messageId : typeof value.message_id === "string" ? value.message_id : typeof msgObj?.id === "string" ? msgObj.id : null;
    if (event === "MESSAGE_EDITED" && isSuppressedMetadataEdit(chatId, messageId)) {
      return;
    }
    const userIds = resolveUsersForChat(chatId, eventUserId);
    for (const userId of userIds) {
      if (getSession(userId).activeChatId === chatId)
        scheduleStoryWeatherReconcile(userId, chatId);
    }
  });
}
spindle.onFrontendMessage(async (raw, userId) => {
  const message = raw;
  try {
    switch (message.type) {
      case "frontend_ready":
        await pushActiveChatState(userId);
        await runSerialized(`prefs:${userId}`, async () => {
          send(userId, { type: "prefs", prefs: await loadPrefs(userId) });
        });
        await pushConnections(userId);
        break;
      case "refresh_connections":
        await pushConnections(userId);
        break;
      case "extract_now": {
        const chatId = await resolveWeatherEditChatId(userId, message.chatId);
        if (!chatId) {
          send(userId, { type: "error", message: "Open a chat before analyzing its weather scene." });
          break;
        }
        await extractWeatherForChat({ chatId, userId, force: true });
        break;
      }
      case "chat_changed":
        await pushActiveChatState(userId, message.chatId, message.requestId);
        break;
      case "weather_tag_intercepted": {
        if (message.isStreaming)
          break;
        const chatId = typeof message.chatId === "string" && message.chatId.trim() ? message.chatId : await resolveActiveChatId(userId);
        if (!chatId) {
          send(userId, { type: "error", message: "Weather tag ignored because no active chat could be resolved." });
          spindle.toast.warning("A weather tag was ignored because no active chat could be resolved.", {
            title: "LumiWeather",
            userId
          });
          break;
        }
        await runSerialized(`chat:${chatId}`, async () => {
          pruneProcessedTags();
          const messageId = typeof message.messageId === "string" && message.messageId.trim() ? message.messageId : null;
          const tagKey = messageId ? JSON.stringify([userId, chatId, messageId]) : null;
          const attrs = buildTagDedupeKey(message.attrs);
          if (tagKey && processedTags.get(tagKey)?.attrs === attrs)
            return;
          let history = null;
          if (messageId) {
            try {
              const messages = await spindle.chat.getMessages(chatId);
              if (messages.some((entry) => entry.id === messageId))
                history = messages;
            } catch (error) {
              spindle.log.warn(`LumiWeather could not verify intercepted message history: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          if (history) {
            const effective = await reconcileStoryWeatherState(userId, chatId, false, history);
            await publishWeatherState(chatId, effective, undefined, userId);
            send(userId, effective ? { type: "weather_state", chatId, state: effective } : { type: "active_chat_state", chatId, state: null });
            return;
          }
          const previousStory = await loadStoryWeatherState(chatId);
          const nextStory = normalizeWeatherTag(message.attrs, previousStory);
          await saveStoryWeatherState(chatId, nextStory);
          const revision = await bumpWeatherRevision(chatId);
          const effective = await loadManualWeatherState(chatId) ?? nextStory;
          await publishWeatherState(chatId, effective, revision, userId);
          if (tagKey)
            processedTags.set(tagKey, { attrs, timestamp: Date.now(), chatId });
          send(userId, { type: "weather_state", chatId, state: effective });
        });
        break;
      }
      case "set_manual_state": {
        const chatId = await resolveWeatherEditChatId(userId, message.chatId);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not resolve an active chat." });
          spindle.toast.warning("Open a chat before locking a weather scene.", {
            title: "LumiWeather",
            userId
          });
          break;
        }
        await runSerialized(`chat:${chatId}`, async () => {
          const previous = await loadManualWeatherState(chatId) ?? await loadStoryWeatherState(chatId) ?? makeDefaultWeatherState();
          const nextState = applyManualWeatherState(previous, message.state);
          await saveManualWeatherState(chatId, nextState);
          const revision = await bumpWeatherRevision(chatId);
          await publishWeatherState(chatId, nextState, revision, userId);
          send(userId, { type: "weather_state", chatId, state: nextState });
        });
        break;
      }
      case "clear_manual_override": {
        const chatId = await resolveWeatherEditChatId(userId, message.chatId);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not be cleared because no chat is active." });
          break;
        }
        await runSerialized(`chat:${chatId}`, async () => {
          await clearManualWeatherState(chatId);
          const revision = await bumpWeatherRevision(chatId);
          const storyState = await loadStoryWeatherState(chatId);
          await publishWeatherState(chatId, storyState, revision, userId);
          send(userId, {
            type: "active_chat_state",
            chatId,
            state: storyState
          });
        });
        break;
      }
      case "save_prefs": {
        await runSerialized(`prefs:${userId}`, async () => {
          const currentPrefs = await loadPrefs(userId);
          const nextPrefs = normalizePrefs({ ...currentPrefs, ...message.prefs });
          await savePrefs(userId, nextPrefs);
          send(userId, { type: "prefs", prefs: nextPrefs });
        });
        break;
      }
      case "reset_widget_position": {
        await runSerialized(`prefs:${userId}`, async () => {
          const currentPrefs = await loadPrefs(userId);
          const nextPrefs = normalizePrefs({ ...currentPrefs, widgetPosition: null });
          await savePrefs(userId, nextPrefs);
          send(userId, { type: "prefs", prefs: nextPrefs });
        });
        break;
      }
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    spindle.log.error(`Weather HUD error: ${messageText}`);
    send(userId, { type: "error", message: messageText || "Unknown Weather HUD error." });
  }
});
