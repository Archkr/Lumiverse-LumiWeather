import { describe, expect, test } from "bun:test";
import {
  bakeCloudAtlasPixels,
  hasAtmosphereLayerContent,
  parseCssColorToRgba,
  resolveAtmosphereTargetFps,
  resolveAtmosphereUniformTarget,
  resolveBackdropContrastBoost,
} from "./atmosphere-engine";
import {
  ATMOSPHERE_FRAGMENT_SHADER,
  CLOUD_FRAGMENT_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_KIND,
} from "./atmosphere-shaders";
import { DEFAULT_PREFS, makeDefaultWeatherState } from "./shared";
import { resolveSceneTokens } from "./scene-tokens";
import { WEATHER_HUD_CSS } from "./ui/styles";

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

  test("guards mobile highp precision and adapts sky shaders to portrait aspect ratios", () => {
    for (const shader of [
      ATMOSPHERE_FRAGMENT_SHADER,
      CLOUD_FRAGMENT_SHADER,
      PARTICLE_FRAGMENT_SHADER,
    ]) {
      expect(shader).toContain("#ifdef GL_FRAGMENT_PRECISION_HIGH");
      expect(shader).toContain("precision mediump float;");
    }

    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("uniform vec2 u_moonPos;");
    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("auroraAspect");
    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("beamTargetAngle");
  });

  test("paces frame rate by scene motion and throttles unfocused windows", () => {
    const clearNight = {
      ...makeDefaultWeatherState(),
      condition: "clear" as const,
      palette: "night" as const,
      intensity: 0.5,
    };
    const clearBack = resolveAtmosphereUniformTarget(
      clearNight,
      resolveSceneTokens(clearNight, 0.5),
      DEFAULT_PREFS,
      "back",
    );
    expect(
      resolveAtmosphereTargetFps(clearBack, clearNight, {
        windowFocused: true,
        lightningActive: false,
        transitioning: false,
      }),
    ).toBe(15);
    expect(
      resolveAtmosphereTargetFps(clearBack, clearNight, {
        windowFocused: false,
        lightningActive: false,
        transitioning: false,
      }),
    ).toBe(4);

    const storm = {
      ...makeDefaultWeatherState(),
      condition: "storm" as const,
      palette: "storm" as const,
      intensity: 0.9,
    };
    const stormBack = resolveAtmosphereUniformTarget(
      storm,
      resolveSceneTokens(storm, 0.9),
      DEFAULT_PREFS,
      "back",
    );
    expect(
      resolveAtmosphereTargetFps(stormBack, storm, {
        windowFocused: true,
        lightningActive: false,
        transitioning: false,
      }),
    ).toBe(30);
    expect(
      resolveAtmosphereTargetFps(stormBack, storm, {
        windowFocused: true,
        lightningActive: true,
        transitioning: false,
      }),
    ).toBe(60);
  });

  test("detects empty front layers on clear nights so idle canvases stop animating", () => {
    const clearNight = {
      ...makeDefaultWeatherState(),
      condition: "clear" as const,
      palette: "night" as const,
      intensity: 0.6,
    };
    const tokens = resolveSceneTokens(clearNight, 0.6);
    const frontUniforms = resolveAtmosphereUniformTarget(
      clearNight,
      tokens,
      { ...DEFAULT_PREFS, layerMode: "both" },
      "front",
    );
    const backUniforms = resolveAtmosphereUniformTarget(
      clearNight,
      tokens,
      { ...DEFAULT_PREFS, layerMode: "both" },
      "back",
    );

    expect(hasAtmosphereLayerContent(frontUniforms, clearNight, false)).toBe(false);
    expect(hasAtmosphereLayerContent(backUniforms, clearNight, false)).toBe(true);

    const rain = {
      ...makeDefaultWeatherState(),
      condition: "rain" as const,
      palette: "day" as const,
      intensity: 0.8,
    };
    const rainFront = resolveAtmosphereUniformTarget(
      rain,
      resolveSceneTokens(rain, 0.8),
      { ...DEFAULT_PREFS, layerMode: "both" },
      "front",
    );
    expect(hasAtmosphereLayerContent(rainFront, rain, false)).toBe(true);
  });

  test("pre-bakes cloud atlas feathering and rim channels for single-tap shader reads", () => {
    const w = 32;
    const h = 32;
    const src = new Uint8ClampedArray(w * h * 4);
    // Draw a solid white cloud rectangle in the middle of a 1x1 cell
    for (let y = 10; y <= 20; y += 1) {
      for (let x = 8; x <= 23; x += 1) {
        const idx = (y * w + x) * 4;
        src[idx] = 240;
        src[idx + 1] = 240;
        src[idx + 2] = 240;
        src[idx + 3] = 255;
      }
    }

    const baked = bakeCloudAtlasPixels(src, w, h, 1, 1);

    // Transparent corner gets neutral mipmap padding
    expect(baked[0]).toBe(168);
    expect(baked[1]).toBe(128);
    expect(baked[2]).toBe(0);
    expect(baked[3]).toBe(0);

    // Top cloud edge encodes positive top-rim delta (G > 128)
    const topEdgeIdx = (10 * w + 15) * 4;
    expect(baked[topEdgeIdx + 1]).toBeGreaterThan(128);
    expect(baked[topEdgeIdx + 3]).toBeGreaterThan(100);

    // Bottom cloud edge encodes positive bottom-rim (B > 0)
    const bottomEdgeIdx = (20 * w + 15) * 4;
    expect(baked[bottomEdgeIdx + 2]).toBeGreaterThan(0);

    // Cloud fragment shader uses a single atlas texture fetch instead of 5 live taps
    const atlasFetches = CLOUD_FRAGMENT_SHADER.match(/texture2D\s*\(\s*u_atlas/g) ?? [];
    expect(atlasFetches.length).toBe(1);
    // Guard prevents zeroed/premultiplied transparent pixels from decoding a phantom drop-shadow box
    expect(CLOUD_FRAGMENT_SHADER).toContain("baked.g < 0.25");
  });

  test("adapts atmosphere lighting and particle contrast for opaque Lumiverse backgrounds", () => {
    expect(resolveBackdropContrastBoost(0)).toBe(0);
    expect(resolveBackdropContrastBoost(0.35)).toBe(0);
    expect(resolveBackdropContrastBoost(0.675)).toBeCloseTo(0.5, 2);
    expect(resolveBackdropContrastBoost(1)).toBe(1);

    const stormState = {
      ...makeDefaultWeatherState(),
      condition: "storm" as const,
      palette: "night" as const,
      intensity: 0.9,
    };
    const tokens = resolveSceneTokens(stormState, 0.9);
    const subtleBg = resolveAtmosphereUniformTarget(stormState, tokens, DEFAULT_PREFS, "back", 0);
    const opaqueBg = resolveAtmosphereUniformTarget(stormState, tokens, DEFAULT_PREFS, "back", 1);

    expect(subtleBg.backdropBoost).toBe(0);
    expect(subtleBg.backdropDarken).toBe(0);
    expect(opaqueBg.backdropBoost).toBe(1);
    expect(opaqueBg.backdropDarken).toBeGreaterThanOrEqual(0.6);
    expect(opaqueBg.skyOpacity).toBeGreaterThan(subtleBg.skyOpacity + 0.14);
    expect(opaqueBg.cloudOpacity).toBeGreaterThan(subtleBg.cloudOpacity);
    expect(opaqueBg.rainOpacity).toBeGreaterThan(subtleBg.rainOpacity);

    const clearNight = {
      ...makeDefaultWeatherState(),
      condition: "clear" as const,
      palette: "night" as const,
      intensity: 0.6,
    };
    const nightTokens = resolveSceneTokens(clearNight, 0.6);
    const subtleNight = resolveAtmosphereUniformTarget(clearNight, nightTokens, DEFAULT_PREFS, "back", 0);
    const opaqueNight = resolveAtmosphereUniformTarget(clearNight, nightTokens, DEFAULT_PREFS, "back", 1);
    expect(opaqueNight.backdropDarken).toBeGreaterThanOrEqual(0.55);
    expect(opaqueNight.skyOpacity).toBeGreaterThan(subtleNight.skyOpacity + 0.18);

    const clearDay = {
      ...makeDefaultWeatherState(),
      condition: "clear" as const,
      palette: "day" as const,
      intensity: 0.6,
    };
    const opaqueDay = resolveAtmosphereUniformTarget(
      clearDay,
      resolveSceneTokens(clearDay, 0.6),
      DEFAULT_PREFS,
      "back",
      1,
    );
    expect(opaqueDay.backdropDarken).toBeLessThan(0.1);

    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("uniform float u_backdropDarken;");
    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("pearlWeight");
    expect(PARTICLE_FRAGMENT_SHADER).toContain("uniform float u_bgContrast;");
    expect(WEATHER_HUD_CSS).toContain('.weather-fx-root[data-kind="back"] {\n  z-index: 2;\n}');
  });

  test("gates FBM fog in clear skies and strips legacy HUD blur animations and @property rules", () => {
    expect(ATMOSPHERE_FRAGMENT_SHADER).toContain("if (fogStrength > 0.045)");
    expect(WEATHER_HUD_CSS).not.toContain("@property --weather-");
    expect(WEATHER_HUD_CSS).not.toContain("weather-hud-drift");
    expect(WEATHER_HUD_CSS).not.toContain("filter: blur(30px)");
    expect(WEATHER_HUD_CSS).toContain(".weather-hud-botw-track");
  });

  test("keeps rain clouds cool overcast slate without orange dawn/dusk rims", () => {
    for (const palette of ["dawn", "dusk", "day", "night"] as const) {
      const rainState = {
        ...makeDefaultWeatherState(),
        condition: "rain" as const,
        palette,
        intensity: 0.74,
      };
      const uniforms = resolveAtmosphereUniformTarget(
        rainState,
        resolveSceneTokens(rainState, 0.74),
        DEFAULT_PREFS,
        "back",
      );
      expect(uniforms.cloudRimLight[2]).toBeGreaterThan(uniforms.cloudRimLight[0]);
      expect(uniforms.cloudEdge[2]).toBeGreaterThan(uniforms.cloudEdge[0]);
      expect(uniforms.cloudUnderGlow[2]).toBeGreaterThan(uniforms.cloudUnderGlow[0]);
      expect(uniforms.cloudUnderGlowStrength).toBeLessThanOrEqual(0.1);
    }
  });
});
