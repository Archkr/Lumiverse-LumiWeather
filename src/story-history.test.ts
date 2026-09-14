import { describe, expect, test } from "bun:test";

import { hasSameStoryScene, normalizeMessageTimestamp, rebuildStoryWeatherState } from "./story-history";

function message(
  index: number,
  role: "user" | "assistant",
  content: string,
): { index_in_chat: number; role: "user" | "assistant"; is_user: boolean; content: string } {
  return { index_in_chat: index, role, is_user: role === "user", content };
}

/** Unix seconds, matching what the host sends for ChatMessageDTO timestamps. */
function stamped(
  index: number,
  content: string,
  sendDateSeconds: number,
  swipe?: { id: number; dates: number[] },
): {
  index_in_chat: number;
  role: "assistant";
  is_user: boolean;
  content: string;
  send_date: number;
  swipe_id?: number;
  swipe_dates?: number[];
} {
  return {
    index_in_chat: index,
    role: "assistant",
    is_user: false,
    content,
    send_date: sendDateSeconds,
    swipe_id: swipe?.id,
    swipe_dates: swipe?.dates,
  };
}

const TAG_A =
  '<weather-state location="Porch" date="2026-07-20" time="3:00 PM" condition="clear" summary="Warm" temperature="76F" intensity="0.2" wind="still" windDirection="none" palette="day"></weather-state>';
const TAG_B =
  '<weather-state location="Porch" date="2026-07-20" time="3:10 PM" condition="rain" summary="Shower" temperature="72F" intensity="0.5" wind="light" windDirection="west" palette="day"></weather-state>';

/** Inserts an extra attribute before the tag's closing bracket. */
function addAttribute(tag: string, attribute: string): string {
  return tag.replace(/>\s*<\/weather-state>$/, ` ${attribute}></weather-state>`);
}

describe("story weather history", () => {
  test("rebuilds from the latest remaining assistant tag", () => {
    const state = rebuildStoryWeatherState([
      message(0, "assistant", TAG_A),
      message(1, "user", '<weather-state location="Fake" date="2026-07-20" time="9:00 PM" condition="storm"></weather-state>'),
      message(2, "assistant", TAG_B),
    ], 1234);

    expect(state).toMatchObject({ time: "3:10 PM", condition: "rain", updatedAt: 1234, source: "story" });
  });

  test("falls back to the prior tag when the newest tagged message is deleted", () => {
    const remaining = [message(0, "assistant", TAG_A), message(1, "user", "Keep talking.")];

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

  test("stamps each replayed tag with its own message timestamp", () => {
    // Regression: every replayed tag used to receive one shared Date.now(), so a
    // scene written weeks ago published as freshly observed.
    const earlier = 1_700_000_000;
    const later = 1_700_000_600;
    const state = rebuildStoryWeatherState([
      stamped(0, TAG_A, earlier),
      stamped(1, TAG_B, later),
    ], Date.now());

    expect(state?.updatedAt).toBe(later * 1000);
    expect(state?.condition).toBe("rain");
  });

  test("uses the active swipe's own timestamp", () => {
    const state = rebuildStoryWeatherState([
      stamped(0, TAG_B, 1_700_000_000, { id: 2, dates: [1_699_999_000, 1_699_999_500, 1_700_000_900] }),
    ], Date.now());

    expect(state?.updatedAt).toBe(1_700_000_900 * 1000);
  });

  test("falls back to send_date when swipe metadata is absent or unusable", () => {
    expect(normalizeMessageTimestamp(0)).toBeNull();
    expect(normalizeMessageTimestamp(-5)).toBeNull();
    expect(normalizeMessageTimestamp(Number.NaN)).toBeNull();
    expect(normalizeMessageTimestamp("1700000000")).toBeNull();
    expect(normalizeMessageTimestamp(1_700_000_000)).toBe(1_700_000_000 * 1000);
    // A value already in milliseconds is passed through unchanged.
    expect(normalizeMessageTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);

    const state = rebuildStoryWeatherState(
      [stamped(0, TAG_A, 1_700_000_000, { id: 3, dates: [1_699_999_000] })],
      Date.now(),
    );
    expect(state?.updatedAt).toBe(1_700_000_000 * 1000);
  });

  test("uses the fallback timestamp only when a message carries none", () => {
    const state = rebuildStoryWeatherState([message(0, "assistant", TAG_A)], 4242);
    expect(state?.updatedAt).toBe(4242);
  });

  test("detects a forecast-only change as a scene change", () => {
    const withForecast = rebuildStoryWeatherState(
      [message(0, "assistant", addAttribute(TAG_A, 'forecast="2026-07-21: rain, 70F"'))],
      1000,
    );
    const without = rebuildStoryWeatherState([message(0, "assistant", TAG_A)], 1000);

    expect(without?.forecast).toEqual([]);
    expect(withForecast?.forecast.length).toBe(1);
    expect(hasSameStoryScene(without, withForecast)).toBe(false);
    expect(hasSameStoryScene(without, rebuildStoryWeatherState([message(0, "assistant", TAG_A)], 1000))).toBe(true);
    expect(hasSameStoryScene(null, null)).toBe(true);
    expect(hasSameStoryScene(without, null)).toBe(false);
  });
});
