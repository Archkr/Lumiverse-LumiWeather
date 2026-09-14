// @bun
// src/time-utils.ts
var DAY_MS = 86400000;
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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
    let hours2 = Number.parseInt(time12[1], 10);
    if (hours2 < 1 || hours2 > 12)
      return null;
    const minutes2 = Number.parseInt(time12[2], 10);
    const seconds2 = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (minutes2 > 59 || seconds2 > 59)
      return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours2 < 12)
      hours2 += 12;
    if (meridiem === "AM" && hours2 === 12)
      hours2 = 0;
    return hours2;
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
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
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
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day || parsed.getHours() !== hours || parsed.getMinutes() !== minutes || parsed.getSeconds() !== seconds) {
    return null;
  }
  return parsed.getTime();
}
function resolveDayOfYear(timestamp) {
  if (!Number.isFinite(timestamp))
    return null;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  if (!Number.isFinite(year))
    return null;
  const startOfYear = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, date.getMonth(), date.getDate());
  const day = Math.round((current - startOfYear) / DAY_MS) + 1;
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
var DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
function isRealCalendarDate(value) {
  const match = value.match(DATE_PATTERN);
  if (!match)
    return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31)
    return false;
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}
function normalizeConditionToken(token) {
  const normalized = token.trim().toLowerCase().replace(/\s+/g, " ");
  return CONDITION_ALIASES[normalized] ?? null;
}
function normalizeTemperatureToken(token) {
  const match = token.trim().match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F|C)(?:ahrenheit|elsius)?$/i);
  if (!match)
    return "";
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount))
    return "";
  return `${Math.round(amount)}${match[2].toUpperCase() === "C" ? "C" : "F"}`;
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
  const summaryParts = [];
  for (const part of trimmed.slice(separatorIndex + 1).split(",")) {
    const token = part.trim();
    if (!token)
      continue;
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
    summary: truncateForecastSummary(summaryParts.join(", ")),
    temperature
  };
}
function normalizeForecast(input, maxDays = MAX_FORECAST_DAYS) {
  const rawEntries = [];
  if (typeof input === "string") {
    rawEntries.push(...splitForecastEntries(input));
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string")
        rawEntries.push(...splitForecastEntries(item));
      else if (item && typeof item === "object")
        rawEntries.push(serializeForecastObject(item));
    }
  } else if (input && typeof input === "object") {
    rawEntries.push(serializeForecastObject(input));
  }
  const byDate = new Map;
  for (const raw of rawEntries) {
    const entry = parseForecastEntry(raw);
    if (entry)
      byDate.set(entry.date, entry);
  }
  const limit = Math.max(0, Math.round(clamp(maxDays, 0, MAX_FORECAST_DAYS)));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(0, limit);
}
function serializeForecastObject(candidate) {
  const read = (key) => typeof candidate[key] === "string" ? candidate[key].trim() : "";
  const date = read("date");
  if (!date)
    return "";
  const details = [read("condition"), read("temperature"), read("summary")].filter(Boolean).join(", ");
  return details ? `${date}: ${details}` : date;
}
function formatForecastEntry(entry) {
  const details = [entry.condition, entry.temperature, entry.summary].filter(Boolean).join(", ");
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
var REDUCED_MOTION_VALUES = ["system", "always", "never"];
var TEMPERATURE_UNITS = ["fahrenheit", "celsius"];
var WEATHER_SEASONS = ["spring", "summer", "autumn", "winter"];
var WEATHER_CLOCK_MODES = ["auto", "live", "story"];
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
  transitionsEnabled: true
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
  return { text: trimmed.slice(0, maxLength), truncated: trimmed.length > maxLength };
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
  const windDirectionValue = source.windDirection ?? source.wind_direction ?? source["wind-direction"];
  const forecastValue = source.forecast ?? source.forecast_days ?? source.forecastDays;
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
    forecast,
    updatedAt,
    source: normalizeSource(source.source, fallback.source)
  };
}
function normalizeWeatherTag(attrs, previous) {
  return normalizeWeatherState({ ...attrs, updatedAt: Date.now(), source: "story" }, previous);
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
    transitionsEnabled: typeof source.transitionsEnabled === "boolean" ? source.transitionsEnabled : DEFAULT_PREFS.transitionsEnabled
  };
}

