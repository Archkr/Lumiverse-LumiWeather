import type { ChatMessageDTO } from "lumiverse-spindle-types";

import { normalizeStoredWeatherState, normalizeWeatherTag } from "./shared";
import { extractLastWeatherTag } from "./tag-utils";
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
  swipe_dates?: number[];
  metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

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
