import { describe, expect, test } from "bun:test";
import { buildPresetWeatherState, matchWeatherScenePreset } from "./presets";
import { makeDefaultWeatherState, normalizeWeatherState } from "./shared";

describe("weather scene presets", () => {
  test("builds a manual preset without losing the current location/date", () => {
    const current = normalizeWeatherState({ location: "Moon Harbor", date: "2026-04-02" });
    const preset = buildPresetWeatherState("rain", current);
    expect(preset?.location).toBe("Moon Harbor");
    expect(preset?.date).toBe("2026-04-02");
    expect(preset?.source).toBe("manual");
  });

  test("matches an exact preset state", () => {
    const state = normalizeWeatherState({ ...makeDefaultWeatherState(), ...buildPresetWeatherState("snow") });
    expect(matchWeatherScenePreset(state)).toBe("snow");
  });
});
