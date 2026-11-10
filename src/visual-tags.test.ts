import { describe, expect, test } from "bun:test";
import { makeDefaultWeatherState } from "./shared";
import { buildWeatherVisualTags } from "./visual-tags";

describe("weather visual prompt tags", () => {
  test("returns an empty string when no weather state is active", () => {
    expect(buildWeatherVisualTags(null)).toBe("");
  });

  test("generates rich visual descriptors for outdoor and indoor scenes", () => {
    const outdoorStorm = buildWeatherVisualTags({
      ...makeDefaultWeatherState(0),
      condition: "storm",
      palette: "storm",
      exposure: "outdoor",
      phenomenon: "embers",
      wind: "gale",
      season: "autumn",
      date: "2026-10-18",
      time: "9:30 PM",
    });
    expect(outdoorStorm).toContain("thunderstorm");
    expect(outdoorStorm).toContain("floating glowing embers");
    expect(outdoorStorm).toContain("windswept motion");

    const indoorRain = buildWeatherVisualTags({
      ...makeDefaultWeatherState(0),
      condition: "rain",
      palette: "dusk",
      exposure: "indoor",
      phenomenon: "none",
      date: "2026-04-12",
      time: "7:00 PM",
    });
    expect(indoorRain).toContain("weather visible through windowpane");
    expect(indoorRain).toContain("condensation on glass");
  });

  test("includes lunar phase descriptors on clear nights", () => {
    const fullMoonNight = buildWeatherVisualTags({
      ...makeDefaultWeatherState(0),
      condition: "clear",
      palette: "night",
      exposure: "outdoor",
      phenomenon: "aurora",
      date: "2000-01-21",
      time: "11:00 PM",
    });
    expect(fullMoonNight).toContain("full moon");
    expect(fullMoonNight).toContain("bright silver moonlight");
    expect(fullMoonNight).toContain("aurora borealis");
  });
});
