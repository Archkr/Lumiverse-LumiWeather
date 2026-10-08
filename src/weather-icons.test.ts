import { describe, expect, test } from "bun:test";
import { WEATHER_CONDITIONS } from "./shared";
import { resolveHudTimePhase } from "./time-utils";
import { conditionIcon, conditionIconLabel } from "./weather-icons";

describe("weather icons", () => {
  test("shows a moon for an explicitly locked night even with an evening live clock", () => {
    const phase = resolveHudTimePhase("night", 18);
    const icon = conditionIcon("clear", phase);
    expect(icon).not.toContain("<circle");
    expect(icon).not.toBe(conditionIcon("clear", "day"));
    expect(conditionIconLabel("clear", phase)).toBe("Clear night");
  });

  test("shows a moon for early morning and late night on non-phase palettes", () => {
    for (const hour of [0, 5, 21, 23]) {
      expect(conditionIcon("clear", resolveHudTimePhase("mist", hour))).toBe(conditionIcon("clear", "night"));
    }
  });

  test("retains the sun for daylight, dawn, dusk, and daily forecast icons", () => {
    for (const phase of ["dawn", "day", "dusk"] as const) {
      expect(conditionIcon("clear", phase)).toContain("<circle");
      expect(conditionIconLabel("clear", phase)).toBe("Clear weather");
    }
    expect(conditionIcon("clear")).toBe(conditionIcon("clear", "day"));
  });

  test("keeps weather-specific symbols at night", () => {
    for (const condition of WEATHER_CONDITIONS.filter((condition) => condition !== "clear")) {
      expect(conditionIcon(condition, "night")).toBe(conditionIcon(condition, "day"));
      expect(conditionIconLabel(condition, "night")).toBe(conditionIconLabel(condition, "day"));
    }
  });
});
