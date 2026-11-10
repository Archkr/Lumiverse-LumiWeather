// src/time-utils.ts
var TIME_PHASE_PALETTES = ["dawn", "day", "dusk", "night"];
var DEFAULT_LATITUDE = 45;
var DAY_MS = 86400000;
var toRadians = (degrees) => degrees * Math.PI / 180;
var toDegrees = (radians) => radians * 180 / Math.PI;
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
function resolveSolarDeclination(dayOfYear) {
  const clamped = Math.min(Math.max(dayOfYear, 1), 366);
  return 23.44 * Math.sin(toRadians(360 / 365 * (clamped - 81)));
}
function resolveDayHalfAngle(latitude, declination) {
  const cosHourAngle = -Math.tan(toRadians(latitude)) * Math.tan(toRadians(declination));
  if (!Number.isFinite(cosHourAngle) || cosHourAngle >= 1 || cosHourAngle <= -1)
    return null;
  return toDegrees(Math.acos(cosHourAngle));
}
function resolvePolarState(latitude, declination) {
  const cosHourAngle = -Math.tan(toRadians(latitude)) * Math.tan(toRadians(declination));
  if (!Number.isFinite(cosHourAngle))
    return null;
  if (cosHourAngle <= -1)
    return "day";
  if (cosHourAngle >= 1)
    return "night";
  return null;
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
function resolveSolarArc(dateValue, timeValue, latitude = DEFAULT_LATITUDE) {
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp === null) {
    return { phase: "day", sunAltitude: 0, season: "spring" };
  }
  const when = new Date(timestamp);
  const dayOfYear = resolveDayOfYear(timestamp) ?? 1;
  const declination = resolveSolarDeclination(dayOfYear);
  const polar = resolvePolarState(latitude, declination);
  const halfAngle = resolveDayHalfAngle(latitude, declination);
  const hourFraction = (when.getUTCHours() + when.getUTCMinutes() / 60 + when.getUTCSeconds() / 3600) / 24;
  const sunAltitude = 90 * Math.cos(2 * Math.PI * (hourFraction - 0.5));
  const season = resolveSeasonFromDayOfYear(dayOfYear);
  if (polar === "day" || polar === "night") {
    return { phase: polar, sunAltitude, season };
  }
  const halfDayFraction = (halfAngle ?? 0) / 360;
  const twilight = Math.min(0.02 + halfDayFraction * 0.16, 0.06);
  const dawnStart = 0.5 - halfDayFraction - twilight;
  const sunriseEnd = 0.5 - halfDayFraction + twilight;
  const sunsetStart = 0.5 + halfDayFraction - twilight;
  const duskEnd = 0.5 + halfDayFraction + twilight;
  let phase;
  if (hourFraction < dawnStart || hourFraction >= duskEnd)
    phase = "night";
  else if (hourFraction < sunriseEnd)
    phase = "dawn";
  else if (hourFraction < sunsetStart)
    phase = "day";
  else
    phase = "dusk";
  return { phase, sunAltitude, season };
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
  return `${collapsed.slice(0, MAX_FORECAST_SUMMARY_LENGTH - 1).trimEnd()}…`;
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
function formatForecastEntry(entry) {
  const keepEmptyTemperature = !entry.temperature && !!normalizeTemperatureToken(entry.summary.split(",")[0]);
  const details = keepEmptyTemperature ? `${entry.condition}, , ${entry.summary}` : [entry.condition, entry.temperature, entry.summary].filter(Boolean).join(", ");
  return details ? `${entry.date}: ${details}` : entry.date;
}
// src/shared.ts
var WEATHER_TAG_NAME = "weather-state";
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
var WEATHER_SEASONS = ["spring", "summer", "autumn", "winter"];
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
  soundEnabled: false,
  soundVolume: 0.45
};
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
function formatTemperatureForUnit(value, unit) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F(?:ahrenheit)?|C(?:elsius)?)$/i);
  if (!match)
    return trimmed;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount))
    return trimmed;
  const sourceUnit = match[2][0].toUpperCase() === "C" ? "celsius" : "fahrenheit";
  if (sourceUnit === unit) {
    return `${Math.round(amount)}${unit === "celsius" ? "C" : "F"}`;
  }
  const converted = unit === "celsius" ? (amount - 32) * (5 / 9) : amount * (9 / 5) + 32;
  return `${Math.round(converted)}${unit === "celsius" ? "C" : "F"}`;
}

// src/fx-utils.ts
function resolveRainProfile(intensity, condition) {
  const rainLike = condition === "rain" || condition === "storm";
  if (!rainLike) {
    return { density: 0, opacityScale: 0, speedScale: 1 };
  }
  const normalizedIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1.5);
  const densityIntensity = clamp(normalizedIntensity, 0, 1);
  const stormBoost = condition === "storm" ? 0.08 : 0;
  return {
    density: clamp(0.15 + 0.9 * densityIntensity + stormBoost, 0.15, 1),
    opacityScale: clamp(0.42 + 0.76 * densityIntensity + stormBoost, 0.25, 1.12),
    speedScale: clamp(1.12 - 0.24 * densityIntensity - stormBoost, 0.76, 1.12)
  };
}
function directionFromSource(source) {
  if (source.includes("west"))
    return 1;
  if (source.includes("east"))
    return -1;
  return 0;
}
function resolveRainVector(wind, windDirection) {
  const normalized = wind.trim().toLowerCase();
  const strength = /hurricane|violent|gale|hard|strong|gust/.test(normalized) ? 20 : /steady|breezy|windy|crosswind/.test(normalized) ? 14 : /light|soft|cool drift/.test(normalized) ? 9 : /still|calm|hushed/.test(normalized) ? 4 : 11;
  let driftDirection;
  if (windDirection === "none" || windDirection === "north" || windDirection === "south") {
    driftDirection = 0;
  } else if (windDirection) {
    driftDirection = directionFromSource(windDirection);
  } else {
    const target = normalized.match(/\b(?:to|toward|towards|blowing)\s+(?:the\s+)?(left|right|east|west)\b/)?.[1];
    if (target === "right" || target === "east") {
      driftDirection = 1;
    } else if (target === "left" || target === "west") {
      driftDirection = -1;
    } else {
      const source = normalized.match(/\bfrom\s+(?:the\s+)?(northeast|northwest|southeast|southwest|north|south|east|west)\b/)?.[1];
      if (source) {
        driftDirection = directionFromSource(source);
      } else if (/\b(?:eastward|rightward)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:westward|leftward)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:westerly|western wind|west wind|northwest|southwest)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:easterly|eastern wind|east wind|northeast|southeast)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:left)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:right)\b/.test(normalized)) {
        driftDirection = 1;
      } else {
        driftDirection = -1;
      }
    }
  }
  return {
    angle: driftDirection === 0 ? 0 : driftDirection > 0 ? -strength : strength,
    driftDirection
  };
}

// src/atmosphere-engine.ts
function parseCssColorToRgba(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
      const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
      const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
      return [
        Number.isFinite(r) ? r : 0,
        Number.isFinite(g) ? g : 0,
        Number.isFinite(b) ? b : 0,
        1
      ];
    }
    if (hex.length >= 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      return [
        Number.isFinite(r) ? r : 0,
        Number.isFinite(g) ? g : 0,
        Number.isFinite(b) ? b : 0,
        1
      ];
    }
  }
  const match = trimmed.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (match) {
    const r = clamp(Number.parseFloat(match[1]) / 255, 0, 1);
    const g = clamp(Number.parseFloat(match[2]) / 255, 0, 1);
    const b = clamp(Number.parseFloat(match[3]) / 255, 0, 1);
    const a = match[4] !== undefined ? clamp(Number.parseFloat(match[4]), 0, 1) : 1;
    return [r, g, b, a];
  }
  return [0.5, 0.6, 0.75, 1];
}
function resolveWindSpeedScalar(wind) {
  const normalized = wind.trim().toLowerCase();
  if (/hurricane|violent|gale|hard|strong|gust/.test(normalized))
    return 1.85;
  if (/steady|breezy|windy|crosswind|brisk/.test(normalized))
    return 1.15;
  if (/light|soft|cool drift|gentle/.test(normalized))
    return 0.65;
  if (/still|calm|hushed|none/.test(normalized))
    return 0.25;
  return 0.85;
}
function resolveAtmosphereUniformTarget(state, tokens, prefs, kind) {
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const rainVector = resolveRainVector(state.wind, state.windDirection);
  const solar = resolveSolarArc(state.date, state.time);
  const lunar = resolveLunarPhase(state.date, state.time);
  const exposure = state.exposure ?? "outdoor";
  const phenomenon = state.phenomenon ?? "none";
  const isFront = kind === "front";
  const isBoth = prefs.layerMode === "both";
  const windSpeed = resolveWindSpeedScalar(state.wind);
  const windDirSign = rainVector.driftDirection === 0 ? 0.35 : rainVector.driftDirection;
  const windVelocityX = windSpeed * windDirSign * (exposure === "indoor" ? 0.35 : exposure === "underground" ? 0.15 : 1);
  const renderAtmosphereShader = !isFront || !isBoth;
  return {
    bgStart: parseCssColorToRgba(tokens.bgStart),
    bgMid: parseCssColorToRgba(tokens.bgMid),
    bgEnd: parseCssColorToRgba(tokens.bgEnd),
    glow: parseCssColorToRgba(tokens.glow),
    beamColor: parseCssColorToRgba(tokens.beamColor),
    horizonColor: parseCssColorToRgba(tokens.horizonColor),
    cloudCore: parseCssColorToRgba(tokens.cloudCore),
    cloudEdge: parseCssColorToRgba(tokens.cloudEdge),
    fogColor: parseCssColorToRgba(tokens.fogColor),
    mistColor: parseCssColorToRgba(tokens.mistColor),
    skyOpacity: isFront && isBoth ? 0 : tokens.skyOpacity,
    glowOpacity: isFront ? 0 : tokens.glowOpacity,
    beamOpacity: isFront ? 0 : tokens.beamOpacity,
    cloudOpacity: isFront && isBoth ? 0 : tokens.cloudOpacity,
    horizonOpacity: isFront && isBoth ? 0 : tokens.horizonOpacity,
    mistOpacity: isFront && isBoth ? tokens.mistOpacity * 0.35 : tokens.mistOpacity,
    fogOpacity: isFront && isBoth ? tokens.fogOpacity * 0.32 : tokens.fogOpacity,
    rainOpacity: tokens.rainOpacity,
    snowOpacity: tokens.snowOpacity,
    moteOpacity: isFront && isBoth ? tokens.moteOpacity * 0.45 : tokens.moteOpacity,
    starOpacity: isFront && isBoth ? 0 : tokens.starOpacity,
    moonlightOpacity: isFront && isBoth ? 0 : tokens.moonlightOpacity,
    auroraOpacity: isFront && isBoth ? 0 : tokens.auroraOpacity,
    windowDropletOpacity: tokens.windowDropletOpacity,
    phenomenonOpacity: tokens.phenomenonOpacity,
    flashOpacity: tokens.flashOpacity,
    sunAltitude: solar.sunAltitude,
    moonIllumination: lunar.illumination,
    moonPhaseFraction: lunar.cycleFraction,
    windVelocityX,
    windAngleDeg: rainVector.angle,
    rainDensity: rainProfile.density,
    rainSpeedScale: rainProfile.speedScale,
    isSandstorm: phenomenon === "sandstorm" ? 1 : 0,
    isIndoor: exposure === "indoor" ? 1 : 0,
    isUnderground: exposure === "underground" ? 1 : 0,
    renderAtmosphereShader
  };
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpRgba(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t)
  ];
}
function interpolateUniforms(from, to, t) {
  if (t >= 0.999)
    return to;
  if (t <= 0.001)
    return from;
  const ease = t * t * (3 - 2 * t);
  return {
    bgStart: lerpRgba(from.bgStart, to.bgStart, ease),
    bgMid: lerpRgba(from.bgMid, to.bgMid, ease),
    bgEnd: lerpRgba(from.bgEnd, to.bgEnd, ease),
    glow: lerpRgba(from.glow, to.glow, ease),
    beamColor: lerpRgba(from.beamColor, to.beamColor, ease),
    horizonColor: lerpRgba(from.horizonColor, to.horizonColor, ease),
    cloudCore: lerpRgba(from.cloudCore, to.cloudCore, ease),
    cloudEdge: lerpRgba(from.cloudEdge, to.cloudEdge, ease),
    fogColor: lerpRgba(from.fogColor, to.fogColor, ease),
    mistColor: lerpRgba(from.mistColor, to.mistColor, ease),
    skyOpacity: lerp(from.skyOpacity, to.skyOpacity, ease),
    glowOpacity: lerp(from.glowOpacity, to.glowOpacity, ease),
    beamOpacity: lerp(from.beamOpacity, to.beamOpacity, ease),
    cloudOpacity: lerp(from.cloudOpacity, to.cloudOpacity, ease),
    horizonOpacity: lerp(from.horizonOpacity, to.horizonOpacity, ease),
    mistOpacity: lerp(from.mistOpacity, to.mistOpacity, ease),
    fogOpacity: lerp(from.fogOpacity, to.fogOpacity, ease),
    rainOpacity: lerp(from.rainOpacity, to.rainOpacity, ease),
    snowOpacity: lerp(from.snowOpacity, to.snowOpacity, ease),
    moteOpacity: lerp(from.moteOpacity, to.moteOpacity, ease),
    starOpacity: lerp(from.starOpacity, to.starOpacity, ease),
    moonlightOpacity: lerp(from.moonlightOpacity, to.moonlightOpacity, ease),
    auroraOpacity: lerp(from.auroraOpacity, to.auroraOpacity, ease),
    windowDropletOpacity: lerp(from.windowDropletOpacity, to.windowDropletOpacity, ease),
    phenomenonOpacity: lerp(from.phenomenonOpacity, to.phenomenonOpacity, ease),
    flashOpacity: lerp(from.flashOpacity, to.flashOpacity, ease),
    sunAltitude: lerp(from.sunAltitude, to.sunAltitude, ease),
    moonIllumination: lerp(from.moonIllumination, to.moonIllumination, ease),
    moonPhaseFraction: to.moonPhaseFraction,
    windVelocityX: lerp(from.windVelocityX, to.windVelocityX, ease),
    windAngleDeg: lerp(from.windAngleDeg, to.windAngleDeg, ease),
    rainDensity: lerp(from.rainDensity, to.rainDensity, ease),
    rainSpeedScale: lerp(from.rainSpeedScale, to.rainSpeedScale, ease),
    isSandstorm: lerp(from.isSandstorm, to.isSandstorm, ease),
    isIndoor: lerp(from.isIndoor, to.isIndoor, ease),
    isUnderground: lerp(from.isUnderground, to.isUnderground, ease),
    renderAtmosphereShader: to.renderAtmosphereShader
  };
}
var VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;
var FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec4 u_bgStart;
  uniform vec4 u_bgMid;
  uniform vec4 u_bgEnd;
  uniform vec4 u_glow;
  uniform vec4 u_beamColor;
  uniform vec4 u_horizonColor;
  uniform vec4 u_cloudCore;
  uniform vec4 u_cloudEdge;
  uniform vec4 u_fogColor;
  uniform vec4 u_mistColor;

  uniform float u_skyOpacity;
  uniform float u_glowOpacity;
  uniform float u_beamOpacity;
  uniform float u_cloudOpacity;
  uniform float u_horizonOpacity;
  uniform float u_mistOpacity;
  uniform float u_fogOpacity;
  uniform float u_starOpacity;
  uniform float u_moonlightOpacity;
  uniform float u_auroraOpacity;
  uniform float u_moonIllumination;
  uniform float u_moonPhaseFraction;
  uniform float u_windX;
  uniform float u_isSandstorm;
  uniform float u_lightningFlash;
  uniform float u_lightningX;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm2(vec2 p) {
    float v = 0.62 * noise(p);
    p = mat2(0.86, -0.5, 0.5, 0.86) * p * 2.07 + vec2(11.3, 5.7);
    v += 0.38 * noise(p);
    return v;
  }

  float fbm3(vec2 p) {
    float v = 0.54 * noise(p);
    p = mat2(0.86, -0.5, 0.5, 0.86) * p * 2.03 + vec2(11.3, 5.7);
    v += 0.31 * noise(p);
    p = mat2(0.86, 0.5, -0.5, 0.86) * p * 2.01 + vec2(4.1, 9.2);
    v += 0.15 * noise(p);
    return v;
  }

  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / max(1.0, u_resolution.y);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // 1. Sky gradient + solar/horizon scattering
    if (u_skyOpacity > 0.004) {
      float yTop = 1.0 - uv.y;
      vec3 sky = yTop < 0.48
        ? mix(u_bgStart.rgb, u_bgMid.rgb, yTop / 0.48)
        : mix(u_bgMid.rgb, u_bgEnd.rgb, (yTop - 0.48) / 0.52);
      color += sky * u_skyOpacity;
      alpha = max(alpha, u_skyOpacity);
    }

    if (u_horizonOpacity > 0.004) {
      float hMask = smoothstep(0.62, 0.0, uv.y) * u_horizonOpacity * u_horizonColor.a;
      color = mix(color, u_horizonColor.rgb, hMask);
      alpha = max(alpha, hMask);
    }

    // 2. Solar / ambient corona glow & crepuscular god-rays
    if (u_glowOpacity > 0.004) {
      vec2 sunPos = vec2(0.2, 0.82);
      float dSun = length(vec2((uv.x - sunPos.x) * aspect, uv.y - sunPos.y));
      float glowMask = exp(-dSun * 3.1) * u_glowOpacity * u_glow.a;
      color += u_glow.rgb * glowMask;
      alpha = max(alpha, glowMask * 0.85);
    }

    if (u_beamOpacity > 0.004 && uv.y > 0.15) {
      float beamCoord = (uv.x * aspect + uv.y * 0.58) * 5.2 - u_time * 0.04;
      float rays = smoothstep(0.45, 0.92, sin(beamCoord) * 0.5 + 0.5)
        * smoothstep(0.15, 0.95, uv.y)
        * smoothstep(1.0, 0.08, abs(uv.x - 0.28));
      float beamA = rays * u_beamOpacity * u_beamColor.a * 0.65;
      color += u_beamColor.rgb * beamA;
      alpha = max(alpha, beamA * 0.7);
    }

    // 3. Night starfield & astronomical lunar disc
    if (u_starOpacity > 0.005 && uv.y > 0.22) {
      vec2 starGrid = uv * vec2(aspect * 38.0, 38.0);
      vec2 cell = floor(starGrid);
      vec2 local = fract(starGrid) - 0.5;
      float seed = hash21(cell);
      if (seed > 0.89) {
        vec2 jitter = vec2(hash21(cell + 7.1) - 0.5, hash21(cell + 13.7) - 0.5) * 0.62;
        float dist = length(local - jitter);
        float twinkle = 0.65 + 0.35 * sin(u_time * (1.8 + fract(seed * 19.0) * 3.2) + seed * 40.0);
        float star = smoothstep(0.16, 0.015, dist) * twinkle * smoothstep(0.22, 0.65, uv.y);
        vec3 starTint = mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.94, 0.82), fract(seed * 53.0));
        float sAlpha = star * u_starOpacity;
        color += starTint * sAlpha;
        alpha = max(alpha, sAlpha * 0.9);
      }
    }

    if (u_moonlightOpacity > 0.005) {
      vec2 moonCenter = vec2(0.83, 0.82);
      vec2 mp = vec2((uv.x - moonCenter.x) * aspect, uv.y - moonCenter.y);
      float mDist = length(mp);
      float corona = exp(-mDist * 4.2) * u_moonlightOpacity * (0.45 + 0.55 * u_moonIllumination);
      color += vec3(0.68, 0.80, 1.0) * corona * 0.65;
      alpha = max(alpha, corona * 0.55);

      float moonRadius = 0.032;
      if (mDist < moonRadius * 1.15) {
        float disc = smoothstep(moonRadius, moonRadius * 0.88, mDist);
        vec2 normP = mp / moonRadius;
        float z = sqrt(max(0.0, 1.0 - dot(normP, normP)));
        float phaseAngle = u_moonPhaseFraction * 6.2831853;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), 0.08, -cos(phaseAngle)));
        float lit = smoothstep(-0.08, 0.14, dot(vec3(normP.x, normP.y, z), lightDir));
        float moonShade = mix(0.12, 1.0, lit);
        vec3 moonCol = vec3(0.88, 0.93, 1.0) * moonShade;
        float mAlpha = disc * clamp(u_moonlightOpacity * 1.45, 0.0, 0.95);
        color = mix(color, moonCol, mAlpha);
        alpha = max(alpha, mAlpha);
      }
    }

    // 4. Aurora Borealis magnetic curtains
    if (u_auroraOpacity > 0.005 && uv.y > 0.28) {
      float yMask = smoothstep(0.28, 0.62, uv.y) * smoothstep(1.02, 0.72, uv.y);
      float wave1 = sin(p.x * 4.2 + u_time * 0.22 + sin(p.x * 2.1 - u_time * 0.14) * 1.6);
      float curtainX = p.x * 6.5 + wave1 * 1.15 - uv.y * 1.4;
      float streaks = noise(vec2(curtainX * 2.2, uv.y * 1.8 - u_time * 0.08));
      float ribbon = smoothstep(0.32, 0.88, streaks) * yMask;
      vec3 emerald = vec3(0.20, 0.96, 0.66);
      vec3 violet = vec3(0.62, 0.36, 0.98);
      vec3 auroraCol = mix(emerald, violet, smoothstep(0.45, 0.88, uv.y + wave1 * 0.08));
      float aAlpha = ribbon * u_auroraOpacity * 0.82;
      color += auroraCol * aAlpha;
      alpha = max(alpha, aAlpha * 0.75);
    }

    // 5. Volumetric multi-layer clouds
    if (u_cloudOpacity > 0.005 && uv.y > 0.18) {
      float windShift = u_time * 0.022 * u_windX;
      vec2 cloudUv1 = vec2(p.x * 1.65 - windShift, (uv.y - 0.55) * 3.1);
      vec2 cloudUv2 = vec2(p.x * 2.75 - windShift * 1.38 + 4.3, (uv.y - 0.48) * 3.8);
      float c1 = fbm3(cloudUv1);
      float c2 = fbm2(cloudUv2 + vec2(c1 * 0.35, 0.0));
      float cloudHeightMask = smoothstep(0.18, 0.58, uv.y) * smoothstep(1.04, 0.80, uv.y);
      float density = smoothstep(0.38, 0.82, c1 * 0.64 + c2 * 0.46) * cloudHeightMask;

      float topLight = clamp((uv.y - 0.45) * 1.8 + c2 * 0.35, 0.0, 1.0);
      vec3 cColor = mix(u_cloudCore.rgb, u_cloudEdge.rgb, topLight);

      if (u_lightningFlash > 0.01) {
        float lDist = length(vec2((uv.x - u_lightningX) * aspect, uv.y - 0.72));
        float lGlow = exp(-lDist * 3.4) * u_lightningFlash;
        cColor += vec3(0.78, 0.88, 1.0) * lGlow * 1.25;
      }

      float cAlpha = clamp(density * u_cloudOpacity * 1.35, 0.0, 0.92);
      color = mix(color, cColor, cAlpha);
      alpha = max(alpha, cAlpha);
    }

    // 6. Volumetric fog, valley mist & sandstorm veil
    float totalFogOpacity = max(u_fogOpacity, u_mistOpacity * 0.85);
    if (totalFogOpacity > 0.005) {
      float fogSpeed = (0.032 + u_isSandstorm * 0.065) * u_windX;
      vec2 fogUv = vec2(p.x * 2.1 - u_time * fogSpeed, uv.y * 2.6);
      float f1 = fbm2(fogUv);
      float f2 = fbm2(fogUv * 1.7 + vec2(f1 * 0.65, -u_time * 0.018));
      float lowerBias = smoothstep(0.92, 0.06, uv.y);
      float fogField = smoothstep(0.32, 0.82, f1 * 0.55 + f2 * 0.55) * mix(0.45, 1.25, lowerBias);
      vec3 baseFogCol = u_isSandstorm > 0.5
        ? vec3(0.84, 0.66, 0.42)
        : mix(u_mistColor.rgb, u_fogColor.rgb, 0.55);
      float fAlpha = clamp(fogField * totalFogOpacity * 1.25, 0.0, 0.88);
      color = mix(color, baseFogCol, fAlpha);
      alpha = max(alpha, fAlpha);
    }

    // 7. Lightning sky flash
    if (u_lightningFlash > 0.01) {
      float lDist = length(vec2((uv.x - u_lightningX) * aspect, uv.y - 0.78));
      float flashGlow = (exp(-lDist * 2.6) * 0.65 + 0.25) * u_lightningFlash;
      color += vec3(0.84, 0.91, 1.0) * flashGlow;
      alpha = max(alpha, flashGlow * 0.72);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 0.96));
  }
