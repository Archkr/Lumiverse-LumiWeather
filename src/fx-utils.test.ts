import { describe, expect, test } from "bun:test";
import {
  resolveRainDensityThreshold,
  resolveRainParticlePool,
  resolveRainProfile,
  resolveRainVector,
  resolveViewportFxProfile,
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

  test("scales clouds, particles, frost, moon, and lightning cleanly for portrait mobile", () => {
    const desktop = resolveViewportFxProfile(1440, 900);
    expect(desktop.compact).toBe(false);
    expect(desktop.particleCountScale).toBe(1);
    expect(desktop.cloudCountScale).toBe(1);
    expect(desktop.cloudSizeScale).toBe(1);
    expect(desktop.moonX).toBe(0.84);
    expect(desktop.lightningSpreadScale).toBe(1);

    for (const [w, h] of [
      [390, 844],
      [360, 740],
      [320, 568],
    ] as const) {
      const mobile = resolveViewportFxProfile(w, h);
      expect(mobile.compact).toBe(true);
      expect(mobile.particleCountScale).toBeLessThan(0.55);
      expect(mobile.particleSizeScale).toBeLessThan(0.75);
      expect(mobile.cloudCountScale).toBeLessThan(0.5);
      expect(mobile.cloudSizeScale).toBeLessThan(0.5);
      expect(mobile.cloudMaxWidthNorm).toBe(0.58);
      expect(mobile.streakWidthScale).toBe(0.5);

      // Moon disc fits inside top-right bounds with zero edge clipping
      expect(mobile.moonX * w + mobile.moonHalfSizePx).toBeLessThan(w);
      expect(mobile.moonY * h - mobile.moonHalfSizePx).toBeGreaterThanOrEqual(0);

      // Left and right corner frost quads leave an unobstructed central chat band
      expect(mobile.frostCornerW * 2).toBeLessThan(w * 0.68);
      expect(mobile.frostCornerH * 2).toBeLessThan(h * 0.55);

      // Lightning branches widen horizontally relative to narrow viewport while keeping slim strokes
      expect(mobile.lightningSpreadScale).toBeGreaterThan(1.5);
      expect(mobile.lightningWidthScale).toBeLessThan(0.8);
    }
  });

  test("caps cloud height and vertical particle span in mobile landscape viewports", () => {
    const landscape = resolveViewportFxProfile(844, 390);
    expect(landscape.cloudMaxHeightNorm).toBe(0.32);
    expect(landscape.verticalSpanScale).toBe(0.72);
    expect(landscape.moonX * 844 + landscape.moonHalfSizePx).toBeLessThan(844);
    expect(landscape.moonY * 390 - landscape.moonHalfSizePx).toBeGreaterThanOrEqual(0);
    expect(landscape.frostCornerW * 2).toBeLessThan(844 * 0.68);
  });
});
