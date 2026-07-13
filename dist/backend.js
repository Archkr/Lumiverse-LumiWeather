// @bun
// src/shared.ts
var WEATHER_STATE_VAR = "weather_state_json";
var WEATHER_MANUAL_STATE_VAR = "weather_manual_state_json";
var WEATHER_CONDITIONS = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
var WEATHER_LAYERS = ["back", "front", "both"];
var WEATHER_PALETTES = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
var REDUCED_MOTION_VALUES = ["system", "always", "never"];
var TEMPERATURE_UNITS = ["fahrenheit", "celsius"];
var DEFAULT_PREFS = {
  effectsEnabled: true,
  lightningFlashEnabled: true,
  layerMode: "both",
  intensity: 1,
  reducedMotion: "system",
  temperatureUnit: "fahrenheit",
  pauseEffects: false,
  widgetPosition: null
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
  return CONDITION_ALIASES[value.trim().toLowerCase()] ?? fallback;
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
function derivePalette(condition, dateValue, timeValue) {
  if (condition === "storm")
    return "storm";
  if (condition === "fog")
    return "mist";
  if (condition === "snow")
    return "snow";
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp !== null) {
    const hour2 = new Date(timestamp).getHours();
    if (hour2 < 6)
      return "night";
    if (hour2 < 10)
      return "dawn";
    if (hour2 < 18)
      return "day";
    if (hour2 < 21)
      return "dusk";
    return "night";
  }
  const hour = parseHourFromTimeString(timeValue);
  if (hour === null)
    return condition === "cloudy" || condition === "rain" ? "dusk" : "day";
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
  return {
    location: normalizeText(source.location, fallback.location, 72),
    date,
    time,
    condition,
    summary: normalizeText(source.summary, fallback.summary, 72),
    temperature: normalizeText(source.temperature, fallback.temperature, 16),
    intensity,
    wind: normalizeText(source.wind, fallback.wind, 32),
    windDirection: normalizeWindDirection(windDirectionValue, fallback.windDirection),
    palette,
    updatedAt,
    source: normalizeSource(source.source, fallback.source)
  };
}
function normalizeWeatherTag(attrs, previous) {
  return normalizeWeatherState({ ...attrs, updatedAt: Date.now(), source: "story" }, previous);
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
    widgetPosition: position
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

// src/state-utils.ts
function selectEffectiveWeatherState(storyState, manualState) {
  return manualState ?? storyState;
}

// src/backend.ts
var PREFS_FILE = "weather_prefs.json";
var WEATHER_FORMAT_MACROS = ["story_weather_format", "weather_format"];
var WEATHER_TRACKER_MACROS = ["story_weather_tracker", "weather_tracker", "story_weather"];
var WEATHER_STATE_MACROS = ["story_weather_state", "weather_state"];
var TAG_DEDUPE_TTL_MS = 10 * 60 * 1000;
var sessions = new Map;
var processedTags = new Map;
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
function buildWeatherTagExample() {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm"></weather-state>';
}
function summarizeWeatherState(state) {
  if (!state)
    return "No saved weather state yet.";
  return [
    `Location: ${state.location}`,
    `Date: ${state.date}`,
    `Time: ${state.time}`,
    `Condition: ${state.condition}`,
    `Summary: ${state.summary}`,
    `Temperature: ${state.temperature}`,
    `Intensity: ${state.intensity.toFixed(2)}`,
    `Wind: ${state.wind}`,
    `Wind direction: ${state.windDirection}`,
    `Palette: ${state.palette}`
  ].join(" | ");
}
function buildTrackerMacro() {
  return [
    "IMPORTANT OUTPUT FORMAT:",
    "Write the visible reply first, then append exactly one final XML weather-state tag.",
    "Never omit the weather-state tag, even if the scene only changed slightly.",
    "Do not wrap the tag in markdown fences.",
    "Do not explain the tag or mention it in visible prose.",
    "Never place visible prose after the tag.",
    "Emit the tag as the very last text in the assistant message.",
    `Allowed conditions: ${WEATHER_CONDITIONS.join(", ")}`,
    `Allowed palettes: ${WEATHER_PALETTES.join(", ")}`,
    "Use location, date, time, condition, summary, temperature, intensity, wind, windDirection, and palette.",
    "windDirection is where the wind comes from and must be one of: none, north, northeast, east, southeast, south, southwest, west, northwest.",
    "Exact wrapper example:",
    buildWeatherTagExample()
  ].join(`
`);
}
function buildStaticStateMacro() {
  return "The current LumiWeather scene state is injected for the active chat during generation.";
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
function buildPromptInstruction(state) {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    `Current scene: ${summarizeWeatherState(state)}`
  ].join(`
`);
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
    return normalizeWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function saveStoryWeatherState(chatId, state) {
  await spindle.variables.local.set(chatId, WEATHER_STATE_VAR, JSON.stringify(state));
}
async function loadManualWeatherState(chatId) {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_MANUAL_STATE_VAR);
    if (!raw)
      return null;
    return normalizeWeatherState(JSON.parse(raw));
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
    send(userId, { type: "active_chat_state", chatId: null, state: null, requestId });
    return;
  }
  send(userId, {
    type: "active_chat_state",
    chatId,
    state: await loadEffectiveWeatherState(chatId),
    requestId
  });
}
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
  const cleanedMessages = messages.map((message) => message?.content ? { ...message, content: stripWeatherStateMessageContent(message.content) } : message);
  const instruction = buildPromptInstruction(state);
  const systemIndex = cleanedMessages.findIndex((message) => message.role === "system");
  if (systemIndex >= 0) {
    const systemMessage = cleanedMessages[systemIndex];
    cleanedMessages[systemIndex] = typeof systemMessage.content === "string" ? { ...systemMessage, content: `${systemMessage.content.trim()}

${instruction}`.trim() } : { ...systemMessage, content: [...systemMessage.content, { type: "text", text: instruction }] };
    return cleanedMessages;
  }
  return [{ role: "system", content: instruction }, ...cleanedMessages];
}, 90);
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
          break;
        }
        pruneProcessedTags();
        const tagKey = `${userId}:${chatId}:${message.messageId ?? ""}:${JSON.stringify(message.attrs)}`;
        if (processedTags.has(tagKey))
          break;
        processedTags.set(tagKey, Date.now());
        const previousStory = await loadStoryWeatherState(chatId);
        const nextStory = normalizeWeatherTag(message.attrs, previousStory);
        await saveStoryWeatherState(chatId, nextStory);
        const effective = await loadManualWeatherState(chatId) ?? nextStory;
        send(userId, { type: "weather_state", chatId, state: effective });
        break;
      }
      case "set_manual_state": {
        const chatId = await resolveActiveChatId(userId, message.chatId ?? undefined);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not resolve an active chat." });
          break;
        }
        const previous = await loadManualWeatherState(chatId) ?? await loadStoryWeatherState(chatId) ?? makeDefaultWeatherState();
        const nextState = normalizeWeatherState({ ...previous, ...message.state, updatedAt: Date.now(), source: "manual" }, previous);
        await saveManualWeatherState(chatId, nextState);
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
        send(userId, {
          type: "active_chat_state",
          chatId,
          state: await loadStoryWeatherState(chatId)
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