`;
function compileGlShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader)
    throw new Error("Unable to allocate WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

class AtmosphereEngine {
  root;
  kind;
  glCanvas;
  particleCanvas;
  gl = null;
  glProgram = null;
  glBuffer = null;
  glUniforms = {};
  ctx2d = null;
  currentUniforms = null;
  fromUniforms = null;
  targetUniforms = null;
  transitionStartMs = 0;
  transitionDurationMs = 0;
  state = null;
  prefs = null;
  visible = false;
  paused = false;
  reducedMotion = false;
  destroyed = false;
  dirty = true;
  animationFrame = null;
  elapsedSeconds = Math.random() * 50;
  lastTickMs = 0;
  lastRenderMs = 0;
  lightningFlash = 0;
  lightningX = 0.5;
  lightningSegments = [];
  rainDrops = [];
  splashes = [];
  snowFlakes = [];
  phenomenonParticles = [];
  windowDroplets = [];
  constructor(root, kind) {
    this.root = root;
    this.kind = kind;
    this.glCanvas = document.createElement("canvas");
    this.glCanvas.className = "weather-fx-shader-canvas";
    this.glCanvas.setAttribute("aria-hidden", "true");
    this.particleCanvas = document.createElement("canvas");
    this.particleCanvas.className = "weather-fx-particle-canvas";
    this.particleCanvas.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.glCanvas);
    this.root.appendChild(this.particleCanvas);
    this.initParticlePools();
    this.initWebGL();
    this.ctx2d = this.particleCanvas.getContext("2d", { alpha: true });
    this.tick = this.tick.bind(this);
  }
  update(options) {
    if (this.destroyed)
      return;
    const nextTarget = resolveAtmosphereUniformTarget(options.state, options.tokens, options.prefs, options.kind);
    const shouldTransition = options.prefs.transitionsEnabled && !options.reducedMotion && !options.paused && options.visible && this.currentUniforms !== null;
    if (shouldTransition && this.currentUniforms) {
      this.fromUniforms = this.currentUniforms;
      this.targetUniforms = nextTarget;
      this.transitionStartMs = performance.now();
      this.transitionDurationMs = 1200;
    } else {
      this.currentUniforms = nextTarget;
      this.fromUniforms = nextTarget;
      this.targetUniforms = nextTarget;
      this.transitionDurationMs = 0;
    }
    this.state = options.state;
    this.prefs = options.prefs;
    this.visible = options.visible;
    this.paused = options.paused;
    this.reducedMotion = options.reducedMotion;
    this.dirty = true;
    this.syncLoopState();
  }
  triggerLightning(boltPositionPercent = 50) {
    if (this.destroyed || !this.visible || this.paused || this.reducedMotion)
      return;
    this.lightningX = clamp(boltPositionPercent / 100, 0.1, 0.9);
    this.lightningFlash = 1;
    if (this.kind === "back" || this.prefs?.layerMode === "front") {
      this.generateLightningBolt(this.lightningX);
    }
    this.dirty = true;
    this.syncLoopState();
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.gl) {
      if (this.glBuffer)
        this.gl.deleteBuffer(this.glBuffer);
      if (this.glProgram)
        this.gl.deleteProgram(this.glProgram);
      this.gl = null;
    }
    this.glCanvas.remove();
    this.particleCanvas.remove();
  }
  syncLoopState() {
    if (this.destroyed)
      return;
    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    const shouldAnimate = this.visible && docVisible && !this.paused && !this.reducedMotion;
    if (!this.visible || !docVisible) {
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      return;
    }
    if (!shouldAnimate) {
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      if (this.dirty) {
        this.currentUniforms = this.targetUniforms;
        this.renderFrame(0);
        this.dirty = false;
      }
      return;
    }
    if (this.animationFrame === null) {
      this.lastTickMs = performance.now();
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }
  }
  tick(nowMs) {
    this.animationFrame = null;
    if (this.destroyed)
      return;
    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    if (!this.visible || !docVisible || this.paused || this.reducedMotion) {
      this.syncLoopState();
      return;
    }
    const dt = clamp((nowMs - this.lastTickMs) / 1000, 0.001, 0.065);
    this.lastTickMs = nowMs;
    const frameIntervalMs = 1000 / 30;
    if (this.dirty || nowMs - this.lastRenderMs >= frameIntervalMs) {
      const renderDt = this.lastRenderMs > 0 ? clamp((nowMs - this.lastRenderMs) / 1000, 0.01, 0.08) : dt;
      this.elapsedSeconds += renderDt;
      this.lastRenderMs = nowMs;
      this.dirty = false;
      if (this.transitionDurationMs > 0 && this.fromUniforms && this.targetUniforms) {
        const progress = clamp((nowMs - this.transitionStartMs) / this.transitionDurationMs, 0, 1);
        this.currentUniforms = interpolateUniforms(this.fromUniforms, this.targetUniforms, progress);
        if (progress >= 1) {
          this.transitionDurationMs = 0;
        }
      } else {
        this.currentUniforms = this.targetUniforms;
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - renderDt * 2.2);
      }
      this.renderFrame(renderDt);
    }
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }
  initWebGL() {
    try {
      const contextOptions = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power"
      };
      const gl = this.glCanvas.getContext("webgl2", contextOptions) ?? this.glCanvas.getContext("webgl", contextOptions);
      if (!gl)
        return;
      const vs = compileGlShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fs = compileGlShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
      const program = gl.createProgram();
      if (!program)
        return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return;
      }
      const buffer = gl.createBuffer();
      if (!buffer) {
        gl.deleteProgram(program);
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const posLoc = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      const uniformNames = [
        "u_resolution",
        "u_time",
        "u_bgStart",
        "u_bgMid",
        "u_bgEnd",
        "u_glow",
        "u_beamColor",
        "u_horizonColor",
        "u_cloudCore",
        "u_cloudEdge",
        "u_fogColor",
        "u_mistColor",
        "u_skyOpacity",
        "u_glowOpacity",
        "u_beamOpacity",
        "u_cloudOpacity",
        "u_horizonOpacity",
        "u_mistOpacity",
        "u_fogOpacity",
        "u_starOpacity",
        "u_moonlightOpacity",
        "u_auroraOpacity",
        "u_moonIllumination",
        "u_moonPhaseFraction",
        "u_windX",
        "u_isSandstorm",
        "u_lightningFlash",
        "u_lightningX"
      ];
      for (const name of uniformNames) {
        this.glUniforms[name] = gl.getUniformLocation(program, name);
      }
      this.gl = gl;
      this.glProgram = program;
      this.glBuffer = buffer;
    } catch {
      this.gl = null;
    }
  }
  initParticlePools() {
    const isFront = this.kind === "front";
    const rainCount = isFront ? 54 : 84;
    for (let i = 0;i < rainCount; i += 1) {
      const depth = i * 37 % 100 / 100;
      this.rainDrops.push({
        x: i * 53.7 % 100 / 100,
        y: i * 29.3 % 100 / 100,
        length: (isFront ? 26 : 16) + depth * (isFront ? 28 : 18),
        speed: (isFront ? 1.15 : 0.85) + depth * 0.55,
        depth,
        threshold: (i + 0.5) / rainCount
      });
    }
    const splashCount = isFront ? 10 : 18;
    for (let i = 0;i < splashCount; i += 1) {
      this.splashes.push({
        x: (i * 41.9 % 96 + 2) / 100,
        y: 0.88 + i * 19.1 % 11 / 100,
        age: i * 0.17 % 0.85,
        duration: 0.55 + i * 13 % 40 / 100,
        size: (isFront ? 9 : 6) + i * 7 % 9,
        threshold: (i + 0.5) / splashCount
      });
    }
    const snowCount = isFront ? 42 : 64;
    for (let i = 0;i < snowCount; i += 1) {
      const depth = i * 43 % 100 / 100;
      this.snowFlakes.push({
        x: i * 61.3 % 100 / 100,
        y: i * 31.7 % 100 / 100,
        radius: (isFront ? 1.6 : 1.1) + depth * (isFront ? 2.6 : 2),
        speedY: 0.045 + depth * 0.055,
        swayAmp: 0.012 + depth * 0.02,
        swayFreq: 1.1 + i * 17 % 20 / 10,
        phase: i * 1.37,
        opacity: 0.35 + depth * 0.55
      });
    }
    const phenomCount = isFront ? 26 : 42;
    for (let i = 0;i < phenomCount; i += 1) {
      this.phenomenonParticles.push({
        x: i * 47.3 % 100 / 100,
        y: i * 73.1 % 100 / 100,
        size: 3 + i * 19 % 6,
        speedX: 0.03 + i * 23 % 50 / 1000,
        speedY: 0.04 + i * 31 % 60 / 1000,
        phase: i * 2.13,
        spinSpeed: 1.2 + i * 11 % 30 / 10,
        opacity: 0.45 + i * 13 % 50 / 100
      });
    }
    const dropletCount = isFront ? 26 : 16;
    for (let i = 0;i < dropletCount; i += 1) {
      this.windowDroplets.push({
        x: 0.03 + i * 39.7 % 94 / 100,
        y: i * 57.1 % 100 / 100,
        radius: 1.6 + i * 7 % 5 * 0.55,
        trailLength: 14 + i * 13 % 26,
        speed: 0.035 + i * 19 % 45 / 1000,
        pauseTimer: i * 0.7 % 2.4,
        opacity: 0.35 + i * 11 % 45 / 100
      });
    }
  }
  generateLightningBolt(startX) {
    this.lightningSegments = [];
    let x = startX;
    let y = 0;
    const steps = 12;
    for (let i = 0;i < steps; i += 1) {
      const nextY = y + 0.68 / steps * (0.8 + Math.random() * 0.4);
      const nextX = clamp(x + (Math.random() - 0.5) * 0.09, 0.05, 0.95);
      this.lightningSegments.push({
        x1: x,
        y1: y,
        x2: nextX,
        y2: nextY,
        width: 2.4 - i / steps * 1.1,
        alpha: 0.95
      });
      if (i > 1 && i < steps - 2 && Math.random() < 0.42) {
        let bx = nextX;
        let by = nextY;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let b = 0;b < 4; b += 1) {
          const nbx = clamp(bx + dir * (0.02 + Math.random() * 0.035), 0.02, 0.98);
          const nby = by + 0.045 + Math.random() * 0.03;
          this.lightningSegments.push({
            x1: bx,
            y1: by,
            x2: nbx,
            y2: nby,
            width: 1.2 - b * 0.2,
            alpha: 0.65 - b * 0.12
          });
          bx = nbx;
          by = nby;
        }
      }
      x = nextX;
      y = nextY;
    }
  }
  renderFrame(dt) {
    const u = this.currentUniforms;
    if (!u || !this.state)
      return;
    const clientW = this.root.clientWidth || window.innerWidth || 1;
    const clientH = this.root.clientHeight || window.innerHeight || 1;
    if (clientW < 2 || clientH < 2)
      return;
    this.renderShaderPass(u, clientW, clientH);
    this.renderParticlePass(u, clientW, clientH, dt);
  }
  renderShaderPass(u, clientW, clientH) {
    if (!u.renderAtmosphereShader) {
      this.glCanvas.style.display = "none";
      return;
    }
    this.glCanvas.style.display = "block";
    const gl = this.gl;
    if (!gl || !this.glProgram)
      return;
    const maxPixels = 240000;
    const budgetScale = Math.sqrt(maxPixels / Math.max(1, clientW * clientH));
    const scale = Math.min(0.6, window.devicePixelRatio || 1, budgetScale);
    const w = Math.max(1, Math.floor(clientW * scale));
    const h = Math.max(1, Math.floor(clientH * scale));
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.glCanvas.width = w;
      this.glCanvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.glProgram);
    const loc = this.glUniforms;
    gl.uniform2f(loc.u_resolution ?? null, w, h);
    gl.uniform1f(loc.u_time ?? null, this.elapsedSeconds);
    gl.uniform4fv(loc.u_bgStart ?? null, u.bgStart);
    gl.uniform4fv(loc.u_bgMid ?? null, u.bgMid);
    gl.uniform4fv(loc.u_bgEnd ?? null, u.bgEnd);
    gl.uniform4fv(loc.u_glow ?? null, u.glow);
    gl.uniform4fv(loc.u_beamColor ?? null, u.beamColor);
    gl.uniform4fv(loc.u_horizonColor ?? null, u.horizonColor);
    gl.uniform4fv(loc.u_cloudCore ?? null, u.cloudCore);
    gl.uniform4fv(loc.u_cloudEdge ?? null, u.cloudEdge);
    gl.uniform4fv(loc.u_fogColor ?? null, u.fogColor);
    gl.uniform4fv(loc.u_mistColor ?? null, u.mistColor);
    gl.uniform1f(loc.u_skyOpacity ?? null, u.skyOpacity);
    gl.uniform1f(loc.u_glowOpacity ?? null, u.glowOpacity);
    gl.uniform1f(loc.u_beamOpacity ?? null, u.beamOpacity);
    gl.uniform1f(loc.u_cloudOpacity ?? null, u.cloudOpacity);
    gl.uniform1f(loc.u_horizonOpacity ?? null, u.horizonOpacity);
    gl.uniform1f(loc.u_mistOpacity ?? null, u.mistOpacity);
    gl.uniform1f(loc.u_fogOpacity ?? null, u.fogOpacity);
    gl.uniform1f(loc.u_starOpacity ?? null, u.starOpacity);
    gl.uniform1f(loc.u_moonlightOpacity ?? null, u.moonlightOpacity);
    gl.uniform1f(loc.u_auroraOpacity ?? null, u.auroraOpacity);
    gl.uniform1f(loc.u_moonIllumination ?? null, u.moonIllumination);
    gl.uniform1f(loc.u_moonPhaseFraction ?? null, u.moonPhaseFraction);
    gl.uniform1f(loc.u_windX ?? null, u.windVelocityX);
    gl.uniform1f(loc.u_isSandstorm ?? null, u.isSandstorm);
    gl.uniform1f(loc.u_lightningFlash ?? null, this.lightningFlash);
    gl.uniform1f(loc.u_lightningX ?? null, this.lightningX);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  renderParticlePass(u, clientW, clientH, dt) {
    const ctx = this.ctx2d;
    if (!ctx || !this.state)
      return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.15);
    const w = Math.max(1, Math.floor(clientW * dpr));
    const h = Math.max(1, Math.floor(clientH * dpr));
    if (this.particleCanvas.width !== w || this.particleCanvas.height !== h) {
      this.particleCanvas.width = w;
      this.particleCanvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientW, clientH);
    if (!this.gl && u.renderAtmosphereShader && u.skyOpacity > 0.01) {
      const grad = ctx.createLinearGradient(0, 0, 0, clientH);
      grad.addColorStop(0, `rgba(${Math.round(u.bgStart[0] * 255)}, ${Math.round(u.bgStart[1] * 255)}, ${Math.round(u.bgStart[2] * 255)}, ${u.skyOpacity})`);
      grad.addColorStop(0.5, `rgba(${Math.round(u.bgMid[0] * 255)}, ${Math.round(u.bgMid[1] * 255)}, ${Math.round(u.bgMid[2] * 255)}, ${u.skyOpacity})`);
      grad.addColorStop(1, `rgba(${Math.round(u.bgEnd[0] * 255)}, ${Math.round(u.bgEnd[1] * 255)}, ${Math.round(u.bgEnd[2] * 255)}, ${u.skyOpacity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, clientW, clientH);
    }
    const condition = this.state.condition;
    const phenomenon = this.state.phenomenon ?? "none";
    const exposure = this.state.exposure ?? "outdoor";
    if (u.rainOpacity > 0.01 && u.rainDensity > 0.01 && exposure !== "underground") {
      this.drawRain(ctx, u, clientW, clientH, dt, condition === "storm");
    }
    if (u.snowOpacity > 0.01 && exposure !== "underground") {
      this.drawSnow(ctx, u, clientW, clientH, dt);
    }
    if (u.moteOpacity > 0.01 && phenomenon === "none") {
      this.drawMotes(ctx, u, clientW, clientH, dt);
    }
    if (u.phenomenonOpacity > 0.01 && phenomenon !== "none" && phenomenon !== "aurora") {
      this.drawPhenomenonParticles(ctx, u, phenomenon, clientW, clientH, dt);
    }
    if (u.windowDropletOpacity > 0.01 && exposure === "indoor") {
      this.drawWindowpane(ctx, u, clientW, clientH, dt);
    }
    if (this.lightningFlash > 0.02 && this.lightningSegments.length > 0) {
      this.drawLightningBolts(ctx, clientW, clientH);
    }
  }
  drawRain(ctx, u, w, h, dt, isStorm) {
    const rad = -u.windAngleDeg * Math.PI / 180;
    const sinA = Math.sin(rad);
    const cosA = Math.cos(rad);
    const fallVelocity = 1.05 / Math.max(0.55, u.rainSpeedScale);
    ctx.lineCap = "round";
    ctx.strokeStyle = isStorm ? "rgba(214, 232, 255, 0.85)" : "rgba(192, 222, 255, 0.76)";
    for (let i = 0;i < this.rainDrops.length; i += 1) {
      const drop = this.rainDrops[i];
      const densityAlpha = clamp((u.rainDensity - drop.threshold) / 0.1, 0, 1);
      if (densityAlpha <= 0.01)
        continue;
      if (dt > 0) {
        drop.y += drop.speed * fallVelocity * dt;
        drop.x += sinA * drop.speed * fallVelocity * dt * 0.45;
        if (drop.y > 1.08) {
          drop.y = -0.08 - drop.y % 0.08;
          drop.x = ((drop.x + 0.37) % 1 + 1) % 1;
        }
        if (drop.x > 1.06)
          drop.x -= 1.12;
        if (drop.x < -0.06)
          drop.x += 1.12;
      }
      const alpha = clamp(u.rainOpacity * densityAlpha * (0.35 + drop.depth * 0.55), 0.04, 0.9);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = (this.kind === "front" ? 1.35 : 1) + drop.depth * 0.7;
      const x1 = drop.x * w;
      const y1 = drop.y * h;
      const x2 = x1 + sinA * drop.length;
      const y2 = y1 + cosA * drop.length;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(216, 236, 255, 0.78)";
    ctx.lineWidth = 1.15;
    for (let i = 0;i < this.splashes.length; i += 1) {
      const sp = this.splashes[i];
      if (sp.threshold > u.rainDensity)
        continue;
      if (dt > 0) {
        sp.age += dt;
        if (sp.age >= sp.duration) {
          sp.age = 0;
          sp.x = 0.03 + Math.random() * 0.94;
          sp.y = 0.87 + Math.random() * 0.12;
        }
      }
      const progress = clamp(sp.age / sp.duration, 0, 1);
      const fade = Math.sin(progress * Math.PI);
      ctx.globalAlpha = clamp(u.rainOpacity * fade * 0.65, 0, 0.8);
      const cx = sp.x * w;
      const cy = sp.y * h;
      const rx = sp.size * (0.35 + progress * 1.45);
      const ry = rx * 0.32;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (progress < 0.55) {
        const crownLift = Math.sin(progress / 0.55 * Math.PI) * sp.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx - sp.size * 0.3, cy);
        ctx.lineTo(cx - sp.size * 0.48, cy - crownLift);
        ctx.moveTo(cx + sp.size * 0.3, cy);
        ctx.lineTo(cx + sp.size * 0.48, cy - crownLift);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  drawSnow(ctx, u, w, h, dt) {
    ctx.fillStyle = this.state?.palette === "night" ? "rgba(220, 234, 255, 0.92)" : "rgba(248, 251, 255, 0.96)";
    for (let i = 0;i < this.snowFlakes.length; i += 1) {
      const flake = this.snowFlakes[i];
      if (dt > 0) {
        flake.y += flake.speedY * dt;
        flake.x += (u.windVelocityX * 0.025 + Math.sin(this.elapsedSeconds * flake.swayFreq + flake.phase) * flake.swayAmp) * dt;
        if (flake.y > 1.04) {
          flake.y = -0.04;
          flake.x = Math.random();
        }
        if (flake.x > 1.04)
          flake.x -= 1.08;
        if (flake.x < -0.04)
          flake.x += 1.08;
      }
      const shimmer = 0.78 + 0.22 * Math.sin(this.elapsedSeconds * 2.4 + flake.phase);
      ctx.globalAlpha = clamp(u.snowOpacity * flake.opacity * shimmer, 0.03, 0.92);
      const px = flake.x * w;
      const py = flake.y * h;
      ctx.beginPath();
      ctx.arc(px, py, flake.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawMotes(ctx, u, w, h, dt) {
    const count = Math.min(18, this.phenomenonParticles.length);
    ctx.fillStyle = u.isUnderground > 0.5 ? "rgba(182, 224, 238, 0.78)" : "rgba(255, 245, 214, 0.88)";
    for (let i = 0;i < count; i += 1) {
      const p = this.phenomenonParticles[i];
      if (dt > 0) {
        p.x = ((p.x + Math.sin(this.elapsedSeconds * 0.4 + p.phase) * 0.008 * dt) % 1 + 1) % 1;
        p.y = ((p.y - 0.006 * dt + Math.cos(this.elapsedSeconds * 0.35 + p.phase) * 0.005 * dt) % 1 + 1) % 1;
      }
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSeconds * 1.6 + p.phase);
      ctx.globalAlpha = clamp(u.moteOpacity * p.opacity * pulse * 2.4, 0, 0.75);
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(1.4, p.size * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawPhenomenonParticles(ctx, u, phenomenon, w, h, dt) {
    for (let i = 0;i < this.phenomenonParticles.length; i += 1) {
      const p = this.phenomenonParticles[i];
      if (dt > 0) {
        if (phenomenon === "embers") {
          p.y -= (p.speedY * 1.45 + 0.025) * dt;
          p.x += (u.windVelocityX * 0.03 + Math.sin(this.elapsedSeconds * 2.2 + p.phase) * 0.028) * dt;
          if (p.y < -0.04) {
            p.y = 1.04;
            p.x = Math.random();
          }
        } else if (phenomenon === "fireflies") {
          p.x += Math.cos(this.elapsedSeconds * 0.75 + p.phase) * 0.018 * dt;
          p.y += Math.sin(this.elapsedSeconds * 0.9 + p.phase * 1.3) * 0.014 * dt;
          p.y = clamp(p.y, 0.25, 0.95);
        } else if (phenomenon === "sandstorm") {
          p.x += (0.55 + p.speedX * 4.2) * (u.windVelocityX >= 0 ? 1 : -1) * dt;
          p.y += Math.sin(this.elapsedSeconds * 3 + p.phase) * 0.02 * dt;
        } else {
          p.y += p.speedY * (phenomenon === "blossoms" ? 0.95 : 0.72) * dt;
          p.x += (u.windVelocityX * 0.045 + Math.sin(this.elapsedSeconds * 1.6 + p.phase) * 0.024) * dt;
          if (p.y > 1.05) {
            p.y = -0.05;
            p.x = Math.random();
          }
        }
        p.x = (p.x % 1 + 1) % 1;
      }
      const px = p.x * w;
      const py = p.y * h;
      if (phenomenon === "blossoms") {
        const tilt = this.elapsedSeconds * p.spinSpeed + p.phase;
        const pitchScale = 0.35 + 0.65 * Math.abs(Math.cos(tilt * 0.85));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(tilt * 0.6);
        ctx.scale(1, pitchScale);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity, 0.05, 0.9);
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 212, 230, 0.94)" : "rgba(255, 174, 206, 0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.95, p.size * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (phenomenon === "embers") {
        const flicker = 0.62 + 0.38 * Math.sin(this.elapsedSeconds * 7.5 + p.phase);
        const r = Math.max(1.4, p.size * 0.46);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * flicker, 0.06, 0.95);
        ctx.fillStyle = "rgba(255, 138, 44, 0.9)";
        ctx.beginPath();
        ctx.arc(px, py, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 242, 192, 0.98)";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      } else if (phenomenon === "fireflies") {
        const glow = Math.pow(0.5 + 0.5 * Math.sin(this.elapsedSeconds * 2.1 + p.phase), 2.4);
        if (glow < 0.06)
          continue;
        const r = Math.max(1.8, p.size * 0.52);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * glow * 0.42, 0, 0.55);
        ctx.fillStyle = "rgba(182, 250, 88, 0.85)";
        ctx.beginPath();
        ctx.arc(px, py, r * 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = clamp(u.phenomenonOpacity * glow, 0, 0.96);
        ctx.fillStyle = "rgba(246, 255, 190, 0.98)";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      } else if (phenomenon === "ashfall") {
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * 0.82, 0.05, 0.78);
        ctx.fillStyle = "rgba(208, 213, 222, 0.84)";
        ctx.beginPath();
        ctx.ellipse(px, py, p.size * 0.55, p.size * 0.36, this.elapsedSeconds + p.phase, 0, Math.PI * 2);
        ctx.fill();
      } else if (phenomenon === "sandstorm") {
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * 0.55, 0.04, 0.6);
        ctx.strokeStyle = "rgba(232, 190, 130, 0.78)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - p.size * 4.5, py);
        ctx.lineTo(px + p.size * 4.5, py + 1.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  drawWindowpane(ctx, u, w, h, dt) {
    for (let i = 0;i < this.windowDroplets.length; i += 1) {
      const drop = this.windowDroplets[i];
      if (dt > 0) {
        if (drop.pauseTimer > 0) {
          drop.pauseTimer -= dt;
        } else {
          drop.y += drop.speed * dt;
          drop.x += Math.sin(drop.y * 18 + i) * 0.0025 * dt;
          if (Math.random() < 0.015) {
            drop.pauseTimer = 0.25 + Math.random() * 0.9;
          }
          if (drop.y > 1.05) {
            drop.y = -0.04;
            drop.x = 0.03 + Math.random() * 0.94;
          }
        }
      }
      const px = drop.x * w;
      const py = drop.y * h;
      const alpha = clamp(u.windowDropletOpacity * drop.opacity, 0.04, 0.75);
      ctx.globalAlpha = alpha * 0.42;
      ctx.strokeStyle = "rgba(220, 238, 255, 0.72)";
      ctx.lineWidth = drop.radius * 0.85;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py - drop.trailLength);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = "rgba(238, 247, 255, 0.92)";
      ctx.beginPath();
      ctx.ellipse(px, py, drop.radius, drop.radius * 1.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawLightningBolts(ctx, w, h) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0;pass < 2; pass += 1) {
      const isGlowPass = pass === 0;
      ctx.strokeStyle = isGlowPass ? "rgba(155, 198, 255, 0.42)" : "rgba(248, 252, 255, 0.96)";
      for (let i = 0;i < this.lightningSegments.length; i += 1) {
        const seg = this.lightningSegments[i];
        ctx.globalAlpha = clamp(this.lightningFlash * seg.alpha, 0, 1);
        ctx.lineWidth = isGlowPass ? seg.width * 3.8 : seg.width;
        ctx.beginPath();
        ctx.moveTo(seg.x1 * w, seg.y1 * h);
        ctx.lineTo(seg.x2 * w, seg.y2 * h);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
var engines = new WeakMap;
function updateAtmosphereEngine(root, kind, options) {
  let engine = engines.get(root);
  if (!engine) {
    engine = new AtmosphereEngine(root, kind);
    engines.set(root, engine);
  }
  engine.update(options);
  return engine;
}
function triggerAtmosphereLightning(root, boltPositionPercent) {
  engines.get(root)?.triggerLightning(boltPositionPercent);
}
function destroyAtmosphereEngine(root) {
  const engine = engines.get(root);
  if (engine) {
    engine.destroy();
    engines.delete(root);
  }
}

// src/presets.ts
var WEATHER_SCENE_PRESETS = [
  {
    id: "clear-day",
    label: "Clear day",
    shortLabel: "Day",
    description: "Bright open skies with a soft daylight bloom.",
    state: {
      time: "1:18 PM",
      condition: "clear",
      summary: "Bright open skies",
      temperature: "72F",
      wind: "light breeze",
      palette: "day",
      intensity: 0.34
    }
  },
  {
    id: "overcast",
    label: "Overcast",
    shortLabel: "Overcast",
    description: "Muted daylight under a heavy cloud ceiling.",
    state: {
      time: "11:26 AM",
      condition: "cloudy",
      summary: "Heavy overcast",
      temperature: "63F",
      wind: "cool drift",
      palette: "day",
      intensity: 0.58
    }
  },
  {
    id: "rain",
    label: "Rain",
    shortLabel: "Rain",
    description: "Steady angled rain with a low mist at the base of the scene.",
    state: {
      time: "5:42 PM",
      condition: "rain",
      summary: "Rain sweeping through",
      temperature: "61F",
      wind: "steady rainwind",
      palette: "dusk",
      intensity: 0.74
    }
  },
  {
    id: "storm",
    label: "Storm",
    shortLabel: "Storm",
    description: "Dark thunderheads, hard rain, and intermittent flashes.",
    state: {
      time: "8:18 PM",
      condition: "storm",
      summary: "Thunderheads building",
      temperature: "58F",
      wind: "hard gusts",
      palette: "storm",
      intensity: 0.94
    }
  },
  {
    id: "snow",
    label: "Snow",
    shortLabel: "Snow",
    description: "Layered snowfall with a cold, luminous atmosphere.",
    state: {
      time: "6:48 AM",
      condition: "snow",
      summary: "Quiet snowfall",
      temperature: "29F",
      wind: "hushed air",
      palette: "snow",
      intensity: 0.68
    }
  },
  {
    id: "fog",
    label: "Fog",
    shortLabel: "Fog",
    description: "Low fog pooling through the lower scene.",
    state: {
      time: "6:12 AM",
      condition: "fog",
      summary: "Fog pooling low",
      temperature: "54F",
      wind: "still",
      palette: "mist",
      intensity: 0.64
    }
  },
  {
    id: "clear-night",
    label: "Clear night",
    shortLabel: "Night",
    description: "Clean night air with a cool moonlit palette.",
    state: {
      time: "10:18 PM",
      condition: "clear",
      summary: "Clear night air",
      temperature: "57F",
      wind: "light night wind",
      palette: "night",
      intensity: 0.24
    }
  },
  {
    id: "aurora-night",
    label: "Aurora night",
    shortLabel: "Aurora",
    description: "Polar ribbons dancing across a crisp starlit sky.",
    state: {
      time: "11:12 PM",
      condition: "clear",
      summary: "Aurora ribbons overhead",
      temperature: "26F",
      wind: "still polar air",
      palette: "night",
      intensity: 0.72,
      exposure: "outdoor",
      phenomenon: "aurora"
    }
  },
  {
    id: "cozy-indoors",
    label: "Indoor rain",
    shortLabel: "Indoors",
    description: "Warm interior shelter with rain streaking down the windowpane.",
    state: {
      time: "9:24 PM",
      condition: "rain",
      summary: "Rain against the windowpane",
      temperature: "59F",
      wind: "muffled gusts",
      palette: "night",
      intensity: 0.76,
      exposure: "indoor",
      phenomenon: "none"
    }
  },
  {
    id: "sakura-breeze",
    label: "Blossom drift",
    shortLabel: "Blossoms",
    description: "Spring petals riding a warm afternoon breeze.",
    state: {
      time: "3:40 PM",
      condition: "clear",
      summary: "Petals drifting on the breeze",
      temperature: "69F",
      wind: "breezy",
      palette: "day",
      intensity: 0.62,
      exposure: "outdoor",
      phenomenon: "blossoms"
    }
  },
  {
    id: "ember-dusk",
    label: "Ember dusk",
    shortLabel: "Embers",
    description: "Glowing cinders rising into a dramatic twilight sky.",
    state: {
      time: "7:35 PM",
      condition: "cloudy",
      summary: "Cinders rising through dusk",
      temperature: "66F",
      wind: "warm updraft",
      palette: "dusk",
      intensity: 0.78,
      exposure: "outdoor",
      phenomenon: "embers"
    }
  }
];
function getWeatherScenePreset(presetId) {
  return WEATHER_SCENE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
function buildPresetWeatherState(presetId, currentState) {
  const preset = getWeatherScenePreset(presetId);
  if (!preset)
    return null;
  const baseState = currentState ?? makeDefaultWeatherState();
  const fallbackDate = isRealCalendarDate(baseState.date) ? baseState.date : formatDate(new Date);
  return {
    location: baseState.location,
    date: fallbackDate,
    exposure: preset.state.exposure ?? "outdoor",
    phenomenon: preset.state.phenomenon ?? "none",
    ...preset.state,
    source: "manual"
  };
}
function matchWeatherScenePreset(state) {
  if (!state)
    return null;
  const match = WEATHER_SCENE_PRESETS.find((preset) => preset.state.condition === state.condition && preset.state.palette === state.palette && preset.state.time === state.time && preset.state.summary === state.summary && preset.state.temperature === state.temperature && preset.state.wind === state.wind && (preset.state.exposure ?? "outdoor") === (state.exposure ?? "outdoor") && (preset.state.phenomenon ?? "none") === (state.phenomenon ?? "none") && Math.abs(preset.state.intensity - state.intensity) < 0.001);
  return match?.id ?? null;
}

// src/mobile-layout.ts
var MOBILE_HUD_BREAKPOINT = 600;
var MOBILE_HUD_LAUNCHER_SIZE = { width: 40, height: 40 };
var DESKTOP_HUD_COLLAPSED_SIZE = { width: 320, height: 184 };
var DESKTOP_HUD_EXPANDED_SIZE = { width: 360, height: 360 };
function isMobileHudLayout(viewportWidth, coarsePointer) {
  return coarsePointer || viewportWidth <= MOBILE_HUD_BREAKPOINT;
}
function resolveHudPresentation(mobile, expanded) {
  if (mobile) {
    return {
      kind: expanded ? "mobile-panel" : "mobile-launcher",
      ...MOBILE_HUD_LAUNCHER_SIZE,
      fullscreen: expanded
    };
  }
  return {
    kind: "desktop",
    ...expanded ? DESKTOP_HUD_EXPANDED_SIZE : DESKTOP_HUD_COLLAPSED_SIZE,
    fullscreen: false
  };
}
function clampMobileHudPosition(position, viewport, padding = 12) {
  return {
    x: Math.max(padding, Math.min(position.x, viewport.width - MOBILE_HUD_LAUNCHER_SIZE.width - padding)),
    y: Math.max(padding, Math.min(position.y, viewport.height - MOBILE_HUD_LAUNCHER_SIZE.height - padding))
  };
}

// src/scene-tokens.ts
function resolveSceneTokens(state, intensity) {
  const baseIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1.5);
  const paletteMap = {
    dawn: {
      start: "#20385f",
      mid: "#5a77a9",
      end: "#f0a56e",
      glow: "rgba(255, 203, 145, 0.82)",
      beam: "rgba(255, 218, 165, 0.48)",
      horizon: "rgba(255, 182, 125, 0.44)"
    },
    day: {
      start: "#4d77ad",
      mid: "#7fa8de",
      end: "#d8ebff",
      glow: "rgba(255, 243, 202, 0.78)",
      beam: "rgba(255, 244, 212, 0.44)",
      horizon: "rgba(185, 212, 244, 0.28)"
    },
    dusk: {
      start: "#221f4c",
      mid: "#68487a",
      end: "#f09067",
      glow: "rgba(255, 173, 128, 0.72)",
      beam: "rgba(255, 189, 150, 0.38)",
      horizon: "rgba(224, 149, 114, 0.34)"
    },
    night: {
      start: "#05101d",
      mid: "#10253c",
      end: "#274768",
      glow: "rgba(143, 180, 255, 0.48)",
      beam: "rgba(130, 164, 234, 0.2)",
      horizon: "rgba(74, 104, 154, 0.26)"
    },
    storm: {
      start: "#04101a",
      mid: "#13283a",
      end: "#33475f",
      glow: "rgba(188, 220, 255, 0.26)",
      beam: "rgba(168, 203, 236, 0.16)",
      horizon: "rgba(108, 139, 170, 0.26)"
    },
    mist: {
      start: "#213141",
      mid: "#586c7d",
      end: "#a7bac2",
      glow: "rgba(226, 240, 255, 0.32)",
      beam: "rgba(228, 239, 248, 0.18)",
      horizon: "rgba(206, 220, 228, 0.36)"
    },
    snow: {
      start: "#415b76",
      mid: "#7d93a8",
      end: "#e0e9f1",
      glow: "rgba(255, 252, 244, 0.66)",
      beam: "rgba(242, 245, 255, 0.32)",
      horizon: "rgba(229, 238, 248, 0.4)"
    }
  };
  const basePalette = paletteMap[state.palette];
  const palette = state.condition === "storm" ? paletteMap.storm : state.condition === "rain" ? {
    start: state.palette === "night" ? "#07131f" : "#102032",
    mid: state.palette === "night" ? "#1d3148" : "#324b67",
    end: state.palette === "night" ? "#41566e" : "#61748b",
    glow: "rgba(176, 206, 240, 0.22)",
    beam: "rgba(135, 165, 198, 0.1)",
    horizon: "rgba(120, 147, 174, 0.24)"
  } : state.condition === "cloudy" && (state.palette === "dawn" || state.palette === "dusk") ? {
    ...basePalette,
    end: state.palette === "dawn" ? "#9baec3" : "#7f90a6",
    glow: "rgba(214, 224, 238, 0.24)",
    beam: "rgba(176, 191, 209, 0.12)",
    horizon: "rgba(154, 169, 187, 0.24)"
  } : basePalette;
  let cloudCore = "rgba(237, 244, 255, 0.34)";
  let cloudEdge = "rgba(255, 255, 255, 0.12)";
  let fogColor = "rgba(236, 241, 255, 0.18)";
  let mistColor = "rgba(228, 238, 248, 0.24)";
  const values = {
    skyOpacity: 0.08,
    glowOpacity: 0.13,
    beamOpacity: 0.14,
    cloudOpacity: 0.1,
    horizonOpacity: 0.06,
    mistOpacity: 0.03,
    fogOpacity: 0,
    rainOpacity: 0,
    snowOpacity: 0,
    moteOpacity: 0.06,
    starOpacity: 0,
    moonlightOpacity: 0,
    flashOpacity: 0.26,
    auroraOpacity: 0,
    windowDropletOpacity: 0,
    phenomenonOpacity: 0
  };
  const lunar = resolveLunarPhase(state.date, state.time);
  const exposure = state.exposure ?? "outdoor";
  const phenomenon = state.phenomenon ?? "none";
  switch (state.condition) {
    case "cloudy":
      values.skyOpacity = 0.14;
      values.glowOpacity = 0.09;
      values.beamOpacity = 0.04;
      values.cloudOpacity = 0.5;
      values.horizonOpacity = 0.1;
      values.mistOpacity = 0.06;
      values.moteOpacity = 0.02;
      if (state.palette === "night") {
        values.moonlightOpacity = 0.09;
      }
      cloudCore = "rgba(205, 216, 231, 0.34)";
      cloudEdge = "rgba(238, 244, 255, 0.12)";
      fogColor = "rgba(210, 223, 239, 0.18)";
      mistColor = "rgba(217, 227, 239, 0.2)";
      break;
    case "rain":
      values.skyOpacity = 0.2;
      values.glowOpacity = 0.06;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.7;
      values.horizonOpacity = 0.16;
      values.mistOpacity = 0.22;
      values.fogOpacity = 0.12;
      values.rainOpacity = 0.82;
      values.moteOpacity = 0;
      cloudCore = "rgba(87, 106, 128, 0.48)";
      cloudEdge = "rgba(158, 178, 201, 0.12)";
      fogColor = "rgba(162, 180, 198, 0.2)";
      mistColor = "rgba(174, 188, 204, 0.22)";
      break;
    case "storm":
      values.skyOpacity = 0.24;
      values.glowOpacity = 0.05;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.86;
      values.horizonOpacity = 0.24;
      values.mistOpacity = 0.28;
      values.fogOpacity = 0.18;
      values.rainOpacity = 1.04;
      values.flashOpacity = 0.64;
      values.moteOpacity = 0;
      cloudCore = "rgba(56, 73, 93, 0.62)";
      cloudEdge = "rgba(118, 138, 163, 0.12)";
      fogColor = "rgba(130, 149, 171, 0.22)";
      mistColor = "rgba(151, 167, 186, 0.24)";
      break;
    case "snow":
      values.skyOpacity = 0.15;
      values.glowOpacity = 0.2;
      values.beamOpacity = 0.08;
      values.cloudOpacity = 0.34;
      values.horizonOpacity = 0.2;
      values.mistOpacity = 0.12;
      values.fogOpacity = 0.08;
      values.snowOpacity = 0.84;
      values.moteOpacity = 0.02;
      cloudCore = "rgba(232, 238, 247, 0.34)";
      cloudEdge = "rgba(255, 255, 255, 0.14)";
      fogColor = "rgba(230, 236, 245, 0.22)";
      mistColor = "rgba(225, 233, 242, 0.22)";
      break;
    case "fog":
      values.skyOpacity = 0.12;
      values.glowOpacity = 0.08;
      values.beamOpacity = 0.02;
      values.cloudOpacity = 0.18;
      values.horizonOpacity = 0.22;
      values.mistOpacity = 0.38;
      values.fogOpacity = 0.68;
      values.moteOpacity = 0.01;
      cloudCore = "rgba(186, 198, 207, 0.28)";
      cloudEdge = "rgba(232, 239, 244, 0.1)";
      fogColor = "rgba(223, 230, 236, 0.26)";
      mistColor = "rgba(217, 224, 231, 0.28)";
      break;
    case "clear":
    default:
      if (state.palette === "night") {
        values.skyOpacity = 0.13;
        values.glowOpacity = 0.08;
        values.beamOpacity = 0.03;
        values.cloudOpacity = 0.02;
        values.moteOpacity = 0;
        values.starOpacity = Number((0.72 - lunar.illumination * 0.08).toFixed(3));
        values.moonlightOpacity = Number((0.45 + lunar.illumination * 0.08).toFixed(3));
      }
      break;
  }
  if (phenomenon === "aurora" && exposure !== "underground") {
    values.auroraOpacity = 0.56;
    values.glowOpacity = Math.max(values.glowOpacity, 0.16);
  } else if (phenomenon === "sandstorm") {
    values.fogOpacity = Math.max(values.fogOpacity, 0.46);
    values.mistOpacity = Math.max(values.mistOpacity, 0.34);
    values.phenomenonOpacity = 0.78;
    fogColor = "rgba(214, 168, 112, 0.32)";
    mistColor = "rgba(204, 154, 98, 0.34)";
  } else if (phenomenon !== "none") {
    values.phenomenonOpacity = 0.68;
  }
  if (exposure === "sheltered") {
    values.rainOpacity *= 0.62;
    values.snowOpacity *= 0.65;
    values.skyOpacity *= 0.86;
    values.beamOpacity *= 0.78;
    values.phenomenonOpacity *= 0.8;
  } else if (exposure === "indoor") {
    const rainLike = state.condition === "rain" || state.condition === "storm";
    const frostLike = state.condition === "snow" || state.condition === "fog";
    values.windowDropletOpacity = rainLike ? 0.68 : frostLike ? 0.28 : 0;
    values.rainOpacity *= 0.22;
    values.snowOpacity *= 0.26;
    values.cloudOpacity *= 0.42;
    values.skyOpacity *= 0.52;
    values.fogOpacity *= 0.32;
    values.mistOpacity *= 0.28;
    values.starOpacity *= 0.45;
    values.moonlightOpacity *= 0.62;
    values.flashOpacity *= 0.45;
    values.auroraOpacity *= 0.5;
    values.phenomenonOpacity *= 0.32;
  } else if (exposure === "underground") {
    values.skyOpacity = 0.04;
    values.glowOpacity = 0.04;
    values.beamOpacity = 0;
    values.cloudOpacity = 0;
    values.horizonOpacity = 0.08;
    values.mistOpacity = Math.max(values.mistOpacity * 0.6, 0.16);
    values.fogOpacity = Math.max(values.fogOpacity * 0.45, 0.12);
    values.rainOpacity = 0;
    values.snowOpacity = 0;
    values.moteOpacity = Math.max(values.moteOpacity, 0.12);
    values.starOpacity = 0;
    values.moonlightOpacity = 0;
    values.flashOpacity = 0;
    values.auroraOpacity = 0;
    values.windowDropletOpacity = 0;
    values.phenomenonOpacity = phenomenon === "embers" || phenomenon === "fireflies" || phenomenon === "ashfall" ? values.phenomenonOpacity * 0.85 : 0;
  }
  const detailScale = clamp(0.82 + baseIntensity * 0.28, 0.75, 1.18);
  const atmosphereScale = clamp(0.92 + baseIntensity * 0.24, 0.84, 1.2);
  return {
    bgStart: palette.start,
    bgMid: palette.mid,
    bgEnd: palette.end,
    glow: palette.glow,
    beamColor: palette.beam,
    horizonColor: palette.horizon,
    cloudCore,
    cloudEdge,
    fogColor,
    mistColor,
    skyOpacity: values.skyOpacity * atmosphereScale,
    glowOpacity: values.glowOpacity * atmosphereScale,
    beamOpacity: values.beamOpacity * atmosphereScale,
    cloudOpacity: values.cloudOpacity * detailScale,
    horizonOpacity: values.horizonOpacity * atmosphereScale,
    mistOpacity: values.mistOpacity * detailScale,
    fogOpacity: values.fogOpacity * detailScale,
    rainOpacity: values.rainOpacity * detailScale,
    snowOpacity: values.snowOpacity * detailScale,
    moteOpacity: exposure === "underground" ? values.moteOpacity * detailScale : state.condition === "clear" && baseIntensity > 0.48 ? values.moteOpacity * detailScale : values.moteOpacity * 0.4,
    starOpacity: values.starOpacity * detailScale,
    moonlightOpacity: values.moonlightOpacity * atmosphereScale,
    flashOpacity: values.flashOpacity,
    auroraOpacity: clamp(values.auroraOpacity * atmosphereScale, 0, 1.2),
    windowDropletOpacity: clamp(values.windowDropletOpacity * detailScale, 0, 1.2),
    phenomenonOpacity: clamp(values.phenomenonOpacity * detailScale, 0, 1.2)
  };
}

// src/scene-hosts.ts
function asHTMLElement(element) {
  return element instanceof HTMLElement ? element : null;
}
function closestByClassName(start, name) {
  const pattern = new RegExp(`(?:^|[^a-zA-Z0-9])${name}(?:$|[^a-zA-Z0-9])`);
  for (let element = start;element; element = element.parentElement) {
    if ([...element.classList].some((className) => pattern.test(className)))
      return asHTMLElement(element);
  }
  return null;
}
function resolveSceneHosts(root = document) {
  const scrollRegion = asHTMLElement(root.querySelector('[data-chat-scroll="true"]'));
  const chatView = asHTMLElement(scrollRegion?.closest('[data-component="ChatView"]') ?? null);
  const sceneScope = chatView ?? root;
  const backgroundLayer = asHTMLElement(sceneScope.querySelector('[class*="sceneBackgroundLayer"]'));
  const sceneTextLayer = asHTMLElement(sceneScope.querySelector('[class*="sceneTextContextLayer"]'));
  const sceneHost = backgroundLayer?.parentElement ?? chatView;
  const chatColumnInner = asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-column-inner"]') ?? null) ?? closestByClassName(scrollRegion, "chatColumnInner");
  const chatColumn = asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-column"]') ?? null) ?? closestByClassName(scrollRegion, "chatColumn");
  const chatBody = asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-body"]') ?? null) ?? chatColumn?.parentElement ?? null;
  return {
    backHost: sceneHost ?? backgroundLayer,
    backBefore: sceneTextLayer?.parentElement === sceneHost ? sceneTextLayer : null,
    frontHost: chatBody ?? chatColumn ?? chatColumnInner ?? scrollRegion,
    frontBefore: null
  };
}

// src/soundscape.ts
var EXPOSURE_LOWPASS_HZ = {
  outdoor: 16000,
  sheltered: 4200,
  indoor: 420,
  underground: 240
};
function resolveWindStrengthFactor(wind) {
  const normalized = wind.trim().toLowerCase();
  if (/hurricane|violent|gale|hard|strong|gust|howl/.test(normalized))
    return 0.92;
  if (/steady|breezy|windy|crosswind|brisk/.test(normalized))
    return 0.54;
  if (/light|soft|cool drift|gentle/.test(normalized))
    return 0.26;
  if (/still|calm|hushed|none/.test(normalized))
    return 0.06;
  return 0.34;
}
function resolveSoundscapeProfile(state, prefs, visible = true) {
  const soundEnabled = Boolean(prefs.soundEnabled);
  const volume = clamp(Number.isFinite(prefs.soundVolume) ? prefs.soundVolume : 0.45, 0.05, 1);
  const exposure = state?.exposure ?? "outdoor";
  const lowpassHz = EXPOSURE_LOWPASS_HZ[exposure];
  if (!visible || !soundEnabled || prefs.pauseEffects || !state) {
    return {
      active: false,
      masterGain: 0,
      lowpassHz,
      rainWashGain: 0,
      rainPatterGain: 0,
      windGain: 0,
      windCenterHz: 200,
      emberCrackleGain: 0,
      shimmerDroneGain: 0,
      thunderGainScale: 0
    };
  }
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const normalizedIntensity = clamp(effectiveIntensity / 1.2, 0, 1);
  const phenomenon = state.phenomenon ?? "none";
  const rainLike = state.condition === "rain" || state.condition === "storm";
  const rainWashBase = rainLike && exposure !== "underground" ? clamp(0.2 + normalizedIntensity * 0.52 + (state.condition === "storm" ? 0.14 : 0), 0.15, 0.92) : 0;
  const rainPatterBase = rainLike && exposure !== "underground" ? clamp(0.14 + normalizedIntensity * 0.44 + (state.condition === "storm" ? 0.08 : 0), 0.1, 0.78) : 0;
  const rainExposureScale = exposure === "indoor" ? 0.62 : exposure === "sheltered" ? 0.85 : exposure === "underground" ? 0 : 1;
  const patterExposureScale = exposure === "indoor" ? 0.32 : exposure === "sheltered" ? 0.68 : exposure === "underground" ? 0 : 1;
  const windFactor = resolveWindStrengthFactor(state.wind);
  const conditionWindBoost = state.condition === "storm" ? 0.28 : state.condition === "snow" ? 0.12 : phenomenon === "sandstorm" ? 0.34 : 0;
  const windExposureScale = exposure === "indoor" ? 0.38 : exposure === "sheltered" ? 0.78 : exposure === "underground" ? 0.22 : 1;
  const windGain = clamp((0.04 + windFactor * 0.46 + conditionWindBoost + normalizedIntensity * 0.14) * windExposureScale, 0, 0.78);
  const windCenterHz = Math.round(150 + windFactor * 220 + (phenomenon === "sandstorm" ? 90 : 0));
  const emberCrackleGain = phenomenon === "embers" ? clamp((0.18 + normalizedIntensity * 0.32) * (exposure === "indoor" ? 0.55 : 1), 0.12, 0.58) : 0;
  const shimmerDroneGain = (phenomenon === "aurora" || phenomenon === "fireflies") && exposure !== "underground" ? clamp((0.07 + normalizedIntensity * 0.12) * (exposure === "indoor" ? 0.5 : 1), 0.04, 0.24) : 0;
  const thunderGainScale = state.condition === "storm" ? clamp((0.45 + normalizedIntensity * 0.48) * (exposure === "indoor" ? 0.58 : exposure === "sheltered" ? 0.88 : exposure === "underground" ? 0.18 : 1), 0, 1) : 0;
  return {
    active: true,
    masterGain: Number(volume.toFixed(3)),
    lowpassHz,
    rainWashGain: Number((rainWashBase * rainExposureScale).toFixed(3)),
    rainPatterGain: Number((rainPatterBase * patterExposureScale).toFixed(3)),
    windGain: Number(windGain.toFixed(3)),
    windCenterHz,
    emberCrackleGain: Number(emberCrackleGain.toFixed(3)),
    shimmerDroneGain: Number(shimmerDroneGain.toFixed(3)),
    thunderGainScale: Number(thunderGainScale.toFixed(3))
  };
}
function resolveAudioContextConstructor() {
  if (typeof window === "undefined")
    return null;
  const win = window;
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}
function createNoiseBuffer(ctx, seconds, mode) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (mode === "brown") {
    let last = 0;
    for (let index = 0;index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.2;
    }
    return buffer;
  }
  if (mode === "crackle") {
    let envelope = 0;
    for (let index = 0;index < length; index += 1) {
      if (Math.random() < 0.0045)
        envelope = 0.65 + Math.random() * 0.35;
      envelope *= 0.985;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    return buffer;
  }
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0;index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

class WeatherSoundscape {
  ctx = null;
  masterGain = null;
  occlusionFilter = null;
  rainWashGain = null;
  rainPatterGain = null;
  windGain = null;
  windFilter = null;
  crackleGain = null;
  shimmerGain = null;
  pinkBuffer = null;
  brownBuffer = null;
  sources = [];
  thunderTimers = new Set;
  suspendTimer = null;
  lastProfile = null;
  destroyed = false;
  sync(state, prefs, visible) {
    const profile = resolveSoundscapeProfile(state, prefs, visible);
    this.lastProfile = profile;
    if (this.destroyed)
      return profile;
    if (!profile.active) {
      this.rampToSilence();
      return profile;
    }
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (!this.ensureGraph()) {
      return profile;
    }
    const ctx = this.ctx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const timeConstant = 0.28;
    this.masterGain?.gain.setTargetAtTime(profile.masterGain * 0.36, now, timeConstant);
    this.occlusionFilter?.frequency.setTargetAtTime(profile.lowpassHz, now, timeConstant);
    this.rainWashGain?.gain.setTargetAtTime(profile.rainWashGain, now, timeConstant);
    this.rainPatterGain?.gain.setTargetAtTime(profile.rainPatterGain * 0.55, now, timeConstant);
    this.windGain?.gain.setTargetAtTime(profile.windGain, now, timeConstant);
    this.windFilter?.frequency.setTargetAtTime(profile.windCenterHz, now, timeConstant);
    this.crackleGain?.gain.setTargetAtTime(profile.emberCrackleGain * 0.65, now, timeConstant);
    this.shimmerGain?.gain.setTargetAtTime(profile.shimmerDroneGain * 0.28, now, timeConstant);
    return profile;
  }
  triggerThunder(boltPositionPercent = 50) {
    const profile = this.lastProfile;
    if (this.destroyed || !profile || !profile.active || profile.thunderGainScale <= 0)
      return;
    if (!this.ensureGraph() || !this.ctx || !this.occlusionFilter)
      return;
    const ctx = this.ctx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const delayMs = 110 + Math.round(Math.random() * 240);
    const timer = window.setTimeout(() => {
      this.thunderTimers.delete(timer);
      if (this.destroyed || !this.ctx || !this.occlusionFilter || !this.brownBuffer)
        return;
      try {
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.brownBuffer;
        source.loop = true;
        source.playbackRate.value = 0.58 + Math.random() * 0.28;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(165, now);
        filter.frequency.exponentialRampToValueAtTime(52, now + 2.1);
        const gain = this.ctx.createGain();
        const peak = clamp(profile.thunderGainScale * 0.72, 0.08, 0.85);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(peak * 0.48, now + 0.38);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.35);
        source.connect(filter);
        if (typeof this.ctx.createStereoPanner === "function") {
          const panner = this.ctx.createStereoPanner();
          panner.pan.value = clamp((boltPositionPercent - 50) / 65, -0.75, 0.75);
          filter.connect(panner);
          panner.connect(gain);
        } else {
          filter.connect(gain);
        }
        gain.connect(this.occlusionFilter);
        source.start(now);
        source.stop(now + 2.45);
      } catch {}
    }, delayMs);
    this.thunderTimers.add(timer);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    for (const timer of this.thunderTimers)
      window.clearTimeout(timer);
    this.thunderTimers.clear();
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.sources = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
  rampToSilence() {
    if (!this.ctx || !this.masterGain)
      return;
    try {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      if (this.suspendTimer === null && this.ctx.state === "running") {
        this.suspendTimer = window.setTimeout(() => {
          this.suspendTimer = null;
          if (!this.destroyed && this.ctx && !this.lastProfile?.active && this.ctx.state === "running") {
            this.ctx.suspend().catch(() => {});
          }
        }, 260);
      }
    } catch {}
  }
  ensureGraph() {
    if (this.ctx)
      return true;
    const Ctor = resolveAudioContextConstructor();
    if (!Ctor)
      return false;
    try {
      const ctx = new Ctor;
      this.ctx = ctx;
      this.pinkBuffer = createNoiseBuffer(ctx, 4, "pink");
      this.brownBuffer = createNoiseBuffer(ctx, 4, "brown");
      const crackleBuffer = createNoiseBuffer(ctx, 3.5, "crackle");
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      const occlusionFilter = ctx.createBiquadFilter();
      occlusionFilter.type = "lowpass";
      occlusionFilter.frequency.value = 16000;
      occlusionFilter.Q.value = 0.5;
      occlusionFilter.connect(masterGain);
      masterGain.connect(ctx.destination);
      const rainWashSource = ctx.createBufferSource();
      rainWashSource.buffer = this.pinkBuffer;
      rainWashSource.loop = true;
      const rainWashFilter = ctx.createBiquadFilter();
      rainWashFilter.type = "bandpass";
      rainWashFilter.frequency.value = 1350;
      rainWashFilter.Q.value = 0.65;
      const rainWashGain = ctx.createGain();
      rainWashGain.gain.value = 0;
      rainWashSource.connect(rainWashFilter);
      rainWashFilter.connect(rainWashGain);
      rainWashGain.connect(occlusionFilter);
      const rainPatterSource = ctx.createBufferSource();
      rainPatterSource.buffer = crackleBuffer;
      rainPatterSource.loop = true;
      const rainPatterFilter = ctx.createBiquadFilter();
      rainPatterFilter.type = "bandpass";
      rainPatterFilter.frequency.value = 2850;
      rainPatterFilter.Q.value = 1.1;
      const rainPatterGain = ctx.createGain();
      rainPatterGain.gain.value = 0;
      rainPatterSource.connect(rainPatterFilter);
      rainPatterFilter.connect(rainPatterGain);
      rainPatterGain.connect(occlusionFilter);
      const windSource = ctx.createBufferSource();
      windSource.buffer = this.brownBuffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 220;
      windFilter.Q.value = 2.4;
      const windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(occlusionFilter);
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = crackleBuffer;
      crackleSource.loop = true;
      crackleSource.playbackRate.value = 0.84;
      const crackleFilter = ctx.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.value = 1950;
      crackleFilter.Q.value = 1.4;
      const crackleGain = ctx.createGain();
      crackleGain.gain.value = 0;
      crackleSource.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(occlusionFilter);
      const oscA = ctx.createOscillator();
      oscA.type = "sine";
      oscA.frequency.value = 220;
      const oscB = ctx.createOscillator();
      oscB.type = "sine";
      oscB.frequency.value = 329.63;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0;
      oscA.connect(shimmerGain);
      oscB.connect(shimmerGain);
      shimmerGain.connect(occlusionFilter);
      for (const source of [rainWashSource, rainPatterSource, windSource, crackleSource, oscA, oscB]) {
        source.start(0);
        this.sources.push(source);
      }
      this.masterGain = masterGain;
      this.occlusionFilter = occlusionFilter;
      this.rainWashGain = rainWashGain;
      this.rainPatterGain = rainPatterGain;
      this.windGain = windGain;
      this.windFilter = windFilter;
      this.crackleGain = crackleGain;
      this.shimmerGain = shimmerGain;
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }
}

// src/weather-icons.ts
function conditionIcon(condition, phase = "day") {
  switch (condition) {
    case "cloudy":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 18.2h10.7a3.8 3.8 0 00.6-7.55 5.5 5.5 0 00-10.45-1.2 4.4 4.4 0 00-.85 8.75Z"/></svg>`;
    case "rain":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 14.8h10.8a3.7 3.7 0 00.55-7.35A5.45 5.45 0 007.6 6.3a4.3 4.3 0 00-1 8.5Z"/><path d="m8.2 17.4-1 2.3M12.3 17.4l-1 2.3M16.4 17.4l-1 2.3"/></svg>`;
    case "storm":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14.5h10.9a3.7 3.7 0 00.55-7.35A5.45 5.45 0 007.6 6a4.3 4.3 0 00-1.1 8.5Z"/><path class="weather-hud-icon-solid" d="m13.1 12.8-3.25 5h2.45l-.75 3.7 4.6-5.65h-2.7l1.45-3.05Z"/></svg>`;
    case "snow":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8v18.4M4.05 7.4l15.9 9.2M4.05 16.6l15.9-9.2M12 2.8 9.8 5M12 2.8 14.2 5M12 21.2 9.8 19M12 21.2l2.2-2.2M4.05 7.4l3-.8M4.05 7.4l.8 3M19.95 16.6l-3 .8M19.95 16.6l-.8-3"/></svg>`;
    case "fog":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 13.5h11a3.45 3.45 0 00.5-6.85A5.1 5.1 0 008.2 5.6a4 4 0 00-1.8 7.9Z"/><path d="M4 17.1h13M7 20.2h13"/></svg>`;
    case "clear":
    default:
      if (phase === "night") {
        return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.7 8.7 0 019.8 3.5a8.7 8.7 0 1010.7 10.7Z"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.25"/><path d="M12 2.5v2.1M12 19.4v2.1M2.5 12h2.1M19.4 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"/></svg>`;
  }
}
function conditionIconLabel(condition, phase) {
  if (condition === "clear" && phase === "night")
    return "Clear night";
  return `${condition.charAt(0).toUpperCase()}${condition.slice(1)} weather`;
}

// src/state-utils.ts
function shouldApplyChatState(currentChatId, responseChatId, responseRequestId, activeRequestId) {
  if (responseRequestId !== undefined)
    return responseRequestId === activeRequestId;
  return activeRequestId === 0 || responseChatId === currentChatId;
}

// src/forecast-text.ts
function encodeForecastText(entries) {
  return entries.map(formatForecastEntry).join(`
`);
}
function decodeForecastText(text) {
  const entries = [];
  const invalidLines = [];
  const seenDates = new Set;
  const duplicateDates = new Set;
  for (const rawLine of text.split(`
`)) {
    const line = rawLine.trim();
    if (!line)
      continue;
    const entry = parseForecastEntry(line);
    if (entry) {
      entries.push(entry);
      if (seenDates.has(entry.date))
        duplicateDates.add(entry.date);
      seenDates.add(entry.date);
    } else
      invalidLines.push(line);
  }
  return {
    entries,
    invalidLines,
    duplicateDates: [...duplicateDates],
    exceedsDayLimit: seenDates.size > MAX_FORECAST_DAYS
  };
}
function forecastTextHint() {
  return `Up to ${MAX_FORECAST_DAYS} days, one day per line, such as 2026-01-16: snow, 30F, heavy flurries. Use each date once. Leave empty to clear the outlook.`;
}

// src/ui/settings.ts
var CONDITIONS = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
var PALETTES = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
var settingsInstanceCount = 0;
function createCodeBlock(text) {
  const code = document.createElement("pre");
  code.className = "weather-settings-code";
  code.textContent = text;
  return code;
}
function createLabeledInput(labelText, input) {
  const label = document.createElement("label");
  label.className = "weather-settings-label";
  label.textContent = labelText;
  label.appendChild(input);
  return label;
}
function createSection(titleText, copyText) {
  const section = document.createElement("section");
  section.className = "weather-settings-section weather-settings-glass-panel";
  const header = document.createElement("div");
  header.className = "weather-settings-section-header";
  const title = document.createElement("strong");
  title.className = "weather-settings-section-title";
  title.textContent = titleText;
  header.appendChild(title);
  if (copyText) {
    const copy = document.createElement("p");
    copy.className = "weather-settings-section-copy";
    copy.textContent = copyText;
    header.appendChild(copy);
  }
  const body = document.createElement("div");
  body.className = "weather-settings-section-body";
  section.appendChild(header);
  section.appendChild(body);
  return { section, body };
}
function formatRelativeTime(timestampMs) {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 10)
    return "just now";
  if (seconds < 60)
    return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)
    return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
function applyStateToInputs(state, fields) {
  if (state.condition)
    fields.conditionSelect.value = state.condition;
  if (state.palette)
    fields.paletteSelect.value = state.palette;
  if (state.exposure)
    fields.exposureSelect.value = state.exposure;
  if (state.phenomenon)
    fields.phenomenonSelect.value = state.phenomenon;
  if (state.location !== undefined)
    fields.locationInput.value = state.location;
  if (state.date !== undefined)
    fields.dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(state.date) ? state.date : "";
  if (state.time !== undefined)
    fields.timeInput.value = state.time;
  if (state.temperature !== undefined)
    fields.temperatureInput.value = state.temperature;
  if (state.wind !== undefined)
    fields.windInput.value = state.wind;
  if (state.windDirection)
    fields.windDirectionSelect.value = state.windDirection;
  if (state.summary !== undefined)
    fields.summaryInput.value = state.summary;
  if ("seasonOverride" in state || "season" in state)
    fields.seasonSelect.value = state.seasonOverride ?? "";
  if (state.forecast !== undefined)
    fields.forecastInput.value = encodeForecastText(state.forecast);
  if (typeof state.intensity === "number" && Number.isFinite(state.intensity)) {
    fields.sceneIntensity.value = state.intensity.toFixed(2);
    fields.sceneIntensityValue.textContent = `${Math.round(state.intensity * 100)}%`;
    fields.sceneIntensity.setAttribute("aria-valuetext", fields.sceneIntensityValue.textContent);
  }
}
function createSettingsUI(sendToBackend) {
  const instanceId = `lumiweather-settings-${++settingsInstanceCount}`;
  const root = document.createElement("section");
  root.className = "weather-settings-card";
  const header = document.createElement("header");
  header.className = "weather-settings-card-header";
  const headerGlow = document.createElement("span");
  headerGlow.className = "weather-settings-header-glow";
  const titleWrap = document.createElement("div");
  titleWrap.className = "weather-settings-titlewrap";
  const eyebrow = document.createElement("span");
  eyebrow.className = "weather-settings-eyebrow";
  eyebrow.textContent = "Ambient scene studio";
  const title = document.createElement("h3");
  title.textContent = "LumiWeather Studio";
  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(title);
  const status = document.createElement("span");
  status.className = "weather-settings-status";
  status.setAttribute("role", "status");
  header.appendChild(headerGlow);
  header.appendChild(titleWrap);
  header.appendChild(status);
  const body = document.createElement("div");
  body.className = "weather-settings-card-body";
  const preview = document.createElement("div");
  preview.className = "weather-settings-preview weather-settings-scene-hero";
  const previewGlow = document.createElement("span");
  previewGlow.className = "weather-settings-preview-glow";
  const previewLabel = document.createElement("span");
  previewLabel.className = "weather-settings-preview-label";
  previewLabel.textContent = "Live chat scene";
  const previewValue = document.createElement("strong");
  previewValue.className = "weather-settings-preview-value";
  const previewHint = document.createElement("span");
  previewHint.className = "weather-settings-preview-hint";
  previewHint.textContent = "Updates only from this chat's weather tag.";
  preview.appendChild(previewGlow);
  preview.appendChild(previewLabel);
  preview.appendChild(previewValue);
  preview.appendChild(previewHint);
  const promptSection = createSection("Prompt integration", "Add the recommended macro to your active system prompt or preset so the model keeps the scene in sync with your story.");
  const effectsSection = createSection("Effects", "Overall ambience, density, and motion.");
  const placementSection = createSection("Placement", "Control whether the weather stays behind the chat, in front, or both.");
  const motionSection = createSection("Motion", "Fine-tune animation pacing without breaking story sync.");
  const promptRecommended = document.createElement("div");
  promptRecommended.className = "weather-settings-copy-group";
  const promptRecommendedLabel = document.createElement("strong");
  promptRecommendedLabel.className = "weather-settings-copy-title";
  promptRecommendedLabel.textContent = "Recommended prompt snippet";
  const promptRecommendedCopy = document.createElement("p");
  promptRecommendedCopy.className = "weather-settings-section-copy";
  promptRecommendedCopy.textContent = "Place this directly in the active character or preset system prompt so the main model sees the weather instruction during generation.";
  promptRecommended.appendChild(promptRecommendedLabel);
  promptRecommended.appendChild(promptRecommendedCopy);
  promptRecommended.appendChild(createCodeBlock("{{weather_tracker}}"));
  const promptOptional = document.createElement("div");
  promptOptional.className = "weather-settings-copy-group";
  const promptOptionalLabel = document.createElement("strong");
  promptOptionalLabel.className = "weather-settings-copy-title";
  promptOptionalLabel.textContent = "Optional reference macros";
  const promptOptionalCopy = document.createElement("p");
  promptOptionalCopy.className = "weather-settings-section-copy";
  promptOptionalCopy.textContent = "These legacy aliases remain available for existing prompts. Current scene state is injected automatically; the format alias is useful only when you want to show the tag contract explicitly.";
  promptOptional.appendChild(promptOptionalLabel);
  promptOptional.appendChild(promptOptionalCopy);
  promptOptional.appendChild(createCodeBlock(`{{weather_visual_tags}}
{{weather_state}}
{{weather_format}}`));
  promptSection.body.appendChild(promptRecommended);
  promptSection.body.appendChild(promptOptional);
  const effectsLabel = document.createElement("label");
  effectsLabel.className = "weather-settings-label";
  effectsLabel.textContent = "Animated effects";
  const effectsToggle = document.createElement("input");
  effectsToggle.type = "checkbox";
  effectsToggle.className = "weather-settings-checkbox";
  effectsToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { effectsEnabled: effectsToggle.checked } });
  });
  effectsLabel.appendChild(effectsToggle);
  const lightningLabel = document.createElement("label");
  lightningLabel.className = "weather-settings-label";
  lightningLabel.textContent = "Lightning flashes";
  const lightningToggle = document.createElement("input");
  lightningToggle.type = "checkbox";
  lightningToggle.className = "weather-settings-checkbox";
  lightningToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { lightningFlashEnabled: lightningToggle.checked } });
  });
  lightningLabel.appendChild(lightningToggle);
  const soundLabel = document.createElement("label");
  soundLabel.className = "weather-settings-label";
  soundLabel.textContent = "Procedural soundscape";
  const soundToggle = document.createElement("input");
  soundToggle.type = "checkbox";
  soundToggle.className = "weather-settings-checkbox";
  soundToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { soundEnabled: soundToggle.checked } });
  });
  soundLabel.appendChild(soundToggle);
  const soundVolumeLabel = document.createElement("label");
  soundVolumeLabel.className = "weather-settings-label";
  soundVolumeLabel.textContent = "Soundscape volume";
  const soundVolumeRow = document.createElement("div");
  soundVolumeRow.className = "weather-settings-row";
  const soundVolumeSlider = document.createElement("input");
  soundVolumeSlider.type = "range";
  soundVolumeSlider.className = "weather-settings-range";
  soundVolumeSlider.setAttribute("aria-label", "Soundscape volume");
  soundVolumeSlider.min = "0.05";
  soundVolumeSlider.max = "1.00";
  soundVolumeSlider.step = "0.05";
  const soundVolumeValue = document.createElement("span");
  soundVolumeValue.className = "weather-settings-value";
  soundVolumeSlider.addEventListener("input", () => {
    const soundVolume = Number.parseFloat(soundVolumeSlider.value);
    soundVolumeValue.textContent = `${Math.round(soundVolume * 100)}%`;
    soundVolumeSlider.setAttribute("aria-valuetext", soundVolumeValue.textContent);
    sendToBackend({ type: "save_prefs", prefs: { soundVolume } });
  });
  soundVolumeRow.appendChild(soundVolumeSlider);
  soundVolumeRow.appendChild(soundVolumeValue);
  soundVolumeLabel.appendChild(soundVolumeRow);
  const layerLabel = document.createElement("label");
  layerLabel.className = "weather-settings-label";
  layerLabel.textContent = "Effect placement";
  const layerSelect = document.createElement("select");
  layerSelect.className = "weather-settings-select";
  layerSelect.innerHTML = `
    <option value="back">Back only</option>
    <option value="front">Front only</option>
    <option value="both">Front and back</option>
  `;
  layerSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { layerMode: layerSelect.value } });
  });
  layerLabel.appendChild(layerSelect);
  const temperatureUnitLabel = document.createElement("label");
  temperatureUnitLabel.className = "weather-settings-label";
  temperatureUnitLabel.textContent = "Temperature unit";
  const temperatureUnitSelect = document.createElement("select");
  temperatureUnitSelect.className = "weather-settings-select";
  temperatureUnitSelect.innerHTML = `
    <option value="fahrenheit">Fahrenheit</option>
    <option value="celsius">Celsius</option>
  `;
  temperatureUnitSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { temperatureUnit: temperatureUnitSelect.value } });
  });
  temperatureUnitLabel.appendChild(temperatureUnitSelect);
  const intensityLabel = document.createElement("label");
  intensityLabel.className = "weather-settings-label";
  intensityLabel.textContent = "Animation intensity";
  const intensityRow = document.createElement("div");
  intensityRow.className = "weather-settings-row";
  const intensitySlider = document.createElement("input");
  intensitySlider.type = "range";
  intensitySlider.className = "weather-settings-range";
  intensitySlider.setAttribute("aria-label", "Animation intensity");
  intensitySlider.min = "0.25";
  intensitySlider.max = "1.50";
  intensitySlider.step = "0.05";
  const intensityValue = document.createElement("span");
  intensityValue.className = "weather-settings-value";
  intensitySlider.addEventListener("input", () => {
    pendingIntensity = Number.parseFloat(intensitySlider.value);
    intensityValue.textContent = `${Math.round(pendingIntensity * 100)}%`;
    intensitySlider.setAttribute("aria-valuetext", intensityValue.textContent);
    if (intensitySaveTimer !== null)
      window.clearTimeout(intensitySaveTimer);
    intensitySaveTimer = window.setTimeout(() => {
      intensitySaveTimer = null;
      const intensity = pendingIntensity;
      pendingIntensity = null;
      if (intensity !== null)
        sendToBackend({ type: "save_prefs", prefs: { intensity } });
    }, 120);
  });
  intensityRow.appendChild(intensitySlider);
  intensityRow.appendChild(intensityValue);
  intensityLabel.appendChild(intensityRow);
  const motionLabel = document.createElement("label");
  motionLabel.className = "weather-settings-label";
  motionLabel.textContent = "Reduced motion";
  const motionSelect = document.createElement("select");
  motionSelect.className = "weather-settings-select";
  motionSelect.innerHTML = `
    <option value="never">Always animate</option>
    <option value="system">Follow system setting</option>
    <option value="always">Always reduce motion</option>
  `;
  motionSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { reducedMotion: motionSelect.value } });
  });
  motionLabel.appendChild(motionSelect);
  const pauseLabel = document.createElement("label");
  pauseLabel.className = "weather-settings-label";
  pauseLabel.textContent = "Pause motion";
  const pauseToggle = document.createElement("input");
  pauseToggle.type = "checkbox";
  pauseToggle.className = "weather-settings-checkbox";
  pauseToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { pauseEffects: pauseToggle.checked } });
  });
  pauseLabel.appendChild(pauseToggle);
  const clockLabel = document.createElement("label");
  clockLabel.className = "weather-settings-label";
  clockLabel.textContent = "HUD clock";
  const clockSelect = document.createElement("select");
  clockSelect.className = "weather-settings-select";
  clockSelect.innerHTML = `
    <option value="auto">Story time, live in manual lock</option>
    <option value="live">Always follow real time</option>
    <option value="story">Always follow story time</option>
  `;
  clockSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { clockMode: clockSelect.value } });
  });
  clockLabel.appendChild(clockSelect);
  const forecastLabel = document.createElement("label");
  forecastLabel.className = "weather-settings-label";
  forecastLabel.textContent = "Show forecast outlook";
  const forecastToggle = document.createElement("input");
  forecastToggle.type = "checkbox";
  forecastToggle.className = "weather-settings-checkbox";
  forecastToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { showForecast: forecastToggle.checked } });
  });
  forecastLabel.appendChild(forecastToggle);
  const transitionsLabel = document.createElement("label");
  transitionsLabel.className = "weather-settings-label";
  transitionsLabel.textContent = "Blend scene changes";
  const transitionsToggle = document.createElement("input");
  transitionsToggle.type = "checkbox";
  transitionsToggle.className = "weather-settings-checkbox";
  transitionsToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { transitionsEnabled: transitionsToggle.checked } });
  });
  transitionsLabel.appendChild(transitionsToggle);
  effectsSection.body.appendChild(effectsLabel);
  effectsSection.body.appendChild(lightningLabel);
  effectsSection.body.appendChild(soundLabel);
  effectsSection.body.appendChild(soundVolumeLabel);
  placementSection.body.appendChild(layerLabel);
  placementSection.body.appendChild(temperatureUnitLabel);
  motionSection.body.appendChild(intensityLabel);
  motionSection.body.appendChild(motionLabel);
  motionSection.body.appendChild(pauseLabel);
  motionSection.body.appendChild(transitionsLabel);
  motionSection.body.appendChild(clockLabel);
  motionSection.body.appendChild(forecastLabel);
  const manualCard = document.createElement("section");
  manualCard.className = "weather-settings-manual-card weather-settings-glass-panel";
  const manualHeader = document.createElement("div");
  manualHeader.className = "weather-settings-manual-header";
  const manualTitleWrap = document.createElement("div");
  manualTitleWrap.className = "weather-settings-manual-titlewrap";
  const manualEyebrow = document.createElement("span");
  manualEyebrow.className = "weather-settings-section-title";
  manualEyebrow.textContent = "Manual scene";
  const manualTitle = document.createElement("strong");
  manualTitle.textContent = "Lock the current chat to a custom weather scene";
  manualTitleWrap.appendChild(manualEyebrow);
  manualTitleWrap.appendChild(manualTitle);
  const manualModePill = document.createElement("span");
  manualModePill.className = "weather-settings-status-pill";
  manualHeader.appendChild(manualTitleWrap);
  manualHeader.appendChild(manualModePill);
  const manualHint = document.createElement("p");
  manualHint.className = "weather-settings-manual-hint";
  manualHint.textContent = "Quick presets apply immediately. The full editor below lets you refine the current scene and keep it locked until you resume story sync.";
  const manualError = document.createElement("p");
  manualError.id = `${instanceId}-error`;
  manualError.className = "weather-settings-error";
  manualError.setAttribute("role", "alert");
  manualError.hidden = true;
  const manualToggle = document.createElement("input");
  manualToggle.type = "checkbox";
  manualToggle.className = "weather-settings-checkbox";
  const manualToggleLabel = createLabeledInput("Manual override", manualToggle);
  const presetGrid = document.createElement("div");
  presetGrid.className = "weather-settings-preset-grid";
  const presetButtons = new Map;
  const conditionSelect = document.createElement("select");
  conditionSelect.className = "weather-settings-select";
  conditionSelect.innerHTML = CONDITIONS.map((condition) => `<option value="${condition}">${condition.charAt(0).toUpperCase()}${condition.slice(1)}</option>`).join("");
  const paletteSelect = document.createElement("select");
  paletteSelect.className = "weather-settings-select";
  paletteSelect.innerHTML = PALETTES.map((palette) => `<option value="${palette}">${palette.charAt(0).toUpperCase()}${palette.slice(1)}</option>`).join("");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "weather-settings-input";
  const locationInput = document.createElement("input");
  locationInput.type = "text";
  locationInput.className = "weather-settings-input";
  locationInput.placeholder = "Moon Harbor";
  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "weather-settings-input";
  timeInput.placeholder = "3:00 PM";
  const temperatureInput = document.createElement("input");
  temperatureInput.type = "text";
  temperatureInput.className = "weather-settings-input";
  temperatureInput.placeholder = "61F or 16C";
  const windInput = document.createElement("input");
  windInput.type = "text";
  windInput.className = "weather-settings-input";
  windInput.placeholder = "breezy";
  const windDirectionSelect = document.createElement("select");
  windDirectionSelect.className = "weather-settings-select";
  windDirectionSelect.setAttribute("aria-label", "Wind direction");
  windDirectionSelect.innerHTML = WEATHER_WIND_DIRECTIONS.map((direction) => `<option value="${direction}">${direction.charAt(0).toUpperCase()}${direction.slice(1)}</option>`).join("");
  const seasonSelect = document.createElement("select");
  seasonSelect.className = "weather-settings-select";
  seasonSelect.innerHTML = [
    `<option value="">Derived from date</option>`,
    ...WEATHER_SEASONS.map((season) => `<option value="${season}">${season.charAt(0).toUpperCase()}${season.slice(1)}</option>`)
  ].join("");
  const exposureSelect = document.createElement("select");
  exposureSelect.className = "weather-settings-select";
  exposureSelect.innerHTML = WEATHER_EXPOSURES.map((exposure) => `<option value="${exposure}">${exposure.charAt(0).toUpperCase()}${exposure.slice(1)}</option>`).join("");
  const phenomenonSelect = document.createElement("select");
  phenomenonSelect.className = "weather-settings-select";
  phenomenonSelect.innerHTML = WEATHER_PHENOMENA.map((phenomenon) => `<option value="${phenomenon}">${phenomenon.charAt(0).toUpperCase()}${phenomenon.slice(1)}</option>`).join("");
  const windControls = document.createElement("div");
  windControls.className = "weather-settings-wind-controls";
  windControls.appendChild(windInput);
  windControls.appendChild(windDirectionSelect);
  const summaryInput = document.createElement("input");
  summaryInput.type = "text";
  summaryInput.className = "weather-settings-input";
  summaryInput.placeholder = "Steady afternoon rain";
  const forecastInput = document.createElement("textarea");
  forecastInput.className = "weather-settings-input weather-settings-textarea";
  forecastInput.setAttribute("aria-label", "Outlook");
  forecastInput.rows = 3;
  forecastInput.placeholder = "2026-01-16: snow, 30F, heavy flurries";
  forecastInput.spellcheck = false;
  const forecastHint = document.createElement("p");
  forecastHint.id = `${instanceId}-forecast-hint`;
  forecastHint.className = "weather-settings-section-copy";
  forecastHint.textContent = forecastTextHint();
  forecastInput.setAttribute("aria-describedby", `${forecastHint.id} ${manualError.id}`);
  const forecastField = document.createElement("div");
  forecastField.className = "weather-settings-forecast-field";
  forecastField.appendChild(forecastInput);
  forecastField.appendChild(forecastHint);
  const sceneIntensityRow = document.createElement("div");
  sceneIntensityRow.className = "weather-settings-row";
  const sceneIntensity = document.createElement("input");
  sceneIntensity.type = "range";
  sceneIntensity.className = "weather-settings-range";
  sceneIntensity.setAttribute("aria-label", "Scene intensity");
  sceneIntensity.min = "0.00";
  sceneIntensity.max = "1.00";
  sceneIntensity.step = "0.05";
  const sceneIntensityValue = document.createElement("span");
  sceneIntensityValue.className = "weather-settings-value";
  sceneIntensity.addEventListener("input", () => {
    markManualDraftDirty();
    sceneIntensityValue.textContent = `${Math.round(Number.parseFloat(sceneIntensity.value) * 100)}%`;
    sceneIntensity.setAttribute("aria-valuetext", sceneIntensityValue.textContent);
  });
  sceneIntensityRow.appendChild(sceneIntensity);
  sceneIntensityRow.appendChild(sceneIntensityValue);
  const fields = {
    conditionSelect,
    paletteSelect,
    seasonSelect,
    exposureSelect,
    phenomenonSelect,
    locationInput,
    dateInput,
    timeInput,
    temperatureInput,
    windInput,
    windDirectionSelect,
    summaryInput,
    forecastInput,
    sceneIntensity,
    sceneIntensityValue
  };
  let currentState = null;
  let currentChatId;
  let manualDraftDirty = false;
  let intensitySaveTimer = null;
  let pendingIntensity = null;
  const manualFields = [
    conditionSelect,
    paletteSelect,
    seasonSelect,
    exposureSelect,
    phenomenonSelect,
    dateInput,
    locationInput,
    timeInput,
    temperatureInput,
    windInput,
    windDirectionSelect,
    summaryInput,
    forecastInput,
    sceneIntensity
  ];
  const clearManualError = () => {
    manualError.hidden = true;
    manualError.textContent = "";
    for (const field of manualFields)
      field.removeAttribute("aria-invalid");
  };
  const markManualDraftDirty = () => {
    manualDraftDirty = true;
    clearManualError();
  };
  for (const field of [
    conditionSelect,
    paletteSelect,
    seasonSelect,
    exposureSelect,
    phenomenonSelect,
    dateInput,
    locationInput,
    timeInput,
    temperatureInput,
    windInput,
    windDirectionSelect,
    summaryInput,
    forecastInput
  ]) {
    field.addEventListener("input", markManualDraftDirty);
    field.addEventListener("change", markManualDraftDirty);
  }
  for (const field of [dateInput, timeInput, temperatureInput])
    field.setAttribute("aria-describedby", manualError.id);
  const buildManualState = () => ({
    location: locationInput.value.trim() || currentState?.location,
    date: dateInput.value || currentState?.date,
    time: timeInput.value.trim() || currentState?.time,
    condition: conditionSelect.value,
    summary: summaryInput.value.trim() || currentState?.summary,
    temperature: temperatureInput.value.trim() || currentState?.temperature,
    wind: windInput.value.trim() || currentState?.wind,
    windDirection: windDirectionSelect.value,
    palette: paletteSelect.value,
    seasonOverride: seasonSelect.value || null,
    exposure: exposureSelect.value,
    phenomenon: phenomenonSelect.value,
    forecast: decodeForecastText(forecastInput.value).entries,
    intensity: Number.parseFloat(sceneIntensity.value),
    source: "manual"
  });
  const updatePresetSelection = (state) => {
    const activePresetId = matchWeatherScenePreset(state);
    for (const [presetId, button] of presetButtons) {
      button.classList.toggle("weather-settings-preset-active", presetId === activePresetId);
      button.setAttribute("aria-pressed", String(presetId === activePresetId));
    }
  };
  const showManualError = (message, field) => {
    clearManualError();
    manualError.textContent = message;
    manualError.hidden = false;
    field.setAttribute("aria-invalid", "true");
    field.focus();
    return false;
  };
  const applyManualState = (state) => {
    const nextState = state ?? buildManualState();
    const hasDate = typeof nextState.date === "string" && nextState.date.trim();
    const hasTime = typeof nextState.time === "string" && nextState.time.trim();
    if (hasDate && !hasTime || !hasDate && hasTime || hasDate && hasTime && parseStoryDateTime(nextState.date, nextState.time) === null) {
      return showManualError("Use a valid story date and time, such as 2026-01-15 and 3:00 PM.", hasDate ? timeInput : dateInput);
    }
    if (typeof nextState.temperature === "string" && nextState.temperature.trim() && !normalizeTemperatureToken(nextState.temperature)) {
      return showManualError("Temperature must include a numeric value and F or C, such as 61F or 16C.", temperatureInput);
    }
    if (state === undefined) {
      const forecast = decodeForecastText(forecastInput.value);
      if (forecast.invalidLines.length > 0) {
        return showManualError(`Fix the outlook line "${forecast.invalidLines[0].slice(0, 40)}". Use one day per line, such as 2026-01-16: snow, 30F, heavy flurries.`, forecastInput);
      }
      if (forecast.duplicateDates.length > 0)
        return showManualError(`Use ${forecast.duplicateDates[0]} only once in the outlook.`, forecastInput);
      if (forecast.exceedsDayLimit)
        return showManualError(`The outlook supports up to ${MAX_FORECAST_DAYS} days. Remove the extra days before applying.`, forecastInput);
    }
    manualDraftDirty = false;
    clearManualError();
    manualToggle.checked = true;
    sendToBackend({ type: "set_manual_state", state: nextState });
    return true;
  };
  for (const preset of WEATHER_SCENE_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weather-settings-preset";
    button.innerHTML = `
      <span class="weather-settings-preset-label">${preset.label}</span>
      <span class="weather-settings-preset-copy">${preset.description}</span>
    `;
    button.addEventListener("click", () => {
      const nextState = buildPresetWeatherState(preset.id, currentState);
      if (!nextState)
        return;
      applyStateToInputs({ ...currentState ?? {}, ...nextState }, fields);
      manualDraftDirty = false;
      applyManualState(nextState);
    });
    presetButtons.set(preset.id, button);
    presetGrid.appendChild(button);
  }
  manualToggle.addEventListener("change", () => {
    if (manualToggle.checked) {
      if (!applyManualState())
        manualToggle.checked = currentState?.source === "manual";
    } else {
      manualDraftDirty = false;
      clearManualError();
      sendToBackend({ type: "clear_manual_override" });
    }
  });
  const manualGrid = document.createElement("div");
  manualGrid.className = "weather-settings-manual-grid";
  manualGrid.appendChild(createLabeledInput("Condition", conditionSelect));
  manualGrid.appendChild(createLabeledInput("Palette", paletteSelect));
  manualGrid.appendChild(createLabeledInput("Season", seasonSelect));
  manualGrid.appendChild(createLabeledInput("Exposure", exposureSelect));
  manualGrid.appendChild(createLabeledInput("Phenomenon", phenomenonSelect));
  manualGrid.appendChild(createLabeledInput("Location", locationInput));
  manualGrid.appendChild(createLabeledInput("Story date", dateInput));
  manualGrid.appendChild(createLabeledInput("Story time", timeInput));
  manualGrid.appendChild(createLabeledInput("Temperature", temperatureInput));
  manualGrid.appendChild(createLabeledInput("Wind", windControls));
  manualGrid.appendChild(createLabeledInput("Summary", summaryInput));
  const forecastFieldLabel = createLabeledInput("Outlook", forecastField);
  forecastFieldLabel.classList.add("weather-settings-manual-field", "weather-settings-manual-field-wide");
  const sceneIntensityLabel = createLabeledInput("Scene intensity", sceneIntensityRow);
  const manualActions = document.createElement("div");
  manualActions.className = "weather-settings-actions";
  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "weather-settings-button weather-settings-button-primary";
  applyButton.textContent = "Apply manual weather";
  applyButton.addEventListener("click", () => {
    applyManualState();
  });
  const resumeButton = document.createElement("button");
  resumeButton.type = "button";
  resumeButton.className = "weather-settings-button";
  resumeButton.textContent = "Resume story sync";
  resumeButton.addEventListener("click", () => {
    manualToggle.checked = false;
    manualDraftDirty = false;
    clearManualError();
    sendToBackend({ type: "clear_manual_override" });
  });
  manualActions.appendChild(applyButton);
  manualActions.appendChild(resumeButton);
  manualCard.appendChild(manualHeader);
  manualCard.appendChild(manualHint);
  manualCard.appendChild(manualError);
  manualCard.appendChild(manualToggleLabel);
  manualCard.appendChild(presetGrid);
  manualCard.appendChild(manualGrid);
  manualCard.appendChild(forecastFieldLabel);
  manualCard.appendChild(sceneIntensityLabel);
  manualCard.appendChild(manualActions);
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "weather-settings-button";
  resetButton.textContent = "Reset HUD position";
  resetButton.addEventListener("click", () => {
    sendToBackend({ type: "reset_widget_position" });
  });
  const controlDeck = document.createElement("div");
  controlDeck.className = "weather-settings-control-deck";
  controlDeck.appendChild(effectsSection.section);
  controlDeck.appendChild(placementSection.section);
  controlDeck.appendChild(motionSection.section);
  body.appendChild(preview);
  body.appendChild(promptSection.section);
  body.appendChild(controlDeck);
  body.appendChild(manualCard);
  body.appendChild(resetButton);
  root.appendChild(header);
  root.appendChild(body);
  return {
    root,
    sync(prefs, state, statusOverride, chatId) {
      if (chatId !== currentChatId) {
        manualDraftDirty = false;
        clearManualError();
        currentChatId = chatId;
      }
      currentState = state;
      effectsToggle.checked = prefs.effectsEnabled;
      lightningToggle.checked = prefs.lightningFlashEnabled;
      soundToggle.checked = Boolean(prefs.soundEnabled);
      const soundVolume = prefs.soundVolume ?? 0.45;
      soundVolumeSlider.value = soundVolume.toFixed(2);
      soundVolumeValue.textContent = `${Math.round(soundVolume * 100)}%`;
      soundVolumeSlider.setAttribute("aria-valuetext", soundVolumeValue.textContent);
      layerSelect.value = prefs.layerMode;
      temperatureUnitSelect.value = prefs.temperatureUnit;
      if (pendingIntensity === null) {
        intensitySlider.value = String(prefs.intensity.toFixed(2));
        intensityValue.textContent = `${Math.round(prefs.intensity * 100)}%`;
        intensitySlider.setAttribute("aria-valuetext", intensityValue.textContent);
      }
      motionSelect.value = prefs.reducedMotion;
      pauseToggle.checked = prefs.pauseEffects;
      transitionsToggle.checked = prefs.transitionsEnabled;
      clockSelect.value = prefs.clockMode;
      forecastToggle.checked = prefs.showForecast;
      const chatAvailable = chatId !== null && statusOverride !== "No active chat";
      manualToggle.disabled = !chatAvailable;
      applyButton.disabled = !chatAvailable;
      resumeButton.disabled = !chatAvailable || !state || state.source === "story";
      for (const button of presetButtons.values())
        button.disabled = !chatAvailable;
      for (const field of manualFields)
        field.disabled = !chatAvailable;
      const displayTemperature = state ? formatTemperatureForUnit(state.temperature, prefs.temperatureUnit) : "";
      const stateMode = statusOverride ? "notice" : state?.source ?? "waiting";
      status.dataset.mode = stateMode;
      preview.dataset.mode = stateMode;
      preview.dataset.condition = state?.condition ?? "waiting";
      status.textContent = statusOverride ?? (state ? `${state.source === "manual" ? "manual" : "story"} / ${state.condition} ${displayTemperature} · synced ${formatRelativeTime(state.updatedAt)}` : "Waiting for LumiWeather");
      const lunar = state ? resolveLunarPhase(state.date, state.time) : null;
      previewValue.textContent = state ? [
        `${state.location} | ${state.date} at ${state.time} | ${displayTemperature} | ${state.summary} | ${state.wind}${state.windDirection === "none" ? "" : ` from ${state.windDirection}`} | ${state.exposure ?? "outdoor"}${state.phenomenon && state.phenomenon !== "none" ? ` · ${state.phenomenon}` : ""}${lunar ? ` | ${lunar.label}` : ""} | placement ${prefs.layerMode}`,
        state.forecast.length > 0 ? `Outlook: ${state.forecast.map((entry) => formatForecastEntry({ ...entry, temperature: formatTemperatureForUnit(entry.temperature, prefs.temperatureUnit) })).join(" | ")}` : ""
      ].filter(Boolean).join(" · ") : "Add {{weather_tracker}} to the active prompt, then the HUD will wake up as soon as the model emits its first weather-state tag.";
      previewHint.textContent = !chatAvailable ? "Open a chat to view or customize its weather scene." : state?.source === "manual" ? "This chat stays locked to your scene until you resume story sync." : "This chat's weather tag keeps the scene in sync with the story.";
      manualModePill.textContent = state?.source === "manual" ? "Manual lock" : "Story sync";
      manualModePill.dataset.mode = state?.source === "manual" ? "manual" : "story";
      manualToggle.checked = state?.source === "manual";
      if (state && !manualDraftDirty) {
        applyStateToInputs(state, fields);
      } else if (!state && !manualDraftDirty) {
        conditionSelect.value = "clear";
        paletteSelect.value = "day";
        seasonSelect.value = "";
        exposureSelect.value = "outdoor";
        phenomenonSelect.value = "none";
        locationInput.value = "";
        dateInput.value = "";
        timeInput.value = "";
        temperatureInput.value = "";
        windInput.value = "";
        windDirectionSelect.value = "none";
        summaryInput.value = "";
        forecastInput.value = "";
        sceneIntensity.value = "0.30";
        sceneIntensityValue.textContent = "30%";
      }
      updatePresetSelection(state);
      sceneIntensity.setAttribute("aria-valuetext", sceneIntensityValue.textContent ?? "");
    },
    reportError(message) {
      manualDraftDirty = true;
      clearManualError();
      manualError.textContent = message;
      manualError.hidden = false;
      manualToggle.checked = currentState?.source === "manual";
    },
    destroy() {
      if (intensitySaveTimer !== null)
        window.clearTimeout(intensitySaveTimer);
      if (pendingIntensity !== null) {
        sendToBackend({ type: "save_prefs", prefs: { intensity: pendingIntensity } });
        pendingIntensity = null;
      }
      root.remove();
    }
  };
}

// src/ui/styles.ts
var WEATHER_HUD_CSS = `
@property --weather-bg-start {
  syntax: "<color>";
  inherits: true;
  initial-value: #4d77ad;
}

@property --weather-bg-mid {
  syntax: "<color>";
  inherits: true;
  initial-value: #7fa8de;
}

@property --weather-bg-end {
  syntax: "<color>";
  inherits: true;
  initial-value: #d8ebff;
}

@property --weather-glow {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 243, 202, 0.78);
}

@property --weather-beam-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 244, 212, 0.44);
}

@property --weather-horizon-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(185, 212, 244, 0.28);
}

@property --weather-cloud-core {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(237, 244, 255, 0.34);
}

@property --weather-cloud-edge {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 255, 255, 0.12);
}

@property --weather-fog-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(236, 241, 255, 0.18);
}

@property --weather-mist-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(228, 238, 248, 0.24);
}

@property --weather-sky-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.05;
}

@property --weather-glow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.1;
}

@property --weather-beam-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.12;
}

@property --weather-cloud-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.06;
}

@property --weather-horizon-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-mist-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.03;
}

@property --weather-fog-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-rain-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-snow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-mote-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-star-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-moonlight-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-aurora-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-window-droplet-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-phenomenon-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-flash-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.26;
}

.weather-settings-card {
  width: 100%;
  border: 1px solid var(--lumiverse-border);
  border-radius: calc(var(--lumiverse-radius) + 2px);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
  color: var(--lumiverse-text);
  overflow: hidden;
}

.weather-settings-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--lumiverse-border);
}

.weather-settings-card-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.weather-settings-status {
  font-size: 11px;
  color: var(--lumiverse-text-muted);
  text-transform: capitalize;
}

.weather-settings-card-body {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.weather-settings-preview {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 84%, transparent);
  font-size: 11px;
  line-height: 1.5;
  color: var(--lumiverse-text);
}

.weather-settings-section,
.weather-settings-manual-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
}

.weather-settings-section-header {
  display: grid;
  gap: 6px;
}

.weather-settings-section-body {
  display: grid;
  gap: 10px;
}

.weather-settings-section-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--lumiverse-text-muted);
}

