import type { InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";

import { stripWeatherStateTags } from "./tag-utils";

export const WEATHER_BREAKDOWN_NAME = "LumiWeather — Scene State";

function stripWeatherStateMessageContent<T>(content: T): T {
  if (typeof content === "string") return stripWeatherStateTags(content) as T;
  if (!Array.isArray(content)) return content;

  return content.map((part) => {
    if (!part || typeof part !== "object" || !("text" in part)) return part;
    const text = (part as { text?: unknown }).text;
    return typeof text === "string" ? { ...part, text: stripWeatherStateTags(text) } : part;
  }) as T;
}

export function injectWeatherInstruction(
  messages: LlmMessageDTO[],
  instruction: string,
): InterceptorResultDTO {
  const cleanedMessages = messages.map((message) =>
    message?.content ? { ...message, content: stripWeatherStateMessageContent(message.content) } : message,
  );
  const firstSystemIndex = cleanedMessages.findIndex((message) => message.role === "system");
  const messageIndex = firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0;
  const injected: LlmMessageDTO = { role: "system", content: instruction };
  const nextMessages = [...cleanedMessages];
  nextMessages.splice(messageIndex, 0, injected);

  return {
    messages: nextMessages,
    breakdown: [{ messageIndex, name: WEATHER_BREAKDOWN_NAME }],
  };
}
