import { describe, expect, test } from "bun:test";
import { parseCssColorToRgba, resolveAtmosphereUniformTarget } from "./atmosphere-engine";
import { DEFAULT_PREFS, makeDefaultWeatherState } from "./shared";
import { resolveSceneTokens } from "./scene-tokens";

describe("parseCssColorToRgba", () => {
  test("parses #rgb and #rrggbb hex strings into normalized RGBA tuples", () => {
    const short = parseCssColorToRgba("#0f8");
    expect(short[0]).toBeCloseTo(0, 2);
    expect(short[1]).toBeCloseTo(1, 2);
    expect(short[2]).toBeCloseTo(0.533, 2);
    expect(short[3]).toBe(1);

    const full = parseCssColorToRgba("#10243d");
    expect(full[0]).toBeCloseTo(16 / 255, 3);
    expect(full[1]).toBeCloseTo(36 / 255, 3);
    expect(full[2]).toBeCloseTo(61 / 255, 3);
    expect(full[3]).toBe(1);
  });

  test("parses rgb() and rgba() strings with alpha clamping", () => {
    const rgba = parseCssColorToRgba("rgba(120, 180, 240, 0.42)");
    expect(rgba[0]).toBeCloseTo(120 / 255, 3);
    expect(rgba[1]).toBeCloseTo(180 / 255, 3);
    expect(rgba[2]).toBeCloseTo(240 / 255, 3);
    expect(rgba[3]).toBeCloseTo(0.42, 3);
  });
});

describe("resolveAtmosphereUniformTarget", () => {
  test("renders shader pass on back layer only when layerMode is both, and on front when layerMode is front", () => {
    const state = {
      ...makeDefaultWeatherState(),
      condition: "storm" as const,
      palette: "night" as const,
      date: "2026-10-14",
      time: "23:15",
      intensity: 0.9,
      wind: "gale",
      windDirection: "west" as const,
      exposure: "outdoor" as const,
      phenomenon: "aurora" as const,
    };
    const tokens = resolveSceneTokens(state, 0.9);

    const backInBoth = resolveAtmosphereUniformTarget(
      state,
      tokens,
      { ...DEFAULT_PREFS, layerMode: "both" },
      "back",
    );
    const frontInBoth = resolveAtmosphereUniformTarget(
      state,
      tokens,
      { ...DEFAULT_PREFS, layerMode: "both" },
      "front",
    );
    const frontInFrontOnly = resolveAtmosphereUniformTarget(
      state,
      tokens,
      { ...DEFAULT_PREFS, layerMode: "front" },
      "front",
    );

    expect(backInBoth.renderAtmosphereShader).toBe(true);
    expect(frontInBoth.renderAtmosphereShader).toBe(false);
    expect(frontInFrontOnly.renderAtmosphereShader).toBe(true);
    expect(backInBoth.auroraOpacity).toBeGreaterThan(0);
    expect(frontInBoth.auroraOpacity).toBe(0);
    expect(Math.abs(backInBoth.windVelocityX)).toBeGreaterThan(1.4);
  });

  test("maps sandstorm phenomenon and underground exposure into shader uniform flags", () => {
    const sandstormState = {
      ...makeDefaultWeatherState(),
      condition: "clear" as const,
      palette: "dusk" as const,
      intensity: 0.85,
      exposure: "outdoor" as const,
      phenomenon: "sandstorm" as const,
    };
    const sandstormTokens = resolveSceneTokens(sandstormState, 0.85);
    const sandUniforms = resolveAtmosphereUniformTarget(
      sandstormState,
      sandstormTokens,
      DEFAULT_PREFS,
      "back",
    );
    expect(sandUniforms.isSandstorm).toBe(1);
    expect(sandUniforms.fogOpacity).toBeGreaterThan(0.2);

    const undergroundState = {
      ...makeDefaultWeatherState(),
      condition: "storm" as const,
      palette: "night" as const,
      intensity: 1,
      exposure: "underground" as const,
      phenomenon: "aurora" as const,
    };
    const undergroundTokens = resolveSceneTokens(undergroundState, 1);
    const undergroundUniforms = resolveAtmosphereUniformTarget(
      undergroundState,
      undergroundTokens,
      DEFAULT_PREFS,
      "back",
    );
    expect(undergroundUniforms.isUnderground).toBe(1);
    expect(undergroundUniforms.auroraOpacity).toBe(0);
    expect(undergroundUniforms.starOpacity).toBe(0);
    expect(undergroundUniforms.rainOpacity).toBe(0);
  });
});