// src/state-utils.ts
function selectEffectiveWeatherState(storyState, manualState) {
  return manualState ?? storyState;
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

// src/prompt-injection.ts
var WEATHER_BREAKDOWN_NAME = "LumiWeather \u2014 Scene State";
function stripWeatherStateMessageContent(content) {
  if (typeof content === "string")
    return stripWeatherStateTags(content);
  if (!Array.isArray(content))
    return content;
  return content.map((part) => {
    if (!part || typeof part !== "object" || !("text" in part))
      return part;
    const text = part.text;
    return typeof text === "string" ? { ...part, text: stripWeatherStateTags(text) } : part;
  });
}
function injectWeatherInstruction(messages, instruction) {
  const cleanedMessages = messages.map((message) => message?.content ? { ...message, content: stripWeatherStateMessageContent(message.content) } : message);
  const firstSystemIndex = cleanedMessages.findIndex((message) => message.role === "system");
  const messageIndex = firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0;
  const injected = { role: "system", content: instruction };
  const nextMessages = [...cleanedMessages];
  nextMessages.splice(messageIndex, 0, injected);
  return {
    messages: nextMessages,
    breakdown: [{ messageIndex, name: WEATHER_BREAKDOWN_NAME }]
  };
}

// src/story-history.ts
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
function rebuildStoryWeatherState(messages, fallbackUpdatedAt = Date.now()) {
  const ordered = messages.map((message, originalIndex) => ({ message, originalIndex })).sort((left, right) => {
    const leftIndex = Number.isFinite(left.message.index_in_chat) ? left.message.index_in_chat : left.originalIndex;
    const rightIndex = Number.isFinite(right.message.index_in_chat) ? right.message.index_in_chat : right.originalIndex;
    return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
  });
  let state = null;
  for (const { message } of ordered) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant" || typeof message.content !== "string")
      continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag)
      continue;
    const updatedAt = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
    state = normalizeWeatherState({ ...tag.attrs, updatedAt, source: "story" }, state);
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
  return left.location === right.location && left.date === right.date && left.time === right.time && left.condition === right.condition && left.summary === right.summary && left.temperature === right.temperature && left.intensity === right.intensity && left.wind === right.wind && left.windDirection === right.windDirection && left.palette === right.palette && left.season === right.season && left.seasonOverride === right.seasonOverride && left.source === right.source && hasSameForecast(left.forecast, right.forecast);
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
var EXTENSION_VERSION = "1.4.0";
var LUMI_STATE_CAPABILITIES = [
  "scene_location",
  "calendar_time",
  "weather_conditions",
  "manual_override",
  "forecast",
  "solar_time"
];

// src/weather-prompt.ts
function buildWeatherTagExample() {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm" season="winter" forecast="2026-01-16: snow, 30F, heavy flurries | 2026-01-17: cloudy, 34F"></weather-state>';
}
function summarizeWeatherState(state) {
  if (!state)
    return "No saved weather state yet.";
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
    `Season: ${state.season}`
  ];
  if (state.forecast.length > 0) {
    lines.push(`Forecast: ${state.forecast.map(formatForecastEntry).join(" | ")}`);
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
    "Preserve every other current scene field unless the visible narrative changes it.",
    "Do not wrap the tag in markdown fences.",
    "Do not explain the tag or mention it in visible prose.",
    "Never place visible prose after the tag.",
    "Emit the tag as the very last text in the assistant message.",
    `Allowed conditions: ${WEATHER_CONDITIONS.join(", ")}`,
    `Allowed palettes: ${WEATHER_PALETTES.join(", ")}`,
    `Allowed seasons: ${WEATHER_SEASONS.join(", ")}`,
    "Use location, date, time, condition, summary, temperature, intensity, wind, windDirection, and palette.",
    "windDirection is where the wind comes from and must be one of: none, north, northeast, east, southeast, south, southwest, west, northwest.",
    "season is optional and, when present, is one of: spring, summer, autumn, winter.",
    "forecast is optional and projects at most five later days. Separate entries with a pipe and format each as date: condition, temperature, summary.",
    "Only include forecast entries the narrative meaningfully establishes; do not invent a daily outlook merely to fill the field.",
    "When forecast is omitted, the previous projection stays in place.",
    "Exact wrapper example:",
    buildWeatherTagExample()
  ].join(`
`);
}
function buildStaticStateMacro() {
  return "The current LumiWeather scene state is injected for the active chat during generation.";
}
function buildPromptInstruction(state) {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    `Current scene: ${summarizeWeatherState(state)}`
  ].join(`
`);
}

