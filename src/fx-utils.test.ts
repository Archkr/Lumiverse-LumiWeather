import { describe, expect, test } from "bun:test";
import {
  resolveRainDensityThreshold,
  resolveRainParticlePool,
  resolveRainProfile,
} from "./fx-utils";

describe("weather FX profiles", () => {
  test("selects balanced desktop and compact rain pools", () => {
    expect(resolveRainParticlePool(false)).toEqual({ back: 48, front: 72 });
    expect(resolveRainParticlePool(true)).toEqual({ back: 28, front: 42 });
  });

  test("clamps intensity and grows rain density monotonically", () => {
    const belowRange = resolveRainProfile(-2, "rain");
    const light = resolveRainProfile(0.25, "rain");
    const steady = resolveRainProfile(0.74, "rain");
    const aboveRange = resolveRainProfile(4, "rain");

    expect(belowRange.density).toBeCloseTo(0.15);
    expect(light.density).toBeLessThan(steady.density);
    expect(steady.density).toBeLessThan(aboveRange.density);
    expect(aboveRange.density).toBe(1);
    expect(aboveRange.opacityScale).toBe(1.12);
    expect(aboveRange.speedScale).toBeLessThan(light.speedScale);
  });

  test("weights storms more heavily than steady rain", () => {
    const rain = resolveRainProfile(0.6, "rain");
    const storm = resolveRainProfile(0.6, "storm");

    expect(storm.density).toBeGreaterThan(rain.density);
    expect(storm.opacityScale).toBeGreaterThan(rain.opacityScale);
    expect(storm.speedScale).toBeLessThan(rain.speedScale);
    expect(storm.sheetOpacity).toBeGreaterThan(rain.sheetOpacity);
  });

  test("distributes density thresholds evenly and disables dry conditions", () => {
    expect(resolveRainDensityThreshold(0, 4)).toBeCloseTo(0.125);
    expect(resolveRainDensityThreshold(3, 4)).toBeCloseTo(0.875);
    expect(resolveRainDensityThreshold(0, 0)).toBe(1);
    expect(resolveRainProfile(1, "cloudy")).toEqual({
      density: 0,
      opacityScale: 0,
      speedScale: 1,
      sheetOpacity: 0,
    });
  });
});
