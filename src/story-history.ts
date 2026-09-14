import type { ChatMessageDTO } from "lumiverse-spindle-types";

import { normalizeWeatherState } from "./shared";
import { extractLastWeatherTag } from "./tag-utils";
import type { ForecastEntry, WeatherState } from "./types";

type StoryHistoryMessage = Pick<ChatMessageDTO, "content" | "index_in_chat" | "is_user"> & {
  role?: "system" | "user" | "assistant";
  send_date?: number;
  swipe_id?: number;
  swipe_dates?: number[];
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
function resolveMessageTimestamp(message: StoryHistoryMessage): number | null {
  const swipeId = typeof message.swipe_id === "number" && Number.isFinite(message.swipe_id) ? message.swipe_id : null;
  if (swipeId !== null && Array.isArray(message.swipe_dates)) {
    const swipeTimestamp = normalizeMessageTimestamp(message.swipe_dates[swipeId]);
    if (swipeTimestamp !== null) return swipeTimestamp;
  }
  return normalizeMessageTimestamp(message.send_date);
}

/**
 * Rebuilds story state from chat history.
 *
 * Each accepted tag is stamped with the timestamp of the message that carried
 * it, so `updatedAt` reflects when the scene was actually written. Stamping a
 * deleted-then-rebuilt history with `Date.now()` reported a weeks-old scene as
 * freshly observed.
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
    if (role !== "assistant" || typeof message.content !== "string") continue;
    const tag = extractLastWeatherTag(message.content);
    if (!tag) continue;

    const updatedAt = resolveMessageTimestamp(message) ?? fallbackUpdatedAt;
    state = normalizeWeatherState({ ...tag.attrs, updatedAt, source: "story" }, state);
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
    left.source === right.source &&
    hasSameForecast(left.forecast, right.forecast)
  );
}
