type WeatherSpindleAPI = import("lumiverse-spindle-types").SpindleAPI & {
  variables: {
    local: {
      get(chatId: string, key: string): Promise<string>;
      set(chatId: string, key: string, value: string): Promise<void>;
      delete(chatId: string, key: string): Promise<void>;
    };
  };
  chats: {
    getActive(userId?: string): Promise<{ id: string } | null>;
  };
  sendToFrontend(payload: unknown, userId?: string): void;
};

declare const spindle: WeatherSpindleAPI;

import type { BackendToFrontend, FrontendToBackend, WeatherPrefs, WeatherState } from "./types";
import {
  DEFAULT_PREFS,
  WEATHER_CONDITIONS,
  WEATHER_MANUAL_STATE_VAR,
  WEATHER_PALETTES,
  WEATHER_STATE_VAR,
  makeDefaultWeatherState,
  normalizePrefs,
  normalizeWeatherState,
  normalizeWeatherTag,
} from "./shared";
import { selectEffectiveWeatherState } from "./state-utils";
import { makeWeatherLumiStateSnapshot } from "./lumi-state";
import { injectWeatherInstruction } from "./prompt-injection";

const PREFS_FILE = "weather_prefs.json";
const EXTENSION_VERSION = "1.3.1";
const WEATHER_REVISION_VAR = "lumi_weather_state_revision_v1";
const WEATHER_FORMAT_MACROS = ["story_weather_format", "weather_format"] as const;
const WEATHER_TRACKER_MACROS = ["story_weather_tracker", "weather_tracker", "story_weather"] as const;
const WEATHER_STATE_MACROS = ["story_weather_state", "weather_state"] as const;
const TAG_DEDUPE_TTL_MS = 10 * 60 * 1000;

type BackendSession = {
  activeChatId: string | null;
};

const sessions = new Map<string, BackendSession>();
const processedTags = new Map<string, number>();

function getSession(userId: string): BackendSession {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const next = { activeChatId: null };
  sessions.set(userId, next);
  return next;
}

function pruneProcessedTags(now = Date.now()): void {
  for (const [key, timestamp] of processedTags) {
    if (now - timestamp > TAG_DEDUPE_TTL_MS) processedTags.delete(key);
  }
}

function buildWeatherTagExample(): string {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm"></weather-state>';
}

function summarizeWeatherState(state: WeatherState | null): string {
  if (!state) return "No saved weather state yet.";
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
    `Palette: ${state.palette}`,
  ].join(" | ");
}

function buildTrackerMacro(): string {
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
    buildWeatherTagExample(),
  ].join("\n");
}

function buildStaticStateMacro(): string {
  return "The current LumiWeather scene state is injected for the active chat during generation.";
}

function pushMacroValues(): void {
  const formatValue = buildWeatherTagExample();
  const trackerValue = buildTrackerMacro();
  const stateValue = buildStaticStateMacro();

  for (const macroName of WEATHER_FORMAT_MACROS) spindle.updateMacroValue(macroName, formatValue);
  for (const macroName of WEATHER_TRACKER_MACROS) spindle.updateMacroValue(macroName, trackerValue);
  for (const macroName of WEATHER_STATE_MACROS) spindle.updateMacroValue(macroName, stateValue);
}

function buildPromptInstruction(state: WeatherState | null): string {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    `Current scene: ${summarizeWeatherState(state)}`,
  ].join("\n");
}

function extractChatId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const nestedChat = value.chat && typeof value.chat === "object" ? (value.chat as Record<string, unknown>) : null;
  const candidates = [value.chatId, value.chat_id, nestedChat?.id];
  const chatId = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof chatId === "string" ? chatId : null;
}

function send(userId: string, message: BackendToFrontend): void {
  spindle.sendToFrontend(message, userId);
}

async function loadPrefs(userId: string): Promise<WeatherPrefs> {
  try {
    const stored = await spindle.userStorage.getJson<WeatherPrefs>(PREFS_FILE, {
      userId,
      fallback: DEFAULT_PREFS,
    });
    return normalizePrefs(stored);
  } catch {
    return normalizePrefs(DEFAULT_PREFS);
  }
}

async function savePrefs(userId: string, prefs: WeatherPrefs): Promise<void> {
  await spindle.userStorage.setJson(PREFS_FILE, prefs, { userId });
}

async function loadStoryWeatherState(chatId: string): Promise<WeatherState | null> {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_STATE_VAR);
    if (!raw) return null;
    return normalizeWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function saveStoryWeatherState(chatId: string, state: WeatherState): Promise<void> {
  await spindle.variables.local.set(chatId, WEATHER_STATE_VAR, JSON.stringify(state));
}

async function loadManualWeatherState(chatId: string): Promise<WeatherState | null> {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_MANUAL_STATE_VAR);
    if (!raw) return null;
    return normalizeWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function saveManualWeatherState(chatId: string, state: WeatherState): Promise<void> {
  await spindle.variables.local.set(chatId, WEATHER_MANUAL_STATE_VAR, JSON.stringify(state));
}

async function clearManualWeatherState(chatId: string): Promise<void> {
  try {
    await spindle.variables.local.delete(chatId, WEATHER_MANUAL_STATE_VAR);
  } catch {
    // Ignore a missing override.
  }
}

async function loadEffectiveWeatherState(chatId: string): Promise<WeatherState | null> {
  const storyState = await loadStoryWeatherState(chatId);
  const manualState = await loadManualWeatherState(chatId);
  return selectEffectiveWeatherState(storyState, manualState);
}

