import { describe, expect, test } from "bun:test";
import { DEFAULT_PREFS, makeDefaultWeatherState } from "./shared";
import {
  parseTemperatureFahrenheit,
  resolveSoundscapeBiome,
  resolveSoundscapeProfile,
  resolveWindDirectionPan,
} from "./soundscape";

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
    expect(blossoms.windChimeGain).toBeGreaterThan(0);
    expect(ashfall.volcanicRumbleGain).toBeGreaterThan(0);
  });

  test("infers coastal, forest, and water biomes from location and activates matching layers", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.7 };
    const base = { ...makeDefaultWeatherState(0), condition: "clear" as const, palette: "day" as const, wind: "breeze" };

    expect(resolveSoundscapeBiome("Slateport Harbor, Hoenn")).toBe("coastal");
    expect(resolveSoundscapeBiome("Lilycove City Park", "Wingull crying over the bay")).toBe("coastal");
    expect(resolveSoundscapeBiome("Petalburg Woods, Hoenn")).toBe("forest");
    expect(resolveSoundscapeBiome("Emerald Creek, Valley")).toBe("water");
    expect(resolveSoundscapeBiome("Downtown Metro Plaza")).toBe("none");

    const coastDay = resolveSoundscapeProfile(
      {
        ...base,
        location: "Lilycove City Park",
        summary: "High noon sun, Wingull crying over the bay",
        season: "spring",
        temperature: "82F",
      },
      prefs,
      true,
    );
    expect(coastDay.biome).toBe("coastal");
    expect(coastDay.surfGain).toBeGreaterThan(0);
    expect(coastDay.gullGain).toBeGreaterThan(0);
    expect(coastDay.cicadaGain).toBeGreaterThan(0);
    expect(coastDay.foghornGain).toBe(0);

    const coastFog = resolveSoundscapeProfile(
      { ...base, location: "Slateport Harbor, Hoenn", condition: "fog" },
      prefs,
      true,
    );
    expect(coastFog.foghornGain).toBeGreaterThan(0);
    expect(coastFog.condensationDripGain).toBeGreaterThan(0);

    const forestNight = resolveSoundscapeProfile(
      { ...base, location: "Petalburg Woods, Hoenn", palette: "night" },
      prefs,
      true,
    );
    expect(forestNight.biome).toBe("forest");
    expect(forestNight.owlGain).toBeGreaterThan(0);

    const brookDusk = resolveSoundscapeProfile(
      { ...base, location: "Silver Creek, Valley", palette: "dusk", season: "spring" },
      prefs,
      true,
    );
    expect(brookDusk.biome).toBe("water");
    expect(brookDusk.brookGain).toBeGreaterThan(0);
    expect(brookDusk.frogGain).toBeGreaterThan(0);
  });

  test("supports flexible biome override, hearth mode, warmth, and per-layer toggles", () => {
    const base = {
      ...makeDefaultWeatherState(0),
      location: "Downtown Cafe",
      condition: "clear" as const,
      palette: "day" as const,
      phenomenon: "aurora" as const,
      exposure: "outdoor" as const,
      wind: "light",
    };

    const forcedCoastal = resolveSoundscapeProfile(
      base,
      {
        ...DEFAULT_PREFS,
        soundEnabled: true,
        soundBiomeOverride: "coastal",
        soundHearthMode: "on",
        soundWarmthEnabled: false,
      },
      true,
    );
    expect(forcedCoastal.biome).toBe("coastal");
    expect(forcedCoastal.surfGain).toBeGreaterThan(0);
    expect(forcedCoastal.gullGain).toBeGreaterThan(0);
    expect(forcedCoastal.winterHearthGain).toBeGreaterThan(0);
    expect(forcedCoastal.warmthEnabled).toBe(false);

    const stripped = resolveSoundscapeProfile(
      { ...base, location: "Slateport Harbor", phenomenon: "aurora" },
      {
        ...DEFAULT_PREFS,
        soundEnabled: true,
        soundHearthMode: "off",
        waterEnabled: false,
        airBedEnabled: false,
        phenomenaAudioEnabled: false,
        wildlifeEnabled: false,
      },
      true,
    );
    expect(stripped.surfGain).toBe(0);
    expect(stripped.airBedGain).toBe(0);
    expect(stripped.shimmerDroneGain).toBe(0);
    expect(stripped.sparkleGain).toBe(0);
    expect(stripped.winterHearthGain).toBe(0);
    expect(stripped.gullGain).toBe(0);
    expect(stripped.birdGain).toBe(0);
  });

  test("wildlifeEnabled toggle mutes all wildlife voices while preserving weather and water beds", () => {
    const base = {
      ...makeDefaultWeatherState(0),
      condition: "clear" as const,
      season: "summer" as const,
      temperature: "88°F",
      wind: "light",
    };

    const hotDayOn = resolveSoundscapeProfile(
      { ...base, palette: "day", location: "Harbor Beach" },
      { ...DEFAULT_PREFS, soundEnabled: true, wildlifeEnabled: true },
      true,
    );
    const hotDayOff = resolveSoundscapeProfile(
      { ...base, palette: "day", location: "Harbor Beach" },
      { ...DEFAULT_PREFS, soundEnabled: true, wildlifeEnabled: false },
      true,
    );

    expect(hotDayOn.cicadaGain).toBeGreaterThan(0);
    expect(hotDayOn.gullGain).toBeGreaterThan(0);
    expect(hotDayOn.birdGain).toBeGreaterThan(0);
    expect(hotDayOff.cicadaGain).toBe(0);
    expect(hotDayOff.gullGain).toBe(0);
    expect(hotDayOff.birdGain).toBe(0);
    expect(hotDayOff.surfGain).toBeGreaterThan(0);

    const nightOff = resolveSoundscapeProfile(
      { ...base, palette: "night", location: "Whispering Woods" },
      { ...DEFAULT_PREFS, soundEnabled: true, wildlifeEnabled: false },
      true,
    );
    expect(nightOff.cricketGain).toBe(0);
    expect(nightOff.owlGain).toBe(0);
    expect(nightOff.frogGain).toBe(0);
  });

  test("applies snow acoustic damping, sleet taps, autumn leaf skittering, and directional wind pan", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.7 };
    const base = makeDefaultWeatherState(0);

    const clearOutdoor = resolveSoundscapeProfile({ ...base, condition: "clear", exposure: "outdoor" }, prefs, true);
    const snowBlizzard = resolveSoundscapeProfile(
      { ...base, condition: "snow", season: "winter", wind: "strong", intensity: 0.85, exposure: "outdoor" },
      prefs,
      true,
    );
    expect(snowBlizzard.lowpassHz).toBeLessThan(clearOutdoor.lowpassHz);
    expect(snowBlizzard.sleetGain).toBeGreaterThan(0);
    expect(snowBlizzard.creakGain).toBeGreaterThan(0);

    const autumnBreeze = resolveSoundscapeProfile(
      { ...base, condition: "cloudy", season: "autumn", wind: "breeze", exposure: "outdoor" },
      prefs,
      true,
    );
    expect(autumnBreeze.autumnLeafGain).toBeGreaterThan(0);

    expect(resolveWindDirectionPan("east", "steady")).toBeGreaterThan(0);
    expect(resolveWindDirectionPan("west", "steady")).toBeLessThan(0);
    expect(resolveWindDirectionPan("north", "steady")).toBe(0);
    expect(resolveWindDirectionPan("none", "gusty westerly breeze")).toBeLessThan(0);
    expect(parseTemperatureFahrenheit("28°C")).toBeCloseTo(82.4, 1);
    expect(parseTemperatureFahrenheit("30°F")).toBe(30);
  });

  test("models shelter reverb kinds, roof resonance, indoor winter hearth, storm creaks, and cavern rumble", () => {
    const prefs = { ...DEFAULT_PREFS, soundEnabled: true, soundVolume: 0.7 };
    const base = makeDefaultWeatherState(0);

    const shelteredRain = resolveSoundscapeProfile(
      { ...base, condition: "rain", intensity: 0.8, exposure: "sheltered" },
      prefs,
      true,
    );
    expect(shelteredRain.reverbKind).toBe("room");
    expect(shelteredRain.shelteredRoofGain).toBeGreaterThan(0);

    const indoorWinterStorm = resolveSoundscapeProfile(
      {
        ...base,
        condition: "storm",
        season: "winter",
        temperature: "28°F",
        wind: "gale",
        intensity: 0.9,
        exposure: "indoor",
      },
      prefs,
      true,
    );
    expect(indoorWinterStorm.reverbKind).toBe("room");
    expect(indoorWinterStorm.winterHearthGain).toBeGreaterThan(0);
    expect(indoorWinterStorm.creakGain).toBeGreaterThan(0);
    expect(indoorWinterStorm.stormRumbleGain).toBeGreaterThan(0);

    const cave = resolveSoundscapeProfile(
      { ...base, condition: "clear", exposure: "underground" },
      prefs,
      true,
    );
    expect(cave.reverbKind).toBe("wide");
    expect(cave.cavernRumbleGain).toBeGreaterThan(0);

    const dawn = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "dawn", season: "spring", wind: "light" },
      prefs,
      true,
    );
    const day = resolveSoundscapeProfile(
      { ...base, condition: "clear", palette: "day", season: "spring", wind: "light" },
      prefs,
      true,
    );
    expect(dawn.dawnChorus).toBe(true);
    expect(day.dawnChorus).toBe(false);
  });
});
