import { describe, expect, test } from "bun:test";
import {
  formatTemperatureForUnit,
  makeDefaultWeatherState,
  normalizePrefs,
  normalizeWeatherState,
  normalizeWeatherTag,
  parseHourFromTimeString,
  parseStoryDateTime,
} from "./shared";

describe("story weather normalization", () => {
  test("rejects rolled calendar dates and invalid times", () => {
    expect(parseStoryDateTime("2026-02-30", "9:42 PM")).toBeNull();
    expect(parseStoryDateTime("2026-03-24", "13:42 PM")).toBeNull();
    expect(parseStoryDateTime("2026-03-24", "25:00")).toBeNull();
    expect(parseStoryDateTime("2026-03-24", "9:42 PM")).not.toBeNull();
  });

  test("normalizes condition aliases and removes legacy state fields", () => {
    const state = normalizeWeatherTag({
      condition: "thunderstorm",
      date: "2026-03-24",
      time: "9:42 PM",
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

    const invalidDate = normalizeWeatherState({ date: "2026-02-30", time: "9:42 PM" }, previous);
    expect(invalidDate.date).toBe(previous.date);
    expect(invalidDate.time).toBe(previous.time);
  });

  test("derives day and night palettes from clear-scene time", () => {
    expect(normalizeWeatherState({ condition: "clear", date: "2026-03-24", time: "10:00 PM" }).palette).toBe("night");
    expect(normalizeWeatherState({ condition: "clear", date: "2026-03-24", time: "7:00 AM" }).palette).toBe("dawn");
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
    expect(prefs.widgetPosition).toEqual({ x: 20, y: 40 });
  });
});
