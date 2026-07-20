import type { ChatMessageDTO } from "lumiverse-spindle-types";

import { normalizeWeatherState } from "./shared";
import { extractLastWeatherTag } from "./tag-utils";
import type { WeatherState } from "./types";

type StoryHistoryMessage = Pick<ChatMessageDTO, "content" | "index_in_chat" | "is_user"> & {
  role?: "system" | "user" | "assistant";
};

export function rebuildStoryWeatherState(
  messages: StoryHistoryMessage[],
  updatedAt = Date.now(),
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
    state = normalizeWeatherState({ ...tag.attrs, updatedAt, source: "story" }, state);
  }
  return state;
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
    left.source === right.source
  );
}