// src/backend.ts
var PREFS_FILE = "weather_prefs.json";
var WEATHER_REVISION_VAR = "lumi_weather_state_revision_v1";
var WEATHER_FORMAT_MACROS = ["story_weather_format", "weather_format"];
var WEATHER_TRACKER_MACROS = ["story_weather_tracker", "weather_tracker", "story_weather"];
var WEATHER_STATE_MACROS = ["story_weather_state", "weather_state"];
var TAG_DEDUPE_TTL_MS = 10 * 60 * 1000;
var HISTORY_RECONCILE_DELAY_MS = 150;
var sessions = new Map;
var processedTags = new Map;
var historyReconcileTimers = new Map;
function getSession(userId) {
  const existing = sessions.get(userId);
  if (existing)
    return existing;
  const next = { activeChatId: null };
  sessions.set(userId, next);
  return next;
}
function pruneProcessedTags(now = Date.now()) {
  for (const [key, timestamp] of processedTags) {
    if (now - timestamp > TAG_DEDUPE_TTL_MS)
      processedTags.delete(key);
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
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_STATE_VAR);
    if (!raw)
      return null;
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function saveStoryWeatherState(chatId, state) {
  await spindle.variables.local.set(chatId, WEATHER_STATE_VAR, JSON.stringify(state));
}
async function clearStoryWeatherState(chatId) {
  try {
    await spindle.variables.local.delete(chatId, WEATHER_STATE_VAR);
  } catch {}
}
async function loadManualWeatherState(chatId) {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_MANUAL_STATE_VAR);
    if (!raw)
      return null;
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function saveManualWeatherState(chatId, state) {
  await spindle.variables.local.set(chatId, WEATHER_MANUAL_STATE_VAR, JSON.stringify(state));
}
async function clearManualWeatherState(chatId) {
  try {
    await spindle.variables.local.delete(chatId, WEATHER_MANUAL_STATE_VAR);
  } catch {}
}
async function loadEffectiveWeatherState(chatId) {
  const storyState = await loadStoryWeatherState(chatId);
  const manualState = await loadManualWeatherState(chatId);
  return selectEffectiveWeatherState(storyState, manualState);
}
async function loadWeatherRevision(chatId) {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_REVISION_VAR);
    if (!raw)
      return 0;
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
async function publishWeatherState(chatId, state, revision) {
  const resolvedState = chatId ? state === undefined ? await loadEffectiveWeatherState(chatId) : state : null;
  const storedRevision = chatId ? revision ?? await loadWeatherRevision(chatId) : 0;
  const resolvedRevision = storedRevision || resolvedState?.updatedAt || 0;
  spindle.rpcPool.sync("state.current", makeWeatherLumiStateSnapshot(chatId, resolvedState, resolvedRevision, EXTENSION_VERSION), { requires: [] });
}
async function reconcileStoryWeatherState(userId, chatId, notifyFrontend = true) {
  const previousStory = await loadStoryWeatherState(chatId);
  const messages = await spindle.chat.getMessages(chatId);
  const rebuiltStory = rebuildStoryWeatherState(messages, previousStory?.updatedAt);
  const unchanged = hasSameStoryScene(previousStory, rebuiltStory) && previousStory?.updatedAt === rebuiltStory?.updatedAt;
  const nextStory = unchanged ? previousStory : rebuiltStory;
  const changed = nextStory !== previousStory;
  if (changed) {
    if (nextStory)
      await saveStoryWeatherState(chatId, nextStory);
    else
      await clearStoryWeatherState(chatId);
  }
  const effective = await loadManualWeatherState(chatId) ?? nextStory;
  const revision = changed ? await bumpWeatherRevision(chatId) : await loadWeatherRevision(chatId);
  await publishWeatherState(chatId, effective, revision);
  if (notifyFrontend)
    send(userId, { type: "active_chat_state", chatId, state: effective });
  return effective;
}
function scheduleStoryWeatherReconcile(userId, chatId) {
  const key = `${userId}:${chatId}`;
  const existing = historyReconcileTimers.get(key);
  if (existing)
    clearTimeout(existing);
  historyReconcileTimers.set(key, setTimeout(() => {
    historyReconcileTimers.delete(key);
    reconcileStoryWeatherState(userId, chatId).catch((error) => {
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
    const active = await spindle.chats.getActive(userId);
    session.activeChatId = active?.id ?? null;
    return session.activeChatId;
  } catch {
    return null;
  }
}
async function pushActiveChatState(userId, explicitChatId, requestId) {
  const chatId = await resolveActiveChatId(userId, explicitChatId);
  if (!chatId) {
    await publishWeatherState(null);
    send(userId, { type: "active_chat_state", chatId: null, state: null, requestId });
    return;
  }
  let state;
  try {
    state = await reconcileStoryWeatherState(userId, chatId, false);
  } catch (error) {
    spindle.log.warn(`LumiWeather could not verify chat history: ${error instanceof Error ? error.message : String(error)}`);
    state = await loadEffectiveWeatherState(chatId);
  }
  await publishWeatherState(chatId, state);
  send(userId, {
    type: "active_chat_state",
    chatId,
    state,
    requestId
  });
}
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
pushMacroValues();
spindle.registerInterceptor(async (messages, context) => {
  const chatId = extractChatId(context);
  const state = chatId ? await loadEffectiveWeatherState(chatId) : null;
  const instruction = buildPromptInstruction(state);
  return injectWeatherInstruction(messages, instruction);
}, 90);
var onEvent = spindle.on;
for (const event of ["MESSAGE_EDITED", "MESSAGE_DELETED", "MESSAGE_SWIPED", "SWIPE_EDITED"]) {
  onEvent(event, (payload, eventUserId) => {
    const value = payload && typeof payload === "object" ? payload : {};
    const chatId = extractChatId(payload) ?? extractChatId(value.message);
    if (!chatId)
      return;
    const userIds = eventUserId ? [eventUserId] : [...sessions.entries()].filter(([, session]) => session.activeChatId === chatId).map(([userId]) => userId);
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
        send(userId, { type: "prefs", prefs: await loadPrefs(userId) });
        break;
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
        pruneProcessedTags();
        const tagKey = `${userId}:${chatId}:${message.messageId ?? ""}:${buildTagDedupeKey(message.attrs)}`;
        if (processedTags.has(tagKey))
          break;
        processedTags.set(tagKey, Date.now());
        const previousStory = await loadStoryWeatherState(chatId);
        const nextStory = normalizeWeatherTag(message.attrs, previousStory);
        await saveStoryWeatherState(chatId, nextStory);
        const revision = await bumpWeatherRevision(chatId);
        const effective = await loadManualWeatherState(chatId) ?? nextStory;
        await publishWeatherState(chatId, effective, revision);
        send(userId, { type: "weather_state", chatId, state: effective });
        break;
      }
      case "set_manual_state": {
        const chatId = await resolveActiveChatId(userId, message.chatId ?? undefined);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not resolve an active chat." });
          spindle.toast.warning("Open a chat before locking a weather scene.", {
            title: "LumiWeather",
            userId
          });
          break;
        }
        const previous = await loadManualWeatherState(chatId) ?? await loadStoryWeatherState(chatId) ?? makeDefaultWeatherState();
        const nextState = applyManualWeatherState(previous, message.state);
        await saveManualWeatherState(chatId, nextState);
        const revision = await bumpWeatherRevision(chatId);
        await publishWeatherState(chatId, nextState, revision);
        send(userId, { type: "weather_state", chatId, state: nextState });
        break;
      }
      case "clear_manual_override": {
        const chatId = await resolveActiveChatId(userId, message.chatId ?? undefined);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not be cleared because no chat is active." });
          break;
        }
        await clearManualWeatherState(chatId);
        const revision = await bumpWeatherRevision(chatId);
        const storyState = await loadStoryWeatherState(chatId);
        await publishWeatherState(chatId, storyState, revision);
        send(userId, {
          type: "active_chat_state",
          chatId,
          state: storyState
        });
        break;
      }
      case "save_prefs": {
        const currentPrefs = await loadPrefs(userId);
        const nextPrefs = normalizePrefs({ ...currentPrefs, ...message.prefs });
        await savePrefs(userId, nextPrefs);
        send(userId, { type: "prefs", prefs: nextPrefs });
        break;
      }
      case "reset_widget_position": {
        const currentPrefs = await loadPrefs(userId);
        const nextPrefs = normalizePrefs({ ...currentPrefs, widgetPosition: null });
        await savePrefs(userId, nextPrefs);
        send(userId, { type: "prefs", prefs: nextPrefs });
        break;
      }
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    spindle.log.error(`Weather HUD error: ${messageText}`);
    send(userId, { type: "error", message: messageText || "Unknown Weather HUD error." });
  }
});
