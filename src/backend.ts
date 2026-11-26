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

import type {
  BackendToFrontend,
  ConnectionProfileSummary,
  FrontendToBackend,
  SoundscapeSampleKey,
  WeatherPrefs,
  WeatherState,
} from "./types";
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
import { injectWeatherInstruction, injectWeatherSceneState } from "./prompt-injection";
import {
  buildSidecarExtractionMessages,
  parseSidecarExtractionResponse,
  type SidecarTurn,
} from "./sidecar-extractor";
import {
  buildMessageWeatherMetadata,
  hasSameStoryScene,
  planWeatherTagMigration,
  rebuildStoryWeatherState,
  resolveMessageTimestamp,
} from "./story-history";
import { buildTagDedupeKey } from "./tag-dedupe";
import { extractLastWeatherTag } from "./tag-utils";
import { EXTENSION_VERSION, LUMI_STATE_CAPABILITIES } from "./version";
import { buildWeatherVisualTags } from "./visual-tags";
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
const WEATHER_VISUAL_TAGS_MACROS = ["story_weather_visual_tags", "weather_visual_tags"] as const;
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
const activeExtractions = new Map<string, AbortController>();
const suppressedMetadataEdits = new Map<string, number>();

const METADATA_EDIT_SUPPRESS_MS = 2500;
const SIDECAR_TIMEOUT_MS = 25000;

const AUDIO_SAMPLE_PATHS: Record<SoundscapeSampleKey, string> = {
  coastal_surf: "audio/coastal_surf.mp3",
  brook: "audio/brook.mp3",
  hearth: "audio/hearth.mp3",
  gulls: "audio/gulls.mp3",
  foghorn: "audio/foghorn.mp3",
};

async function loadAudioSampleBase64(key: SoundscapeSampleKey): Promise<string | null> {
  const storagePath = AUDIO_SAMPLE_PATHS[key];
  if (!storagePath || typeof spindle.storage?.readBinary !== "function") return null;
  try {
    const bytes = await spindle.storage.readBinary(storagePath);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) return null;
    return Buffer.from(bytes).toString("base64");
  } catch {
    return null;
  }
}

function extractUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const candidates = [value.userId, value.user_id];
  const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof found === "string" ? found : null;
}

function resolveUsersForChat(chatId: string, explicitUserId?: string): string[] {
  if (explicitUserId) return [explicitUserId];
  const matched = [...sessions.entries()]
    .filter(([, session]) => session.activeChatId === chatId)
    .map(([userId]) => userId);
  if (matched.length > 0) return matched;
  return sessions.size === 1 ? [...sessions.keys()] : [];
}

function cancelActiveExtraction(chatId: string): void {
  const controller = activeExtractions.get(chatId);
  if (!controller) return;
  activeExtractions.delete(chatId);
  try {
    controller.abort();
  } catch {
    // Ignore abort errors on already-settled controllers
  }
}

function isSuppressedMetadataEdit(chatId: string, messageId?: string | null): boolean {
  if (!messageId) return false;
  const key = `${chatId}:${messageId}`;
  const expiresAt = suppressedMetadataEdits.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    suppressedMetadataEdits.delete(key);
    return false;
  }
  suppressedMetadataEdits.delete(key);
  return true;
}

