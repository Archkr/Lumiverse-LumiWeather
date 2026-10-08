import { describe, expect, test } from "bun:test";

import { makeDefaultWeatherState, normalizeWeatherTag } from "./shared";
import { extractLastWeatherTag } from "./tag-utils";
import { buildPromptInstruction, buildTrackerMacro, buildWeatherTagExample } from "./weather-prompt";

describe("weather prompt guidance", () => {
  test("keeps conversational turns on the current story time", () => {
    const tracker = buildTrackerMacro();

    expect(tracker).toContain("Treat date and time as story-continuity state");
    expect(tracker).toContain("Copy the current date and time exactly");
    expect(tracker).toContain("Brief dialogue and quick actions normally keep the exact same time");
    expect(tracker).toContain("When time does advance, make the amount match");
  });

  test("includes the exact current date and time in the injected instruction", () => {
    const state = makeDefaultWeatherState(0);
    state.date = "2026-07-20";
    state.time = "8:14 PM";

    const instruction = buildPromptInstruction(state);
    expect(instruction).toContain("Date: 2026-07-20");
    expect(instruction).toContain("Time: 8:14 PM");
  });

  test("requires a populated fictional projection even when the story has not forecast weather", () => {
    const tracker = buildTrackerMacro();

    expect(tracker).toContain("Include a non-empty forecast attribute in every weather-state tag");
    expect(tracker).toContain("even when the visible narrative does not discuss future weather");
    expect(tracker).toContain("Project the next three story calendar days by default");
    expect(tracker).toContain("at most five future days total");
    expect(tracker).toContain("location, season, current weather, and temperature");
    expect(tracker).toContain("projection of fictional story weather, not live forecast data");
    expect(tracker).toContain("Stable weather is a valid projection");
    expect(tracker).not.toContain("forecast is optional");
    expect(tracker).not.toContain("Only include forecast entries the narrative meaningfully establishes");
  });

  test("retains the saved outlook and tells the model how to roll it forward with story time", () => {
    const state = normalizeWeatherTag({
      date: "2026-12-31", time: "8:14 PM", temperature: "16C",
      forecast: "2027-01-01: rain, 15C, lingering showers | 2027-01-02: cloudy, 14C, low clouds",
    });
    const instruction = buildPromptInstruction(state);

    expect(instruction).toContain("Date: 2026-12-31");
    expect(instruction).toContain("Forecast: 2027-01-01: rain, 15C, lingering showers | 2027-01-02: cloudy, 14C, low clouds");
    expect(instruction).toContain("Copy existing future forecast entries unchanged");
    expect(instruction).toContain("remove entries on or before that date");
    expect(instruction).toContain("restore the default three-day horizon");
    expect(instruction).toContain("never on the device date or the example date below");
    expect(instruction).toContain("keep the scene's temperature unit");
  });

  test("marks a missing saved outlook and retains forecast instructions before the first scene tag", () => {
    const withState = buildPromptInstruction(makeDefaultWeatherState(0));
    const withoutState = buildPromptInstruction(null);

    expect(withState).toContain("Forecast: Not set yet; create a near-term outlook in the next tag.");
    expect(withoutState).toContain("Current scene: No saved weather state yet.");
    expect(withoutState).toContain("Include a non-empty forecast attribute in every weather-state tag");
  });

  test("the wrapper example parses into three complete later days", () => {
    const tag = extractLastWeatherTag(buildWeatherTagExample());
    expect(tag).not.toBeNull();
    const state = normalizeWeatherTag(tag!.attrs);

    expect(state.forecast.map((entry) => entry.date)).toEqual(["2026-01-16", "2026-01-17", "2026-01-18"]);
    for (const entry of state.forecast) {
      expect(entry.date > state.date).toBe(true);
      expect(entry.temperature).toMatch(/^-?\d+F$/);
      expect(entry.summary.length).toBeGreaterThan(0);
    }
  });
});
