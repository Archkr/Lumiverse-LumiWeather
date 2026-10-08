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
  /** Newer hosts keep hidden-tag messages covered until interception attaches. */
  frontendCapabilities?: {
    declare(capability: "message_tag_interceptor"): () => void;
  };
  sendToFrontend(payload: unknown, userId?: string): void;
};

declare const spindle: WeatherSpindleAPI;

import type { BackendToFrontend, FrontendToBackend, WeatherPrefs, WeatherState } from "./types";
import {
  DEFAULT_PREFS,
  WEATHER_MANUAL_STATE_VAR,
  WEATHER_STATE_VAR,
  makeDefaultWeatherState,
  normalizePrefs,
  normalizeStoredWeatherState,
  applyManualWeatherState,
  normalizeWeatherTag,
} from "./shared";
import { selectEffectiveWeatherState } from "./state-utils";
import { makeWeatherLumiStateSnapshot } from "./lumi-state";
import { injectWeatherInstruction } from "./prompt-injection";
import { hasSameStoryScene, rebuildStoryWeatherState } from "./story-history";
import { buildTagDedupeKey } from "./tag-dedupe";
import { extractLastWeatherTag } from "./tag-utils";
import { EXTENSION_VERSION, LUMI_STATE_CAPABILITIES } from "./version";
import {
  buildPromptInstruction,
  buildStaticStateMacro,
  buildTrackerMacro,
  buildWeatherTagExample,
} from "./weather-prompt";

const PREFS_FILE = "weather_prefs.json";
const WEATHER_REVISION_VAR = "lumi_weather_state_revision_v1";
const WEATHER_FORMAT_MACROS = ["story_weather_format", "weather_format"] as const;
const WEATHER_TRACKER_MACROS = ["story_weather_tracker", "weather_tracker", "story_weather"] as const;
const WEATHER_STATE_MACROS = ["story_weather_state", "weather_state"] as const;
const TAG_DEDUPE_TTL_MS = 10 * 60 * 1000;
const HISTORY_RECONCILE_DELAY_MS = 150;

type BackendSession = {
  activeChatId: string | null;
  activeChatRequest: number;
};

const sessions = new Map<string, BackendSession>();
const processedTags = new Map<string, { attrs: string; timestamp: number; chatId: string }>();
const historyReconcileTimers = new Map<string, ReturnType<typeof setTimeout>>();
const operationQueues = new Map<string, Promise<unknown>>();

/** Keep read/modify/write operations from overwriting another pending edit. */
async function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = operationQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  operationQueues.set(key, next);
  try {
    return await next;
  } finally {
    if (operationQueues.get(key) === next) operationQueues.delete(key);
  }
}

function getSession(userId: string): BackendSession {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const next = { activeChatId: null, activeChatRequest: 0 };
  sessions.set(userId, next);
  return next;
}

function pruneProcessedTags(now = Date.now()): void {
  for (const [key, tag] of processedTags) {
    if (now - tag.timestamp > TAG_DEDUPE_TTL_MS) processedTags.delete(key);
  }
}

function clearProcessedChatTags(chatId: string): void {
  for (const [key, tag] of processedTags) {
    if (tag.chatId === chatId) processedTags.delete(key);
  }
}

function rememberHistoryTags(
  userId: string,
  chatId: string,
  messages: Parameters<typeof rebuildStoryWeatherState>[0],
): void {
  pruneProcessedTags();
  for (const message of messages) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant" || !message.id || typeof message.content !== "string") continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag) continue;
    processedTags.set(JSON.stringify([userId, chatId, message.id]), {
      attrs: buildTagDedupeKey(tag.attrs), timestamp: Date.now(), chatId,
    });
  }
}