.weather-settings-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-danger, #ef4444) 28%, transparent);
  background: color-mix(in srgb, var(--lumiverse-danger, #ef4444) 10%, transparent);
  color: var(--lumiverse-danger, #ef4444);
  font-size: 11px;
  line-height: 1.4;
}

.weather-settings-copy-group {
  display: grid;
  gap: 6px;
}

.weather-settings-copy-title {
  font-size: 11px;
  color: color-mix(in srgb, var(--lumiverse-text) 92%, transparent);
}

.weather-settings-code {
  margin: 0;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 90%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 96%, transparent);
  color: color-mix(in srgb, var(--lumiverse-text) 94%, transparent);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

.weather-settings-label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--lumiverse-text-muted);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button,
.weather-hud-select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 92%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  font-size: 12px;
}

.weather-settings-button {
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-button:hover {
  border-color: var(--lumiverse-border-hover);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 90%, transparent);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 26%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 12%, var(--lumiverse-fill));
  color: var(--lumiverse-text);
}

.weather-settings-button-primary:hover {
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 18%, var(--lumiverse-fill-subtle));
}

.weather-settings-button:disabled,
.weather-settings-preset:disabled,
.weather-settings-checkbox:disabled,
.weather-settings-select:disabled,
.weather-settings-input:disabled,
.weather-settings-range:disabled,
.weather-hud-control:disabled,
.weather-hud-chip:disabled,
.weather-hud-preset:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.weather-settings-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
}

