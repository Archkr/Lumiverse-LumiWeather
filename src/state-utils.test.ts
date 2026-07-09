import { describe, expect, test } from "bun:test";
import { selectEffectiveWeatherState, shouldApplyChatState } from "./state-utils";
import { makeDefaultWeatherState } from "./shared";

describe("weather chat state flow", () => {
  test("manual state takes precedence while story state remains available", () => {
    const story = makeDefaultWeatherState(1);
    const manual = { ...story, source: "manual" as const, summary: "Locked scene" };
    expect(selectEffectiveWeatherState(story, manual)).toBe(manual);
    expect(selectEffectiveWeatherState(story, null)).toBe(story);
    expect(selectEffectiveWeatherState(null, null)).toBeNull();
  });

  test("accepts only the current chat response or matching request", () => {
    expect(shouldApplyChatState("chat-b", "chat-a", undefined, 2)).toBe(false);
    expect(shouldApplyChatState("chat-b", "chat-b", undefined, 2)).toBe(true);
    expect(shouldApplyChatState("chat-b", null, 3, 3)).toBe(true);
    expect(shouldApplyChatState("chat-b", "chat-a", 2, 3)).toBe(false);
  });
});
