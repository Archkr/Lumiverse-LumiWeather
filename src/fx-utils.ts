import { clamp } from "./shared";
import type { WeatherCondition } from "./types";

export interface RainParticlePool {
  back: number;
  front: number;
}

export interface RainProfile {
  density: number;
  opacityScale: number;
  speedScale: number;
}

export function resolveRainParticlePool(compact: boolean): RainParticlePool {
  return compact ? { back: 60, front: 42 } : { back: 96, front: 72 };
}

export function resolveRainDensityThreshold(index: number, total: number): number {
  if (total <= 0) return 1;
  return clamp((index + 0.5) / total, 0, 1);
}

export function resolveRainProfile(intensity: number, condition: WeatherCondition): RainProfile {
  const rainLike = condition === "rain" || condition === "storm";
  if (!rainLike) {
    return { density: 0, opacityScale: 0, speedScale: 1 };
  }

  const normalizedIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1.5);
  const densityIntensity = clamp(normalizedIntensity, 0, 1);
  const stormBoost = condition === "storm" ? 0.08 : 0;

  return {
    density: clamp(0.15 + 0.9 * densityIntensity + stormBoost, 0.15, 1),
    opacityScale: clamp(0.42 + 0.76 * densityIntensity + stormBoost, 0.25, 1.12),
    speedScale: clamp(1.12 - 0.24 * densityIntensity - stormBoost, 0.76, 1.12),
  };
}
