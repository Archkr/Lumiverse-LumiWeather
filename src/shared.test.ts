import { describe, expect, test } from "bun:test";
import {
  SUMMARY_MAX_LENGTH,
  formatTemperatureForUnit,
  makeDefaultWeatherState,
  normalizePrefs,
  normalizeWeatherState,
  normalizeWeatherTag,
  normalizeWindDirection,
  parseHourFromTimeString,
  parseStoryDateTime,
} from "./shared";

describe("story weather normalization", () => {
  test("rejects rolled calendar dates and invalid times", () => {
    expect(parseStoryDateTime("2026-02-30", "3:00 PM")).toBeNull();
    expect(parseStoryDateTime("2026-01-15", "13:42 PM")).toBeNull();
    expect(parseStoryDateTime("2026-01-15", "25:00")).toBeNull();
    expect(parseStoryDateTime("2026-01-15", "3:00 PM")).not.toBeNull();
  });

  test("normalizes condition aliases and removes legacy state fields", () => {
    const state = normalizeWeatherTag({
      condition: "thunderstorm",
      date: "2026-01-15",
      time: "3:00 PM",
      intensity: "0.65",
      layer: "front",
      timestampMs: "123",
    });

    expect(state.condition).toBe("storm");
    expect(state.palette).toBe("storm");
    expect("layer" in state).toBe(false);
    expect("timestampMs" in state).toBe(false);
  });

  test("clamps values and preserves explicit previous state", () => {
    const previous = makeDefaultWeatherState(0);
    const state = normalizeWeatherState({ intensity: 4, summary: "" }, previous);
    expect(state.intensity).toBe(1);
    expect(state.summary).toBe(previous.summary);

    const invalidDate = normalizeWeatherState({ date: "2026-02-30", time: "3:00 PM" }, previous);
    expect(invalidDate.date).toBe(previous.date);
    expect(invalidDate.time).toBe(previous.time);
  });

  test("derives day and night palettes from clear-scene time", () => {
    expect(normalizeWeatherState({ condition: "clear", date: "2026-01-15", time: "10:00 PM" }).palette).toBe("night");
    expect(normalizeWeatherState({ condition: "clear", date: "2026-01-15", time: "7:00 AM" }).palette).toBe("dawn");
  });

  test("supports story time parsing and unit conversion", () => {
    expect(parseHourFromTimeString("12:05 AM")).toBe(0);
    expect(parseHourFromTimeString("12:05 PM")).toBe(12);
    expect(formatTemperatureForUnit("16C", "fahrenheit")).toBe("61F");
    expect(formatTemperatureForUnit("61°F", "celsius")).toBe("16C");
  });

  test("normalizes preference bounds", () => {
    const prefs = normalizePrefs({ intensity: -2, widgetPosition: { x: "20", y: 40 } });
    expect(prefs.intensity).toBe(0.25);
    expect(prefs.lightningFlashEnabled).toBe(true);
    expect(prefs.widgetPosition).toEqual({ x: 20, y: 40 });

    expect(normalizePrefs({ lightningFlashEnabled: false }).lightningFlashEnabled).toBe(false);
  });

  test("normalizes dedicated wind-direction tag values", () => {
    expect(normalizeWindDirection("north-west", "none")).toBe("northwest");
    expect(normalizeWindDirection("SW", "none")).toBe("southwest");
    expect(normalizeWindDirection("unknown", "east")).toBe("east");
    expect(normalizeWeatherTag({ windDirection: "west" }).windDirection).toBe("west");
    expect(normalizeWeatherTag({ wind_direction: "north-east" }).windDirection).toBe("northeast");
  });

  test("keeps a longer summary instead of silently clipping it", () => {
    const long =
      "Steady afternoon rain easing into a low mist that settles quietly across the whole valley floor " +
      "before dusk, with the far ridge disappearing first and the lanterns along the eastern road " +
      "beginning to blur into soft halos of warm light";
    expect(long.length).toBeGreaterThan(SUMMARY_MAX_LENGTH);

    const state = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM", summary: long });
    expect(state.summary.length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
    expect(state.summary.endsWith("\u2026")).toBe(true);

    const short = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM", summary: "Steady rain" });
    expect(short.summary).toBe("Steady rain");
  });

  test("normalizes the new preference fields and defaults them for old installs", () => {
    const legacy = normalizePrefs({ effectsEnabled: false });
    expect(legacy.clockMode).toBe("auto");
    expect(legacy.showForecast).toBe(true);
    expect(legacy.transitionsEnabled).toBe(true);

    const custom = normalizePrefs({ clockMode: "live", showForecast: false, transitionsEnabled: false });
    expect(custom.clockMode).toBe("live");
    expect(custom.showForecast).toBe(false);
    expect(custom.transitionsEnabled).toBe(false);

    expect(normalizePrefs({ clockMode: "sideways" }).clockMode).toBe("auto");
  });
});