.weather-settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.weather-settings-range,
.weather-hud-range {
  width: 100%;
}

.weather-settings-value {
  min-width: 44px;
  text-align: right;
  font-size: 11px;
  color: var(--lumiverse-text);
}

.weather-settings-manual-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 10px;
}

.weather-settings-manual-titlewrap {
  display: grid;
  gap: 4px;
}

.weather-settings-manual-titlewrap strong {
  font-size: 13px;
}

.weather-settings-status-pill {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
}

.weather-settings-status-pill[data-mode="manual"] {
  color: var(--lumiverse-text);
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 22%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill));
}

.weather-settings-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.weather-settings-preset {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 24%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill-subtle));
}

.weather-settings-preset-label {
  font-size: 11px;
  font-weight: 600;
}

.weather-settings-preset-copy {
  font-size: 10px;
  line-height: 1.35;
  color: var(--lumiverse-text-muted);
}

.weather-settings-manual-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* The outlook editor spans both columns and sits outside the grid, so it always
   gets the full panel width regardless of the grid's column count. */
.weather-settings-manual-field-wide {
  grid-column: 1 / -1;
}

.weather-settings-textarea {
  min-height: 68px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.45;
  white-space: pre;
  overflow-x: auto;
}

.weather-settings-forecast-field {
  display: grid;
  gap: 6px;
}