async function loadWeatherRevision(chatId: string): Promise<number> {
  try {
    const raw = await spindle.variables.local.get(chatId, WEATHER_REVISION_VAR);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { revision?: unknown };
    const revision = Number(parsed?.revision);
    return Number.isFinite(revision) ? Math.max(0, Math.round(revision)) : 0;
  } catch {
    return 0;
  }
}

async function bumpWeatherRevision(chatId: string): Promise<number> {
  const current = await loadWeatherRevision(chatId);
  const revision = Math.max(Date.now(), current + 1);
  await spindle.variables.local.set(chatId, WEATHER_REVISION_VAR, JSON.stringify({ schemaVersion: 1, revision }));
  return revision;
}

async function publishWeatherState(chatId: string | null, state?: WeatherState | null, revision?: number): Promise<void> {
  const resolvedState = chatId ? state === undefined ? await loadEffectiveWeatherState(chatId) : state : null;
  const storedRevision = chatId ? revision ?? await loadWeatherRevision(chatId) : 0;
  const resolvedRevision = storedRevision || resolvedState?.updatedAt || 0;
  spindle.rpcPool.sync(
    "state.current",
    makeWeatherLumiStateSnapshot(chatId, resolvedState, resolvedRevision, EXTENSION_VERSION),
    { requires: [] },
  );
}

async function resolveActiveChatId(userId: string, candidate?: string | null): Promise<string | null> {
  const session = getSession(userId);
  if (typeof candidate === "string" && candidate.trim()) {
    session.activeChatId = candidate;
    return candidate;
  }
  if (candidate === null) {
    session.activeChatId = null;
    return null;
  }
  if (session.activeChatId) return session.activeChatId;

  try {
    const active = await spindle.chats.getActive(userId);
    session.activeChatId = active?.id ?? null;
    return session.activeChatId;
  } catch {
    return null;
  }
}

async function pushActiveChatState(userId: string, explicitChatId?: string | null, requestId?: number): Promise<void> {
  const chatId = await resolveActiveChatId(userId, explicitChatId);
  if (!chatId) {
    await publishWeatherState(null);
    send(userId, { type: "active_chat_state", chatId: null, state: null, requestId });
    return;
  }

  const state = await loadEffectiveWeatherState(chatId);
  await publishWeatherState(chatId, state);

  send(userId, {
    type: "active_chat_state",
    chatId,
    state,
    requestId,
  });
}

spindle.rpcPool.sync("contract.v1", {
  schemaVersion: 1,
  protocol: "lumi_state.v1",
  extension: "lumi_weather",
  extensionVersion: EXTENSION_VERSION,
  capabilities: ["scene_location", "calendar_time", "weather_conditions", "manual_override"],
  endpoints: { public: "lumi_weather.state.current" },
  channels: [{
    endpoint: "lumi_weather.state.current",
    schema: "lumi_state.snapshot.v1",
    visibility: "public",
    requires: [],
    mode: "sync",
  }],
}, { requires: [] });

void publishWeatherState(null);

for (const name of WEATHER_FORMAT_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Example weather-state tag format",
    returnType: "string",
    handler: "",
  });
}

for (const name of WEATHER_TRACKER_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Weather HUD scene tracking instructions",
    returnType: "string",
    handler: "",
  });
}

for (const name of WEATHER_STATE_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Current LumiWeather scene state summary",
    returnType: "string",
    handler: "",
  });
}

pushMacroValues();

spindle.registerInterceptor(async (messages, context) => {
  const chatId = extractChatId(context);
  const state = chatId ? await loadEffectiveWeatherState(chatId) : null;
  const instruction = buildPromptInstruction(state);
  return injectWeatherInstruction(messages, instruction);
}, 90);

spindle.onFrontendMessage(async (raw, userId) => {
  const message = raw as FrontendToBackend;

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
        if (message.isStreaming) break;
        const chatId =
          typeof message.chatId === "string" && message.chatId.trim()
            ? message.chatId
            : await resolveActiveChatId(userId);
        if (!chatId) {
          send(userId, { type: "error", message: "Weather tag ignored because no active chat could be resolved." });
          break;
        }

        pruneProcessedTags();
        const tagKey = `${userId}:${chatId}:${message.messageId ?? ""}:${JSON.stringify(message.attrs)}`;
        if (processedTags.has(tagKey)) break;
        processedTags.set(tagKey, Date.now());

        const previousStory = await loadStoryWeatherState(chatId);
        const nextStory = normalizeWeatherTag(message.attrs, previousStory);
        await saveStoryWeatherState(chatId, nextStory);
        const revision = await bumpWeatherRevision(chatId);
        const effective = (await loadManualWeatherState(chatId)) ?? nextStory;
        await publishWeatherState(chatId, effective, revision);
        send(userId, { type: "weather_state", chatId, state: effective });
        break;
      }

      case "set_manual_state": {
        const chatId = await resolveActiveChatId(userId, message.chatId ?? undefined);
        if (!chatId) {
          send(userId, { type: "error", message: "Manual weather override could not resolve an active chat." });
          break;
        }

        const previous =
          (await loadManualWeatherState(chatId)) ??
          (await loadStoryWeatherState(chatId)) ??
          makeDefaultWeatherState();
        const nextState = normalizeWeatherState(
          { ...previous, ...message.state, updatedAt: Date.now(), source: "manual" },
          previous,
        );
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
          state: storyState,
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
  } catch (error: unknown) {
    const messageText = error instanceof Error ? error.message : String(error);
    spindle.log.error(`Weather HUD error: ${messageText}`);
    send(userId, { type: "error", message: messageText || "Unknown Weather HUD error." });
  }
});
