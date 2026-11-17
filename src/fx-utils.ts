import { clamp } from "./shared";
import type { WeatherCondition, WeatherWindDirection } from "./types";

export interface RainParticlePool {
  back: number;
  front: number;
}

export interface RainProfile {
  density: number;
  opacityScale: number;
  speedScale: number;
}

export interface RainVector {
  angle: number;
  driftDirection: -1 | 0 | 1;
}

export interface ViewportFxProfile {
  compact: boolean;
  cloudCountScale: number;
  cloudSizeScale: number;
  cloudMaxWidthNorm: number;
  cloudMaxHeightNorm: number;
  cloudOpacityScale: number;
  particleCountScale: number;
  particleSizeScale: number;
  streakWidthScale: number;
  verticalSpanScale: number;
  moonX: number;
  moonY: number;
  moonHalfSizePx: number;
  frostCornerW: number;
  frostCornerH: number;
  lightningSpreadScale: number;
  lightningWidthScale: number;
}

export function resolveViewportFxProfile(clientW: number, clientH: number): ViewportFxProfile {
  const safeW = Math.max(1, Number.isFinite(clientW) ? clientW : 1);
  const safeH = Math.max(1, Number.isFinite(clientH) ? clientH : 1);
  const compact = safeW < 768;

  const widthScale = clamp(safeW / 1024, 0.38, 1);
  const areaScale = clamp(Math.sqrt((safeW * safeH) / (1180 * 780)), 0.42, 1);
  const particleCountScale = clamp(widthScale * 0.6 + areaScale * 0.4, 0.42, 1);
  const particleSizeScale = clamp(safeW / 760, 0.68, 1);
  const streakWidthScale = clamp(safeW / 900, 0.5, 1);
  const verticalSpanScale = clamp(safeH / 840, 0.72, 1);

  const cloudCountScale = clamp(safeW / 960, 0.44, 1);
  const cloudSizeScale = clamp(safeW / 960, 0.44, 1);
  const cloudMaxWidthNorm = compact ? 0.58 : 0.72;
  const cloudMaxHeightNorm = safeH < 520 ? 0.32 : 0.42;
  const cloudOpacityScale = clamp(0.76 + (safeW / 1024) * 0.24, 0.8, 1);

  const moonHalfSizePx = clamp(Math.min(safeW, safeH) * 0.13, 50, 145);
  const moonX = safeW < 640 ? 0.78 : 0.84;
  const moonY = 0.16;

  const frostCornerW = clamp(safeW * 0.32, 105, 480);
  const frostCornerH = clamp(safeH * 0.25, 110, 320);

  const lightningSpreadScale = compact ? clamp(768 / Math.max(safeW, 300), 1, 1.9) : 1;
  const lightningWidthScale = clamp(safeW / 760, 0.72, 1);

  return {
    compact,
    cloudCountScale,
    cloudSizeScale,
    cloudMaxWidthNorm,
    cloudMaxHeightNorm,
    cloudOpacityScale,
    particleCountScale,
    particleSizeScale,
    streakWidthScale,
    verticalSpanScale,
    moonX,
    moonY,
    moonHalfSizePx,
    frostCornerW,
    frostCornerH,
    lightningSpreadScale,
    lightningWidthScale,
  };
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

function directionFromSource(source: string): -1 | 0 | 1 {
  if (source.includes("west")) return 1;
  if (source.includes("east")) return -1;
  return 0;
}

export function resolveRainVector(wind: string, windDirection?: WeatherWindDirection): RainVector {
  const normalized = wind.trim().toLowerCase();
  const strength = /hurricane|violent|gale|hard|strong|gust/.test(normalized)
    ? 20
    : /steady|breezy|windy|crosswind/.test(normalized)
      ? 14
      : /light|soft|cool drift/.test(normalized)
        ? 9
        : /still|calm|hushed/.test(normalized)
          ? 4
          : 11;

  let driftDirection: -1 | 0 | 1;

  if (windDirection === "none" || windDirection === "north" || windDirection === "south") {
    driftDirection = 0;
  } else if (windDirection) {
    driftDirection = directionFromSource(windDirection);
  } else {
    const target = normalized.match(/\b(?:to|toward|towards|blowing)\s+(?:the\s+)?(left|right|east|west)\b/)?.[1];

    if (target === "right" || target === "east") {
    driftDirection = 1;
    } else if (target === "left" || target === "west") {
      driftDirection = -1;
    } else {
      const source = normalized.match(
        /\bfrom\s+(?:the\s+)?(northeast|northwest|southeast|southwest|north|south|east|west)\b/,
      )?.[1];

      if (source) {
        driftDirection = directionFromSource(source);
      } else if (/\b(?:eastward|rightward)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:westward|leftward)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:westerly|western wind|west wind|northwest|southwest)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:easterly|eastern wind|east wind|northeast|southeast)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:left)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:right)\b/.test(normalized)) {
        driftDirection = 1;
      } else {
        driftDirection = -1;
      }
    }
  }

  return {
    angle: driftDirection === 0 ? 0 : driftDirection > 0 ? -strength : strength,
    driftDirection,
  };
}
