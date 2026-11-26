import type { ChatMessageDTO } from "lumiverse-spindle-types";

import { normalizeStoredWeatherState, normalizeWeatherTag } from "./shared";
import { buildWeatherTagRegex, extractLastWeatherTag, stripWeatherStateTags } from "./tag-utils";
import type { ForecastEntry, WeatherState } from "./types";

export const MESSAGE_WEATHER_METADATA_KEY = "lumi_weather";

export interface MessageWeatherMetadata {
  schemaVersion: 1;
  bySwipe?: Record<string, WeatherState>;
  state?: WeatherState;
}

export type StoryHistoryMessage = Pick<ChatMessageDTO, "content" | "index_in_chat" | "is_user"> & {
  id?: string;
  role?: "system" | "user" | "assistant";
  name?: string;
  send_date?: number;
  swipe_id?: number;
  swipes?: string[];
  swipe_dates?: number[];
  metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

export interface WeatherTagMigrationPatch {
  messageId: string;
  content: string;
  swipes?: string[];
  metadata: Record<string, unknown>;
  tagsRemoved: number;
}

export interface WeatherTagMigrationPlan {
  patches: WeatherTagMigrationPatch[];
  migratedMessages: number;
  tagsRemoved: number;
  finalState: WeatherState | null;
}

/** Timestamps below this are treated as unix seconds rather than milliseconds. */
const MILLISECOND_THRESHOLD = 1e12;

/**
 * Normalizes a chat timestamp to milliseconds. `ChatMessageDTO.send_date` and
 * `swipe_dates` are unix **seconds**, but a host or fixture may already pass
 * milliseconds, so both shapes are accepted and implausible values are rejected.
 */
export function normalizeMessageTimestamp(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const milliseconds = numeric >= MILLISECOND_THRESHOLD ? numeric : numeric * 1000;
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * The instant a message's active swipe was written, preferring the active swipe's
 * own timestamp so a swiped tag does not inherit the original message's time.
 */
export function resolveMessageTimestamp(message: StoryHistoryMessage): number | null {
  const swipeId = typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id) ? message.swipe_id : null;
  if (swipeId !== null && Array.isArray(message.swipe_dates)) {
    const swipeTimestamp = normalizeMessageTimestamp(message.swipe_dates[swipeId]);
    if (swipeTimestamp !== null) return swipeTimestamp;
  }
  return normalizeMessageTimestamp(message.send_date);
}

function readRawWeatherMetadata(message: StoryHistoryMessage): Record<string, unknown> | null {
  const fromMetadata = message.metadata?.[MESSAGE_WEATHER_METADATA_KEY];
  if (fromMetadata && typeof fromMetadata === "object" && !Array.isArray(fromMetadata)) {
    return fromMetadata as Record<string, unknown>;
  }
  const spindleMeta = message.extra?.spindle_metadata;
  if (spindleMeta && typeof spindleMeta === "object" && !Array.isArray(spindleMeta)) {
    const nested = (spindleMeta as Record<string, unknown>)[MESSAGE_WEATHER_METADATA_KEY];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Extracts the stored weather snapshot for a message's active swipe, if present.
 * Returns `null` if the message has no snapshot for the active swipe slot so
 * callers can fall back to legacy tags or prior turns.
 */
export function extractMessageWeatherMetadata(message: StoryHistoryMessage): WeatherState | null {
  const entry = readRawWeatherMetadata(message);
  if (!entry) return null;

  const swipeIndex = typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id)
    ? Math.max(0, Math.floor(message.swipe_id))
    : 0;

  let candidate: unknown = null;
  if (entry.bySwipe && typeof entry.bySwipe === "object" && !Array.isArray(entry.bySwipe)) {
    const map = entry.bySwipe as Record<string, unknown>;
    candidate = map[String(swipeIndex)] ?? null;
  } else if (entry.state && typeof entry.state === "object" && swipeIndex === 0) {
    candidate = entry.state;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const normalized = normalizeStoredWeatherState(candidate);
  return { ...normalized, source: "story" };
}

/**
 * Merges a weather snapshot into a message's `spindle_metadata` bag without
 * clobbering other extensions' metadata keys or other swipe slots.
 */
export function buildMessageWeatherMetadata(
  existingMetadata: Record<string, unknown> | undefined,
  swipeId: number | undefined,
  state: WeatherState,
): Record<string, unknown> {
  const base = existingMetadata && typeof existingMetadata === "object" ? { ...existingMetadata } : {};
  const existingEntry = base[MESSAGE_WEATHER_METADATA_KEY];
  const prevBySwipe =
    existingEntry &&
    typeof existingEntry === "object" &&
    !Array.isArray(existingEntry) &&
    (existingEntry as Record<string, unknown>).bySwipe &&
    typeof (existingEntry as Record<string, unknown>).bySwipe === "object" &&
    !Array.isArray((existingEntry as Record<string, unknown>).bySwipe)
      ? { ...((existingEntry as Record<string, unknown>).bySwipe as Record<string, WeatherState>) }
      : {};

  const swipeIndex = typeof swipeId === "number" && Number.isFinite(swipeId) ? Math.max(0, Math.floor(swipeId)) : 0;
  const cleanSnapshot: WeatherState = { ...state, source: "story" };
  prevBySwipe[String(swipeIndex)] = cleanSnapshot;

  const nextEntry: MessageWeatherMetadata = {
    schemaVersion: 1,
    bySwipe: prevBySwipe,
    ...(swipeIndex === 0 ? { state: cleanSnapshot } : {}),
  };

  return {
    ...base,
    [MESSAGE_WEATHER_METADATA_KEY]: nextEntry,
  };
}

/**
 * Rebuilds story state from chat history.
 *
 * Prefers per-message `metadata.lumi_weather` snapshots (populated by the
 * post-turn sidecar extractor) and falls back to legacy `<weather-state>` tags
 * in assistant prose. Each entry is stamped with its message/swipe timestamp so
 * editing, deleting, or swiping never churns observation times.
 */
export function rebuildStoryWeatherState(
  messages: StoryHistoryMessage[],
  fallbackUpdatedAt = Date.now(),
): WeatherState | null {
  const ordered = messages
    .map((message, originalIndex) => ({ message, originalIndex }))
    .sort((left, right) => {
      const leftIndex = Number.isFinite(left.message.index_in_chat) ? left.message.index_in_chat : left.originalIndex;
      const rightIndex = Number.isFinite(right.message.index_in_chat) ? right.message.index_in_chat : right.originalIndex;
      return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
    });

  let state: WeatherState | null = null;
  for (const { message } of ordered) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant") continue;

    const fromMetadata = extractMessageWeatherMetadata(message);
    if (fromMetadata) {
      const updatedAt = resolveMessageTimestamp(message) ?? (fromMetadata.updatedAt > 0 ? fromMetadata.updatedAt : fallbackUpdatedAt);
      state = { ...fromMetadata, updatedAt, source: "story" };
      continue;
    }

    if (typeof message.content !== "string") continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag) continue;

    const updatedAt = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
    state = { ...normalizeWeatherTag(tag.attrs, state), updatedAt };
  }
  return state;
}

function countWeatherTags(text: string): number {
  let count = 0;
  for (const _match of text.matchAll(buildWeatherTagRegex())) count += 1;
  return count;
}

function readExistingMetadataForSwipe(message: StoryHistoryMessage, swipeIndex: number): WeatherState | null {
  return extractMessageWeatherMetadata({ ...message, swipe_id: swipeIndex });
}

/**
 * Plans a lossless migration from inline `<weather-state>` XML tags in assistant
 * message prose into per-message swipe-aware `metadata.lumi_weather` snapshots.
 *
 * Preserves alternate swipes, original timestamps, and sibling extension metadata
 * keys, and is safe to run repeatedly (idempotent once tags are stripped).
 */
export function planWeatherTagMigration(
  messages: StoryHistoryMessage[],
  fallbackUpdatedAt = Date.now(),
): WeatherTagMigrationPlan {
  const ordered = messages
    .map((message, originalIndex) => ({ message, originalIndex }))
    .sort((left, right) => {
      const leftIndex = Number.isFinite(left.message.index_in_chat) ? left.message.index_in_chat : left.originalIndex;
      const rightIndex = Number.isFinite(right.message.index_in_chat) ? right.message.index_in_chat : right.originalIndex;
      return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
    });

  const patches: WeatherTagMigrationPatch[] = [];
  let runningState: WeatherState | null = null;
  let totalTagsRemoved = 0;

  for (const { message } of ordered) {
    const role = message.role ?? (message.is_user ? "user" : "assistant");
    if (role !== "assistant") continue;

    const activeSwipeId =
      typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id)
        ? Math.max(0, Math.floor(message.swipe_id))
        : 0;
    const hasSwipes = Array.isArray(message.swipes) && message.swipes.length > 0;

    let nextMetadata: Record<string, unknown> =
      message.metadata && typeof message.metadata === "object" ? { ...message.metadata } : {};
    let changed = false;
    let messageTagsRemoved = 0;
    let nextActiveState: WeatherState | null = null;

    if (hasSwipes) {
      const nextSwipes = [...message.swipes!];
      for (let i = 0; i < nextSwipes.length; i += 1) {
        const swipeText = typeof nextSwipes[i] === "string" ? nextSwipes[i]! : "";
        const existingSwipeMeta = readExistingMetadataForSwipe(message, i);
        const tag = extractLastWeatherTag(swipeText);
        if (tag) {
          const swipeTimestamp =
            normalizeMessageTimestamp(message.swipe_dates?.[i]) ??
            normalizeMessageTimestamp(message.send_date) ??
            fallbackUpdatedAt;
          const migratedState: WeatherState = existingSwipeMeta
            ? { ...existingSwipeMeta, source: "story" }
            : { ...normalizeWeatherTag(tag.attrs, runningState), updatedAt: swipeTimestamp };
          nextMetadata = buildMessageWeatherMetadata(nextMetadata, i, migratedState);
          nextSwipes[i] = stripWeatherStateTags(swipeText);
          changed = true;
          messageTagsRemoved += countWeatherTags(swipeText);
          if (i === activeSwipeId) nextActiveState = migratedState;
        } else if (i === activeSwipeId && existingSwipeMeta) {
          const ts =
            normalizeMessageTimestamp(message.swipe_dates?.[i]) ??
            normalizeMessageTimestamp(message.send_date) ??
            (existingSwipeMeta.updatedAt > 0 ? existingSwipeMeta.updatedAt : fallbackUpdatedAt);
          nextActiveState = { ...existingSwipeMeta, updatedAt: ts, source: "story" };
        }
      }

      // Also strip `message.content` if it carried a tag not reflected in `swipes`.
      const rawContent = typeof message.content === "string" ? message.content : "";
      const activeSwipeContent = typeof nextSwipes[activeSwipeId] === "string" ? nextSwipes[activeSwipeId]! : rawContent;
      let nextContent = activeSwipeContent;
      if (!changed && extractLastWeatherTag(rawContent)) {
        const tag = extractLastWeatherTag(rawContent)!;
        const ts = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
        const existingActiveMeta = readExistingMetadataForSwipe(message, activeSwipeId);
        const migratedState: WeatherState = existingActiveMeta
          ? { ...existingActiveMeta, source: "story" }
          : { ...normalizeWeatherTag(tag.attrs, runningState), updatedAt: ts };
        nextMetadata = buildMessageWeatherMetadata(nextMetadata, activeSwipeId, migratedState);
        nextContent = stripWeatherStateTags(rawContent);
        if (activeSwipeId < nextSwipes.length) nextSwipes[activeSwipeId] = nextContent;
        changed = true;
        messageTagsRemoved += countWeatherTags(rawContent);
        nextActiveState = migratedState;
      }

      if (changed && message.id) {
        patches.push({
          messageId: message.id,
          content: nextContent,
          swipes: nextSwipes,
          metadata: nextMetadata,
          tagsRemoved: messageTagsRemoved,
        });
        totalTagsRemoved += messageTagsRemoved;
      }
    } else {
      const rawContent = typeof message.content === "string" ? message.content : "";
      const existingActiveMeta = readExistingMetadataForSwipe(message, activeSwipeId);
      const tag = extractLastWeatherTag(rawContent);
      if (tag) {
        const ts = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
        const migratedState: WeatherState = existingActiveMeta
          ? { ...existingActiveMeta, source: "story" }
          : { ...normalizeWeatherTag(tag.attrs, runningState), updatedAt: ts };
        nextMetadata = buildMessageWeatherMetadata(nextMetadata, activeSwipeId, migratedState);
        const nextContent = stripWeatherStateTags(rawContent);
        changed = true;
        messageTagsRemoved += countWeatherTags(rawContent);
        nextActiveState = migratedState;
        if (message.id) {
          patches.push({
            messageId: message.id,
            content: nextContent,
            metadata: nextMetadata,
            tagsRemoved: messageTagsRemoved,
          });
          totalTagsRemoved += messageTagsRemoved;
        }
      } else if (existingActiveMeta) {
        const ts =
          resolveMessageTimestamp(message) ??
          (existingActiveMeta.updatedAt > 0 ? existingActiveMeta.updatedAt : fallbackUpdatedAt);
        nextActiveState = { ...existingActiveMeta, updatedAt: ts, source: "story" };
      }
    }

    if (nextActiveState) {
      runningState = nextActiveState;
    }
  }

  return {
    patches,
    migratedMessages: patches.length,
    tagsRemoved: totalTagsRemoved,
    finalState: runningState,
  };
}

function hasSameForecast(left: ForecastEntry[], right: ForecastEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry.date === other.date &&
      entry.condition === other.condition &&
      entry.summary === other.summary &&
      entry.temperature === other.temperature
    );
  });
}

export function hasSameStoryScene(left: WeatherState | null, right: WeatherState | null): boolean {
  if (!left || !right) return left === right;
  return (
    left.location === right.location &&
    left.date === right.date &&
    left.time === right.time &&
    left.condition === right.condition &&
    left.summary === right.summary &&
    left.temperature === right.temperature &&
    left.intensity === right.intensity &&
    left.wind === right.wind &&
    left.windDirection === right.windDirection &&
    left.palette === right.palette &&
    left.season === right.season &&
    left.seasonOverride === right.seasonOverride &&
    (left.exposure ?? "outdoor") === (right.exposure ?? "outdoor") &&
    (left.phenomenon ?? "none") === (right.phenomenon ?? "none") &&
    left.source === right.source &&
    hasSameForecast(left.forecast, right.forecast)
  );
}
