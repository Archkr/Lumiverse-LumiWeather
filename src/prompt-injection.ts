import type { InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";

import { extractLastWeatherTag } from "./tag-utils";
import { normalizeWeatherTag } from "./shared";
import { hasSameStoryScene } from "./story-history";
import { buildSceneInstruction } from "./weather-prompt";
import type { WeatherState } from "./types";

export const WEATHER_INSTRUCTIONS_BREAKDOWN_NAME = "LumiWeather — Instructions";
export const WEATHER_BREAKDOWN_NAME = "LumiWeather — Scene State";

function latestHistoryTag(messages: LlmMessageDTO[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !message.__isChatHistory) continue;
    const content = typeof message.content === "string" ? message.content : message.content
      .flatMap(part => "text" in part && typeof part.text === "string" ? [part.text] : [])
      .join("\n");
    const tag = extractLastWeatherTag(content);
    if (tag) return tag;
  }
  return null;
}

export function injectWeatherInstruction(
  messages: LlmMessageDTO[],
  instruction: string,
  state: WeatherState | null,
): InterceptorResultDTO {
  // Keep historical tags and source identity intact. The tags carry continuity
  // without rewriting earlier instructions on each turn.
  const firstSystemIndex = messages.findIndex((message) => message.role === "system");
  const messageIndex = firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0;
  const nextMessages = [...messages];
  nextMessages.splice(messageIndex, 0, { role: "system", content: instruction });
  const breakdown = [{ messageIndex, name: WEATHER_INSTRUCTIONS_BREAKDOWN_NAME }];

  const tag = latestHistoryTag(messages);
  // LumiBooks or context clipping can remove the latest tag. Manual overrides
  // also need an explicit reference because they are not recorded in history.
  if (state && (state.source === "manual" || !tag ||
    !hasSameStoryScene(normalizeWeatherTag(tag.attrs, state), state))) {
    breakdown.push({ messageIndex: nextMessages.length, name: WEATHER_BREAKDOWN_NAME });
    nextMessages.push({ role: "system", content: buildSceneInstruction(state) });
  }

  return { messages: nextMessages, breakdown };
}
