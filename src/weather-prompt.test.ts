import { describe, expect, test } from "bun:test";

import { makeDefaultWeatherState } from "./shared";
import { buildPromptInstruction, buildTrackerMacro } from "./weather-prompt";

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
});
