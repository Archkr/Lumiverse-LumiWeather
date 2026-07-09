import type { WeatherState } from "./types";

export function selectEffectiveWeatherState(
  storyState: WeatherState | null,
  manualState: WeatherState | null,
): WeatherState | null {
  return manualState ?? storyState;
}

export function shouldApplyChatState(
  currentChatId: string | null,
  responseChatId: string | null,
  responseRequestId: number | undefined,
  activeRequestId: number,
): boolean {
  if (responseRequestId !== undefined) return responseRequestId === activeRequestId;
  return activeRequestId === 0 || responseChatId === currentChatId;
}
