import { describe, expect, test } from "bun:test";

import { WEATHER_BREAKDOWN_NAME, injectWeatherInstruction } from "./prompt-injection";

describe("weather prompt injection", () => {
  test("creates a dedicated breakdown message after the first system block", () => {
    const result = injectWeatherInstruction([
      { role: "system", content: "Base system prompt" },
      { role: "user", content: "Continue the scene" },
    ], "[LumiWeather HUD]\nCurrent scene: rain");

    expect(result.messages).toEqual([
      { role: "system", content: "Base system prompt" },
      { role: "system", content: "[LumiWeather HUD]\nCurrent scene: rain" },
      { role: "user", content: "Continue the scene" },
    ]);
    expect(result.breakdown).toEqual([{ messageIndex: 1, name: WEATHER_BREAKDOWN_NAME }]);
  });

  test("prepends the dedicated message and strips historical weather tags", () => {
    const result = injectWeatherInstruction([
      {
        role: "assistant",
        content: "Visible prose\n<weather-state condition=\"rain\"></weather-state>",
      },
    ], "Weather instruction");

    expect(result.messages).toEqual([
      { role: "system", content: "Weather instruction" },
      { role: "assistant", content: "Visible prose" },
    ]);
    expect(result.breakdown).toEqual([{ messageIndex: 0, name: WEATHER_BREAKDOWN_NAME }]);
  });
});
