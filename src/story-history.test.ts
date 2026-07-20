import { describe, expect, test } from "bun:test";

import { hasSameStoryScene, rebuildStoryWeatherState } from "./story-history";

function message(
  index: number,
  role: "user" | "assistant",
  content: string,
): { index_in_chat: number; role: "user" | "assistant"; is_user: boolean; content: string } {
  return { index_in_chat: index, role, is_user: role === "user", content };
}

describe("story weather history", () => {
  test("rebuilds from the latest remaining assistant tag", () => {
    const state = rebuildStoryWeatherState([
      message(0, "assistant", '<weather-state location="Porch" date="2026-07-20" time="3:00 PM" condition="clear" summary="Warm" temperature="76F" intensity="0.2" wind="still" windDirection="none" palette="day"></weather-state>'),
      message(1, "user", '<weather-state location="Fake" date="2026-07-20" time="9:00 PM" condition="storm"></weather-state>'),
      message(2, "assistant", '<weather-state location="Porch" date="2026-07-20" time="3:10 PM" condition="rain" summary="Shower" temperature="72F" intensity="0.5" wind="light" windDirection="west" palette="day"></weather-state>'),
    ], 1234);

    expect(state).toMatchObject({ time: "3:10 PM", condition: "rain", updatedAt: 1234, source: "story" });
  });

  test("falls back to the prior tag when the newest tagged message is deleted", () => {
    const remaining = [
      message(0, "assistant", '<weather-state location="Porch" date="2026-07-20" time="3:00 PM" condition="clear" summary="Warm" temperature="76F" intensity="0.2" wind="still" windDirection="none" palette="day"></weather-state>'),
      message(1, "user", "Keep talking."),
    ];

    expect(rebuildStoryWeatherState(remaining, 2000)).toMatchObject({ time: "3:00 PM", condition: "clear" });
    expect(rebuildStoryWeatherState([], 2000)).toBeNull();
  });

  test("replays partial tags chronologically and compares scene fields without sync time", () => {
    const state = rebuildStoryWeatherState([
      message(5, "assistant", '<weather-state condition="rain" summary="Drizzle"></weather-state>'),
      message(2, "assistant", '<weather-state location="Garden" date="2026-07-20" time="4:00 PM" condition="clear" temperature="70F" wind="still" windDirection="none" palette="day"></weather-state>'),
    ], 3000);

    expect(state).toMatchObject({ location: "Garden", time: "4:00 PM", condition: "rain", summary: "Drizzle" });
    expect(hasSameStoryScene(state, state ? { ...state, updatedAt: 9000 } : null)).toBe(true);
  });
});
