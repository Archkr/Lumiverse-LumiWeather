import { describe, expect, test } from "bun:test";

import { resolveSceneTokens } from "./scene-tokens";
import { makeDefaultWeatherState } from "./shared";
import { derivePalette } from "./time-utils";
import type { SceneTokens, WeatherCondition, WeatherPalette, WeatherState } from "./types";

function state(overrides: Partial<WeatherState> = {}): WeatherState {
  return {
    ...makeDefaultWeatherState(0),
    date: "2026-07-20",
    time: "3:00 PM",
    ...overrides,
  };
}

/** All numeric fields, so ratio-style assertions can be written generically. */
const OPACITY_KEYS: ReadonlyArray<keyof SceneTokens> = [
  "skyOpacity",
  "glowOpacity",
  "beamOpacity",
  "cloudOpacity",
  "horizonOpacity",
  "mistOpacity",
  "fogOpacity",
  "rainOpacity",
  "snowOpacity",
  "moteOpacity",
  "flashOpacity",
];

function opacityOf(tokens: SceneTokens, key: keyof SceneTokens): number {
  return tokens[key] as number;
}

describe("scene tokens", () => {
  test("returns the palette colors for each registered palette", () => {
    const palettes: WeatherPalette[] = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
    for (const palette of palettes) {
      const tokens = resolveSceneTokens(state({ palette }), 0.5);
      expect(tokens.bgStart).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.bgMid).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.bgEnd).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.glow).toMatch(/^rgba\(/);
    }
  });

  test("gives storm and rain their own overrides regardless of palette", () => {
    const storm = resolveSceneTokens(state({ condition: "storm", palette: "storm" }), 0.6);
    const rain = resolveSceneTokens(state({ condition: "rain", palette: "storm" }), 0.6);
    expect(storm.bgStart).not.toBe(rain.bgStart);
    expect(storm.cloudCore).not.toBe(rain.cloudCore);
  });

  test("only produces precipitation opacity for matching conditions", () => {
    const conditions: WeatherCondition[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
    const tokens = Object.fromEntries(
      conditions.map((condition) => [condition, resolveSceneTokens(state({ condition }), 0.7)]),
    );

    expect(tokens.rain.rainOpacity).toBeGreaterThan(0);
    expect(tokens.storm.rainOpacity).toBeGreaterThan(tokens.rain.rainOpacity);
    expect(tokens.snow.snowOpacity).toBeGreaterThan(0);
    expect(tokens.fog.fogOpacity).toBeGreaterThan(0);
    expect(tokens.cloudy.cloudOpacity).toBeGreaterThan(tokens.clear.cloudOpacity);

    // A clear sky must not render rain, snow, or fog.
    expect(tokens.clear.rainOpacity).toBe(0);
    expect(tokens.clear.snowOpacity).toBe(0);
    expect(tokens.clear.fogOpacity).toBe(0);
  });

  test("scales atmosphere opacities monotonically with intensity", () => {
    const soft = resolveSceneTokens(state({ condition: "rain" }), 0.1);
    const hard = resolveSceneTokens(state({ condition: "rain" }), 1.4);

    // Rain visibility must grow with intensity; sky should not shrink.
    expect(hard.rainOpacity).toBeGreaterThan(soft.rainOpacity);
    expect(hard.cloudOpacity).toBeGreaterThanOrEqual(soft.cloudOpacity);
  });

  test("keeps every opacity finite and non-negative across the intensity range", () => {
    const palettes: WeatherPalette[] = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
    const conditions: WeatherCondition[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];

    for (const palette of palettes) {
      for (const condition of conditions) {
        for (const intensity of [0, 0.25, 0.5, 1, 1.5, 3, -2, Number.NaN]) {
          const tokens = resolveSceneTokens(state({ palette, condition }), intensity);
          for (const key of OPACITY_KEYS) {
            const value = opacityOf(tokens, key);
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            // Rain deliberately exceeds 1 so overlapping drops brighten, but every
            // layer must stay inside a band the compositor can render sanely.
            expect(value).toBeLessThanOrEqual(1.5);
          }
        }
      }
    }
  });

  test("clamps intensity beyond the supported ceiling", () => {
    const atCeiling = resolveSceneTokens(state({ condition: "rain" }), 1.5);
    const beyond = resolveSceneTokens(state({ condition: "rain" }), 12);
    expect(beyond).toEqual(atCeiling);
  });

  test("only shows motes for a bright clear scene", () => {
    const bright = resolveSceneTokens(state({ condition: "clear", palette: "day" }), 0.6);
    const dim = resolveSceneTokens(state({ condition: "clear", palette: "day" }), 0.3);
    const cloudy = resolveSceneTokens(state({ condition: "cloudy", palette: "day" }), 0.6);

    expect(bright.moteOpacity).toBeGreaterThan(0);
    expect(bright.moteOpacity).toBeGreaterThan(dim.moteOpacity);
    // Overcast scenes keep only a trace of motes rather than the clear-sky amount.
    expect(cloudy.moteOpacity).toBeLessThan(bright.moteOpacity / 4);
  });

  test("matches the palette that derivePalette would choose for a tag", () => {
    // The HUD and the FX layers must never disagree about a scene's phase palette.
    const date = "2026-07-20";
    expect(derivePalette("clear", date, "3:00 PM")).toBe("day");
    const derived = resolveSceneTokens(state({ palette: derivePalette("clear", date, "3:00 PM"), condition: "clear" }), 0.5);
    expect(derived.bgStart).toBe(resolveSceneTokens(state({ palette: "day", condition: "clear" }), 0.5).bgStart);
  });
});