.weather-settings-wind-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(104px, 0.5fr);
  gap: 8px;
  min-width: 0;
}

.weather-settings-actions {
  display: flex;
  gap: 8px;
}

.weather-settings-actions .weather-settings-button {
  flex: 1 1 0;
}

/* LumiWeather Studio: layered glass control surface. */
.weather-settings-card {
  --lumi-glass-fill: color-mix(in srgb, var(--lumiverse-fill, #101827) 72%, rgba(25, 50, 87, 0.64));
  --lumi-glass-soft: color-mix(in srgb, var(--lumiverse-fill-subtle, #172338) 68%, rgba(116, 168, 255, 0.1));
  --lumi-glass-line: color-mix(in srgb, var(--lumiverse-border, #33425a) 68%, rgba(183, 220, 255, 0.32));
  position: relative;
  isolation: isolate;
  border: 1px solid var(--lumi-glass-line);
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 88% -12%, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 35%, transparent), transparent 46%),
    radial-gradient(ellipse at 6% 102%, rgba(99, 213, 255, 0.15), transparent 44%),
    linear-gradient(150deg, color-mix(in srgb, var(--lumi-glass-fill) 94%, #162842) 0%, var(--lumi-glass-fill) 52%, color-mix(in srgb, var(--lumi-glass-fill) 88%, #0c1422) 100%);
  box-shadow:
    0 28px 72px rgba(4, 12, 28, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(4, 10, 22, 0.18);
  backdrop-filter: blur(24px) saturate(145%);
}

.weather-settings-card::before,
.weather-settings-card::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

.weather-settings-card::before {
  inset: 0;
  opacity: 0.72;
  background:
    linear-gradient(112deg, rgba(255, 255, 255, 0.09), transparent 28%, transparent 72%, rgba(177, 214, 255, 0.08)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 4px);
  mix-blend-mode: screen;
}

.weather-settings-card::after {
  width: 260px;
  height: 260px;
  right: -130px;
  top: 88px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 30%, transparent), transparent 68%);
  filter: blur(10px);
}

.weather-settings-card-header {
  position: relative;
  z-index: 1;
  min-height: 60px;
  padding: 17px 18px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.018));
}

.weather-settings-header-glow {
  position: absolute;
  inset: -32px auto auto -26px;
  width: 176px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(132, 191, 255, 0.24), transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}

.weather-settings-titlewrap,
.weather-settings-status {
  position: relative;
  z-index: 1;
}

.weather-settings-titlewrap {
  display: grid;
  gap: 5px;
}

.weather-settings-eyebrow {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 78%, var(--lumiverse-text-muted));
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.weather-settings-card-header h3 {
  font-size: 18px;
  font-weight: 720;
  letter-spacing: -0.025em;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
}

.weather-settings-status {
  max-width: min(48%, 228px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--lumiverse-fill, #111c2c) 52%, rgba(255, 255, 255, 0.11));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  font-size: 10px;
  line-height: 1.25;
  text-align: right;
  text-transform: none;
}

.weather-settings-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 6px 1px 0;
  border-radius: 50%;
  background: #86d7ff;
  box-shadow: 0 0 12px rgba(134, 215, 255, 0.82);
}

.weather-settings-status[data-mode="manual"]::before {
  background: #f3c989;
  box-shadow: 0 0 12px rgba(243, 201, 137, 0.8);
}

.weather-settings-status[data-mode="notice"]::before,
.weather-settings-status[data-mode="waiting"]::before {
  background: #aab7c9;
  box-shadow: none;
}

.weather-settings-card-body {
  position: relative;
  z-index: 1;
  gap: 14px;
  padding: 15px;
}

.weather-settings-scene-hero {
  position: relative;
  display: grid;
  align-content: start;
  min-height: 102px;
  gap: 7px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 84%, transparent);
  border-radius: 19px;
  background:
    radial-gradient(circle at 86% 18%, var(--lumi-scene-glow, rgba(139, 200, 255, 0.32)), transparent 26%),
    linear-gradient(128deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.025) 48%, rgba(5, 16, 33, 0.16));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 14px 34px rgba(5, 14, 28, 0.12);
}

.weather-settings-preview-glow {
  position: absolute;
  width: 150px;
  height: 150px;
  right: -44px;
  bottom: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lumi-scene-glow, rgba(121, 185, 255, 0.38)), transparent 70%);
  filter: blur(4px);
}

.weather-settings-preview-label,
.weather-settings-preview-value,
.weather-settings-preview-hint {
  position: relative;
  z-index: 1;
}

.weather-settings-preview-label {
  color: var(--lumiverse-text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.weather-settings-preview-value {
  max-width: 76ch;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
  font-size: 12px;
  font-weight: 590;
  line-height: 1.48;
}

.weather-settings-preview-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 94%, white 6%);
  font-size: 10px;
}

.weather-settings-scene-hero[data-condition="rain"],
.weather-settings-scene-hero[data-condition="storm"] {
  --lumi-scene-glow: rgba(127, 167, 255, 0.34);
}

.weather-settings-scene-hero[data-condition="snow"] {
  --lumi-scene-glow: rgba(222, 240, 255, 0.4);
}

.weather-settings-scene-hero[data-condition="fog"] {
  --lumi-scene-glow: rgba(208, 225, 233, 0.3);
}

.weather-settings-glass-panel {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 82%, transparent);
  border-radius: 18px;
  background:
    linear-gradient(144deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 44%, rgba(0, 0, 0, 0.04)),
    var(--lumi-glass-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 12px 26px rgba(4, 13, 27, 0.1);
  backdrop-filter: blur(16px) saturate(135%);
}

.weather-settings-section,
.weather-settings-manual-card {
  gap: 12px;
  padding: 14px;
}

.weather-settings-section-header {
  gap: 7px;
}

.weather-settings-section-title {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 68%, var(--lumiverse-text-muted));
  font-weight: 720;
  letter-spacing: 0.15em;
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 92%, white 8%);
}

.weather-settings-control-deck {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.weather-settings-control-deck .weather-settings-section {
  min-width: 0;
}

.weather-settings-control-deck .weather-settings-section:nth-child(3) {
  grid-column: span 2;
}

.weather-settings-section-body,
.weather-settings-copy-group {
  gap: 9px;
}

.weather-settings-copy-group {
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 62%, transparent);
  border-radius: 13px;
  background: rgba(4, 14, 29, 0.1);
}

.weather-settings-copy-title {
  color: color-mix(in srgb, var(--lumiverse-text) 95%, white 5%);
}

.weather-settings-code {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 78%, transparent);
  border-radius: 12px;
  background: rgba(3, 12, 27, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.weather-settings-label {
  gap: 8px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 58%, transparent);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: color-mix(in srgb, var(--lumiverse-text-muted) 90%, white 10%);
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.weather-settings-label:focus-within {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 52%, var(--lumi-glass-line));
  background: rgba(117, 170, 255, 0.08);
  transform: translateY(-1px);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill, #101827) 58%, rgba(255, 255, 255, 0.12));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
}

.weather-settings-select,
.weather-settings-input {
  min-height: 35px;
}

.weather-settings-button {
  min-height: 37px;
  border-radius: 12px;
  font-weight: 620;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 18px rgba(4, 13, 28, 0.09);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 56%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 42%, rgba(255, 255, 255, 0.12)), color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 20%, rgba(9, 23, 46, 0.5)));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.19), 0 10px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 17%, transparent);
}

.weather-settings-checkbox {
  width: 19px;
  height: 19px;
  accent-color: var(--lumiverse-primary, #82a8ff);
  filter: drop-shadow(0 2px 5px rgba(2, 12, 26, 0.28));
}

.weather-settings-range {
  accent-color: var(--lumiverse-primary, #82a8ff);
}

.weather-settings-row {
  gap: 8px;
}

.weather-settings-value {
  min-width: 42px;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 66%, transparent);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: color-mix(in srgb, var(--lumiverse-text) 92%, white 8%);
}

.weather-settings-status-pill {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset-grid {
  gap: 9px;
}

.weather-settings-preset {
  min-height: 72px;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 58%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 21%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.045));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 13%, transparent);
}

.weather-settings-manual-card {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 25%, var(--lumi-glass-line));
}

.weather-hud-widget {
  --weather-hud-shell-top: #16273d;
  --weather-hud-shell-mid: #17314f;
  --weather-hud-shell-bottom: #101d31;
  --weather-hud-aura-primary: rgba(255, 218, 162, 0.22);
  --weather-hud-aura-secondary: rgba(116, 164, 255, 0.18);
  --weather-hud-aura-soft: rgba(255, 255, 255, 0.07);
  --weather-hud-line: rgba(255, 255, 255, 0.14);
  --weather-hud-surface: rgba(255, 255, 255, 0.08);
  --weather-hud-surface-strong: rgba(255, 255, 255, 0.12);
  --weather-hud-surface-active: rgba(103, 145, 220, 0.3);
  --weather-hud-shadow: rgba(3, 10, 23, 0.38);
  --weather-hud-text-soft: rgba(234, 241, 255, 0.76);
  --weather-hud-text-muted: rgba(222, 231, 247, 0.62);
  --weather-hud-accent: #9dc0ff;
  --weather-hud-icon-bg: rgba(255, 255, 255, 0.11);
  --weather-hud-icon-color: #fff1c7;
  --weather-hud-scene-intensity: 1;
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 13px 13px 15px;
  box-sizing: border-box;
  border-radius: 20px;
  color: #f5f8ff;
  overflow: hidden;
  backdrop-filter: blur(18px) saturate(132%);
  background:
    radial-gradient(circle at 84% 16%, var(--weather-hud-aura-primary), transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, var(--weather-hud-shell-top) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border: 1px solid var(--weather-hud-line);
  box-shadow:
    0 22px 46px var(--weather-hud-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-widget[data-presentation="mobile-launcher"] {
  width: 40px;
  height: 40px;
  display: block;
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
}

.weather-hud-widget[data-presentation="mobile-launcher"] > .weather-hud-header,
.weather-hud-widget[data-presentation="mobile-launcher"] > .weather-hud-body {
  display: none;
}

.weather-hud-launcher {
  appearance: none;
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--weather-hud-icon-color);
  cursor: grab;
  touch-action: none;
}

.weather-hud-launcher:active {
  cursor: grabbing;
}

.weather-hud-launcher:focus-visible {
  outline: 2px solid var(--lumiverse-primary, var(--weather-hud-accent));
  outline-offset: -3px;
}

.weather-hud-launcher-icon,
.weather-hud-launcher-icon svg {
  width: 24px;
  height: 24px;
  display: block;
}

.weather-hud-launcher-icon svg {
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 3px rgba(1, 8, 18, 0.48));
}

.weather-hud-launcher-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-widget[data-presentation="mobile-panel"] {
  width: 100%;
  height: 100%;
  min-height: 0;
  align-content: start;
  gap: 14px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-right: max(14px, env(safe-area-inset-right));
  padding-bottom: calc(16px + max(env(safe-area-inset-bottom), var(--weather-keyboard-inset-bottom, 0px)));
  padding-left: max(14px, env(safe-area-inset-left));
  border-radius: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  user-select: auto;
}

.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-header,
.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-body,
.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-drawer {
  width: min(100%, 560px);
  margin-inline: auto;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-control,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-chip,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-preset,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-select {
  min-height: 44px;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-gear {
  width: 44px;
  height: 44px;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-range {
  min-height: 44px;
}

.weather-hud-widget::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 34%),
    radial-gradient(circle at 18% 20%, var(--weather-hud-aura-soft), transparent 26%),
    linear-gradient(120deg, transparent 28%, rgba(255, 255, 255, 0.05) 45%, transparent 60%);
  pointer-events: none;
}

.weather-hud-widget::after {
  content: "";
  position: absolute;
  inset: auto -10% -36% 26%;
  height: 66%;
  background: radial-gradient(circle at center, color-mix(in srgb, var(--weather-hud-aura-secondary) 90%, transparent) 0%, transparent 68%);
  /* Sun altitude (-90 midnight to +90 noon) softens the aura toward night. */
  opacity: calc((0.35 + 0.55 * (var(--weather-sun-altitude, 0) + 90) / 180) * var(--weather-hud-scene-intensity));
  filter: blur(30px);
  transform: translate3d(0, 0, 0);
  animation: weather-hud-drift 12s ease-in-out infinite alternate;
  pointer-events: none;
}

.weather-hud-widget[data-time-phase="dawn"] {
  --weather-hud-shell-top: #30324f;
  --weather-hud-shell-mid: #6b536d;
  --weather-hud-shell-bottom: #26394c;
  --weather-hud-aura-primary: rgba(255, 196, 139, 0.34);
  --weather-hud-aura-secondary: rgba(121, 187, 255, 0.24);
  --weather-hud-aura-soft: rgba(255, 221, 176, 0.1);
  --weather-hud-accent: #ffcf9d;
}

.weather-hud-widget[data-time-phase="day"] {
  --weather-hud-shell-top: #1d3550;
  --weather-hud-shell-mid: #295075;
  --weather-hud-shell-bottom: #17283f;
  --weather-hud-aura-primary: rgba(255, 228, 162, 0.28);
  --weather-hud-aura-secondary: rgba(120, 193, 255, 0.26);
  --weather-hud-aura-soft: rgba(207, 227, 255, 0.1);
  --weather-hud-accent: #9ed0ff;
}

.weather-hud-widget[data-time-phase="dusk"] {
  --weather-hud-shell-top: #382c4c;
  --weather-hud-shell-mid: #674967;
  --weather-hud-shell-bottom: #202641;
  --weather-hud-aura-primary: rgba(255, 176, 123, 0.28);
  --weather-hud-aura-secondary: rgba(139, 142, 255, 0.22);
  --weather-hud-aura-soft: rgba(255, 207, 161, 0.09);
  --weather-hud-accent: #ffb88d;
}

.weather-hud-widget[data-time-phase="night"] {
  --weather-hud-shell-top: #131d31;
  --weather-hud-shell-mid: #18253f;
  --weather-hud-shell-bottom: #0d1524;
  --weather-hud-aura-primary: rgba(138, 167, 255, 0.16);
  --weather-hud-aura-secondary: rgba(84, 123, 206, 0.18);
  --weather-hud-aura-soft: rgba(192, 214, 255, 0.06);
  --weather-hud-accent: #97b8ff;
}

.weather-hud-widget[data-condition="clear"] {
  --weather-hud-icon-bg: rgba(255, 248, 222, 0.12);
  --weather-hud-icon-color: #fff1b2;
}

.weather-hud-widget[data-condition="cloudy"] {
  --weather-hud-aura-primary: rgba(206, 221, 255, 0.16);
  --weather-hud-aura-secondary: rgba(102, 139, 190, 0.16);
  --weather-hud-icon-bg: rgba(228, 237, 255, 0.11);
  --weather-hud-icon-color: #eef4ff;
}

.weather-hud-widget[data-condition="rain"] {
  --weather-hud-shell-top: #17283d;
  --weather-hud-shell-mid: #20344d;
  --weather-hud-shell-bottom: #0e1624;
  --weather-hud-aura-primary: rgba(118, 155, 220, 0.16);
  --weather-hud-aura-secondary: rgba(88, 126, 174, 0.16);
  --weather-hud-aura-soft: rgba(188, 215, 255, 0.05);
  --weather-hud-accent: #8db9ff;
  --weather-hud-icon-bg: rgba(194, 220, 255, 0.12);
  --weather-hud-icon-color: #dfeeff;
}

.weather-hud-widget[data-condition="storm"] {
  --weather-hud-shell-top: #141b2d;
  --weather-hud-shell-mid: #1b2841;
  --weather-hud-shell-bottom: #0b111c;
  --weather-hud-aura-primary: rgba(123, 146, 255, 0.18);
  --weather-hud-aura-secondary: rgba(82, 108, 182, 0.2);
  --weather-hud-aura-soft: rgba(220, 230, 255, 0.05);
  --weather-hud-accent: #a7b9ff;
  --weather-hud-icon-bg: rgba(205, 215, 255, 0.1);
  --weather-hud-icon-color: #eef2ff;
}

.weather-hud-widget[data-condition="snow"] {
  --weather-hud-shell-top: #233244;
  --weather-hud-shell-mid: #324860;
  --weather-hud-shell-bottom: #182230;
  --weather-hud-aura-primary: rgba(225, 236, 255, 0.22);
  --weather-hud-aura-secondary: rgba(162, 203, 255, 0.18);
  --weather-hud-aura-soft: rgba(240, 246, 255, 0.09);
  --weather-hud-accent: #d9e9ff;
  --weather-hud-icon-bg: rgba(235, 243, 255, 0.14);
  --weather-hud-icon-color: #ffffff;
}

.weather-hud-widget[data-condition="fog"] {
  --weather-hud-shell-top: #23303e;
  --weather-hud-shell-mid: #314153;
  --weather-hud-shell-bottom: #1a2430;
  --weather-hud-aura-primary: rgba(214, 222, 232, 0.18);
  --weather-hud-aura-secondary: rgba(168, 184, 208, 0.15);
  --weather-hud-aura-soft: rgba(244, 246, 250, 0.06);
  --weather-hud-accent: #d5deeb;
  --weather-hud-icon-bg: rgba(232, 238, 245, 0.12);
  --weather-hud-icon-color: #f6f8fb;
}

.weather-hud-widget[data-source="manual"] {
  background:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--weather-hud-aura-primary) 90%, rgba(198, 226, 255, 0.26)) 0%, transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, color-mix(in srgb, var(--weather-hud-shell-top) 90%, rgba(24, 49, 87, 0.7)) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.16));
}

.weather-hud-header,
.weather-hud-body,
.weather-hud-drawer {
  position: relative;
  z-index: 1;
}

.weather-hud-widget[data-empty="true"] .weather-hud-summary {
  color: var(--weather-hud-text-muted);
}

.weather-hud-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.weather-hud-titlewrap {
  display: grid;
  gap: 6px;
}

.weather-hud-eyebrow {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-source {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 9px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 82%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 90%, transparent);
  color: rgba(242, 247, 255, 0.92);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weather-hud-control,
.weather-hud-gear,
.weather-hud-chip,
.weather-hud-preset {
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 84%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 96%, transparent);
  color: inherit;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.weather-hud-control:hover,
.weather-hud-gear:hover,
.weather-hud-chip:hover,
.weather-hud-preset:hover {
  background: color-mix(in srgb, var(--weather-hud-surface-strong) 96%, transparent);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 18%, rgba(255, 255, 255, 0.2));
  transform: translateY(-1px);
}

.weather-hud-control,
.weather-hud-gear {
  border-radius: 11px;
}

.weather-hud-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 11px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.15;
  text-align: center;
}

.weather-hud-control-ghost {
  background: rgba(255, 255, 255, 0.04);
}

.weather-hud-control-active {
  background: color-mix(in srgb, var(--weather-hud-accent) 24%, rgba(255, 255, 255, 0.06));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-control-icon,
.weather-hud-gear svg {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.weather-hud-gear {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.weather-settings-select:focus-visible,
.weather-settings-input:focus-visible,
.weather-settings-button:focus-visible,
.weather-settings-checkbox:focus-visible,
.weather-settings-range:focus-visible,
.weather-hud-control:focus-visible,
.weather-hud-gear:focus-visible,
.weather-hud-chip:focus-visible,
.weather-hud-preset:focus-visible,
.weather-hud-select:focus-visible,
.weather-hud-range:focus-visible {
  outline: 2px solid var(--lumiverse-primary, var(--weather-hud-accent, #9dc0ff));
  outline-offset: 2px;
}

.weather-hud-gear svg,
.weather-hud-control-icon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.weather-hud-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 10px;
  align-items: end;
}

.weather-hud-primary {
  display: grid;
  min-width: 0;
  gap: 4px;
  transform: translateY(-7px);
}

.weather-hud-location {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(245, 248, 255, 0.92);
  max-width: 168px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-wrap: balance;
}

.weather-hud-date {
  font-size: 10px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-time {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 0.94;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
}

.weather-hud-wind {
  font-size: 11px;
  color: var(--weather-hud-text-muted);
}

.weather-hud-weather {
  display: grid;
  width: 100%;
  min-width: 0;
  align-content: start;
  justify-items: end;
  gap: 6px;
  text-align: right;
  transform: translateY(-9px);
}

.weather-hud-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--weather-hud-icon-color) 24%, rgba(255, 255, 255, 0.1));
  background:
    radial-gradient(circle at 32% 22%, color-mix(in srgb, var(--weather-hud-icon-color) 14%, transparent), transparent 48%),
    linear-gradient(155deg, color-mix(in srgb, var(--weather-hud-icon-bg) 76%, white 16%), color-mix(in srgb, var(--weather-hud-icon-bg) 88%, rgba(6, 15, 30, 0.34)));
  color: var(--weather-hud-icon-color);
  box-shadow:
    0 10px 24px rgba(3, 10, 23, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -10px 18px rgba(4, 12, 24, 0.12);
}

.weather-hud-icon svg {
  width: 27px;
  height: 27px;
  display: block;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 3px rgba(1, 8, 18, 0.48));
}

.weather-hud-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-temp {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 0.94;
}

.weather-hud-summary-viewport {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 15px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}

.weather-hud-summary {
  --weather-hud-summary-gap: 28px;
  display: flex;
  width: max-content;
  min-width: max-content;
  align-items: center;
  gap: var(--weather-hud-summary-gap);
  font-size: 11px;
  line-height: 1.35;
  color: var(--weather-hud-text-soft);
  white-space: nowrap;
  will-change: transform;
  animation: weather-hud-summary-ticker 12s linear infinite;
}

.weather-hud-summary::after {
  content: attr(data-ticker-text);
  flex: 0 0 auto;
}

.weather-hud-summary-viewport:hover .weather-hud-summary {
  animation-play-state: paused;
}

.weather-hud-drawer {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--weather-hud-line) 70%, transparent);
}

.weather-hud-drawer-section {
  display: grid;
  gap: 8px;
  padding: 11px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 62%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
}

