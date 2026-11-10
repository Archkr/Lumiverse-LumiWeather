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

  test("scales individual soundscape channels and mutes when master volume is 0", () => {
    const stormScene = {
      ...makeDefaultWeatherState(0),
      condition: "storm" as const,
      wind: "gale",
      phenomenon: "embers" as const,
      intensity: 0.9,
    };

    const fullMix = resolveSoundscapeProfile(
      stormScene,
      {
        ...DEFAULT_PREFS,
        soundEnabled: true,
        soundVolume: 0.8,
        rainVolume: 1,
        windVolume: 1,
        thunderVolume: 1,
        ambienceVolume: 1,
      },
      true,
    );

    const halfMix = resolveSoundscapeProfile(
      stormScene,
      {
        ...DEFAULT_PREFS,
        soundEnabled: true,
        soundVolume: 0.8,
        rainVolume: 0.5,
        windVolume: 0.25,
        thunderVolume: 0,
        ambienceVolume: 0.5,
      },
      true,
    );

    expect(halfMix.rainWashGain).toBeCloseTo(fullMix.rainWashGain * 0.5, 2);
    expect(halfMix.rainPatterGain).toBeCloseTo(fullMix.rainPatterGain * 0.5, 2);
    expect(halfMix.windGain).toBeCloseTo(fullMix.windGain * 0.25, 2);
    expect(halfMix.thunderGainScale).toBe(0);
    expect(halfMix.emberCrackleGain).toBeCloseTo(fullMix.emberCrackleGain * 0.5, 2);

    const mutedMaster = resolveSoundscapeProfile(
      stormScene,
      { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0 },
      true,
    );
    expect(mutedMaster.active).toBe(false);
    expect(mutedMaster.masterGain).toBe(0);
  });

  test("gusts, whistle, and droplet density scale with wind and rain strength", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.6 };
    const base = makeDefaultWeatherState(0);
    const calm = resolveSoundscapeProfile({ ...base, condition: "rain", wind: "calm", intensity: 0.3 }, prefs, true);
    const gale = resolveSoundscapeProfile({ ...base, condition: "storm", wind: "gale", intensity: 1 }, prefs, true);

    expect(gale.gustiness).toBeGreaterThan(calm.gustiness);
    expect(gale.windWhistleGain).toBeGreaterThan(0);
    expect(calm.windWhistleGain).toBe(0);
    expect(gale.dropletRate).toBeGreaterThan(calm.dropletRate);
    expect(calm.dropletRate).toBeGreaterThan(0);
    expect(gale.thunderProximity).toBeGreaterThan(0);
    expect(calm.thunderProximity).toBe(0);
  });

  test("keeps a quiet air bed and adds wildlife only in fitting calm scenes", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.6 };
    const base = { ...makeDefaultWeatherState(0), wind: "light", intensity: 0.5 };

    const summerNight = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "night", season: "summer" },
      prefs,
      true,
    );
    expect(summerNight.airBedGain).toBeGreaterThan(0);
    expect(summerNight.cricketGain).toBeGreaterThan(0);
    expect(summerNight.birdGain).toBe(0);

    const springDawn = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "dawn", season: "spring" },
      prefs,
      true,
    );
    expect(springDawn.birdGain).toBeGreaterThan(0);
    expect(springDawn.cricketGain).toBe(0);

    const rainyDawn = resolveSoundscapeProfile(
      { ...base, condition: "rain", palette: "dawn", season: "spring" },
      prefs,
      true,
    );
    expect(rainyDawn.birdGain).toBe(0);

    const winterNight = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "night", season: "winter" },
      prefs,
      true,
    );
    expect(winterNight.cricketGain).toBe(0);

    const silencedAmbience = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "night", season: "summer" },
      { ...prefs, ambienceVolume: 0 },
      true,
    );
    expect(silencedAmbience.cricketGain).toBe(0);
    expect(silencedAmbience.airBedGain).toBe(0);
  });

  test("underground scenes swap weather for cave drips and a larger reverb", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.6 };
    const base = { ...makeDefaultWeatherState(0), condition: "rain" as const, intensity: 0.8 };
    const cave = resolveSoundscapeProfile({ ...base, exposure: "underground" }, prefs, true);
    const outside = resolveSoundscapeProfile({ ...base, exposure: "outdoor" }, prefs, true);

    expect(cave.caveDripGain).toBeGreaterThan(0);
    expect(cave.dropletRate).toBe(0);
    expect(outside.caveDripGain).toBe(0);
    expect(cave.reverbWet).toBeGreaterThan(outside.reverbWet);
  });

  test("distinguishes aurora, firefly, and blossom shimmer styles and ashfall grit", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.6 };
    const base = { ...makeDefaultWeatherState(0), condition: "clear" as const, palette: "night" as const };
    const aurora = resolveSoundscapeProfile({ ...base, phenomenon: "aurora" }, prefs, true);
    const fireflies = resolveSoundscapeProfile({ ...base, phenomenon: "fireflies" }, prefs, true);
    const blossoms = resolveSoundscapeProfile({ ...base, phenomenon: "blossoms" }, prefs, true);
    const ashfall = resolveSoundscapeProfile({ ...base, phenomenon: "ashfall" }, prefs, true);

    expect(aurora.shimmerStyle).toBe("aurora");
    expect(fireflies.shimmerStyle).toBe("fireflies");
    expect(blossoms.shimmerStyle).toBe("blossoms");
    expect(fireflies.sparkleRate).toBeGreaterThan(aurora.sparkleRate);
    expect(blossoms.sparkleGain).toBeGreaterThan(0);
    expect(aurora.shimmerDroneGain).toBeGreaterThan(fireflies.shimmerDroneGain);
    expect(ashfall.sandGritGain).toBeGreaterThan(0);
  });
});