function pushMacroValues(): void {
  const formatValue = buildWeatherTagExample();
  const trackerValue = buildTrackerMacro();
  const stateValue = buildStaticStateMacro();

  for (const macroName of WEATHER_FORMAT_MACROS) spindle.updateMacroValue(macroName, formatValue);
  for (const macroName of WEATHER_TRACKER_MACROS) spindle.updateMacroValue(macroName, trackerValue);
  for (const macroName of WEATHER_STATE_MACROS) spindle.updateMacroValue(macroName, stateValue);
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
  const raw = await spindle.variables.local.get(chatId, WEATHER_STATE_VAR);
  if (!raw) return null;
  try {
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function saveStoryWeatherState(chatId: string, state: WeatherState): Promise<void> {
  await spindle.variables.local.set(chatId, WEATHER_STATE_VAR, JSON.stringify(state));
}

async function clearStoryWeatherState(chatId: string): Promise<void> {
  await spindle.variables.local.delete(chatId, WEATHER_STATE_VAR);
}

async function loadManualWeatherState(chatId: string): Promise<WeatherState | null> {
  const raw = await spindle.variables.local.get(chatId, WEATHER_MANUAL_STATE_VAR);
  if (!raw) return null;
  try {
    return normalizeStoredWeatherState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function saveManualWeatherState(chatId: string, state: WeatherState): Promise<void> {
  await spindle.variables.local.set(chatId, WEATHER_MANUAL_STATE_VAR, JSON.stringify(state));
}

async function clearManualWeatherState(chatId: string): Promise<void> {
  await spindle.variables.local.delete(chatId, WEATHER_MANUAL_STATE_VAR);
}

async function loadEffectiveWeatherState(chatId: string): Promise<WeatherState | null> {
  const storyState = await loadStoryWeatherState(chatId);
  const manualState = await loadManualWeatherState(chatId);
  return selectEffectiveWeatherState(storyState, manualState);
}

async function loadWeatherRevision(chatId: string): Promise<number> {
  const raw = await spindle.variables.local.get(chatId, WEATHER_REVISION_VAR);
  if (!raw) return 0;
  try {
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

async function publishWeatherState(
  chatId: string | null,
  state?: WeatherState | null,
  revision?: number,
  userId?: string,
  activeChatRequest?: number,
): Promise<void> {
  const resolvedState = chatId ? state === undefined ? await loadEffectiveWeatherState(chatId) : state : null;
  const storedRevision = chatId ? revision ?? await loadWeatherRevision(chatId) : 0;
  const resolvedRevision = storedRevision || resolvedState?.updatedAt || 0;
  if (userId !== undefined) {
    const session = getSession(userId);
    if (session.activeChatId !== chatId) return;
    if (activeChatRequest !== undefined && session.activeChatRequest !== activeChatRequest) return;
  }
  spindle.rpcPool.sync(
    "state.current",
    makeWeatherLumiStateSnapshot(chatId, resolvedState, resolvedRevision, EXTENSION_VERSION),
    { requires: [] },
  );
}

async function reconcileStoryWeatherState(
  userId: string,
  chatId: string,
  notifyFrontend = true,
  history?: Parameters<typeof rebuildStoryWeatherState>[0],
): Promise<WeatherState | null> {
  const previousStory = await loadStoryWeatherState(chatId);
  const messages = history ?? await spindle.chat.getMessages(chatId);
  // Missing timestamps have no new observation time; avoid revision churn on replay.
  const rebuiltStory = rebuildStoryWeatherState(messages, previousStory?.updatedAt);
  const unchanged = hasSameStoryScene(previousStory, rebuiltStory)
    && previousStory?.updatedAt === rebuiltStory?.updatedAt;
  const nextStory = unchanged ? previousStory : rebuiltStory;
  const changed = nextStory !== previousStory;

  if (changed) {
    if (nextStory) await saveStoryWeatherState(chatId, nextStory);
    else await clearStoryWeatherState(chatId);
    clearProcessedChatTags(chatId);
  }

  const effective = (await loadManualWeatherState(chatId)) ?? nextStory;
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

function scheduleStoryWeatherReconcile(userId: string, chatId: string): void {
  const key = `${userId}:${chatId}`;
  const existing = historyReconcileTimers.get(key);
  if (existing) clearTimeout(existing);
  historyReconcileTimers.set(key, setTimeout(() => {
    historyReconcileTimers.delete(key);
    void runSerialized(`chat:${chatId}`, () => reconcileStoryWeatherState(userId, chatId)).catch((error: unknown) => {
      spindle.log.warn(`LumiWeather history reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, HISTORY_RECONCILE_DELAY_MS));
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
    const activeChatRequest = session.activeChatRequest;
    const active = await spindle.chats.getActive(userId);
    if (session.activeChatRequest !== activeChatRequest) return session.activeChatId;
    session.activeChatId = active?.id ?? null;
    return session.activeChatId;
  } catch {
    return null;
  }
}

/** A scene edit may finish after a switch; its target must not change selection. */
async function resolveWeatherEditChatId(userId: string, candidate?: string | null): Promise<string | null> {
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  if (candidate === null) return null;
  return resolveActiveChatId(userId);
}

async function pushActiveChatState(userId: string, explicitChatId?: string | null, requestId?: number): Promise<void> {
  const session = getSession(userId);
  const activeChatRequest = ++session.activeChatRequest;
  const chatId = await resolveActiveChatId(userId, explicitChatId);
  if (session.activeChatRequest !== activeChatRequest) return;
  if (!chatId) {
    await publishWeatherState(null, null, 0, userId, activeChatRequest);
    send(userId, { type: "active_chat_state", chatId: null, state: null, requestId });
    return;
  }

  await runSerialized(`chat:${chatId}`, async () => {
    let state: WeatherState | null;
    try {
      state = await reconcileStoryWeatherState(userId, chatId, false);
    } catch (error: unknown) {
      spindle.log.warn(`LumiWeather could not verify chat history: ${error instanceof Error ? error.message : String(error)}`);
      state = await loadEffectiveWeatherState(chatId);
    }
    await publishWeatherState(chatId, state, undefined, userId, activeChatRequest);
    if (session.activeChatRequest !== activeChatRequest || session.activeChatId !== chatId) return;
    send(userId, {
      type: "active_chat_state",
      chatId,
      state,
      requestId,
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

const onEvent = spindle.on as unknown as (
  event: string,
  handler: (payload: unknown, userId?: string) => void,
) => () => void;

for (const event of ["MESSAGE_EDITED", "MESSAGE_DELETED", "MESSAGE_SWIPED", "SWIPE_EDITED"] as const) {
  onEvent(event, (payload, eventUserId) => {
    const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const chatId = extractChatId(payload) ?? extractChatId(value.message);
    if (!chatId) return;

    const userIds = eventUserId
      ? [eventUserId]
      : [...sessions.entries()]
          .filter(([, session]) => session.activeChatId === chatId)
          .map(([userId]) => userId);
    for (const userId of userIds) {
      if (getSession(userId).activeChatId === chatId) scheduleStoryWeatherReconcile(userId, chatId);
    }
  });
}

spindle.onFrontendMessage(async (raw, userId) => {
  const message = raw as FrontendToBackend;

  try {
    switch (message.type) {
      case "frontend_ready":
        await pushActiveChatState(userId);
        await runSerialized(`prefs:${userId}`, async () => {
          send(userId, { type: "prefs", prefs: await loadPrefs(userId) });
        });
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
          spindle.toast.warning("A weather tag was ignored because no active chat could be resolved.", {
            title: "LumiWeather",
            userId,
          });
          break;
        }

        await runSerialized(`chat:${chatId}`, async () => {
          pruneProcessedTags();
          const messageId = typeof message.messageId === "string" && message.messageId.trim()
            ? message.messageId : null;
          const tagKey = messageId ? JSON.stringify([userId, chatId, messageId]) : null;
          const attrs = buildTagDedupeKey(message.attrs);
          if (tagKey && processedTags.get(tagKey)?.attrs === attrs) return;

          // Interceptors also fire when historical bubbles render. A known
          // stored message must rebuild from history, rather than make an old
          // tag the latest scene merely because the user scrolled to it.
          let history: Awaited<ReturnType<typeof spindle.chat.getMessages>> | null = null;
          if (messageId) {
            try {
              const messages = await spindle.chat.getMessages(chatId);
              if (messages.some((entry) => entry.id === messageId)) history = messages;
            } catch (error: unknown) {
              spindle.log.warn(`LumiWeather could not verify intercepted message history: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          if (history) {
            const effective = await reconcileStoryWeatherState(userId, chatId, false, history);
            await publishWeatherState(chatId, effective, undefined, userId);
            send(userId, effective
              ? { type: "weather_state", chatId, state: effective }
              : { type: "active_chat_state", chatId, state: null });
            return;
          }

          const previousStory = await loadStoryWeatherState(chatId);
          const nextStory = normalizeWeatherTag(message.attrs, previousStory);
          await saveStoryWeatherState(chatId, nextStory);
          const revision = await bumpWeatherRevision(chatId);
          const effective = (await loadManualWeatherState(chatId)) ?? nextStory;
          await publishWeatherState(chatId, effective, revision, userId);
          // Remember only the current variant after a successful save, so an
          // edit/swipe back to an earlier tag and retries after failure work.
          if (tagKey) processedTags.set(tagKey, { attrs, timestamp: Date.now(), chatId });
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
            userId,
          });
          break;
        }

        await runSerialized(`chat:${chatId}`, async () => {
          const previous =
            (await loadManualWeatherState(chatId)) ??
            (await loadStoryWeatherState(chatId)) ??
            makeDefaultWeatherState();
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
            state: storyState,
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
  } catch (error: unknown) {
    const messageText = error instanceof Error ? error.message : String(error);
    spindle.log.error(`Weather HUD error: ${messageText}`);
    send(userId, { type: "error", message: messageText || "Unknown Weather HUD error." });
  }
});
