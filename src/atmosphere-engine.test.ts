import { describe, expect, test } from "bun:test";
import { parseCssColorToRgba, resolveAtmosphereUniformTarget } from "./atmosphere-engine";
import {
  ATMOSPHERE_FRAGMENT_SHADER,
  CLOUD_FRAGMENT_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_KIND,
} from "./atmosphere-shaders";
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

  test("computes warm coral-amber cloud underglow at dusk and deep slate shadows in storms", () => {
    const duskState = {
      ...makeDefaultWeatherState(),
      condition: "cloudy" as const,
      palette: "dusk" as const,
      intensity: 0.85,
    };
    const duskUniforms = resolveAtmosphereUniformTarget(
      duskState,
      resolveSceneTokens(duskState, 0.85),
      DEFAULT_PREFS,
      "back",
    );
    expect(duskUniforms.cloudUnderGlowStrength).toBeGreaterThan(0.4);
    expect(duskUniforms.cloudUnderGlow[0]).toBeGreaterThan(duskUniforms.cloudUnderGlow[2]);

    const stormState = {
      ...makeDefaultWeatherState(),
      condition: "storm" as const,
      palette: "storm" as const,
      intensity: 1,
    };
    const stormUniforms = resolveAtmosphereUniformTarget(
      stormState,
      resolveSceneTokens(stormState, 1),
      DEFAULT_PREFS,
      "back",
    );
    expect(stormUniforms.cloudShadowTint[0]).toBeLessThan(0.15);
    expect(stormUniforms.cloudCore[0]).toBeLessThan(0.35);
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

  test("exposes complete WebGL shader sources and all 17 GPU gradient particle kinds", () => {
    expect(Object.keys(PARTICLE_KIND).length).toBe(17);
    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("fbm4");
    expect(CLOUD_FRAGMENT_SHADER).toContain("u_rimLight");
    expect(CLOUD_FRAGMENT_SHADER).toContain("u_underGlow");
    expect(PARTICLE_FRAGMENT_SHADER).toContain("kind == 16");
  });

  test("resolves rain tilt angle from wind text when windDirection is none and from cardinal direction when set", () => {
    const rainPresetState = {
      ...makeDefaultWeatherState(),
      condition: "rain" as const,
      wind: "steady rainwind",
      windDirection: "none" as const,
      intensity: 0.74,
    };
    const rainPresetUniforms = resolveAtmosphereUniformTarget(
      rainPresetState,
      resolveSceneTokens(rainPresetState, 0.74),
      DEFAULT_PREFS,
      "back",
    );
    expect(rainPresetUniforms.windAngleDeg).toBe(14);

    const westGaleState = {
      ...rainPresetState,
      condition: "storm" as const,
      wind: "hard gusts",
      windDirection: "west" as const,
    };
    const westGaleUniforms = resolveAtmosphereUniformTarget(
      westGaleState,
      resolveSceneTokens(westGaleState, 0.94),
      DEFAULT_PREFS,
      "back",
    );
    expect(westGaleUniforms.windAngleDeg).toBe(-20);

    const calmState = {
      ...rainPresetState,
      wind: "still",
      windDirection: "none" as const,
    };
    const calmUniforms = resolveAtmosphereUniformTarget(
      calmState,
      resolveSceneTokens(calmState, 0.74),
      DEFAULT_PREFS,
      "back",
    );
    expect(calmUniforms.windAngleDeg).toBe(0);
  });
});