.weather-hud-section-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-mode-row,
.weather-hud-action-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-hud-chip,
.weather-hud-preset {
  min-height: 35px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.weather-hud-chip-active,
.weather-hud-preset-active {
  background: linear-gradient(180deg, color-mix(in srgb, var(--weather-hud-accent) 24%, transparent), color-mix(in srgb, var(--weather-hud-accent) 16%, rgba(255, 255, 255, 0.04)));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-preset-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.weather-hud-drawer-section[hidden] {
  display: none;
}

.weather-hud-forecast {
  display: grid;
  gap: 4px;
}

/* A missing interceptor permission is surfaced on the HUD badge, not only in settings. */
.weather-hud-widget[data-permission="limited"] .weather-hud-source,
.weather-hud-widget[data-error="true"] .weather-hud-source {
  border-color: color-mix(in srgb, #ffb45e 55%, transparent);
  color: rgba(255, 214, 160, 0.96);
  background: color-mix(in srgb, #ffb45e 14%, var(--weather-hud-surface));
}

.weather-hud-forecast-row {
  display: grid;
  grid-template-columns: 34px 16px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--weather-hud-line) 26%, transparent);
  font-size: 11px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-forecast-day {
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(245, 248, 255, 0.78);
}

.weather-hud-forecast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--weather-hud-accent);
}

.weather-hud-forecast-icon svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.weather-hud-forecast-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-forecast-copy {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: capitalize;
}

.weather-hud-control-grid {
  display: grid;
  gap: 10px;
}

.weather-hud-field {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-field-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.weather-hud-inline-value {
  color: rgba(245, 248, 255, 0.88);
  font-weight: 600;
}

.weather-hud-select {
  font-size: 11px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 72%, transparent);
  background: rgba(7, 16, 28, 0.3);
  color: inherit;
}

.weather-hud-range {
  accent-color: var(--weather-hud-accent);
}

.weather-hud-widget[data-expanded="false"] {
  gap: 10px;
}

/* Keep every control reachable inside the compact desktop frame. */
.weather-hud-widget[data-presentation="desktop"][data-expanded="true"] {
  grid-template-rows: auto auto minmax(0, 1fr);
}

.weather-hud-widget[data-presentation="desktop"][data-expanded="true"] .weather-hud-drawer {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--weather-hud-line) transparent;
  padding-right: 4px;
  scroll-padding-block: 10px;
}

.weather-hud-forecast-summary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  line-height: 1.5;
  color: var(--weather-hud-text-muted);
  text-transform: none;
}

.weather-hud-widget[data-paused="true"]::after {
  animation-play-state: paused;
  opacity: calc(0.55 * var(--weather-hud-scene-intensity));
}

.weather-hud-widget[data-paused="true"] .weather-hud-summary {
  animation-play-state: paused;
}

@keyframes weather-hud-drift {
  0% {
    transform: translate3d(-5%, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(6%, -4%, 0) scale(1.08);
  }
}

@keyframes weather-hud-summary-ticker {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(calc(-50% - 14px), 0, 0);
  }
}

.weather-fx-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  isolation: isolate;
  contain: paint;
  transition: opacity 320ms ease;
}

.weather-fx-root.weather-scene-blending {
  transition:
    opacity 320ms ease,
    --weather-bg-start 1200ms ease,
    --weather-bg-mid 1200ms ease,
    --weather-bg-end 1200ms ease,
    --weather-glow 900ms ease,
    --weather-beam-color 900ms ease,
    --weather-horizon-color 900ms ease,
    --weather-cloud-core 900ms ease,
    --weather-cloud-edge 900ms ease,
    --weather-fog-color 900ms ease,
    --weather-mist-color 900ms ease,
    --weather-sky-opacity 800ms ease,
    --weather-glow-opacity 800ms ease,
    --weather-beam-opacity 800ms ease,
    --weather-cloud-opacity 800ms ease,
    --weather-horizon-opacity 800ms ease,
    --weather-mist-opacity 800ms ease,
    --weather-fog-opacity 800ms ease,
    --weather-rain-opacity 600ms ease,
    --weather-snow-opacity 600ms ease,
    --weather-mote-opacity 600ms ease,
    --weather-star-opacity 800ms ease,
    --weather-moonlight-opacity 800ms ease,
    --weather-aurora-opacity 900ms ease,
    --weather-window-droplet-opacity 700ms ease,
    --weather-phenomenon-opacity 700ms ease,
    --weather-flash-opacity 300ms ease;
}

.weather-fx-root.weather-visible {
  opacity: 1;
}

.weather-fx-root[data-kind="back"] {
  z-index: 1;
}

.weather-fx-root[data-kind="front"] {
  z-index: 24;
  mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.55) 46%, #000 78%);
}

.weather-fx-root.weather-hidden {
  display: none;
}

.weather-fx-shader-canvas,
.weather-fx-particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

.weather-fx-shader-canvas {
  z-index: 1;
}

.weather-fx-particle-canvas {
  z-index: 2;
}

.weather-fx-procedural-fog-layer {
  position: absolute;
  inset: 0;
  opacity: var(--weather-procedural-fog-opacity, 0);
  pointer-events: none;
  transition: opacity 800ms ease;
}

.weather-fx-root[data-kind="front"] .weather-fx-procedural-fog-layer {
  opacity: calc(var(--weather-procedural-fog-opacity, 0) * 0.48);
  mix-blend-mode: screen;
}

.weather-fx-procedural-fog-layer::before {
  content: "";
  position: absolute;
  inset: -8%;
  background:
    radial-gradient(ellipse at 18% 72%, rgba(202, 216, 225, 0.26), transparent 46%),
    radial-gradient(ellipse at 78% 28%, rgba(182, 202, 215, 0.2), transparent 50%);
  filter: blur(30px);
  opacity: 0.8;
  transition: opacity 400ms ease;
}

.weather-fx-root[data-kind="front"] .weather-fx-procedural-fog-layer::before {
  opacity: 0.34;
}

.weather-fx-root.weather-fog-webgl-ready .weather-fx-procedural-fog-layer::before {
  opacity: 0;
}

.weather-fx-root.weather-paused *,
.weather-fx-root.weather-paused *::before,
.weather-fx-root.weather-paused *::after {
  animation-play-state: paused !important;
}

.weather-fx-sky,
.weather-fx-glow,
.weather-fx-beams,
.weather-fx-clouds,
.weather-fx-horizon,
.weather-fx-mist,
.weather-fx-fog,
.weather-fx-procedural-fog-layer,
.weather-fx-procedural-fog,
.weather-fx-motes,
.weather-fx-stars,
.weather-fx-moonlight,
.weather-fx-aurora,
.weather-fx-phenomenon,
.weather-fx-windowpane,
.weather-fx-rain,
.weather-fx-snow,
.weather-fx-wind-gusts,
.weather-fx-rain-splashes,
.weather-fx-rain-ripples,
.weather-fx-frost,
.weather-fx-lightning,
.weather-fx-lightning-glow,
.weather-fx-flash {
  position: absolute;
  inset: 0;
}

/* Keep the painted edges outside the clip through the full drift/sway cycle.
   3vmax covers the 1vw drift and 1deg rotation, including tall mobile scenes. */
.weather-fx-sky,
.weather-fx-glow,
.weather-fx-beams {
  inset: -3vmax;
}

.weather-fx-sky {
  background: linear-gradient(180deg, var(--weather-bg-start) 0%, var(--weather-bg-mid) 46%, var(--weather-bg-end) 100%);
  opacity: var(--weather-sky-opacity);
  mix-blend-mode: normal;
  filter: saturate(1.08) brightness(1.04);
  animation: weather-sky-shift 24s ease-in-out infinite alternate;
}

.weather-fx-glow {
  background:
    radial-gradient(circle at 18% 18%, var(--weather-glow), transparent 34%),
    radial-gradient(circle at 82% 22%, color-mix(in srgb, var(--weather-glow) 74%, white 14%), transparent 30%);
  opacity: var(--weather-glow-opacity);
  mix-blend-mode: screen;
  animation: weather-glow-drift 18s ease-in-out infinite alternate;
}

.weather-fx-beams {
  background:
    radial-gradient(circle at 20% 16%, var(--weather-beam-color), transparent 26%),
    linear-gradient(120deg, transparent 30%, color-mix(in srgb, var(--weather-beam-color) 58%, transparent) 48%, transparent 62%);
  opacity: var(--weather-beam-opacity);
  mix-blend-mode: screen;
  animation: weather-beam-sway 14s ease-in-out infinite alternate;
}

.weather-fx-stars {
  opacity: var(--weather-star-opacity);
  mix-blend-mode: screen;
}

.weather-fx-star {
  position: absolute;
  left: var(--star-left);
  top: var(--star-top);
  width: var(--star-size);
  height: var(--star-size);
  border-radius: 50%;
  background: rgba(231, 241, 255, 0.96);
  box-shadow: 0 0 5px rgba(162, 198, 255, 0.62);
  opacity: var(--star-opacity-scale);
  animation: weather-star-twinkle var(--star-duration) ease-in-out infinite;
  animation-delay: var(--star-delay);
  animation-play-state: paused;
}

.weather-fx-moonlight {
  inset: -3vmax;
  background:
    radial-gradient(ellipse at 86% 14%, rgba(183, 210, 255, 0.55), rgba(115, 151, 226, 0.23) 22%, transparent 57%),
    radial-gradient(ellipse at 12% 75%, rgba(89, 123, 185, 0.16), transparent 60%);
  opacity: var(--weather-moonlight-opacity);
  mix-blend-mode: screen;
  animation: weather-glow-drift 22s ease-in-out infinite alternate;
  animation-play-state: paused;
}

.weather-fx-root.weather-visible.weather-night-active .weather-fx-star,
.weather-fx-root.weather-visible.weather-night-active .weather-fx-moonlight {
  animation-play-state: running;
}

.weather-fx-aurora {
  inset: -4vmax;
  opacity: var(--weather-aurora-opacity, 0);
  mix-blend-mode: screen;
  pointer-events: none;
  overflow: hidden;
}

.weather-fx-aurora-ribbon {
  position: absolute;
  top: var(--aurora-top, -8%);
  left: var(--aurora-left, -10%);
  width: var(--aurora-width, 64vw);
  height: var(--aurora-height, 42vh);
  border-radius: 50%;
  background: linear-gradient(
    118deg,
    transparent 8%,
    hsla(var(--aurora-hue-a, 154), 92%, 64%, 0.55) 36%,
    hsla(var(--aurora-hue-b, 272), 86%, 68%, 0.42) 68%,
    transparent 92%
  );
  filter: blur(28px) saturate(1.25);
  transform: rotate(var(--aurora-skew, -12deg));
  animation: weather-aurora-wave var(--aurora-duration, 18s) ease-in-out infinite alternate;
  animation-delay: var(--aurora-delay, 0s);
}

.weather-fx-phenomenon {
  opacity: var(--weather-phenomenon-opacity, 0);
  pointer-events: none;
  overflow: hidden;
}

.weather-fx-phenomenon-particle {
  position: absolute;
  left: var(--p-left, 50%);
  top: var(--p-top, 10%);
  width: var(--p-size, 6px);
  height: var(--p-size, 6px);
  opacity: var(--p-opacity, 0.75);
  animation-duration: var(--p-duration, 9s);
  animation-delay: var(--p-delay, 0s);
  animation-iteration-count: infinite;
}

.weather-fx-phenomenon[data-phenomenon="blossoms"] .weather-fx-phenomenon-particle {
  width: calc(var(--p-size, 7px) * 1.35);
  height: calc(var(--p-size, 7px) * 0.82);
  border-radius: 80% 18% 80% 18%;
  background: linear-gradient(135deg, rgba(255, 224, 238, 0.96), rgba(255, 166, 203, 0.86));
  box-shadow: 0 0 8px rgba(255, 188, 217, 0.45);
  animation-name: weather-phenomenon-blossom;
  animation-timing-function: linear;
}

.weather-fx-phenomenon[data-phenomenon="embers"] .weather-fx-phenomenon-particle {
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 186, 0.98) 0%, rgba(255, 126, 46, 0.92) 56%, transparent 100%);
  box-shadow: 0 0 12px rgba(255, 118, 38, 0.85);
  mix-blend-mode: screen;
  animation-name: weather-phenomenon-ember;
  animation-timing-function: ease-in-out;
}

.weather-fx-phenomenon[data-phenomenon="ashfall"] .weather-fx-phenomenon-particle {
  border-radius: 42% 58% 62% 38%;
  background: rgba(212, 216, 224, 0.78);
  box-shadow: 0 0 4px rgba(145, 152, 165, 0.32);
  animation-name: weather-phenomenon-ash;
  animation-timing-function: linear;
}

.weather-fx-phenomenon[data-phenomenon="fireflies"] .weather-fx-phenomenon-particle {
  border-radius: 50%;
  background: radial-gradient(circle, rgba(246, 255, 182, 0.98) 0%, rgba(176, 245, 86, 0.84) 55%, transparent 100%);
  box-shadow: 0 0 14px rgba(190, 255, 102, 0.88);
  mix-blend-mode: screen;
  animation-name: weather-phenomenon-firefly;
  animation-timing-function: ease-in-out;
}

.weather-fx-phenomenon[data-phenomenon="sandstorm"] .weather-fx-phenomenon-particle {
  width: calc(var(--p-size, 4px) * 6.5);
  height: calc(var(--p-size, 4px) * 0.45);
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(235, 192, 132, 0.72), transparent);
  filter: blur(1px);
  animation-name: weather-phenomenon-sand;
  animation-timing-function: linear;
}

.weather-fx-windowpane {
  opacity: var(--weather-window-droplet-opacity, 0);
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(168, 200, 232, 0.08) 100%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0%, transparent 42%, rgba(195, 222, 255, 0.04) 100%);
}

.weather-fx-window-drop {
  position: absolute;
  left: var(--wdrop-left, 50%);
  top: var(--wdrop-top, 20%);
  width: var(--wdrop-width, 3px);
  height: var(--wdrop-height, 18px);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(232, 244, 255, 0.05) 0%,
    rgba(225, 241, 255, var(--wdrop-opacity, 0.45)) 68%,
    rgba(255, 255, 255, 0.86) 100%
  );
  box-shadow: 0 1px 4px rgba(12, 26, 46, 0.22);
  animation: weather-window-rivulet var(--wdrop-duration, 8s) ease-in-out infinite;
  animation-delay: var(--wdrop-delay, 0s);
}

.weather-fx-horizon {
  background: linear-gradient(180deg, transparent 0%, transparent 48%, var(--weather-horizon-color) 100%);
  opacity: var(--weather-horizon-opacity);
  filter: blur(20px);
  transform: translateY(6%);
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-rain-drop,
.weather-fx-snow-flake,
.weather-fx-wind-gust,
.weather-fx-rain-splash,
.weather-fx-rain-ripple {
  position: absolute;
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-wind-gust {
  will-change: auto;
}

.weather-fx-root.weather-visible .weather-fx-cloud,
.weather-fx-root.weather-visible .weather-fx-fog-band,
.weather-fx-root.weather-visible .weather-fx-mist-plume,
.weather-fx-root.weather-visible .weather-fx-mote,
.weather-fx-root.weather-visible .weather-fx-wind-gust,
.weather-fx-root.weather-visible .weather-fx-rain-drop,
.weather-fx-root.weather-visible .weather-fx-snow-flake {
  will-change: transform, opacity;
}

.weather-fx-cloud {
  --cloud-base-y: 0vh;
  --cloud-detail-opacity: 0.2;
  width: var(--cloud-width);
  height: var(--cloud-height);
  top: var(--cloud-top);
  left: var(--cloud-left);
  filter: blur(var(--cloud-blur)) drop-shadow(0 10px 18px rgba(7, 15, 28, 0.14));
  opacity: calc(var(--weather-cloud-opacity) * var(--cloud-opacity-scale));
  scale: var(--weather-cloud-size-scale, 1);
  transform-origin: 50% 58%;
  animation: weather-cloud-drift var(--cloud-duration) linear infinite;
  animation-delay: var(--cloud-delay);
}

.weather-fx-cloud::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--weather-cloud-edge) 72%, var(--weather-cloud-core)) 0%,
    var(--weather-cloud-core) 58%,
    color-mix(in srgb, var(--weather-cloud-core) 78%, rgba(4, 12, 24, 0.3)) 100%
  );
  -webkit-mask: var(--cloud-image) no-repeat center 58% / cover;
  mask: var(--cloud-image) no-repeat center 58% / cover;
  pointer-events: none;
}

.weather-fx-cloud img {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 58%;
  opacity: var(--cloud-detail-opacity);
  filter: grayscale(1) contrast(0.9) brightness(0.92);
  user-select: none;
  pointer-events: none;
}

.weather-fx-procedural-fog {
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 1;
  filter: blur(0.45px) saturate(0.92);
  pointer-events: none;
}

.weather-fx-root[data-condition="fog"] .weather-fx-fog,
.weather-fx-root[data-condition="fog"] .weather-fx-mist {
  opacity: 0;
}

.weather-fx-fog-band {
  width: var(--fog-width);
  height: var(--fog-height);
  top: var(--fog-top);
  left: var(--fog-left);
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--weather-fog-color), transparent);
  filter: blur(20px);
  opacity: calc(var(--weather-fog-opacity) * var(--fog-opacity-scale));
  animation: weather-fog-drift var(--fog-duration) ease-in-out infinite;
  animation-delay: var(--fog-delay);
}

.weather-fx-mist-plume {
  width: var(--mist-width);
  height: var(--mist-height);
  left: var(--mist-left);
  bottom: var(--mist-bottom);
  border-radius: 999px;
  background: radial-gradient(circle at center, var(--weather-mist-color), transparent 68%);
  filter: blur(22px);
  opacity: calc(var(--weather-mist-opacity) * var(--mist-opacity-scale));
  animation: weather-mist-roll var(--mist-duration) ease-in-out infinite;
  animation-delay: var(--mist-delay);
}

.weather-fx-mote {
  left: var(--mote-left);
  top: var(--mote-top);
  width: var(--mote-size);
  height: var(--mote-size);
  border-radius: 50%;
  background: rgba(255, 247, 224, 0.95);
  box-shadow: 0 0 10px rgba(255, 245, 214, 0.4);
  opacity: calc(var(--weather-mote-opacity) * var(--mote-opacity-scale));
  animation: weather-mote-drift var(--mote-duration) ease-in-out infinite;
  animation-delay: var(--mote-delay);
}

.weather-fx-rain-drop {
  top: var(--drop-top);
  left: var(--drop-left);
  width: var(--drop-width);
  height: var(--drop-length);
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 10%,
    var(--weather-rain-color) 50%,
    rgba(255, 255, 255, 0.9) 95%,
    rgba(255, 255, 255, 1) 100%
  );
  border-radius: 999px;
  opacity: 0;
  scale: var(--weather-rain-particle-scale, 1);
  transform-origin: 50% 0;
  transform: rotate(var(--weather-rain-angle, 11deg));
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.24));
  animation: weather-rain-fall var(--drop-duration) linear infinite;
  animation-delay: var(--drop-delay);
  animation-play-state: paused;
}

.weather-fx-rain-ripple-front {
  --ripple-opacity-scale: 0.78;
  border-color: rgba(226, 242, 255, 0.78);
  filter: drop-shadow(0 0 4px rgba(209, 232, 255, 0.58));
}

.weather-fx-rain-drop-front {
  filter: drop-shadow(0 0 5px rgba(209, 229, 255, 0.34));
}

.weather-fx-rain-drop.weather-density-hidden {
  opacity: 0 !important;
  animation-play-state: paused !important;
}

/* Density is expressed as a per-particle opacity multiplier rather than a binary
   hidden class, so intensity changes read as a swell instead of a flicker. */
.weather-fx-rain-drop {
  --drop-opacity-scale: var(--drop-density-scale, 1);
}

.weather-fx-rain-splashes,
.weather-fx-rain-ripples {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splashes,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripples {
  opacity: 1;
}

.weather-fx-rain-splash {
  --splash-color: rgba(205, 231, 255, 0.9);
  --splash-dot-color: rgba(236, 247, 255, 0.98);
  --splash-opacity-scale: 0.94;
  bottom: var(--splash-bottom);
  left: var(--splash-left);
  width: var(--splash-size);
  height: var(--splash-height, var(--splash-size));
  transform-origin: 50% 100%;
  scale: var(--weather-rain-particle-scale, 1);
  opacity: 0;
  filter: drop-shadow(0 0 3px rgba(194, 225, 255, 0.58));
  animation: weather-splash var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash::before,
.weather-fx-rain-splash::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.weather-fx-rain-splash::before {
  top: auto;
  height: 48%;
  border: 1.8px solid var(--splash-color);
  border-radius: 50%;
  clip-path: inset(0 0 48% 0);
}

.weather-fx-rain-splash::after {
  background:
    radial-gradient(circle at 15% 70%, var(--splash-dot-color) 0 1.1px, transparent 2px),
    radial-gradient(circle at 50% 5%, var(--splash-dot-color) 0 1.3px, transparent 2.2px),
    radial-gradient(circle at 84% 66%, var(--splash-dot-color) 0 1.1px, transparent 2px);
}

.weather-fx-rain-splash-front {
  --splash-color: rgba(226, 242, 255, 0.98);
  --splash-dot-color: rgba(248, 252, 255, 1);
  --splash-opacity-scale: 1;
}

.weather-fx-rain-ripple {
  --ripple-opacity-scale: 0.64;
  bottom: var(--ripple-bottom);
  left: var(--ripple-left);
  width: var(--ripple-size);
  height: calc(var(--ripple-size) * 0.4);
  border: 1.4px solid rgba(205, 231, 255, 0.62);
  border-radius: 50%;
  scale: var(--weather-rain-particle-scale, 1);
  opacity: 0;
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.42));
  animation: weather-ripple var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash.weather-density-hidden,
.weather-fx-rain-ripple.weather-density-hidden {
  display: none;
}

.weather-fx-wind-gusts {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gusts {
  opacity: 0.65;
}

.weather-fx-root[data-condition="rain"] .weather-fx-wind-gusts {
  opacity: 0.72;
}

.weather-fx-root[data-condition="storm"] .weather-fx-wind-gusts {
  opacity: 1;
}

.weather-fx-wind-gust {
  top: var(--gust-top);
  left: var(--gust-left);
  width: var(--gust-width);
  height: var(--gust-height);
  color: rgba(235, 245, 255, var(--gust-opacity));
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  animation: weather-wind-gust var(--gust-duration) linear infinite;
  animation-delay: var(--gust-delay);
  animation-play-state: paused;
}

.weather-fx-wind-gust svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="rain"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="storm"] .weather-fx-wind-gust {
  animation-play-state: running;
}

.weather-fx-snow-flake {
  top: var(--flake-top);
  left: var(--flake-left);
  width: var(--flake-size);
  height: var(--flake-size);
  border-radius: 50%;
  background-color: var(--weather-snow-color);
  opacity: 0;
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.72);
  animation:
    weather-snow-fall var(--flake-duration) linear infinite,
    weather-snow-shimmer var(--flake-shimmer-duration) ease-in-out infinite;
  animation-delay: var(--flake-delay), var(--flake-delay);
  animation-play-state: paused;
}

.weather-fx-snow-flake-front {
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.82);
}

.weather-fx-frost {
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(ellipse 40% 50% at 0% 0%, rgba(220, 235, 255, 0.25), transparent 60%),
    radial-gradient(ellipse 40% 50% at 100% 0%, rgba(220, 235, 255, 0.2), transparent 60%),
    radial-gradient(ellipse 50% 60% at 0% 100%, rgba(220, 235, 255, 0.3), transparent 55%),
    radial-gradient(ellipse 50% 60% at 100% 100%, rgba(220, 235, 255, 0.25), transparent 55%),
    radial-gradient(ellipse 60% 30% at 50% 0%, rgba(210, 230, 255, 0.12), transparent 50%),
    radial-gradient(ellipse 30% 80% at 0% 50%, rgba(210, 230, 255, 0.1), transparent 50%),
    radial-gradient(ellipse 30% 80% at 100% 50%, rgba(210, 230, 255, 0.1), transparent 50%);
  mix-blend-mode: screen;
  filter: blur(3px);
  transition: opacity 1000ms ease;
}

.weather-fx-root[data-condition="snow"] .weather-fx-frost {
  opacity: 0.6;
}

.weather-fx-lightning {
  overflow: hidden;
  pointer-events: none;
}

.weather-fx-lightning-bolt {
  position: absolute;
  top: 0;
  width: 26%;
  height: 100%;
  opacity: 0;
  filter:
    drop-shadow(0 0 4px rgba(200, 220, 255, 0.9))
    drop-shadow(0 0 14px rgba(160, 190, 255, 0.5))
    drop-shadow(0 0 30px rgba(120, 160, 255, 0.3));
}

.weather-fx-lightning-bolt[data-bolt-index="0"] { left: 10%; }
.weather-fx-lightning-bolt[data-bolt-index="1"] { left: 38%; }
.weather-fx-lightning-bolt[data-bolt-index="2"] { left: 62%; }

.weather-fx-lightning-bolt.weather-lightning-strike {
  animation: weather-lightning-strike 650ms ease-out forwards;
}

.weather-fx-lightning-glow {
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    ellipse 50% 60% at var(--weather-lightning-x, 50%) 15%,
    rgba(210, 230, 255, 0.5) 0%,
    rgba(180, 210, 255, 0.2) 20%,
    transparent 50%
  );
  mix-blend-mode: screen;
}

.weather-fx-root.weather-lightning-glow-flash .weather-fx-lightning-glow {
  animation: weather-lightning-glow-flash 650ms ease-out forwards;
}

.weather-fx-flash {
  background:
    radial-gradient(circle at 34% 22%, rgba(232, 241, 255, 0.9), transparent 32%),
    radial-gradient(circle at 50% 10%, rgba(220, 235, 255, 0.6), transparent 40%),
    rgba(219, 231, 255, 0.48);
  opacity: 0;
  mix-blend-mode: screen;
}

.weather-fx-root.weather-storm-flash .weather-fx-flash {
  animation: weather-flash-sequence 650ms ease-out;
}

.weather-fx-root[data-condition="rain"] .weather-fx-cloud,
.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-base-y: -0.8vh;
  --cloud-detail-opacity: 0.16;
  filter: blur(var(--cloud-blur)) drop-shadow(0 12px 20px rgba(3, 10, 20, 0.24));
}

.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.1;
  filter: blur(var(--cloud-blur)) brightness(0.9) drop-shadow(0 14px 24px rgba(1, 6, 14, 0.34));
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.18;
  filter: blur(var(--cloud-blur)) drop-shadow(0 10px 18px rgba(7, 15, 28, 0.16));
}

.weather-fx-root[data-condition="snow"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.24;
  filter: blur(var(--cloud-blur)) brightness(1.02) drop-shadow(0 10px 18px rgba(70, 92, 122, 0.14));
}

.weather-fx-root.weather-storm-flash .weather-fx-clouds {
  animation: weather-cloud-lightning 650ms ease-out;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop,
.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  animation-play-state: running;
  will-change: transform, opacity;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop {
  opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale));
}