async function listConnectionProfiles(userId?: string): Promise<ConnectionProfileSummary[]> {
  if (typeof spindle.connections?.list !== "function") return [];
  try {
    const rawProfiles = await spindle.connections.list(userId);
    if (!Array.isArray(rawProfiles)) return [];
    return rawProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name || profile.model || profile.id,
      provider: profile.provider || "",
      model: profile.model || "",
      isDefault: Boolean(profile.is_default),
    }));
  } catch (error: unknown) {
    spindle.log.warn(`LumiWeather could not list connection profiles: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function pushConnections(userId: string): Promise<void> {
  const profiles = await listConnectionProfiles(userId);
  send(userId, { type: "connections", profiles });
}

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
  for (const macroName of WEATHER_VISUAL_TAGS_MACROS) spindle.updateMacroValue(macroName, "");
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
  const visualTags = buildWeatherVisualTags(resolvedState);
  for (const macroName of WEATHER_VISUAL_TAGS_MACROS) {
    spindle.updateMacroValue(macroName, visualTags);
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

for (const name of WEATHER_VISUAL_TAGS_MACROS) {
  spindle.registerMacro({
    name,
    category: "extension:lumiweather",
    description: "Comma-separated visual art descriptors for the active weather scene",
    returnType: "string",
    handler: "",
  });
}

pushMacroValues();

function notifyExtractionStatus(
  chatId: string,
  status: "idle" | "running" | "error",
  userIds: string[],
  detail?: string,
): void {
  for (const uid of userIds) {
    if (getSession(uid).activeChatId === chatId) {
      send(uid, { type: "extraction_status", chatId, status, detail });
    }
  }
}

async function extractWeatherForChat(options: {
  chatId: string;
  userId?: string;
  targetMessageId?: string;
  fallbackContent?: string;
  generationType?: string;
  force?: boolean;
}): Promise<WeatherState | null> {
  const { chatId, targetMessageId, fallbackContent, generationType, force = false } = options;
  if (typeof spindle.generate?.quiet !== "function") return null;

  const userIds = resolveUsersForChat(chatId, options.userId);
  const primaryUserId = options.userId ?? userIds[0];
  const prefs = await loadPrefs(primaryUserId ?? "");
  if (!force && (prefs.trackingMode ?? "sidecar") !== "sidecar") return null;

  // Cancel any stale extraction for this chat before starting a fresh one.
  cancelActiveExtraction(chatId);
  const controller = new AbortController();
  activeExtractions.set(chatId, controller);
  const timeout = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors
    }
  }, SIDECAR_TIMEOUT_MS);

  try {
    const rawMessages = await spindle.chat.getMessages(chatId);
    if (controller.signal.aborted || activeExtractions.get(chatId) !== controller) return null;

    const ordered = rawMessages
      .map((entry, originalIndex) => ({ entry, originalIndex }))
      .sort((left, right) => {
        const leftIndex = Number.isFinite(left.entry.index_in_chat) ? left.entry.index_in_chat : left.originalIndex;
        const rightIndex = Number.isFinite(right.entry.index_in_chat) ? right.entry.index_in_chat : right.originalIndex;
        return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
      })
      .map(({ entry }) => entry);

    let targetIndex = -1;
    if (targetMessageId) {
      targetIndex = ordered.findIndex((entry) => entry.id === targetMessageId);
    }
    if (targetIndex < 0) {
      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const entry = ordered[i]!;
        const role = entry.role ?? (entry.is_user ? "user" : "assistant");
        if (role === "assistant") {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex < 0) return null;

    const targetMessage = ordered[targetIndex]!;
    const targetContent =
      typeof targetMessage.content === "string" && targetMessage.content.trim()
        ? targetMessage.content
        : fallbackContent ?? "";

    // If the assistant message already carried an explicit legacy weather tag and
    // this wasn't a manual re-analyze request, avoid redundant extraction.
    if (!force && targetContent && extractLastWeatherTag(targetContent)) {
      return null;
    }

    const messagesBeforeTarget = ordered.slice(0, targetIndex);
    const priorFromHistory = rebuildStoryWeatherState(messagesBeforeTarget);
    const isRewrite = generationType === "swipe" || generationType === "regenerate";
    const previousState = priorFromHistory ?? (!isRewrite ? await loadStoryWeatherState(chatId) : null);

    // Collect up to 3 recent non-system turns ending at the target assistant message.
    const recentTurns: SidecarTurn[] = [];
    for (let i = Math.max(0, targetIndex - 2); i <= targetIndex; i += 1) {
      const entry = ordered[i]!;
      const role = entry.role ?? (entry.is_user ? "user" : "assistant");
      if (role !== "user" && role !== "assistant") continue;
      const content = i === targetIndex ? targetContent : (typeof entry.content === "string" ? entry.content : "");
      if (!content.trim()) continue;
      recentTurns.push({ role, name: entry.name, content });
    }
    if (recentTurns.length === 0) return null;

    notifyExtractionStatus(chatId, "running", userIds);

    const parameters: Record<string, unknown> = { temperature: 0.1, max_tokens: 450 };
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
      signal: controller.signal,
    });

    if (controller.signal.aborted || activeExtractions.get(chatId) !== controller) return null;

    const messageTimestamp = resolveMessageTimestamp(targetMessage) ?? Date.now();
    const extracted = parseSidecarExtractionResponse(rawResult, previousState, messageTimestamp);
    if (!extracted) {
      spindle.log.warn("LumiWeather sidecar returned an unparseable response; keeping previous scene state.");
      notifyExtractionStatus(chatId, "error", userIds, "Could not parse sidecar response");
      return null;
    }

    let finalEffective: WeatherState | null = null;
    await runSerialized(`chat:${chatId}`, async () => {
      if (controller.signal.aborted || activeExtractions.get(chatId) !== controller) return;

      // Persist per-message metadata so edit/delete/swipe/fork rewind cleanly without tags in prose.
      if (targetMessage.id && typeof spindle.chat?.updateMessage === "function") {
        try {
          const nextMetadata = buildMessageWeatherMetadata(targetMessage.metadata, targetMessage.swipe_id, extracted);
          suppressedMetadataEdits.set(`${chatId}:${targetMessage.id}`, Date.now() + METADATA_EDIT_SUPPRESS_MS);
          await spindle.chat.updateMessage(chatId, targetMessage.id, {
            metadata: nextMetadata,
            skipChunkRebuild: true,
          });
        } catch (error: unknown) {
          suppressedMetadataEdits.delete(`${chatId}:${targetMessage.id}`);
          spindle.log.warn(`LumiWeather could not save per-message metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const previousStored = await loadStoryWeatherState(chatId);
      const changed =
        !hasSameStoryScene(previousStored, extracted) || previousStored?.updatedAt !== extracted.updatedAt;
      if (changed) {
        await saveStoryWeatherState(chatId, extracted);
      }
      const revision = changed ? await bumpWeatherRevision(chatId) : await loadWeatherRevision(chatId);
      const effective = (await loadManualWeatherState(chatId)) ?? extracted;
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
  } catch (error: unknown) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
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

async function migrateChatTags(userId: string, chatId: string): Promise<void> {
  if (typeof spindle.chat?.updateMessage !== "function") {
    send(userId, {
      type: "migration_result",
      chatId,
      status: "error",
      detail: "Enable the Chat Mutation permission to migrate legacy weather tags.",
    });
    return;
  }

  cancelActiveExtraction(chatId);
  send(userId, { type: "migration_result", chatId, status: "running" });

  try {
    await runSerialized(`chat:${chatId}`, async () => {
      const messages = await spindle.chat.getMessages(chatId);
      const plan = planWeatherTagMigration(messages);

      if (plan.patches.length === 0) {
        send(userId, {
          type: "migration_result",
          chatId,
          status: "done",
          migratedMessages: 0,
          tagsRemoved: 0,
        });
        return;
      }

      for (const patch of plan.patches) {
        const suppressKey = `${chatId}:${patch.messageId}`;
        suppressedMetadataEdits.set(suppressKey, Date.now() + METADATA_EDIT_SUPPRESS_MS);
        try {
          await spindle.chat.updateMessage(chatId, patch.messageId, {
            content: patch.content,
            ...(patch.swipes ? { swipes: patch.swipes } : {}),
            metadata: patch.metadata,
            skipChunkRebuild: true,
          });
        } catch (error) {
          suppressedMetadataEdits.delete(suppressKey);
          throw error;
        }
      }

      clearProcessedChatTags(chatId);
      const previousStored = await loadStoryWeatherState(chatId);
      if (plan.finalState) {
        const changed =
          !hasSameStoryScene(previousStored, plan.finalState) ||
          previousStored?.updatedAt !== plan.finalState.updatedAt;
        if (changed) {
          await saveStoryWeatherState(chatId, plan.finalState);
        }
        const revision = changed ? await bumpWeatherRevision(chatId) : await loadWeatherRevision(chatId);
        const effective = (await loadManualWeatherState(chatId)) ?? plan.finalState;
        await publishWeatherState(chatId, effective, revision, userId);
        if (getSession(userId).activeChatId === chatId) {
          send(userId, { type: "weather_state", chatId, state: effective });
        }
      }

      send(userId, {
        type: "migration_result",
        chatId,
        status: "done",
        migratedMessages: plan.migratedMessages,
        tagsRemoved: plan.tagsRemoved,
      });
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWeather tag migration failed: ${detail}`);
    send(userId, { type: "migration_result", chatId, status: "error", detail });
  }
}

// Run after LumiBooks (90) so fallback detection sees the final surviving history.
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

const onEvent = spindle.on as unknown as (
  event: string,
  handler: (payload: unknown, userId?: string) => void,
) => () => void;

onEvent("GENERATION_ENDED", (payload, eventUserId) => {
  if (!payload || typeof payload !== "object") return;
  const event = payload as {
    chatId?: string;
    messageId?: string;
    content?: string;
    error?: string;
    generationType?: string;
  };
  if (event.error || event.generationType === "impersonate") return;
  const chatId = typeof event.chatId === "string" && event.chatId.trim() ? event.chatId : null;
  if (!chatId) return;

  void extractWeatherForChat({
    chatId,
    userId: eventUserId,
    targetMessageId: event.messageId,
    fallbackContent: event.content,
    generationType: event.generationType,
  });
});

for (const event of ["MESSAGE_EDITED", "MESSAGE_DELETED", "MESSAGE_SWIPED", "SWIPE_EDITED"] as const) {
  onEvent(event, (payload, eventUserId) => {
    const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const chatId = extractChatId(payload) ?? extractChatId(value.message);
    if (!chatId) return;

    const msgObj = value.message && typeof value.message === "object" ? (value.message as Record<string, unknown>) : null;
    const messageId =
      typeof value.messageId === "string"
        ? value.messageId
        : typeof value.message_id === "string"
          ? value.message_id
          : typeof msgObj?.id === "string"
            ? msgObj.id
            : null;
    if ((event === "MESSAGE_EDITED" || event === "SWIPE_EDITED") && isSuppressedMetadataEdit(chatId, messageId)) {
      return;
    }

    const userIds = resolveUsersForChat(chatId, eventUserId);
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

      case "migrate_chat_tags": {
        const chatId = await resolveWeatherEditChatId(userId, message.chatId);
        if (!chatId) {
          send(userId, { type: "error", message: "Open a chat before migrating legacy weather tags." });
          break;
        }
        await migrateChatTags(userId, chatId);
        break;
      }

      case "load_audio_sample": {
        const base64 = await loadAudioSampleBase64(message.key);
        send(userId, { type: "audio_sample", key: message.key, base64 });
        break;
      }

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
