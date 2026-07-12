import { describe, expect, test } from "bun:test";
import {
  resolveRainDensityThreshold,
  resolveRainParticlePool,
  resolveRainProfile,
  resolveRainVector,
} from "./fx-utils";

describe("weather FX profiles", () => {
  test("selects rear-heavy desktop and compact rain pools", () => {
    expect(resolveRainParticlePool(false)).toEqual({ back: 96, front: 72 });
    expect(resolveRainParticlePool(true)).toEqual({ back: 60, front: 42 });
  });

  test("keeps substantially more rear drops visible at the rain preset intensity", () => {
    const profile = resolveRainProfile(0.74, "rain");
    const desktopBack = resolveRainParticlePool(false).back;
    const compactBack = resolveRainParticlePool(true).back;
    const visibleCount = (total: number) =>
      Array.from({ length: total }, (_, index) => resolveRainDensityThreshold(index, total)).filter(
        (threshold) => threshold <= profile.density,
      ).length;

    expect(visibleCount(desktopBack)).toBe(78);
    expect(visibleCount(compactBack)).toBe(49);
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
  });

  test("maps tagged wind direction to rain angle and horizontal drift", () => {
    expect(resolveRainVector("breezy", "west")).toEqual({ angle: -14, driftDirection: 1 });
    expect(resolveRainVector("strong", "east")).toEqual({ angle: 20, driftDirection: -1 });
    expect(resolveRainVector("light", "north")).toEqual({ angle: 0, driftDirection: 0 });
    expect(resolveRainVector("steady", "southwest")).toEqual({ angle: -14, driftDirection: 1 });
    expect(resolveRainVector("breezy")).toEqual({ angle: 14, driftDirection: -1 });
  });

  test("distributes density thresholds evenly and disables dry conditions", () => {
    expect(resolveRainDensityThreshold(0, 4)).toBeCloseTo(0.125);
    expect(resolveRainDensityThreshold(3, 4)).toBeCloseTo(0.875);
    expect(resolveRainDensityThreshold(0, 0)).toBe(1);
    expect(resolveRainProfile(1, "cloudy")).toEqual({
      density: 0,
      opacityScale: 0,
      speedScale: 1,
    });
  });
});
