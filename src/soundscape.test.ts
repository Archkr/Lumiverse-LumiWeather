import { describe, expect, test } from "bun:test";
import { DEFAULT_PREFS, makeDefaultWeatherState } from "./shared";
import { resolveSoundscapeProfile } from "./soundscape";

describe("procedural weather soundscape profile", () => {
  test("silences all channels when soundscape is disabled or effects are hidden", () => {
    const state = makeDefaultWeatherState(0);
    const disabled = resolveSoundscapeProfile(state, { ...DEFAULT_PREFS, soundEnabled: false }, true);
    expect(disabled.masterGain).toBe(0);
    expect(disabled.rainWashGain).toBe(0);

    const hidden = resolveSoundscapeProfile(state, { ...DEFAULT_PREFS, soundEnabled: true }, false);
    expect(hidden.masterGain).toBe(0);
  });

  test("applies low-pass wall occlusion for indoor and underground exposures", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.7 };
    const baseRain = { ...makeDefaultWeatherState(0), condition: "rain" as const, intensity: 0.8 };

    const outdoor = resolveSoundscapeProfile({ ...baseRain, exposure: "outdoor" }, prefs, true);
    const sheltered = resolveSoundscapeProfile({ ...baseRain, exposure: "sheltered" }, prefs, true);
    const indoor = resolveSoundscapeProfile({ ...baseRain, exposure: "indoor" }, prefs, true);
    const underground = resolveSoundscapeProfile({ ...baseRain, exposure: "underground" }, prefs, true);

    expect(outdoor.lowpassHz).toBeGreaterThan(sheltered.lowpassHz);
    expect(sheltered.lowpassHz).toBeGreaterThan(indoor.lowpassHz);
    expect(indoor.lowpassHz).toBeGreaterThan(underground.lowpassHz);
    expect(outdoor.rainWashGain).toBeGreaterThan(indoor.rainWashGain);
  });

  test("activates shimmer and crackle channels for phenomena", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.6 };
    const aurora = resolveSoundscapeProfile(
      { ...makeDefaultWeatherState(0), condition: "clear", palette: "night", phenomenon: "aurora" },
      prefs,
      true,
    );
    expect(aurora.shimmerDroneGain).toBeGreaterThan(0);

    const embers = resolveSoundscapeProfile(
      { ...makeDefaultWeatherState(0), condition: "clear", palette: "dusk", phenomenon: "embers" },
      prefs,
      true,
    );
    expect(embers.emberCrackleGain).toBeGreaterThan(0);
  });
});