.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  opacity: calc(var(--weather-snow-opacity) * var(--flake-opacity-scale));
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splash,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripple {
  animation-play-state: running;
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud,
.weather-fx-root.weather-reduced-motion .weather-fx-fog-band,
.weather-fx-root.weather-reduced-motion .weather-fx-mist-plume,
.weather-fx-root.weather-reduced-motion .weather-fx-mote,
.weather-fx-root.weather-reduced-motion .weather-fx-star,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-drop,
.weather-fx-root.weather-reduced-motion .weather-fx-snow-flake,
.weather-fx-root.weather-reduced-motion .weather-fx-wind-gust,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-splash,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-ripple {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-sky,
.weather-fx-root.weather-reduced-motion .weather-fx-glow,
.weather-fx-root.weather-reduced-motion .weather-fx-beams {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-moonlight,
.weather-fx-root.weather-reduced-motion .weather-fx-aurora-ribbon,
.weather-fx-root.weather-reduced-motion .weather-fx-phenomenon-particle,
.weather-fx-root.weather-reduced-motion .weather-fx-window-drop {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud {
  transform: translate3d(var(--cloud-drift-x-mid), var(--cloud-base-y), 0) scale(var(--cloud-scale));
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion .weather-fx-wind-gusts {
  display: none;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  opacity: 0;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake:nth-child(4n) {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  transform: translate3d(0, 48vh, 0) rotate(var(--weather-rain-angle, 11deg));
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  transform: translate3d(var(--flake-drift-b), var(--flake-static-y), 0);
}

@keyframes weather-sky-shift {
  0% { transform: scale(1) translate3d(0, 0, 0); }
  100% { transform: scale(1.04) translate3d(0, -1.6vh, 0); }
}

@keyframes weather-glow-drift {
  0% { transform: translate3d(-1vw, 0, 0) scale(1); }
  100% { transform: translate3d(1vw, -1vh, 0) scale(1.08); }
}

@keyframes weather-beam-sway {
  0% { transform: translate3d(-1vw, 0, 0) rotate(-1deg); }
  100% { transform: translate3d(1vw, -0.6vh, 0) rotate(1deg); }
}

@keyframes weather-cloud-drift {
  0% {
    transform: translate3d(var(--cloud-drift-x-start), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
  48% {
    transform: translate3d(var(--cloud-drift-x-mid), calc(var(--cloud-base-y) + var(--cloud-drift-y)), 0) scale(var(--cloud-scale-mid));
  }
  100% {
    transform: translate3d(var(--cloud-drift-x-end), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
}

@keyframes weather-cloud-lightning {
  0%, 100% { filter: brightness(1) saturate(1); }
  12% { filter: brightness(1.72) saturate(0.82); }
  24% { filter: brightness(1.12) saturate(0.94); }
  36% { filter: brightness(1.48) saturate(0.86); }
  58% { filter: brightness(1.06) saturate(0.98); }
}

@keyframes weather-fog-drift {
  0%, 100% { transform: translate3d(-2vw, 0, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mist-roll {
  0%, 100% { transform: translate3d(-2vw, 1vh, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mote-drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(0.95); }
  50% { transform: translate3d(var(--mote-drift-x), var(--mote-drift-y), 0) scale(1.12); }
}

@keyframes weather-star-twinkle {
  0%, 100% { opacity: calc(var(--star-opacity-scale) * 0.55); }
  50% { opacity: var(--star-opacity-scale); }
}

@keyframes weather-aurora-wave {
  0% {
    transform: translate3d(-4vw, 0, 0) rotate(var(--aurora-skew, -12deg)) scaleY(0.92);
    opacity: 0.72;
  }
  50% {
    transform: translate3d(3vw, -2vh, 0) rotate(calc(var(--aurora-skew, -12deg) + 4deg)) scaleY(1.14);
    opacity: 1;
  }
  100% {
    transform: translate3d(6vw, 1.5vh, 0) rotate(calc(var(--aurora-skew, -12deg) - 3deg)) scaleY(0.96);
    opacity: 0.8;
  }
}

@keyframes weather-phenomenon-blossom {
  0% {
    transform: translate3d(0, -10vh, 0) rotate(0deg);
    opacity: 0;
  }
  12% {
    opacity: var(--p-opacity, 0.8);
  }
  88% {
    opacity: var(--p-opacity, 0.8);
  }
  100% {
    transform: translate3d(var(--p-drift-x, 18vw), 112vh, 0) rotate(var(--p-rotate, 240deg));
    opacity: 0;
  }
}

@keyframes weather-phenomenon-ember {
  0% {
    transform: translate3d(0, 108vh, 0) scale(0.75);
    opacity: 0;
  }
  18% {
    opacity: var(--p-opacity, 0.85);
  }
  82% {
    opacity: calc(var(--p-opacity, 0.85) * 0.7);
  }
  100% {
    transform: translate3d(var(--p-drift-x, 12vw), -12vh, 0) scale(0.35);
    opacity: 0;
  }
}

@keyframes weather-phenomenon-ash {
  0% {
    transform: translate3d(0, -8vh, 0) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: var(--p-opacity, 0.65);
  }
  100% {
    transform: translate3d(var(--p-drift-x, 10vw), 110vh, 0) rotate(var(--p-rotate, 180deg));
    opacity: 0;
  }
}

@keyframes weather-phenomenon-firefly {
  0%, 100% {
    transform: translate3d(0, 0, 0) scale(0.65);
    opacity: 0.12;
  }
  35% {
    transform: translate3d(calc(var(--p-drift-x, 8vw) * 0.45), var(--p-drift-y, -6vh), 0) scale(1.18);
    opacity: var(--p-opacity, 0.92);
  }
  70% {
    transform: translate3d(var(--p-drift-x, 8vw), calc(var(--p-drift-y, -6vh) * -0.5), 0) scale(0.85);
    opacity: 0.28;
  }
}

@keyframes weather-phenomenon-sand {
  0% {
    transform: translate3d(-24vw, 0, 0);
    opacity: 0;
  }
  15% {
    opacity: var(--p-opacity, 0.65);
  }
  85% {
    opacity: var(--p-opacity, 0.65);
  }
  100% {
    transform: translate3d(124vw, 6vh, 0);
    opacity: 0;
  }
}

@keyframes weather-window-rivulet {
  0% {
    transform: translate3d(0, -4vh, 0) scaleY(0.82);
    opacity: 0;
  }
  16% {
    opacity: var(--wdrop-opacity, 0.5);
  }
  78% {
    opacity: var(--wdrop-opacity, 0.5);
  }
  100% {
    transform: translate3d(0.4vw, 24vh, 0) scaleY(1.18);
    opacity: 0;
  }
}

@keyframes weather-rain-fall {
  0% { transform: translate3d(0, 0, 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
  12% { opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale)); }
  100% { transform: translate3d(var(--drop-drift), var(--weather-rain-fall-distance, 118vh), 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
}

@keyframes weather-snow-fall {
  0% { transform: translate3d(0, 0, 0); }
  25% { transform: translate3d(var(--flake-drift-a), 29vh, 0); }
  50% { transform: translate3d(var(--flake-drift-b), 58vh, 0); }
  75% { transform: translate3d(var(--flake-drift-c), 87vh, 0); }
  100% { transform: translate3d(var(--flake-drift-end), 116vh, 0); }
}

@keyframes weather-snow-shimmer {
  0%, 100% { filter: brightness(0.78); }
  50% { filter: brightness(1.22); }
}

@keyframes weather-splash {
  0% { transform: translate3d(0, 2px, 0) scale(0.2) rotate(0deg); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--splash-opacity-scale)); }
  42% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1) rotate(var(--splash-tilt, 0deg)); }
  62% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
  100% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
}

@keyframes weather-ripple {
  0% { transform: scale(0.15); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--ripple-opacity-scale)); }
  100% { transform: scale(3); opacity: 0; }
}

@keyframes weather-wind-gust {
  0% { transform: translate3d(-18vw, 0, 0); opacity: 0; }
  8% { opacity: 1; }
  35% { transform: translate3d(46vw, -5px, 0); }
  70% { transform: translate3d(108vw, 4px, 0); opacity: 1; }
  100% { transform: translate3d(168vw, 0, 0); opacity: 0; }
}

@keyframes weather-lightning-strike {
  0% { opacity: 0; }
  2% { opacity: 1; }
  8% { opacity: 0.15; }
  14% { opacity: 0.95; }
  22% { opacity: 0.08; }
  30% { opacity: 0.6; }
  45% { opacity: 0.02; }
  52% { opacity: 0.35; }
  70% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-lightning-glow-flash {
  0% { opacity: 0; }
  3% { opacity: 0.7; }
  10% { opacity: 0.08; }
  17% { opacity: 0.55; }
  28% { opacity: 0.04; }
  38% { opacity: 0.3; }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-flash-sequence {
  0% { opacity: 0; }
  3% { opacity: var(--weather-flash-opacity); }
  10% { opacity: calc(var(--weather-flash-opacity) * 0.12); }
  17% { opacity: calc(var(--weather-flash-opacity) * 0.82); }
  28% { opacity: calc(var(--weather-flash-opacity) * 0.06); }
  38% { opacity: calc(var(--weather-flash-opacity) * 0.4); }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@media (max-width: 768px) {
  .weather-fx-root {
    --weather-cloud-size-scale: 0.62;
    --weather-rain-fall-distance: 160vh;
    --weather-rain-particle-scale: 0.68;
  }

  .weather-fx-cloud {
    transform-origin: 50% 0;
  }

  .weather-settings-card-header {
    align-items: start;
  }

  .weather-settings-status {
    max-width: 52%;
  }

  .weather-settings-control-deck {
    grid-template-columns: 1fr;
  }

  .weather-settings-control-deck .weather-settings-section:nth-child(3) {
    grid-column: auto;
  }

  .weather-settings-manual-grid,
  .weather-settings-preset-grid {
    grid-template-columns: 1fr;
  }

  .weather-settings-actions,
  .weather-hud-mode-row,
  .weather-hud-action-row {
    grid-template-columns: 1fr;
  }

  .weather-hud-preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .weather-hud-time {
    font-size: 24px;
  }
}

.weather-hud-widget[data-reduced-motion="true"]::after {
  animation: none;
}

.weather-hud-widget[data-reduced-motion="true"] .weather-hud-summary {
  display: block;
  width: auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: none;
}

.weather-hud-widget[data-reduced-motion="true"] .weather-hud-summary::after {
  content: none;
}
`;

// src/tag-utils.ts
function shouldProcessWeatherTag(payload) {
  return !payload.isStreaming && !payload.isUser;
}

// src/frontend.ts
var GEAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98a7.79 7.79 0 000-1.96l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.88 7.88 0 00-1.69-.98l-.36-2.54a.5.5 0 00-.49-.42h-3.84a.5.5 0 00-.49.42l-.36 2.54c-.6.24-1.16.56-1.69.98l-2.39-.96a.5.5 0 00-.6.22L2.43 8.8a.5.5 0 00.12.64l2.03 1.58a7.79 7.79 0 000 1.96L2.55 14.56a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.6.22l2.39-.96c.53.42 1.09.74 1.69.98l.36 2.54a.5.5 0 00.49.42h3.84a.5.5 0 00.49-.42l.36-2.54c.6-.24 1.16-.56 1.69-.98l2.39.96a.5.5 0 00.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z"/></svg>`;
var CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
var CHEVRON_UP_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m7.41 15.41 4.59-4.58 4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
var CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m7.05 5.64 4.95 4.95 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05z"/></svg>`;
var LIGHTNING_BOLT_POSITIONS = [23, 51, 75];
var DEFAULT_WIDGET_POSITION = { x: 24, y: 96 };
var SCENE_TRANSITION_MS = 1300;
function resolveHudTimePhase2(state, liveDate) {
  const hour = liveDate?.getHours() ?? parseHourFromTimeString(state.time);
  return resolveHudTimePhase(state.palette, hour);
}
function sendToBackend(ctx, payload) {
  ctx.sendToBackend(payload);
}
function protectInteractive(element) {
  const stop = (event) => event.stopPropagation();
  element.addEventListener("pointerdown", stop);
  element.addEventListener("mousedown", stop);
  element.addEventListener("touchstart", stop);
}
function createFxMarkup(kind) {
  const root = document.createElement("div");
  root.className = "weather-fx-root";
  root.dataset.kind = kind;
  const flash = document.createElement("div");
  flash.className = "weather-fx-flash";
  root.appendChild(flash);
  return { root, host: null, kind, sceneTokens: null, sceneKey: null, blendTimer: null };
}
function readChatIdFromSettingsUpdate(payload) {
  if (!payload || typeof payload !== "object")
    return;
  const key = "key" in payload ? payload.key : undefined;
  if (key !== "activeChatId")
    return;
  const value = "value" in payload ? payload.value : undefined;
  if (typeof value !== "string" || !value.trim())
    return null;
  return value;
}
function readChatIdFromChatSwitch(payload) {
  if (!payload || typeof payload !== "object" || !("chatId" in payload))
    return;
  const value = payload.chatId;
  if (typeof value === "string" && value.trim())
    return value;
  return value === null ? null : undefined;
}
function createHudWidget(ctx, initialPosition, expanded, mobile, keyboardState, callbacks) {
  const presentation = resolveHudPresentation(mobile, expanded);
  const widget = ctx.ui.createFloatWidget({
    width: presentation.width,
    height: presentation.height,
    initialPosition,
    snapToEdge: true,
    tooltip: presentation.kind === "mobile-launcher" ? "Open LumiWeather" : "LumiWeather HUD",
    chromeless: true,
    fullscreen: presentation.fullscreen
  });
  const root = document.createElement("div");
  root.className = "weather-hud-widget";
  root.dataset.expanded = expanded ? "true" : "false";
  root.dataset.mobile = mobile ? "true" : "false";
  root.dataset.presentation = presentation.kind;
  root.style.setProperty("--weather-keyboard-inset-bottom", `${keyboardState.insetBottom}px`);
  root.style.setProperty("--weather-visual-viewport-height", `${keyboardState.viewportHeight}px`);
  if (presentation.kind === "mobile-panel") {
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "LumiWeather controls");
  }
  if (expanded) {
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape")
        return;
      event.preventDefault();
      event.stopPropagation();
      callbacks.onToggleDrawer();
    });
  }
  let launcherButton;
  let launcherIcon;
  if (presentation.kind === "mobile-launcher") {
    launcherButton = document.createElement("button");
    launcherButton.type = "button";
    launcherButton.className = "weather-hud-launcher";
    launcherButton.setAttribute("aria-label", "Open LumiWeather");
    launcherButton.title = "Open LumiWeather";
    launcherIcon = document.createElement("span");
    launcherIcon.className = "weather-hud-launcher-icon";
    launcherIcon.setAttribute("aria-hidden", "true");
    launcherButton.appendChild(launcherIcon);
    let pointerId = null;
    let pointerStart = { x: 0, y: 0 };
    let moved = false;
    launcherButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0)
        return;
      pointerId = event.pointerId;
      pointerStart = { x: event.clientX, y: event.clientY };
      moved = false;
    });
    launcherButton.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId)
        return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8)
        moved = true;
    });
    launcherButton.addEventListener("pointercancel", () => {
      pointerId = null;
      moved = false;
    });
    launcherButton.addEventListener("click", (event) => {
      event.stopPropagation();
      pointerId = null;
      if (moved) {
        moved = false;
        return;
      }
      callbacks.onToggleDrawer();
    });
    root.appendChild(launcherButton);
  }
  const header = document.createElement("div");
  header.className = "weather-hud-header";
  const titleWrap = document.createElement("div");
  titleWrap.className = "weather-hud-titlewrap";
  const eyebrow = document.createElement("div");
  eyebrow.className = "weather-hud-eyebrow";
  eyebrow.textContent = "LumiWeather";
  const source = document.createElement("span");
  source.className = "weather-hud-source";
  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(source);
  const headerActions = document.createElement("div");
  headerActions.className = "weather-hud-actions";
  const drawerToggle = document.createElement("button");
  drawerToggle.type = "button";
  drawerToggle.className = "weather-hud-control weather-hud-control-ghost";
  protectInteractive(drawerToggle);
  const drawerToggleLabel = document.createElement("span");
  drawerToggleLabel.textContent = presentation.kind === "mobile-panel" ? "Close" : expanded ? "Hide" : "Controls";
  const drawerToggleIcon = document.createElement("span");
  drawerToggleIcon.className = "weather-hud-control-icon";
  drawerToggleIcon.innerHTML = presentation.kind === "mobile-panel" ? CLOSE_SVG : expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  drawerToggle.appendChild(drawerToggleLabel);
  drawerToggle.appendChild(drawerToggleIcon);
  drawerToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  drawerToggle.setAttribute("aria-label", presentation.kind === "mobile-panel" ? "Close LumiWeather" : expanded ? "Hide LumiWeather controls" : "Show LumiWeather controls");
  drawerToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onToggleDrawer();
  });
  const settingsButton = document.createElement("button");
  settingsButton.className = "weather-hud-gear";
  settingsButton.type = "button";
  settingsButton.innerHTML = GEAR_SVG;
  settingsButton.title = "Open extension settings";
  settingsButton.setAttribute("aria-label", "Open extension settings");
  protectInteractive(settingsButton);
  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onOpenSettings();
  });
  headerActions.appendChild(drawerToggle);
  headerActions.appendChild(settingsButton);
  header.appendChild(titleWrap);
  header.appendChild(headerActions);
  const body = document.createElement("div");
  body.className = "weather-hud-body";
  const left = document.createElement("div");
  left.className = "weather-hud-primary";
  const location = document.createElement("div");
  location.className = "weather-hud-location";
  const date = document.createElement("div");
  date.className = "weather-hud-date";
  const time = document.createElement("div");
  time.className = "weather-hud-time";
  const wind = document.createElement("div");
  wind.className = "weather-hud-wind";
  left.appendChild(location);
  left.appendChild(date);
  left.appendChild(time);
  left.appendChild(wind);
  const right = document.createElement("div");
  right.className = "weather-hud-weather";
  const icon = document.createElement("div");
  icon.className = "weather-hud-icon";
  const temp = document.createElement("div");
  temp.className = "weather-hud-temp";
  const summaryViewport = document.createElement("div");
  summaryViewport.className = "weather-hud-summary-viewport";
  const summary = document.createElement("div");
  summary.className = "weather-hud-summary";
  summaryViewport.appendChild(summary);
  right.appendChild(icon);
  right.appendChild(temp);
  right.appendChild(summaryViewport);
  body.appendChild(left);
  body.appendChild(right);
  root.appendChild(header);
  root.appendChild(body);
  const presetButtons = new Map;
  let storyButton;
  let manualButton;
  let layerSelect;
  let exposureSelect;
  let phenomenonSelect;
  let intensitySlider;
  let intensityValue;
  let pauseButton;
  let soundButton;
  let resumeButton;
  let forecastSection;
  let forecastLabel;
  let forecastList;
  if (expanded) {
    const drawer = document.createElement("div");
    drawer.className = "weather-hud-drawer";
    const modeSection = document.createElement("div");
    modeSection.className = "weather-hud-drawer-section";
    const modeLabel = document.createElement("span");
    modeLabel.className = "weather-hud-section-label";
    modeLabel.textContent = "Mode";
    const modeRow = document.createElement("div");
    modeRow.className = "weather-hud-mode-row";
    storyButton = document.createElement("button");
    storyButton.type = "button";
    storyButton.className = "weather-hud-chip";
    storyButton.textContent = "Follow story";
    protectInteractive(storyButton);
    storyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onResumeStory();
    });
    manualButton = document.createElement("button");
    manualButton.type = "button";
    manualButton.className = "weather-hud-chip";
    manualButton.textContent = "Lock scene";
    protectInteractive(manualButton);
    manualButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onLockCurrentScene();
    });
    modeRow.appendChild(storyButton);
    modeRow.appendChild(manualButton);
    modeSection.appendChild(modeLabel);
    modeSection.appendChild(modeRow);
    const presetsSection = document.createElement("div");
    presetsSection.className = "weather-hud-drawer-section";
    const presetsLabel = document.createElement("span");
    presetsLabel.className = "weather-hud-section-label";
    presetsLabel.textContent = "Scene";
    const presetGrid = document.createElement("div");
    presetGrid.className = "weather-hud-preset-grid";
    for (const preset of WEATHER_SCENE_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "weather-hud-preset";
      button.textContent = preset.shortLabel;
      button.title = preset.description;
      protectInteractive(button);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.onApplyPreset(preset.id);
      });
      presetButtons.set(preset.id, button);
      presetGrid.appendChild(button);
    }
    presetsSection.appendChild(presetsLabel);
    presetsSection.appendChild(presetGrid);
    forecastSection = document.createElement("div");
    forecastSection.className = "weather-hud-drawer-section";
    forecastSection.hidden = true;
    forecastLabel = document.createElement("span");
    forecastLabel.className = "weather-hud-section-label";
    forecastLabel.textContent = "Outlook";
    forecastList = document.createElement("div");
    forecastList.className = "weather-hud-forecast";
    forecastSection.appendChild(forecastLabel);
    forecastSection.appendChild(forecastList);
    const controlsSection = document.createElement("div");
    controlsSection.className = "weather-hud-drawer-section";
    const controlsLabel = document.createElement("span");
    controlsLabel.className = "weather-hud-section-label";
    controlsLabel.textContent = "Scene mix";
    const controlGrid = document.createElement("div");
    controlGrid.className = "weather-hud-control-grid";
    const layerWrap = document.createElement("label");
    layerWrap.className = "weather-hud-field";
    const layerText = document.createElement("span");
    layerText.textContent = "Placement";
    layerSelect = document.createElement("select");
    layerSelect.className = "weather-hud-select";
    layerSelect.innerHTML = `
      <option value="back">Back</option>
      <option value="front">Front</option>
      <option value="both">Both</option>
    `;
    protectInteractive(layerSelect);
    layerSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangeLayerMode(layerSelect.value);
    });
    layerWrap.appendChild(layerText);
    layerWrap.appendChild(layerSelect);
    const intensityWrap = document.createElement("label");
    intensityWrap.className = "weather-hud-field";
    const intensityHeader = document.createElement("div");
    intensityHeader.className = "weather-hud-field-row";
    const intensityText = document.createElement("span");
    intensityText.textContent = "Density";
    intensityValue = document.createElement("span");
    intensityValue.className = "weather-hud-inline-value";
    intensityHeader.appendChild(intensityText);
    intensityHeader.appendChild(intensityValue);
    intensitySlider = document.createElement("input");
    intensitySlider.type = "range";
    intensitySlider.className = "weather-hud-range";
    intensitySlider.min = "0.25";
    intensitySlider.max = "1.50";
    intensitySlider.step = "0.05";
    protectInteractive(intensitySlider);
    intensitySlider.addEventListener("input", (event) => {
      event.stopPropagation();
      callbacks.onChangeIntensity(Number.parseFloat(intensitySlider.value));
    });
    intensityWrap.appendChild(intensityHeader);
    intensityWrap.appendChild(intensitySlider);
    controlGrid.appendChild(layerWrap);
    controlGrid.appendChild(intensityWrap);
    const exposureWrap = document.createElement("label");
    exposureWrap.className = "weather-hud-field";
    const exposureText = document.createElement("span");
    exposureText.textContent = "Exposure";
    exposureSelect = document.createElement("select");
    exposureSelect.className = "weather-hud-select";
    exposureSelect.innerHTML = `
      <option value="outdoor">Outdoor</option>
      <option value="sheltered">Sheltered</option>
      <option value="indoor">Indoor</option>
      <option value="underground">Underground</option>
    `;
    protectInteractive(exposureSelect);
    exposureSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangeExposure(exposureSelect.value);
    });
    exposureWrap.appendChild(exposureText);
    exposureWrap.appendChild(exposureSelect);
    const phenomenonWrap = document.createElement("label");
    phenomenonWrap.className = "weather-hud-field";
    const phenomenonText = document.createElement("span");
    phenomenonText.textContent = "Phenomenon";
    phenomenonSelect = document.createElement("select");
    phenomenonSelect.className = "weather-hud-select";
    phenomenonSelect.innerHTML = `
      <option value="none">None</option>
      <option value="aurora">Aurora</option>
      <option value="blossoms">Blossoms</option>
      <option value="embers">Embers</option>
      <option value="ashfall">Ashfall</option>
      <option value="fireflies">Fireflies</option>
      <option value="sandstorm">Sandstorm</option>
    `;
    protectInteractive(phenomenonSelect);
    phenomenonSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangePhenomenon(phenomenonSelect.value);
    });
    phenomenonWrap.appendChild(phenomenonText);
    phenomenonWrap.appendChild(phenomenonSelect);
    controlGrid.appendChild(exposureWrap);
    controlGrid.appendChild(phenomenonWrap);
    controlsSection.appendChild(controlsLabel);
    controlsSection.appendChild(controlGrid);
    const actionsSection = document.createElement("div");
    actionsSection.className = "weather-hud-drawer-section";
    const actionRow = document.createElement("div");
    actionRow.className = "weather-hud-action-row";
    pauseButton = document.createElement("button");
    pauseButton.type = "button";
    pauseButton.className = "weather-hud-control";
    protectInteractive(pauseButton);
    pauseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onTogglePause();
    });
    soundButton = document.createElement("button");
    soundButton.type = "button";
    soundButton.className = "weather-hud-control";
    protectInteractive(soundButton);
    soundButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onToggleSound();
    });
    resumeButton = document.createElement("button");
    resumeButton.type = "button";
    resumeButton.className = "weather-hud-control weather-hud-control-ghost";
    resumeButton.textContent = "Resume story";
    protectInteractive(resumeButton);
    resumeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onResumeStory();
    });
    actionRow.appendChild(pauseButton);
    actionRow.appendChild(soundButton);
    actionRow.appendChild(resumeButton);
    actionsSection.appendChild(actionRow);
    drawer.appendChild(modeSection);
    drawer.appendChild(presetsSection);
    drawer.appendChild(forecastSection);
    drawer.appendChild(controlsSection);
    drawer.appendChild(actionsSection);
    root.appendChild(drawer);
  }
  widget.root.appendChild(root);
  return {
    widget,
    root,
    location,
    date,
    time,
    wind,
    icon,
    temp,
    summary,
    source,
    drawerToggle,
    drawerToggleLabel,
    drawerToggleIcon,
    launcherButton,
    launcherIcon,
    storyButton,
    manualButton,
    presetButtons,
    layerSelect,
    exposureSelect,
    phenomenonSelect,
    intensitySlider,
    intensityValue,
    pauseButton,
    soundButton,
    resumeButton,
    forecastSection,
    forecastLabel,
    forecastList
  };
}
function renderForecastStrip(list, entries, unit) {
  list.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "weather-hud-forecast-row";
    row.dataset.forecastDate = entry.date;
    const day = document.createElement("span");
    day.className = "weather-hud-forecast-day";
    day.textContent = formatForecastDayLabel(entry.date);
    day.title = entry.date;
    const icon = document.createElement("span");
    icon.className = "weather-hud-forecast-icon";
    icon.innerHTML = conditionIcon(entry.condition);
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "weather-hud-forecast-copy";
    text.textContent = entry.temperature ? `${entry.condition} · ${formatTemperatureForUnit(entry.temperature, unit)}` : entry.condition;
    if (entry.summary) {
      const summary = document.createElement("span");
      summary.className = "weather-hud-forecast-summary";
      summary.textContent = entry.summary;
      text.appendChild(summary);
    }
    text.title = [entry.date, entry.condition, entry.temperature, entry.summary].filter(Boolean).join(" · ");
    row.appendChild(day);
    row.appendChild(icon);
    row.appendChild(text);
    list.appendChild(row);
  }
}
function formatForecastDayLabel(dateValue) {
  const timestamp = parseStoryDateTime(dateValue, "12:00");
  if (timestamp === null)
    return dateValue;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(timestamp);
}
function resolveClockDate(state, clockMode) {
  if (clockMode === "story")
    return null;
  if (clockMode === "live")
    return new Date;
  return state.source === "manual" ? new Date : null;
}
var dateFormatters = new Map;
var timeFormatters = new Map;
function getDateFormatter(locale) {
  const existing = dateFormatters.get(locale);
  if (existing)
    return existing;
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  dateFormatters.set(locale, formatter);
  return formatter;
}
function getTimeFormatter(locale) {
  const existing = timeFormatters.get(locale);
  if (existing)
    return existing;
  const formatter = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  timeFormatters.set(locale, formatter);
  return formatter;
}
function syncHudClock(hud, displayState, hasState, liveDate) {
  const locale = document.documentElement.lang || navigator.language || "en-US";
  const nextDate = liveDate ? getDateFormatter(locale).format(liveDate) : hasState ? displayState.date : "No tag yet";
  const nextTime = liveDate ? getTimeFormatter(locale).format(liveDate) : hasState ? displayState.time : "—";
  if (hud.root.dataset.clockDate !== nextDate) {
    hud.root.dataset.clockDate = nextDate;
    hud.date.textContent = nextDate;
  }
  if (hud.root.dataset.clockTime !== nextTime) {
    hud.root.dataset.clockTime = nextTime;
    hud.time.textContent = nextTime;
  }
  hud.root.dataset.clockSource = liveDate ? "live" : "story";
}
function syncHudState(hud, prefs, state, expanded, hasActiveChat) {
  const displayState = state ?? makeDefaultWeatherState();
  const liveDate = resolveClockDate(displayState, prefs.clockMode);
  const phase = resolveHudTimePhase2(displayState, liveDate);
  const sceneIntensity = clamp(displayState.intensity * prefs.intensity, 0.25, 1.5);
  hud.root.dataset.expanded = expanded ? "true" : "false";
  hud.root.dataset.empty = state ? "false" : "true";
  hud.root.dataset.source = state?.source ?? "empty";
  hud.root.dataset.condition = displayState.condition;
  hud.root.dataset.palette = displayState.palette;
  hud.root.dataset.timePhase = phase;
  hud.root.dataset.layer = prefs.layerMode;
  hud.root.dataset.paused = prefs.pauseEffects ? "true" : "false";
  hud.root.style.setProperty("--weather-hud-scene-intensity", sceneIntensity.toFixed(2));
  const solar = resolveSolarArc(displayState.date, displayState.time);
  const lunar = resolveLunarPhase(displayState.date, displayState.time);
  const exposure = displayState.exposure ?? "outdoor";
  const phenomenon = displayState.phenomenon ?? "none";
  hud.root.style.setProperty("--weather-sun-altitude", solar.sunAltitude.toFixed(1));
  hud.root.dataset.season = state ? displayState.season : "unknown";
  hud.root.dataset.exposure = exposure;
  hud.root.dataset.phenomenon = phenomenon;
  hud.root.dataset.lunarPhase = lunar.phase;
  const iconMarkup = conditionIcon(displayState.condition, phase);
  hud.icon.innerHTML = iconMarkup;
  const iconLabel = conditionIconLabel(displayState.condition, phase);
  hud.icon.setAttribute("role", "img");
  hud.icon.setAttribute("aria-label", iconLabel);
  hud.icon.title = iconLabel;
  hud.temp.textContent = state ? formatTemperatureForUnit(displayState.temperature, prefs.temperatureUnit) : "—";
  const summaryText = state ? displayState.summary : "Waiting for the first weather tag";
  hud.summary.textContent = summaryText;
  hud.summary.title = summaryText;
  hud.summary.dataset.tickerText = summaryText;
  const windBase = `Wind ${displayState.wind}${displayState.windDirection === "none" ? "" : ` from ${displayState.windDirection}`}`;
  const windExtras = [];
  if (exposure !== "outdoor")
    windExtras.push(exposure);
  if (phenomenon !== "none")
    windExtras.push(phenomenon);
  hud.wind.textContent = state ? [windBase, ...windExtras].join(" · ") : "Add {{weather_tracker}} to the prompt";
  hud.location.textContent = state ? displayState.location : "Waiting for LumiWeather";
  hud.location.title = hud.location.textContent;
  hud.wind.title = state ? `${hud.wind.textContent} · ${lunar.label} (${Math.round(lunar.illumination * 100)}% moon)` : hud.wind.textContent;
  const permissionLimited = hud.root.dataset.permission === "limited";
  hud.source.textContent = hud.root.dataset.error === "true" ? "Update failed" : permissionLimited ? "Permission needed" : state ? displayState.source === "manual" ? "Scene lock" : "Story sync" : "Waiting";
  const mobilePanel = hud.root.dataset.presentation === "mobile-panel";
  hud.drawerToggleLabel.textContent = mobilePanel ? "Close" : expanded ? "Hide" : "Controls";
  hud.drawerToggleIcon.innerHTML = mobilePanel ? CLOSE_SVG : expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  hud.drawerToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  hud.drawerToggle.setAttribute("aria-label", mobilePanel ? "Close LumiWeather" : expanded ? "Hide LumiWeather controls" : "Show LumiWeather controls");
  if (hud.launcherButton && hud.launcherIcon) {
    hud.launcherIcon.innerHTML = iconMarkup;
    const launcherLabel = state ? `Open LumiWeather: ${displayState.location}, ${displayState.condition}, ${formatTemperatureForUnit(displayState.temperature, prefs.temperatureUnit)}` : "Open LumiWeather: waiting for a weather update";
    hud.launcherButton.setAttribute("aria-label", launcherLabel);
    hud.launcherButton.title = launcherLabel;
  }
  syncHudClock(hud, displayState, state !== null, liveDate);
  if (hud.storyButton && hud.manualButton) {
    hud.storyButton.classList.toggle("weather-hud-chip-active", state?.source === "story");
    hud.manualButton.classList.toggle("weather-hud-chip-active", state?.source === "manual");
    hud.storyButton.setAttribute("aria-pressed", String(state?.source === "story"));
    hud.manualButton.setAttribute("aria-pressed", String(state?.source === "manual"));
    hud.storyButton.disabled = !state || state.source === "story";
    hud.manualButton.disabled = !state;
  }
  const activePresetId = matchWeatherScenePreset(state);
  for (const [presetId, button] of hud.presetButtons) {
    button.classList.toggle("weather-hud-preset-active", presetId === activePresetId);
    button.setAttribute("aria-pressed", String(presetId === activePresetId));
    button.disabled = !hasActiveChat;
  }
  if (hud.layerSelect) {
    hud.layerSelect.value = prefs.layerMode;
  }
  if (hud.exposureSelect) {
    hud.exposureSelect.value = exposure;
    hud.exposureSelect.disabled = !hasActiveChat;
  }
  if (hud.phenomenonSelect) {
    hud.phenomenonSelect.value = phenomenon;
    hud.phenomenonSelect.disabled = !hasActiveChat;
  }
  if (hud.intensitySlider && hud.intensityValue) {
    hud.intensitySlider.value = prefs.intensity.toFixed(2);
    hud.intensityValue.textContent = `${Math.round(prefs.intensity * 100)}%`;
  }
  if (hud.pauseButton) {
    hud.pauseButton.textContent = prefs.pauseEffects ? "Resume motion" : "Pause motion";
    hud.pauseButton.classList.toggle("weather-hud-control-active", prefs.pauseEffects);
    hud.pauseButton.setAttribute("aria-pressed", String(prefs.pauseEffects));
  }
  if (hud.soundButton) {
    const soundEnabled = Boolean(prefs.soundEnabled);
    hud.soundButton.textContent = soundEnabled ? "Soundscape on" : "Soundscape off";
    hud.soundButton.classList.toggle("weather-hud-control-active", soundEnabled);
    hud.soundButton.setAttribute("aria-pressed", String(soundEnabled));
  }
  if (hud.resumeButton) {
    hud.resumeButton.disabled = !state || state.source === "story";
  }
  if (hud.forecastSection && hud.forecastList) {
    const entries = prefs.showForecast && state ? state.forecast : [];
    const show = entries.length > 0 && expanded;
    hud.forecastSection.hidden = !show;
    if (show) {
      const forecastKey = `${prefs.temperatureUnit}|${entries.map((entry) => `${entry.date}:${entry.condition}:${entry.temperature}:${entry.summary}`).join("|")}`;
      if (hud.forecastList.dataset.forecastKey !== forecastKey) {
        hud.forecastList.dataset.forecastKey = forecastKey;
        renderForecastStrip(hud.forecastList, entries, prefs.temperatureUnit);
      }
    } else if (hud.forecastList.dataset.forecastKey) {
      hud.forecastList.dataset.forecastKey = "";
      hud.forecastList.replaceChildren();
    }
  }
}
function setFxVisibility(root, visible) {
  root.root.classList.toggle("weather-hidden", !visible);
  root.root.classList.toggle("weather-visible", visible);
}
var TRANSITIONED_TOKENS = [
  ["--weather-bg-start", "bgStart"],
  ["--weather-bg-mid", "bgMid"],
  ["--weather-bg-end", "bgEnd"],
  ["--weather-glow", "glow"],
  ["--weather-beam-color", "beamColor"],
  ["--weather-horizon-color", "horizonColor"],
  ["--weather-cloud-core", "cloudCore"],
  ["--weather-cloud-edge", "cloudEdge"],
  ["--weather-fog-color", "fogColor"],
  ["--weather-mist-color", "mistColor"],
  ["--weather-sky-opacity", "skyOpacity"],
  ["--weather-glow-opacity", "glowOpacity"],
  ["--weather-beam-opacity", "beamOpacity"],
  ["--weather-cloud-opacity", "cloudOpacity"],
  ["--weather-horizon-opacity", "horizonOpacity"],
  ["--weather-mist-opacity", "mistOpacity"],
  ["--weather-fog-opacity", "fogOpacity"],
  ["--weather-rain-opacity", "rainOpacity"],
  ["--weather-snow-opacity", "snowOpacity"],
  ["--weather-mote-opacity", "moteOpacity"],
  ["--weather-star-opacity", "starOpacity"],
  ["--weather-moonlight-opacity", "moonlightOpacity"],
  ["--weather-aurora-opacity", "auroraOpacity"],
  ["--weather-window-droplet-opacity", "windowDropletOpacity"],
  ["--weather-phenomenon-opacity", "phenomenonOpacity"],
  ["--weather-flash-opacity", "flashOpacity"]
];
function tokenCssValue(value) {
  return typeof value === "number" ? String(value) : value;
}
function sceneKeyFor(state, effectiveIntensity, prefs) {
  return [
    state.condition,
    state.palette,
    state.exposure ?? "outdoor",
    state.phenomenon ?? "none",
    Math.round(effectiveIntensity * 1000),
    Math.round(state.intensity * 1000),
    prefs.layerMode
  ].join(":");
}
var sceneTransitionsSupported = (() => {
  try {
    return typeof CSS !== "undefined" && typeof CSS.registerProperty === "function" && typeof CSS.supports === "function" && CSS.supports("background-color", "color-mix(in srgb, red 50%, blue)");
  } catch {
    return false;
  }
})();
function writeSceneTokens(root, tokens) {
  for (const [property, key] of TRANSITIONED_TOKENS) {
    root.root.style.setProperty(property, tokenCssValue(tokens[key]));
  }
}
function applySceneBlend(root, to, onComplete) {
  if (root.blendTimer !== null)
    window.clearTimeout(root.blendTimer);
  root.root.classList.add("weather-scene-blending");
  root.root.offsetWidth;
  writeSceneTokens(root, to);
  root.blendTimer = window.setTimeout(() => {
    root.blendTimer = null;
    root.root.classList.remove("weather-scene-blending");
    onComplete();
  }, SCENE_TRANSITION_MS);
}
function clearSceneBlend(root) {
  root.root.classList.remove("weather-scene-blending");
  if (root.blendTimer !== null) {
    window.clearTimeout(root.blendTimer);
    root.blendTimer = null;
  }
}
function applySceneState(root, state, prefs, reducedMotion, visible, onBlendComplete) {
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const tokens = resolveSceneTokens(state, effectiveIntensity);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const rainVector = resolveRainVector(state.wind, state.windDirection);
  const isFront = root.kind === "front";
  const visibleRainDensity = reducedMotion ? Math.min(rainProfile.density, 0.22) : rainProfile.density;
  const rainLayerOpacity = tokens.rainOpacity * rainProfile.opacityScale * (isFront ? 0.82 : 0.72);
  const paused = prefs.pauseEffects || document.visibilityState === "hidden";
  root.root.dataset.condition = state.condition;
  root.root.dataset.palette = state.palette;
  root.root.dataset.exposure = state.exposure ?? "outdoor";
  root.root.dataset.phenomenon = state.phenomenon ?? "none";
  root.root.classList.toggle("weather-reduced-motion", reducedMotion);
  root.root.classList.toggle("weather-paused", paused);
  root.root.classList.toggle("weather-rain-active", state.condition === "rain" || state.condition === "storm");
  root.root.classList.toggle("weather-snow-active", state.condition === "snow");
  root.root.classList.toggle("weather-night-active", tokens.starOpacity > 0 || tokens.moonlightOpacity > 0);
  root.root.classList.toggle("weather-aurora-active", tokens.auroraOpacity > 0);
  root.root.classList.toggle("weather-windowpane-active", tokens.windowDropletOpacity > 0);
  root.root.classList.toggle("weather-phenomenon-active", tokens.phenomenonOpacity > 0);
  const resolvedTokens = {
    ...tokens,
    glowOpacity: isFront ? 0 : tokens.glowOpacity,
    beamOpacity: isFront ? 0 : tokens.beamOpacity,
    fogOpacity: isFront ? 0 : tokens.fogOpacity,
    rainOpacity: rainLayerOpacity,
    snowOpacity: tokens.snowOpacity * (isFront ? 0.96 : 0.82),
    starOpacity: tokens.starOpacity * (isFront ? prefs.layerMode === "both" ? 0.4 : 0.78 : 1),
    moonlightOpacity: tokens.moonlightOpacity * (isFront ? prefs.layerMode === "both" ? 0.22 : 0.65 : 1),
    auroraOpacity: tokens.auroraOpacity * (isFront ? prefs.layerMode === "both" ? 0.25 : 0.75 : 1),
    windowDropletOpacity: tokens.windowDropletOpacity * (isFront ? 1 : prefs.layerMode === "both" ? 0.35 : 0.9),
    phenomenonOpacity: tokens.phenomenonOpacity * (isFront ? 0.95 : 0.85)
  };
  const nextKey = sceneKeyFor(state, effectiveIntensity, prefs);
  const canBlend = prefs.effectsEnabled && (prefs.layerMode === "both" || prefs.layerMode === root.kind) && prefs.transitionsEnabled && sceneTransitionsSupported && !reducedMotion && !paused && root.sceneTokens !== null && visible;
  if (canBlend && root.sceneKey !== nextKey) {
    applySceneBlend(root, resolvedTokens, onBlendComplete);
  } else if (!canBlend || root.blendTimer === null) {
    clearSceneBlend(root);
    writeSceneTokens(root, resolvedTokens);
  }
  root.sceneTokens = resolvedTokens;
  root.sceneKey = nextKey;
  root.root.style.setProperty("--weather-procedural-fog-opacity", String(clamp(0.42 + state.intensity * prefs.intensity * 0.18, 0.42, 0.72)));
  root.root.style.setProperty("--weather-rain-density", String(visibleRainDensity));
  root.root.style.setProperty("--weather-rain-speed-scale", String(rainProfile.speedScale));
  root.root.style.setProperty("--weather-rain-angle", `${rainVector.angle}deg`);
  root.root.style.setProperty("--weather-rain-color", state.condition === "storm" ? "rgba(212, 231, 255, 0.96)" : "rgba(190, 220, 255, 0.84)");
  root.root.style.setProperty("--weather-snow-color", state.palette === "night" ? "rgba(219, 232, 255, 0.92)" : "rgba(247, 250, 255, 0.95)");
  root.root.style.setProperty("--weather-particle-opacity-static", state.condition === "snow" ? String(clamp(tokens.snowOpacity * 0.2, 0.04, 0.22)) : String(clamp(rainLayerOpacity * 0.13, 0.025, 0.12)));
  updateAtmosphereEngine(root.root, root.kind, {
    state,
    tokens: resolvedTokens,
    prefs,
    kind: root.kind,
    visible,
    reducedMotion,
    paused
  });
}
function setup(ctx) {
  const cleanups = [];
  const removeStyle = ctx.dom.addStyle(WEATHER_HUD_CSS);
  cleanups.push(removeStyle);
  let currentPrefs = DEFAULT_PREFS;
  let currentState = null;
  let activeChatId = null;
  let activeChatRequestId = 0;
  let hudExpanded = false;
  let permissionWarning = null;
  let backendWarning = null;
  let keyboardState = ctx.ui.events.getKeyboardState();
  const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
  let mobileHudLayout = isMobileHudLayout(keyboardState.viewportWidth, coarsePointerMedia.matches);
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const getReducedMotion = () => currentPrefs.reducedMotion === "always" || currentPrefs.reducedMotion === "system" && motionMedia.matches;
  const sendManualState = (state) => {
    sendToBackend(ctx, { type: "set_manual_state", chatId: activeChatId, state });
  };
  const resumeStorySync = () => {
    sendToBackend(ctx, { type: "clear_manual_override", chatId: activeChatId });
  };
  const applyPreset = (presetId) => {
    const nextState = buildPresetWeatherState(presetId, currentState);
    if (!nextState)
      return;
    sendManualState(nextState);
  };
  const lockCurrentScene = () => {
    const state = currentState ?? makeDefaultWeatherState();
    sendManualState({
      ...state,
      source: "manual"
    });
  };
  const settingsMount = ctx.ui.mount("settings_extensions");
  const settingsUI = createSettingsUI((payload) => {
    const message = payload;
    if (message.type === "set_manual_state" || message.type === "clear_manual_override") {
      sendToBackend(ctx, { ...message, chatId: activeChatId });
      return;
    }
    sendToBackend(ctx, message);
  });
  settingsMount.appendChild(settingsUI.root);
  cleanups.push(() => settingsUI.destroy());
  const soundscape = new WeatherSoundscape;
  cleanups.push(() => soundscape.destroy());
  const backFx = createFxMarkup("back");
  const frontFx = createFxMarkup("front");
  let hostSyncFrame = null;
  const detachFxRoot = (fxRoot) => {
    fxRoot.root.remove();
    fxRoot.host = null;
  };
  const attachFxRoot = (fxRoot, nextHost, before) => {
    if (!nextHost) {
      const hadHost = !!fxRoot.host || fxRoot.root.isConnected;
      detachFxRoot(fxRoot);
      return hadHost;
    }
    if (fxRoot.host === nextHost && fxRoot.root.parentElement === nextHost && (!before || fxRoot.root.nextElementSibling === before)) {
      return false;
    }
    detachFxRoot(fxRoot);
    fxRoot.host = nextHost;
    if (before && before.parentElement === nextHost) {
      nextHost.insertBefore(fxRoot.root, before);
    } else {
      nextHost.appendChild(fxRoot.root);
    }
    return true;
  };
  const attachFxRoots = () => {
    hostSyncFrame = null;
    const nextHosts = resolveSceneHosts();
    const backChanged = attachFxRoot(backFx, nextHosts.backHost, nextHosts.backBefore);
    const frontChanged = attachFxRoot(frontFx, nextHosts.frontHost, nextHosts.frontBefore);
    return backChanged || frontChanged;
  };
  let hostObserver = null;
  const stopHostObserver = () => {
    hostObserver?.disconnect();
    hostObserver = null;
  };
  const ensureHostObserver = () => {
    if (hostObserver || !document.body)
      return;
    hostObserver = new MutationObserver((records) => {
      if (backFx.host && backFx.host.isConnected && backFx.root.parentElement === backFx.host && frontFx.host && frontFx.host.isConnected && frontFx.root.parentElement === frontFx.host) {
        let relevant = false;
        for (let i = 0;i < records.length; i += 1) {
          const record = records[i];
          const target = record.target;
          if (backFx.root.contains(target) || frontFx.root.contains(target) || hud?.root.contains(target)) {
            continue;
          }
          if (target === document.body || target === backFx.host.parentElement || target === frontFx.host.parentElement) {
            relevant = true;
            break;
          }
        }
        if (!relevant)
          return;
      }
      queueFxRootAttach();
    });
    hostObserver.observe(document.body, { childList: true, subtree: true });
  };
  const queueFxRootAttach = () => {
    if (hostSyncFrame !== null)
      return;
    hostSyncFrame = window.requestAnimationFrame(() => {
      const changed = attachFxRoots();
      if (changed)
        updateScene();
      ensureHostObserver();
    });
  };
  cleanups.push(() => {
    if (hostSyncFrame !== null) {
      window.cancelAnimationFrame(hostSyncFrame);
      hostSyncFrame = null;
    }
    stopHostObserver();
    clearSceneBlend(backFx);
    clearSceneBlend(frontFx);
    destroyAtmosphereEngine(backFx.root);
    destroyAtmosphereEngine(frontFx.root);
    detachFxRoot(backFx);
    detachFxRoot(frontFx);
  });
  let hud = null;
  let removeHudDragListener = null;
  let windowedHudPosition = currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
  const destroyHud = () => {
    if (removeHudDragListener) {
      removeHudDragListener();
      removeHudDragListener = null;
    }
    if (hud) {
      hud.widget.destroy();
      hud = null;
    }
  };
  const buildHud = (position) => {
    const mountedWindowedPosition = hud && !hud.widget.isFullscreen() ? hud.widget.getPosition() : null;
    let nextPosition = position ?? mountedWindowedPosition ?? windowedHudPosition ?? currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
    if (mobileHudLayout) {
      nextPosition = clampMobileHudPosition(nextPosition, {
        width: keyboardState.viewportWidth,
        height: keyboardState.viewportHeight
      });
    }
    windowedHudPosition = nextPosition;
    destroyHud();
    hud = createHudWidget(ctx, nextPosition, hudExpanded, mobileHudLayout, keyboardState, {
      onToggleDrawer: () => {
        const restoreFocus = !!hud?.root.contains(document.activeElement);
        const currentPosition = hud && !hud.widget.isFullscreen() ? hud.widget.getPosition() : windowedHudPosition;
        windowedHudPosition = currentPosition;
        hudExpanded = !hudExpanded;
        buildHud(currentPosition);
        updateScene();
        if (restoreFocus && hud)
          (hud.launcherButton ?? hud.drawerToggle).focus({ preventScroll: true });
      },
      onOpenSettings: () => {
        ctx.events.emit("open-settings", { view: "extensions" });
      },
      onLockCurrentScene: () => {
        lockCurrentScene();
      },
      onResumeStory: () => {
        resumeStorySync();
      },
      onApplyPreset: (presetId) => {
        applyPreset(presetId);
      },
      onChangeLayerMode: (mode) => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { layerMode: mode } });
      },
      onChangeExposure: (exposure) => {
        const state = currentState ?? makeDefaultWeatherState();
        sendManualState({ ...state, exposure, source: "manual" });
      },
      onChangePhenomenon: (phenomenon) => {
        const state = currentState ?? makeDefaultWeatherState();
        sendManualState({ ...state, phenomenon, source: "manual" });
      },
      onChangeIntensity: (intensity) => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { intensity } });
      },
      onTogglePause: () => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { pauseEffects: !currentPrefs.pauseEffects } });
      },
      onToggleSound: () => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { soundEnabled: !currentPrefs.soundEnabled } });
      }
    });
    hud.root.dataset.reducedMotion = String(getReducedMotion());
    removeHudDragListener = hud.widget.onDragEnd((nextPositionFromDrag) => {
      windowedHudPosition = nextPositionFromDrag;
      sendToBackend(ctx, { type: "save_prefs", prefs: { widgetPosition: nextPositionFromDrag } });
    });
    syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
  };
  buildHud(currentPrefs.widgetPosition);
  cleanups.push(() => destroyHud());
  const syncHudViewportVariables = () => {
    if (!hud)
      return;
    hud.root.style.setProperty("--weather-keyboard-inset-bottom", `${keyboardState.insetBottom}px`);
    hud.root.style.setProperty("--weather-visual-viewport-height", `${keyboardState.viewportHeight}px`);
  };
  const refreshMobileHudLayout = (nextKeyboardState, coarsePointer) => {
    const previousKeyboardState = keyboardState;
    const previousMobileHudLayout = mobileHudLayout;
    keyboardState = nextKeyboardState;
    mobileHudLayout = isMobileHudLayout(keyboardState.viewportWidth, coarsePointer);
    const layoutChanged = mobileHudLayout !== previousMobileHudLayout;
    const widthChanged = keyboardState.viewportWidth !== previousKeyboardState.viewportWidth;
    const heightChanged = keyboardState.viewportHeight !== previousKeyboardState.viewportHeight;
    if (!layoutChanged && mobileHudLayout && !hudExpanded && (widthChanged || heightChanged)) {
      windowedHudPosition = clampMobileHudPosition(windowedHudPosition, {
        width: keyboardState.viewportWidth,
        height: keyboardState.viewportHeight
      });
      if (hud && !hud.widget.isFullscreen()) {
        hud.widget.moveTo(windowedHudPosition.x, windowedHudPosition.y);
      }
    }
    const shouldRebuild = layoutChanged || mobileHudLayout && hudExpanded && widthChanged;
    if (shouldRebuild) {
      buildHud(windowedHudPosition);
      return;
    }
    syncHudViewportVariables();
  };
  const keyboardUnsub = ctx.ui.events.onKeyboardChange((nextKeyboardState) => {
    refreshMobileHudLayout(nextKeyboardState, coarsePointerMedia.matches);
  });
  cleanups.push(keyboardUnsub);
  const onCoarsePointerChange = () => {
    refreshMobileHudLayout(ctx.ui.events.getKeyboardState(), coarsePointerMedia.matches);
  };
  coarsePointerMedia.addEventListener("change", onCoarsePointerChange);
  cleanups.push(() => coarsePointerMedia.removeEventListener("change", onCoarsePointerChange));
  let flashTimer = null;
  const flashCleanupTimers = new Set;
  const scheduleFlashCleanup = (callback, delay) => {
    const timer = window.setTimeout(() => {
      flashCleanupTimers.delete(timer);
      callback();
    }, delay);
    flashCleanupTimers.add(timer);
  };
  const resetFlashTimer = () => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
  };
  let disposed = false;
  const canRunLightning = () => !disposed && currentState?.condition === "storm" && !getReducedMotion() && !currentPrefs.pauseEffects && currentPrefs.effectsEnabled && currentPrefs.lightningFlashEnabled && document.visibilityState !== "hidden" && !!activeChatId;
  const scheduleStormFlash = () => {
    resetFlashTimer();
    if (!canRunLightning()) {
      for (const timer of flashCleanupTimers)
        window.clearTimeout(timer);
      flashCleanupTimers.clear();
      backFx.root.classList.remove("weather-storm-flash");
      frontFx.root.classList.remove("weather-storm-flash");
      frontFx.root.classList.remove("weather-lightning-glow-flash");
      return;
    }
    if (backFx.blendTimer !== null || frontFx.blendTimer !== null)
      return;
    const trigger = () => {
      flashTimer = null;
      if (!canRunLightning() || backFx.blendTimer !== null || frontFx.blendTimer !== null) {
        scheduleStormFlash();
        return;
      }
      if (currentPrefs.lightningFlashEnabled) {
        backFx.root.classList.add("weather-storm-flash");
        frontFx.root.classList.add("weather-storm-flash");
      }
      const boltIndex = Math.floor(Math.random() * LIGHTNING_BOLT_POSITIONS.length);
      const boltX = LIGHTNING_BOLT_POSITIONS[boltIndex] ?? 50;
      triggerAtmosphereLightning(backFx.root, boltX);
      triggerAtmosphereLightning(frontFx.root, boltX);
      frontFx.root.style.setProperty("--weather-lightning-x", `${boltX}%`);
      frontFx.root.classList.remove("weather-lightning-glow-flash");
      frontFx.root.offsetWidth;
      frontFx.root.classList.add("weather-lightning-glow-flash");
      soundscape.triggerThunder(boltX);
      scheduleFlashCleanup(() => {
        backFx.root.classList.remove("weather-storm-flash");
        frontFx.root.classList.remove("weather-storm-flash");
        frontFx.root.classList.remove("weather-lightning-glow-flash");
      }, 650);
      flashTimer = window.setTimeout(trigger, 3200 + Math.random() * 5200);
    };
    flashTimer = window.setTimeout(trigger, 1400 + Math.random() * 2800);
  };
  const updateScene = () => {
    const reducedMotion = getReducedMotion();
    const layerMode = currentPrefs.layerMode;
    const showEffects = currentPrefs.effectsEnabled && document.visibilityState !== "hidden" && !!activeChatId && !!currentState;
    const sceneState = currentState ?? makeDefaultWeatherState();
    const showBack = showEffects && !!backFx.host && (layerMode === "back" || layerMode === "both");
    const showFront = showEffects && !!frontFx.host && (layerMode === "front" || layerMode === "both");
    if (hud) {
      hud.root.dataset.permission = permissionWarning ? "limited" : "ok";
      hud.root.dataset.error = String(!!backendWarning);
      hud.source.title = backendWarning ?? permissionWarning ?? "";
      hud.root.dataset.reducedMotion = String(reducedMotion);
      syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
    }
    settingsUI.sync(currentPrefs, currentState, !activeChatId ? "No active chat" : backendWarning ?? permissionWarning ?? undefined, activeChatId);
    setFxVisibility(backFx, showBack);
    setFxVisibility(frontFx, showFront);
    applySceneState(backFx, sceneState, currentPrefs, reducedMotion, showBack, scheduleStormFlash);
    applySceneState(frontFx, sceneState, currentPrefs, reducedMotion, showFront, scheduleStormFlash);
    soundscape.sync(currentState, currentPrefs, showEffects);
    scheduleStormFlash();
  };
  const clockTimer = window.setInterval(() => {
    if (!hud)
      return;
    const clockMode = currentPrefs.clockMode;
    if (clockMode === "story")
      return;
    if (clockMode === "auto" && currentState?.source !== "manual")
      return;
    syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
  }, 1000);
  cleanups.push(() => window.clearInterval(clockTimer));
  const onMotionChange = () => updateScene();
  motionMedia.addEventListener("change", onMotionChange);
  cleanups.push(() => motionMedia.removeEventListener("change", onMotionChange));
  const onResize = () => queueFxRootAttach();
  window.addEventListener("resize", onResize);
  cleanups.push(() => window.removeEventListener("resize", onResize));
  const onVisibilityChange = () => updateScene();
  document.addEventListener("visibilitychange", onVisibilityChange);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
  const tagUnsub = ctx.messages.registerTagInterceptor({ tagName: WEATHER_TAG_NAME, removeFromMessage: true }, (payload) => {
    if (!shouldProcessWeatherTag(payload))
      return;
    const chatId = payload.chatId ?? activeChatId;
    if (!chatId)
      return;
    sendToBackend(ctx, {
      type: "weather_tag_intercepted",
      chatId,
      messageId: payload.messageId ?? null,
      attrs: payload.attrs,
      isStreaming: false
    });
  });
  cleanups.push(tagUnsub);
  const msgUnsub = ctx.onBackendMessage((raw) => {
    const message = raw;
    switch (message.type) {
      case "prefs":
        backendWarning = null;
        currentPrefs = message.prefs;
        windowedHudPosition = currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
        if (mobileHudLayout) {
          windowedHudPosition = clampMobileHudPosition(windowedHudPosition, {
            width: keyboardState.viewportWidth,
            height: keyboardState.viewportHeight
          });
        }
        if (hud && !hud.widget.isFullscreen()) {
          hud.widget.moveTo(windowedHudPosition.x, windowedHudPosition.y);
        }
        updateScene();
        break;
      case "active_chat_state":
        if (!shouldApplyChatState(activeChatId, message.chatId, message.requestId, activeChatRequestId))
          break;
        backendWarning = null;
        activeChatId = message.chatId;
        currentState = message.state;
        updateScene();
        break;
      case "weather_state":
        if (message.chatId !== activeChatId)
          break;
        backendWarning = null;
        currentState = message.state;
        updateScene();
        break;
      case "error":
        console.warn(`[weather_hud] ${message.message}`);
        backendWarning = message.message;
        settingsUI.reportError(message.message);
        updateScene();
        break;
    }
  });
  cleanups.push(msgUnsub);
  const requestActiveChatState = (chatId) => {
    if (chatId === activeChatId && activeChatRequestId > 0)
      return;
    activeChatId = chatId;
    currentState = null;
    backendWarning = null;
    queueFxRootAttach();
    activeChatRequestId += 1;
    sendToBackend(ctx, { type: "chat_changed", chatId, requestId: activeChatRequestId });
    updateScene();
  };
  const chatSwitchedUnsub = ctx.events.on("CHAT_SWITCHED", (payload) => {
    const chatId = readChatIdFromChatSwitch(payload);
    if (typeof chatId !== "undefined")
      requestActiveChatState(chatId);
  });
  cleanups.push(chatSwitchedUnsub);
  const settingsChangedUnsub = ctx.events.on("SETTINGS_UPDATED", (payload) => {
    const nextChatId = readChatIdFromSettingsUpdate(payload);
    if (typeof nextChatId !== "undefined")
      requestActiveChatState(nextChatId);
  });
  cleanups.push(settingsChangedUnsub);
  sendToBackend(ctx, { type: "frontend_ready" });
  requestActiveChatState(ctx.getActiveChat().chatId);
  queueFxRootAttach();
  updateScene();
  ctx.permissions.getGranted().then((granted) => {
    if (disposed)
      return;
    if (!granted.includes("interceptor")) {
      permissionWarning = "Enable the Interceptor permission to inject the current weather scene into prompts.";
      updateScene();
    }
  }).catch(() => {});
  return () => {
    disposed = true;
    scheduleStormFlash();
    for (const cleanup of cleanups.reverse())
      cleanup();
  };
}
export {
  setup
};
