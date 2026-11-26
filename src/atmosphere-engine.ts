import cloud1 from "./assets/cloud_1.png";
import cloud2 from "./assets/cloud_2.png";
import cloud3 from "./assets/cloud_3.png";
import cloud4 from "./assets/cloud_4.png";
import cloud5 from "./assets/cloud_5.png";
import cloud6 from "./assets/cloud_6.png";
import {
  ATMOSPHERE_FRAGMENT_SHADER,
  ATMOSPHERE_VERTEX_SHADER,
  BLIT_FRAGMENT_SHADER,
  BLIT_VERTEX_SHADER,
  CLOUD_FRAGMENT_SHADER,
  CLOUD_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_KIND,
  PARTICLE_VERTEX_SHADER,
} from "./atmosphere-shaders";
import {
  resolveRainProfile,
  resolveRainVector,
  resolveViewportFxProfile,
  type ViewportFxProfile,
} from "./fx-utils";
import { clamp } from "./shared";
import { resolveLunarPhase, resolveSolarArc } from "./time-utils";
import type {
  SceneTokens,
  WeatherCondition,
  WeatherExposure,
  WeatherPalette,
  WeatherPhenomenon,
  WeatherPrefs,
  WeatherState,
} from "./types";

const CLOUD_SOURCES = [cloud1, cloud2, cloud3, cloud4, cloud5, cloud6] as const;
const ATLAS_SIZE = 1024;
const ATLAS_COLS = 2;
const ATLAS_ROWS = 3;

export type RgbaTuple = readonly [number, number, number, number];

export interface AtmosphereUniforms {
  bgStart: RgbaTuple;
  bgMid: RgbaTuple;
  bgEnd: RgbaTuple;
  glow: RgbaTuple;
  beamColor: RgbaTuple;
  horizonColor: RgbaTuple;
  cloudCore: RgbaTuple;
  cloudEdge: RgbaTuple;
  fogColor: RgbaTuple;
  mistColor: RgbaTuple;
  cloudRimLight: RgbaTuple;
  cloudUnderGlow: RgbaTuple;
  cloudShadowTint: RgbaTuple;
  cloudUnderGlowStrength: number;
  cloudDetailStrength: number;
  skyOpacity: number;
  glowOpacity: number;
  beamOpacity: number;
  cloudOpacity: number;
  horizonOpacity: number;
  mistOpacity: number;
  fogOpacity: number;
  rainOpacity: number;
  snowOpacity: number;
  moteOpacity: number;
  starOpacity: number;
  moonlightOpacity: number;
  auroraOpacity: number;
  windowDropletOpacity: number;
  phenomenonOpacity: number;
  flashOpacity: number;
  sunAltitude: number;
  moonIllumination: number;
  moonPhaseFraction: number;
  windVelocityX: number;
  windAngleDeg: number;
  rainDensity: number;
  rainSpeedScale: number;
  isSandstorm: number;
  isIndoor: number;
  isUnderground: number;
  backdropBoost: number;
  renderAtmosphereShader: boolean;
}

export interface AtmosphereUpdateOptions {
  state: WeatherState;
  tokens: SceneTokens;
  prefs: WeatherPrefs;
  kind: "back" | "front";
  visible: boolean;
  reducedMotion: boolean;
  paused: boolean;
}

/**
 * Parses `#rgb`, `#rrggbb`, `rgb(...)`, or `rgba(...)` strings from `SceneTokens`
 * into normalized `[0..1, 0..1, 0..1, 0..1]` tuples for WebGL shader uniforms.
 */
export function parseCssColorToRgba(input: string): RgbaTuple {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
      const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
      const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
      return [
        Number.isFinite(r) ? r : 0,
        Number.isFinite(g) ? g : 0,
        Number.isFinite(b) ? b : 0,
        1,
      ];
    }
    if (hex.length >= 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      return [
        Number.isFinite(r) ? r : 0,
        Number.isFinite(g) ? g : 0,
        Number.isFinite(b) ? b : 0,
        1,
      ];
    }
  }

  const match = trimmed.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (match) {
    const r = clamp(Number.parseFloat(match[1]) / 255, 0, 1);
    const g = clamp(Number.parseFloat(match[2]) / 255, 0, 1);
    const b = clamp(Number.parseFloat(match[3]) / 255, 0, 1);
    const a = match[4] !== undefined ? clamp(Number.parseFloat(match[4]), 0, 1) : 1;
    return [r, g, b, a];
  }

  return [0.5, 0.6, 0.75, 1];
}

function resolveWindSpeedScalar(wind: string): number {
  const normalized = wind.trim().toLowerCase();
  if (/hurricane|violent|gale|hard|strong|gust/.test(normalized)) return 1.85;
  if (/steady|breezy|windy|crosswind|brisk/.test(normalized)) return 1.15;
  if (/light|soft|cool drift|gentle/.test(normalized)) return 0.65;
  if (/still|calm|hushed|none/.test(normalized)) return 0.25;
  return 0.85;
}

function mixRgb(a: RgbaTuple, b: RgbaTuple, t: number, alpha = 1): RgbaTuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    alpha,
  ];
}

function resolveCloudLightingPalette(
  palette: WeatherPalette,
  condition: WeatherCondition,
  bgStart: RgbaTuple,
  bgEnd: RgbaTuple,
  glow: RgbaTuple,
  cloudCore: RgbaTuple,
  cloudEdge: RgbaTuple,
): {
  core: RgbaTuple;
  edge: RgbaTuple;
  rimLight: RgbaTuple;
  underGlow: RgbaTuple;
  shadowTint: RgbaTuple;
  underGlowStrength: number;
  detailStrength: number;
} {
  const isStorm = condition === "storm";
  const isRain = condition === "rain";

  let core = cloudCore;
  let edge = cloudEdge;
  let rimLight: RgbaTuple = mixRgb(cloudEdge, glow, 0.45);
  let underGlow: RgbaTuple = bgEnd;
  let shadowTint: RgbaTuple = mixRgb(bgStart, [0.05, 0.1, 0.18, 1], 0.45);
  let underGlowStrength = 0.08;
  let detailStrength = isStorm ? 0.18 : isRain ? 0.22 : 0.28;

  if (isRain) {
    // Rain clouds stay cool overcast slate-blue across every time-of-day palette
    // instead of picking up warm orange dawn/dusk sunset rims.
    const isNightRain = palette === "night";
    core = isNightRain
      ? [0.24, 0.32, 0.43, cloudCore[3]]
      : [0.34, 0.42, 0.52, cloudCore[3]];
    edge = isNightRain
      ? [0.46, 0.56, 0.70, cloudEdge[3]]
      : [0.60, 0.69, 0.80, cloudEdge[3]];
    rimLight = isNightRain
      ? [0.58, 0.70, 0.86, 1]
      : [0.74, 0.82, 0.91, 1];
    underGlow = isNightRain
      ? [0.16, 0.24, 0.36, 1]
      : [0.34, 0.44, 0.56, 1];
    shadowTint = isNightRain
      ? [0.06, 0.10, 0.18, 1]
      : [0.15, 0.22, 0.32, 1];
    underGlowStrength = 0.08;
  } else if (palette === "dawn" && !isStorm) {
    core = mixRgb(cloudCore, [0.84, 0.78, 0.86, 1], 0.35, cloudCore[3]);
    edge = mixRgb(cloudEdge, [1.0, 0.88, 0.74, 1], 0.48, cloudEdge[3]);
    rimLight = [1.0, 0.87, 0.7, 1];
    underGlow = [0.98, 0.68, 0.48, 1];
    shadowTint = [0.22, 0.26, 0.44, 1];
    underGlowStrength = 0.46;
  } else if (palette === "dusk" && !isStorm) {
    core = mixRgb(cloudCore, [0.68, 0.6, 0.76, 1], 0.42, cloudCore[3]);
    edge = mixRgb(cloudEdge, [1.0, 0.76, 0.62, 1], 0.46, cloudEdge[3]);
    rimLight = [1.0, 0.78, 0.6, 1];
    underGlow = [0.96, 0.56, 0.42, 1];
    shadowTint = [0.18, 0.15, 0.34, 1];
    underGlowStrength = 0.52;
  } else if (palette === "night" || isStorm) {
    core = isStorm
      ? [0.22, 0.29, 0.38, cloudCore[3]]
      : mixRgb([0.2, 0.28, 0.42, 1], cloudCore, 0.28, cloudCore[3]);
    edge = isStorm
      ? [0.46, 0.56, 0.68, cloudEdge[3]]
      : [0.58, 0.7, 0.88, cloudEdge[3]];
    rimLight = isStorm ? [0.62, 0.76, 0.94, 1] : [0.74, 0.85, 1.0, 1];
    underGlow = [0.16, 0.24, 0.38, 1];
    shadowTint = [0.04, 0.08, 0.15, 1];
    underGlowStrength = 0.1;
  } else if (palette === "snow") {
    core = [0.91, 0.94, 0.98, cloudCore[3]];
    edge = [1.0, 1.0, 1.0, cloudEdge[3]];
    rimLight = [1.0, 0.99, 0.97, 1];
    shadowTint = [0.46, 0.56, 0.68, 1];
    detailStrength = 0.3;
  } else {
    // Day / mist
    rimLight = [1.0, 0.99, 0.95, 1];
    shadowTint = [0.36, 0.48, 0.64, 1];
  }

  return {
    core,
    edge,
    rimLight,
    underGlow,
    shadowTint,
    underGlowStrength,
    detailStrength,
  };
}

/**
 * Converts Lumiverse's active wallpaper / scene background opacity (`0..1`) into
 * an adaptive contrast & lighting boost (`0..1`). Default subtle backdrops (`<= 0.35`)
 * receive `0` boost so dark themes keep their light touch; opaque backdrops (`0.35..1.0`)
 * ramp smoothly up to `1.0` so weather lighting, clouds, and precipitation remain crisp.
 */
export function resolveBackdropContrastBoost(backdropOpacity: number): number {
  if (!Number.isFinite(backdropOpacity) || backdropOpacity <= 0.35) return 0;
  return clamp((backdropOpacity - 0.35) / 0.65, 0, 1);
}

/**
 * Samples the highest active wallpaper or scene background opacity (`0..1`) behind
 * the weather layer inside Lumiverse's `ChatView` (or global fixed `WallpaperLayer`).
 */
export function measureHostBackgroundOpacity(root: HTMLElement | null): number {
  if (!root || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return 0;
  }

  let maxOpacity = 0;
  const inspectLayer = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.classList.contains("weather-fx-root")) return;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const opacity = Number.parseFloat(style.opacity || "0");
    if (!Number.isFinite(opacity) || opacity <= 0.01) return;
    const isVideo = el.tagName === "VIDEO";
    const hasBgImage = Boolean(style.backgroundImage && style.backgroundImage !== "none");
    if (!isVideo && !hasBgImage) return;
    if (opacity > maxOpacity) {
      maxOpacity = clamp(opacity, 0, 1);
    }
  };

  const inspectContainerChildren = (container: Element | null) => {
    if (!container) return;
    for (let i = 0; i < container.children.length; i += 1) {
      const child = container.children[i];
      if (child === root || child.classList.contains("weather-fx-root")) continue;
      if (child instanceof HTMLElement) {
        const z = window.getComputedStyle(child).zIndex;
        if (z === "0" || child.className.includes("sceneBackgroundLayer") || child.tagName === "VIDEO") {
          inspectLayer(child);
        }
      }
    }
  };

  const chatView = root.closest('[data-component="ChatView"]') ?? root.parentElement;
  if (chatView) {
    inspectLayer(chatView.querySelector('[class*="sceneBackgroundLayer"]'));
    inspectContainerChildren(chatView);
  }

  if (maxOpacity < 0.99 && typeof document !== "undefined") {
    const globalSceneBg = document.querySelector('[class*="sceneBackgroundLayer"]');
    inspectLayer(globalSceneBg);
    if (globalSceneBg?.parentElement && globalSceneBg.parentElement !== chatView) {
      inspectContainerChildren(globalSceneBg.parentElement);
    }
    const fixedLayers = document.querySelectorAll('[class*="fixed"]');
    for (let i = 0; i < fixedLayers.length; i += 1) {
      const candidate = fixedLayers[i];
      if (!(candidate instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(candidate);
      if (style.position === "fixed" && style.zIndex === "0") {
        inspectLayer(candidate);
      }
    }
  }

  return maxOpacity;
}

/**
 * Resolves the complete GPU shader & particle uniform target for a layer.
 * In `layerMode === "both"`, the offscreen atmosphere FBO pass runs only on `back`
 * while `front` renders crisp foreground parallax particles, wisps, and windowpane droplets.
 */
export function resolveAtmosphereUniformTarget(
  state: WeatherState,
  tokens: SceneTokens,
  prefs: WeatherPrefs,
  kind: "back" | "front",
  backdropBoost = 0,
): AtmosphereUniforms {
  const safeBackdropBoost = clamp(Number.isFinite(backdropBoost) ? backdropBoost : 0, 0, 1);
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const effectiveWindDirection =
    state.windDirection === "none" && !/\b(still|calm|hushed|none)\b/i.test(state.wind)
      ? undefined
      : state.windDirection;
  const rainVector = resolveRainVector(state.wind, effectiveWindDirection);
  const solar = resolveSolarArc(state.date, state.time);
  const lunar = resolveLunarPhase(state.date, state.time);
  const exposure: WeatherExposure = state.exposure ?? "outdoor";
  const phenomenon: WeatherPhenomenon = state.phenomenon ?? "none";
  const isFront = kind === "front";
  const isBoth = prefs.layerMode === "both";

  const windSpeed = resolveWindSpeedScalar(state.wind);
  const windDirSign = rainVector.driftDirection === 0 ? 0.35 : rainVector.driftDirection;
  const windVelocityX =
    windSpeed * windDirSign * (exposure === "indoor" ? 0.35 : exposure === "underground" ? 0.15 : 1);

  const renderAtmosphereShader = !isFront || !isBoth;

  const bgStart = parseCssColorToRgba(tokens.bgStart);
  const bgMid = parseCssColorToRgba(tokens.bgMid);
  const bgEnd = parseCssColorToRgba(tokens.bgEnd);
  const glow = parseCssColorToRgba(tokens.glow);
  const beamColor = parseCssColorToRgba(tokens.beamColor);
  const horizonColor = parseCssColorToRgba(tokens.horizonColor);
  const rawCloudCore = parseCssColorToRgba(tokens.cloudCore);
  const rawCloudEdge = parseCssColorToRgba(tokens.cloudEdge);
  const fogColor = parseCssColorToRgba(tokens.fogColor);
  const mistColor = parseCssColorToRgba(tokens.mistColor);

  const cloudPalette = resolveCloudLightingPalette(
    state.palette,
    state.condition,
    bgStart,
    bgEnd,
    glow,
    rawCloudCore,
    rawCloudEdge,
  );

  // When Lumiverse's wallpaper/scene background is opaque (e.g. 100%), lift atmospheric
  // lighting grade, cloud density, and precipitation contrast so night/storm/dusk moods
  // and particles remain clearly visible over vivid artwork.
  const exposureLiftScale = exposure === "underground" ? 0.28 : exposure === "indoor" ? 0.52 : 1;
  const bgLift = safeBackdropBoost * exposureLiftScale;
  let skyOpacityLift = 0;
  let horizonOpacityLift = 0;
  let glowOpacityLift = 0;
  let beamOpacityLift = 0;
  let fogOpacityLift = 0;
  let mistOpacityLift = 0;

  if (bgLift > 0.001) {
    if (state.condition === "storm") {
      skyOpacityLift = 0.34 * bgLift;
      horizonOpacityLift = 0.10 * bgLift;
      mistOpacityLift = 0.08 * bgLift;
    } else if (state.palette === "night") {
      skyOpacityLift = (state.condition === "clear" ? 0.36 : 0.30) * bgLift;
      horizonOpacityLift = 0.08 * bgLift;
    } else if (state.condition === "rain") {
      skyOpacityLift = 0.24 * bgLift;
      mistOpacityLift = 0.08 * bgLift;
    } else if (state.palette === "dusk" || state.palette === "dawn") {
      skyOpacityLift = 0.18 * bgLift;
      horizonOpacityLift = 0.16 * bgLift;
      glowOpacityLift = 0.10 * bgLift;
    } else if (state.condition === "fog") {
      skyOpacityLift = 0.14 * bgLift;
      fogOpacityLift = 0.14 * bgLift;
      mistOpacityLift = 0.12 * bgLift;
    } else if (state.condition === "cloudy" || state.condition === "snow") {
      skyOpacityLift = 0.12 * bgLift;
      mistOpacityLift = 0.06 * bgLift;
    } else {
      skyOpacityLift = 0.06 * bgLift;
      glowOpacityLift = 0.14 * bgLift;
      beamOpacityLift = 0.14 * bgLift;
    }
  }

  const boostedCloudOpacity =
    tokens.cloudOpacity >= 0.05
      ? clamp(tokens.cloudOpacity + 0.14 * bgLift, 0, 1.15)
      : tokens.cloudOpacity;
  const particleBoost = 1 + 0.22 * safeBackdropBoost;

  return {
    bgStart,
    bgMid,
    bgEnd,
    glow,
    beamColor,
    horizonColor,
    cloudCore: cloudPalette.core,
    cloudEdge: cloudPalette.edge,
    fogColor,
    mistColor,
    cloudRimLight: cloudPalette.rimLight,
    cloudUnderGlow: cloudPalette.underGlow,
    cloudShadowTint: cloudPalette.shadowTint,
    cloudUnderGlowStrength: cloudPalette.underGlowStrength,
    cloudDetailStrength: cloudPalette.detailStrength,
    skyOpacity: isFront && isBoth ? 0 : clamp(tokens.skyOpacity + skyOpacityLift, 0, 0.72),
    glowOpacity: isFront && isBoth ? 0 : clamp(tokens.glowOpacity + glowOpacityLift, 0, 0.85),
    beamOpacity: isFront && isBoth ? 0 : clamp(tokens.beamOpacity + beamOpacityLift, 0, 0.78),
    cloudOpacity: isFront && isBoth
      ? (tokens.cloudOpacity >= 0.08 ? boostedCloudOpacity * 0.26 : 0)
      : boostedCloudOpacity,
    horizonOpacity: isFront && isBoth ? 0 : clamp(tokens.horizonOpacity + horizonOpacityLift, 0, 0.75),
    mistOpacity: isFront && isBoth
      ? tokens.mistOpacity * 0.32
      : clamp(tokens.mistOpacity + mistOpacityLift, 0, 0.75),
    fogOpacity: isFront && isBoth
      ? tokens.fogOpacity * 0.28
      : clamp(tokens.fogOpacity + fogOpacityLift, 0, 0.92),
    rainOpacity: clamp(tokens.rainOpacity * (1 + 0.24 * safeBackdropBoost), 0, 1.4),
    snowOpacity: clamp(tokens.snowOpacity * particleBoost, 0, 1.25),
    moteOpacity: isFront && isBoth
      ? tokens.moteOpacity * 0.48 * particleBoost
      : tokens.moteOpacity * particleBoost,
    starOpacity: isFront && isBoth ? 0 : clamp(tokens.starOpacity * particleBoost, 0, 1.25),
    moonlightOpacity: isFront && isBoth ? 0 : clamp(tokens.moonlightOpacity * (1 + 0.18 * safeBackdropBoost), 0, 1.1),
    auroraOpacity: isFront && isBoth ? 0 : clamp(tokens.auroraOpacity * (1 + 0.24 * safeBackdropBoost), 0, 1.25),
    windowDropletOpacity: clamp(tokens.windowDropletOpacity * particleBoost, 0, 1.25),
    phenomenonOpacity: clamp(tokens.phenomenonOpacity * particleBoost, 0, 1.25),
    flashOpacity: tokens.flashOpacity,
    sunAltitude: solar.sunAltitude,
    moonIllumination: lunar.illumination,
    moonPhaseFraction: lunar.cycleFraction,
    windVelocityX,
    windAngleDeg: rainVector.angle,
    rainDensity: rainProfile.density,
    rainSpeedScale: rainProfile.speedScale,
    isSandstorm: phenomenon === "sandstorm" ? 1 : 0,
    isIndoor: exposure === "indoor" ? 1 : 0,
    isUnderground: exposure === "underground" ? 1 : 0,
    backdropBoost: safeBackdropBoost,
    renderAtmosphereShader,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgba(a: RgbaTuple, b: RgbaTuple, t: number): RgbaTuple {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t),
  ];
}

function interpolateUniforms(from: AtmosphereUniforms, to: AtmosphereUniforms, t: number): AtmosphereUniforms {
  if (t >= 0.999) return to;
  if (t <= 0.001) return from;
  const ease = t * t * (3 - 2 * t);
  return {
    bgStart: lerpRgba(from.bgStart, to.bgStart, ease),
    bgMid: lerpRgba(from.bgMid, to.bgMid, ease),
    bgEnd: lerpRgba(from.bgEnd, to.bgEnd, ease),
    glow: lerpRgba(from.glow, to.glow, ease),
    beamColor: lerpRgba(from.beamColor, to.beamColor, ease),
    horizonColor: lerpRgba(from.horizonColor, to.horizonColor, ease),
    cloudCore: lerpRgba(from.cloudCore, to.cloudCore, ease),
    cloudEdge: lerpRgba(from.cloudEdge, to.cloudEdge, ease),
    fogColor: lerpRgba(from.fogColor, to.fogColor, ease),
    mistColor: lerpRgba(from.mistColor, to.mistColor, ease),
    cloudRimLight: lerpRgba(from.cloudRimLight, to.cloudRimLight, ease),
    cloudUnderGlow: lerpRgba(from.cloudUnderGlow, to.cloudUnderGlow, ease),
    cloudShadowTint: lerpRgba(from.cloudShadowTint, to.cloudShadowTint, ease),
    cloudUnderGlowStrength: lerp(from.cloudUnderGlowStrength, to.cloudUnderGlowStrength, ease),
    cloudDetailStrength: lerp(from.cloudDetailStrength, to.cloudDetailStrength, ease),
    skyOpacity: lerp(from.skyOpacity, to.skyOpacity, ease),
    glowOpacity: lerp(from.glowOpacity, to.glowOpacity, ease),
    beamOpacity: lerp(from.beamOpacity, to.beamOpacity, ease),
    cloudOpacity: lerp(from.cloudOpacity, to.cloudOpacity, ease),
    horizonOpacity: lerp(from.horizonOpacity, to.horizonOpacity, ease),
    mistOpacity: lerp(from.mistOpacity, to.mistOpacity, ease),
    fogOpacity: lerp(from.fogOpacity, to.fogOpacity, ease),
    rainOpacity: lerp(from.rainOpacity, to.rainOpacity, ease),
    snowOpacity: lerp(from.snowOpacity, to.snowOpacity, ease),
    moteOpacity: lerp(from.moteOpacity, to.moteOpacity, ease),
    starOpacity: lerp(from.starOpacity, to.starOpacity, ease),
    moonlightOpacity: lerp(from.moonlightOpacity, to.moonlightOpacity, ease),
    auroraOpacity: lerp(from.auroraOpacity, to.auroraOpacity, ease),
    windowDropletOpacity: lerp(from.windowDropletOpacity, to.windowDropletOpacity, ease),
    phenomenonOpacity: lerp(from.phenomenonOpacity, to.phenomenonOpacity, ease),
    flashOpacity: lerp(from.flashOpacity, to.flashOpacity, ease),
    sunAltitude: lerp(from.sunAltitude, to.sunAltitude, ease),
    moonIllumination: lerp(from.moonIllumination, to.moonIllumination, ease),
    moonPhaseFraction: to.moonPhaseFraction,
    windVelocityX: lerp(from.windVelocityX, to.windVelocityX, ease),
    windAngleDeg: lerp(from.windAngleDeg, to.windAngleDeg, ease),
    rainDensity: lerp(from.rainDensity, to.rainDensity, ease),
    rainSpeedScale: lerp(from.rainSpeedScale, to.rainSpeedScale, ease),
    isSandstorm: lerp(from.isSandstorm, to.isSandstorm, ease),
    isIndoor: lerp(from.isIndoor, to.isIndoor, ease),
    isUnderground: lerp(from.isUnderground, to.isUnderground, ease),
    backdropBoost: lerp(from.backdropBoost, to.backdropBoost, ease),
    renderAtmosphereShader: to.renderAtmosphereShader,
  };
}

/**
 * Realistic multi-restrike lightning brightness envelope (680ms total),
 * matching classic thunderhead double-flash dynamics.
 */
function evaluateLightningFlicker(ageSec: number): number {
  if (ageSec < 0 || ageSec > 0.68) return 0;
  if (ageSec < 0.04) return ageSec / 0.04;
  if (ageSec < 0.11) return 1.0 - ((ageSec - 0.04) / 0.07) * 0.78;
  if (ageSec < 0.17) return 0.22 + ((ageSec - 0.11) / 0.06) * 0.74;
  if (ageSec < 0.28) return 0.96 - ((ageSec - 0.17) / 0.11) * 0.58;
  if (ageSec < 0.35) return 0.38 + ((ageSec - 0.28) / 0.07) * 0.26;
  return 0.64 * Math.pow(1.0 - (ageSec - 0.35) / 0.33, 1.8);
}

function smoothstepJs(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Pre-bakes the 5-tap cloud feathering, interior puff luminance relief, and
 * top/bottom contour rim channels once on the CPU during atlas creation so
 * `CLOUD_FRAGMENT_SHADER` executes a single `texture2D()` fetch per fragment
 * instead of 5 trilinear taps per pixel across 20+ overlapping clouds.
 *
 * Channel layout:
 * - R: interior puff relief `[0.55..1.08]` normalized to `[0..255]`
 * - G: signed upper-edge delta `0.5 + (softAlpha - aUp) * 0.5` (encodes both topRim & dropShadow)
 * - B: lower-edge rim `clamp((softAlpha - aDown) * 2.1, 0, 1)`
 * - A: feathered `softAlpha`
 */
export function bakeCloudAtlasPixels(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  cols = ATLAS_COLS,
  rows = ATLAS_ROWS,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const stepX = Math.max(1, Math.round(width * 0.006));
  const stepY = Math.max(1, Math.round(height * 0.0085));

  for (let row = 0; row < rows; row += 1) {
    const y0 = row * cellH;
    const y1 = Math.min(height - 1, (row + 1) * cellH - 1);
    for (let col = 0; col < cols; col += 1) {
      const x0 = col * cellW;
      const x1 = Math.min(width - 1, (col + 1) * cellW - 1);

      for (let y = y0; y <= y1; y += 1) {
        const yUp = Math.max(y0, y - stepY);
        const yDown = Math.min(y1, y + stepY);
        const rowOff = y * width;
        const upOff = yUp * width;
        const downOff = yDown * width;

        for (let x = x0; x <= x1; x += 1) {
          const xLeft = Math.max(x0, x - stepX);
          const xRight = Math.min(x1, x + stepX);
          const idx = (rowOff + x) * 4;

          const cA = src[idx + 3] / 255;
          const aUp = src[(upOff + x) * 4 + 3] / 255;
          const aDown = src[(downOff + x) * 4 + 3] / 255;
          const aLeft = src[(rowOff + xLeft) * 4 + 3] / 255;
          const aRight = src[(rowOff + xRight) * 4 + 3] / 255;

          const softAlpha = cA * 0.44 + (aUp + aDown + aLeft + aRight) * 0.14;

          if (softAlpha <= 0 && aUp <= 0 && aDown <= 0) {
            // Neutral padding prevents dark or glowing fringes during mipmap filtering.
            out[idx] = 168; // 0.90 relief
            out[idx + 1] = 128; // 0.5 neutral delta
            out[idx + 2] = 0;
            out[idx + 3] = 0;
            continue;
          }

          const rawLuma = (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255;
          const interiorMask = smoothstepJs(0.32, 0.88, cA);
          const puffRelief = lerp(0.9, clamp(rawLuma * 1.06, 0.55, 1.08), interiorMask);

          out[idx] = Math.round(clamp((puffRelief - 0.55) / 0.53, 0, 1) * 255);
          out[idx + 1] = Math.round(clamp(0.5 + (softAlpha - aUp) * 0.5, 0, 1) * 255);
          out[idx + 2] = Math.round(clamp((softAlpha - aDown) * 2.1, 0, 1) * 255);
          out[idx + 3] = Math.round(clamp(softAlpha, 0, 1) * 255);
        }
      }
    }
  }

  return out;
}

export interface AtmospherePacingOptions {
  windowFocused: boolean;
  lightningActive: boolean;
  transitioning: boolean;
}

/**
 * Returns true if the layer has any visible elements to draw in the current scene.
 * Empty layers (e.g. `front` during a clear night in `both` mode) pause their rAF
 * loop completely instead of clearing and presenting blank 1M+ pixel canvases.
 */
export function hasAtmosphereLayerContent(
  u: AtmosphereUniforms,
  state: WeatherState,
  lightningActive: boolean,
): boolean {
  if (u.renderAtmosphereShader) return true;
  if (lightningActive) return true;
  if (u.cloudOpacity > 0.005 && u.isUnderground < 0.5) return true;
  if (u.starOpacity > 0.005 || u.moonlightOpacity > 0.005) return true;
  if (u.rainOpacity > 0.01 && u.rainDensity > 0.01 && u.isUnderground < 0.5) return true;
  if (u.snowOpacity > 0.01 && u.isUnderground < 0.5) return true;

  const phenomenon: WeatherPhenomenon = state.phenomenon ?? "none";
  const exposure: WeatherExposure = state.exposure ?? "outdoor";
  if (u.moteOpacity > 0.008 && phenomenon === "none") return true;
  if (u.phenomenonOpacity > 0.01 && phenomenon !== "none" && phenomenon !== "aurora") return true;
  if (u.windowDropletOpacity > 0.01 && exposure === "indoor") return true;

  const condition = state.condition;
  if (
    exposure !== "underground" &&
    exposure !== "indoor" &&
    (condition === "cloudy" || condition === "rain" || condition === "storm" || phenomenon === "sandstorm")
  ) {
    return true;
  }

  return false;
}

/**
 * Selects an energy-aware target frame rate matched to the visual motion speed
 * of the active weather scene, avoiding wasteful 120-144 Hz rendering and
 * backdrop-filter invalidation on calm skies or unfocused laptop windows.
 */
export function resolveAtmosphereTargetFps(
  u: AtmosphereUniforms,
  state: WeatherState,
  options: AtmospherePacingOptions,
): number {
  if (options.lightningActive) return 60;
  if (!options.windowFocused) return options.transitioning ? 15 : 4;
  if (options.transitioning) return 30;

  const phenomenon: WeatherPhenomenon = state.phenomenon ?? "none";
  const exposure: WeatherExposure = state.exposure ?? "outdoor";
  const hasFastRain = u.rainOpacity > 0.01 && u.rainDensity > 0.01 && u.isUnderground < 0.5;
  const hasSnow = u.snowOpacity > 0.01 && u.isUnderground < 0.5;
  const hasFastPhenomenon = u.phenomenonOpacity > 0.01 && phenomenon !== "none" && phenomenon !== "aurora";
  const hasWindowDrops = u.windowDropletOpacity > 0.01 && exposure === "indoor";

  if (hasFastRain || hasSnow || hasFastPhenomenon || hasWindowDrops) {
    return 30;
  }

  // Slow ambient motion (drifting clouds, fog, aurora, stars, calm motes) moves
  // < 1 px per frame at 15 FPS, slashing GPU and backdrop-filter churn by 4x-9x.
  return 15;
}

// Shared raw straight-alpha RGBA pixel buffer built once across all engine instances.
// Uploading the raw Uint8Array directly to WebGL bypasses HTMLCanvasElement's premultiplied
// 2D backing store, which would otherwise zero G=128 on transparent pixels (A=0) and make
// CLOUD_FRAGMENT_SHADER decode a phantom full-quad drop shadow around every cloud.
let sharedCloudAtlasPixels: Uint8Array | null = null;
let sharedCloudAtlasLoading = false;
const activeEngines = new Set<AtmosphereEngine>();

function ensureSharedCloudAtlas(): Uint8Array | null {
  if (sharedCloudAtlasPixels) return sharedCloudAtlasPixels;
  if (sharedCloudAtlasLoading) return null;
  if (typeof document === "undefined" || typeof Image === "undefined") return null;

  sharedCloudAtlasLoading = true;
  const images: HTMLImageElement[] = [];
  let loadedCount = 0;

  const finalizeAtlas = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = ATLAS_SIZE;
      canvas.height = ATLAS_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      const cellW = Math.floor(ATLAS_SIZE / ATLAS_COLS);
      const cellH = Math.floor(ATLAS_SIZE / ATLAS_ROWS);
      const padX = 28;
      const padY = 20;
      const drawW = cellW - padX * 2;
      const drawH = cellH - padY * 2;

      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        if (!img.complete || img.naturalWidth < 1) continue;
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        ctx.drawImage(img, col * cellW + padX, row * cellH + padY, drawW, drawH);
      }

      const raw = ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      const baked = bakeCloudAtlasPixels(raw.data, ATLAS_SIZE, ATLAS_SIZE, ATLAS_COLS, ATLAS_ROWS);
      sharedCloudAtlasPixels = new Uint8Array(baked.buffer, baked.byteOffset, baked.byteLength);
      for (const engine of activeEngines) {
        engine.notifyAtlasReady();
      }
    } catch {
      // Ignore headless environment canvas limitations
    }
  };

  for (let i = 0; i < CLOUD_SOURCES.length; i += 1) {
    const img = new Image();
    img.decoding = "async";
    const onDone = () => {
      loadedCount += 1;
      if (loadedCount === CLOUD_SOURCES.length) {
        finalizeAtlas();
      }
    };
    img.onload = onDone;
    img.onerror = onDone;
    img.src = CLOUD_SOURCES[i];
    images.push(img);
  }

  return sharedCloudAtlasPixels;
}

interface CloudInstance {
  x: number;
  baseY: number;
  widthPx: number;
  aspect: number;
  depth: number;
  spriteIndex: number;
  flipX: boolean;
  speedFactor: number;
  bobAmp: number;
  bobPhase: number;
  opacityScale: number;
}

interface StarInstance {
  x: number;
  y: number;
  sizePx: number;
  twinkleFreq: number;
  phase: number;
  spikes: number;
  coreRgb: readonly [number, number, number];
  haloRgb: readonly [number, number, number];
  opacity: number;
}

interface RainDropParticle {
  x: number;
  y: number;
  lengthPx: number;
  widthPx: number;
  speed: number;
  depth: number;
  threshold: number;
}

interface ImpactParticle {
  x: number;
  y: number;
  age: number;
  duration: number;
  sizePx: number;
  threshold: number;
}

interface WindGustInstance {
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  speed: number;
  phase: number;
  opacity: number;
}

interface SnowParticle {
  x: number;
  y: number;
  sizePx: number;
  speedY: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  crystalParam: number;
  opacity: number;
}

interface PhenomenonParticle {
  x: number;
  y: number;
  sizePx: number;
  speedX: number;
  speedY: number;
  phase: number;
  spinSpeed: number;
  opacity: number;
}

interface WindowDroplet {
  x: number;
  y: number;
  radiusPx: number;
  trailLengthPx: number;
  speed: number;
  pauseTimer: number;
  phase: number;
  opacity: number;
}

interface LightningBoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  halfWidthPx: number;
  alpha: number;
}

function compileGlShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function linkGlProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileGlShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileGlShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error("Unable to create WebGL program.");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Program link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

const MAX_CLOUD_QUADS = 32;
const CLOUD_FLOATS_PER_VERTEX = 8; // a_pos(2), a_atlasUv(2), a_localUv(2), a_alpha(1), a_depth(1)

const MAX_PARTICLE_QUADS = 640;
const PARTICLE_FLOATS_PER_VERTEX = 14; // a_pos(2), a_uv(2), a_kind(1), a_param(1), a_colorA(4), a_colorB(4)

function poolHash(index: number, salt: number): number {
  let h = (Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function scaledPoolCount(poolLength: number, scale: number, minCount = 1): number {
  if (poolLength <= 0) return 0;
  return clamp(Math.round(poolLength * scale), Math.min(minCount, poolLength), poolLength);
}

function sampledPoolIndex(slot: number, activeCount: number, poolLength: number): number {
  return Math.floor((slot * poolLength) / Math.max(1, activeCount));
}

export class AtmosphereEngine {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private fallbackCtx2d: CanvasRenderingContext2D | null = null;

  private atmoProgram: WebGLProgram | null = null;
  private blitProgram: WebGLProgram | null = null;
  private cloudProgram: WebGLProgram | null = null;
  private particleProgram: WebGLProgram | null = null;

  private quadBuffer: WebGLBuffer | null = null;
  private cloudBuffer: WebGLBuffer | null = null;
  private particleBuffer: WebGLBuffer | null = null;

  private atmoFbo: WebGLFramebuffer | null = null;
  private atmoFboTex: WebGLTexture | null = null;
  private atmoFboW = 0;
  private atmoFboH = 0;

  private cloudAtlasTex: WebGLTexture | null = null;
  private cloudAtlasUploaded = false;

  private atmoLocs: Record<string, WebGLUniformLocation | null> = {};
  private blitTexLoc: WebGLUniformLocation | null = null;
  private cloudLocs: Record<string, WebGLUniformLocation | null> = {};
  private particleLocs: Record<string, WebGLUniformLocation | null> = {};

  private atmoAttribs = { a_pos: -1 };
  private blitAttribs = { a_pos: -1 };
  private cloudAttribs = { a_pos: -1, a_atlasUv: -1, a_localUv: -1, a_alpha: -1, a_depth: -1 };
  private particleAttribs = { a_pos: -1, a_uv: -1, a_kind: -1, a_param: -1, a_colorA: -1, a_colorB: -1 };

  private readonly cloudVertices = new Float32Array(MAX_CLOUD_QUADS * 6 * CLOUD_FLOATS_PER_VERTEX);
  private cloudVertexCount = 0;

  private readonly particleVertices = new Float32Array(MAX_PARTICLE_QUADS * 6 * PARTICLE_FLOATS_PER_VERTEX);
  private particleVertexCount = 0;

  private currentUniforms: AtmosphereUniforms | null = null;
  private fromUniforms: AtmosphereUniforms | null = null;
  private targetUniforms: AtmosphereUniforms | null = null;
  private transitionStartMs = 0;
  private transitionDurationMs = 0;

  private state: WeatherState | null = null;
  private tokens: SceneTokens | null = null;
  private prefs: WeatherPrefs | null = null;
  private backdropBoost = 0;
  private lastBackdropProbeMs = 0;
  private visible = false;
  private paused = false;
  private reducedMotion = false;
  private destroyed = false;
  private dirty = true;

  private animationFrame: number | null = null;
  private pacingTimer: number | null = null;
  private elapsedSeconds = Math.random() * 40;
  private lastTickMs = 0;
  private lastRenderMs = 0;
  private lastAtmoFboMs = 0;
  private atmoFboDirty = true;
  private cachedClientW = 0;
  private cachedClientH = 0;
  private cachedFxProfileW = 0;
  private cachedFxProfileH = 0;
  private cachedFxProfile: ViewportFxProfile | null = null;
  private lastClientW = 1280;
  private windowFocused = typeof document === "undefined" ? true : document.hasFocus();
  private canvasHiddenForIdle = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly onContextLost: (event: Event) => void;
  private readonly onContextRestored: () => void;
  private readonly onWindowFocus: () => void;
  private readonly onWindowBlur: () => void;

  private lightningAge = -1;
  private lightningX = 0.5;
  private lightningSegments: LightningBoltSegment[] = [];

  private readonly clouds: CloudInstance[] = [];
  private readonly stars: StarInstance[] = [];
  private readonly rainDrops: RainDropParticle[] = [];
  private readonly ripples: ImpactParticle[] = [];
  private readonly splashes: ImpactParticle[] = [];
  private readonly windGusts: WindGustInstance[] = [];
  private readonly snowFlakes: SnowParticle[] = [];
  private readonly phenomenonParticles: PhenomenonParticle[] = [];
  private readonly windowDroplets: WindowDroplet[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly kind: "back" | "front",
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "weather-fx-shader-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.canvas);

    activeEngines.add(this);
    ensureSharedCloudAtlas();

    this.initScenePools();
    this.initWebGL();
    if (!this.gl) {
      this.fallbackCtx2d = this.canvas.getContext("2d", { alpha: true });
    }
    this.tick = this.tick.bind(this);

    this.onContextLost = (event: Event) => {
      event.preventDefault();
      if (this.destroyed) return;
      this.resetGlHandles();
      this.cancelScheduledFrame();
    };

    this.onContextRestored = () => {
      if (this.destroyed) return;
      this.initWebGL();
      if (!this.gl && !this.fallbackCtx2d) {
        this.fallbackCtx2d = this.canvas.getContext("2d", { alpha: true });
      }
      this.dirty = true;
      this.atmoFboDirty = true;
      this.syncLoopState();
    };

    this.onWindowFocus = () => {
      if (this.destroyed) return;
      this.windowFocused = true;
      this.dirty = true;
      this.atmoFboDirty = true;
      this.cancelScheduledFrame();
      this.syncLoopState();
    };

    this.onWindowBlur = () => {
      if (this.destroyed) return;
      this.windowFocused = false;
    };

    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onWindowFocus);
      window.addEventListener("blur", this.onWindowBlur);
    }

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.destroyed) return;
        const entry = entries[entries.length - 1];
        if (entry) {
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          if (w > 0 && h > 0) {
            this.cachedClientW = w;
            this.cachedClientH = h;
          }
        }
        this.dirty = true;
        this.atmoFboDirty = true;
        this.syncLoopState();
      });
      this.resizeObserver.observe(this.root);
    }
  }

  notifyAtlasReady(): void {
    if (this.destroyed) return;
    this.dirty = true;
    this.syncLoopState();
  }

  update(options: AtmosphereUpdateOptions): void {
    if (this.destroyed) return;

    const nowMs = performance.now();
    this.backdropBoost = resolveBackdropContrastBoost(measureHostBackgroundOpacity(this.root));
    this.lastBackdropProbeMs = nowMs;

    const nextTarget = resolveAtmosphereUniformTarget(
      options.state,
      options.tokens,
      options.prefs,
      options.kind,
      this.backdropBoost,
    );

    const shouldTransition =
      options.prefs.transitionsEnabled &&
      !options.reducedMotion &&
      !options.paused &&
      options.visible &&
      this.currentUniforms !== null;

    if (shouldTransition && this.currentUniforms) {
      this.fromUniforms = this.currentUniforms;
      this.targetUniforms = nextTarget;
      this.transitionStartMs = nowMs;
      this.transitionDurationMs = 1200;
    } else {
      this.currentUniforms = nextTarget;
      this.fromUniforms = nextTarget;
      this.targetUniforms = nextTarget;
      this.transitionDurationMs = 0;
    }

    this.state = options.state;
    this.tokens = options.tokens;
    this.prefs = options.prefs;
    this.visible = options.visible;
    this.paused = options.paused;
    this.reducedMotion = options.reducedMotion;
    this.dirty = true;
    this.atmoFboDirty = true;

    this.syncLoopState();
  }

  triggerLightning(boltPositionPercent = 50): void {
    if (this.destroyed || !this.visible || this.paused || this.reducedMotion) return;
    this.lightningX = clamp(boltPositionPercent / 100, 0.12, 0.88);
    this.lightningAge = 0;
    if (this.kind === "back" || this.prefs?.layerMode === "front") {
      const clientW = this.cachedClientW || this.root.clientWidth || this.lastClientW;
      this.generateLightningBolt(this.lightningX, clientW);
    } else {
      this.lightningSegments = [];
    }
    this.dirty = true;
    this.atmoFboDirty = true;
    this.cancelScheduledFrame();
    this.syncLoopState();
  }

  private cancelScheduledFrame(): void {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.pacingTimer !== null) {
      window.clearTimeout(this.pacingTimer);
      this.pacingTimer = null;
    }
  }

  private resetGlHandles(): void {
    this.gl = null;
    this.atmoProgram = null;
    this.blitProgram = null;
    this.cloudProgram = null;
    this.particleProgram = null;
    this.quadBuffer = null;
    this.cloudBuffer = null;
    this.particleBuffer = null;
    this.atmoFbo = null;
    this.atmoFboTex = null;
    this.atmoFboW = 0;
    this.atmoFboH = 0;
    this.atmoFboDirty = true;
    this.cloudAtlasTex = null;
    this.cloudAtlasUploaded = false;
    this.atmoLocs = {};
    this.blitTexLoc = null;
    this.cloudLocs = {};
    this.particleLocs = {};
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    activeEngines.delete(this);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onWindowFocus);
      window.removeEventListener("blur", this.onWindowBlur);
    }

    this.cancelScheduledFrame();
    const gl = this.gl;
    if (gl) {
      if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
      if (this.cloudBuffer) gl.deleteBuffer(this.cloudBuffer);
      if (this.particleBuffer) gl.deleteBuffer(this.particleBuffer);
      if (this.atmoFboTex) gl.deleteTexture(this.atmoFboTex);
      if (this.atmoFbo) gl.deleteFramebuffer(this.atmoFbo);
      if (this.cloudAtlasTex) gl.deleteTexture(this.cloudAtlasTex);
      if (this.atmoProgram) gl.deleteProgram(this.atmoProgram);
      if (this.blitProgram) gl.deleteProgram(this.blitProgram);
      if (this.cloudProgram) gl.deleteProgram(this.cloudProgram);
      if (this.particleProgram) gl.deleteProgram(this.particleProgram);
      try {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // Ignore if extension is unavailable
      }
    }
    this.resetGlHandles();
    this.canvas.remove();
  }

  private setCanvasIdleHidden(hidden: boolean): void {
    if (this.canvasHiddenForIdle === hidden) return;
    this.canvasHiddenForIdle = hidden;
    this.canvas.style.visibility = hidden ? "hidden" : "";
  }

  private clearCanvasOnce(): void {
    if (this.gl) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else if (this.fallbackCtx2d) {
      this.fallbackCtx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private syncLoopState(): void {
    if (this.destroyed) return;
    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    const shouldAnimate = this.visible && docVisible && !this.paused && !this.reducedMotion;

    if (!this.visible || !docVisible) {
      this.cancelScheduledFrame();
      return;
    }

    const activeUniforms = this.targetUniforms ?? this.currentUniforms;
    const hasContent =
      activeUniforms !== null &&
      this.state !== null &&
      (this.transitionDurationMs > 0 ||
        hasAtmosphereLayerContent(activeUniforms, this.state, this.lightningAge >= 0));

    if (!hasContent) {
      this.cancelScheduledFrame();
      if (this.dirty) {
        this.clearCanvasOnce();
        this.dirty = false;
      }
      this.setCanvasIdleHidden(true);
      return;
    }

    this.setCanvasIdleHidden(false);

    if (!shouldAnimate) {
      this.cancelScheduledFrame();
      if (this.dirty) {
        this.currentUniforms = this.targetUniforms;
        this.renderFrame(0, performance.now());
        this.dirty = false;
      }
      return;
    }

    if (this.dirty) {
      this.cancelScheduledFrame();
      this.lastTickMs = performance.now();
      this.animationFrame = window.requestAnimationFrame(this.tick);
      return;
    }

    if (this.animationFrame === null && this.pacingTimer === null) {
      this.lastTickMs = performance.now();
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }
  }

  private scheduleNextFrame(targetFps: number): void {
    if (this.destroyed || this.animationFrame !== null || this.pacingTimer !== null) return;
    if (targetFps >= 55) {
      this.animationFrame = window.requestAnimationFrame(this.tick);
      return;
    }
    const intervalMs = 1000 / Math.max(1, targetFps);
    // Sleep on a timer before requesting VSync so high-refresh displays (120/144 Hz)
    // do not wake JS and the compositor on skipped frames.
    const delayMs = Math.max(4, Math.floor(intervalMs - 12));
    this.pacingTimer = window.setTimeout(() => {
      this.pacingTimer = null;
      if (this.destroyed || this.animationFrame !== null) return;
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }, delayMs);
  }

  /**
   * Adaptive VSync-aligned render loop: paces frame cadence to the active scene's
   * motion speed (60 FPS for lightning, 30 FPS for rain/snow/phenomena, 15 FPS for
   * slow skies/clouds/fog, 4 FPS when unfocused) and idles completely when a layer
   * has no visible content.
   */
  private tick(nowMs: number): void {
    this.animationFrame = null;
    if (this.destroyed) return;

    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    if (!this.visible || !docVisible || this.paused || this.reducedMotion) {
      this.syncLoopState();
      return;
    }

    const activeUniforms = this.currentUniforms ?? this.targetUniforms;
    if (!activeUniforms || !this.state) return;

    const transitioning = this.transitionDurationMs > 0 && !!this.fromUniforms && !!this.targetUniforms;
    const lightningActive = this.lightningAge >= 0;

    if (!transitioning && !hasAtmosphereLayerContent(activeUniforms, this.state, lightningActive)) {
      this.clearCanvasOnce();
      this.setCanvasIdleHidden(true);
      this.dirty = false;
      return;
    }

    const targetFps = resolveAtmosphereTargetFps(activeUniforms, this.state, {
      windowFocused: this.windowFocused,
      lightningActive,
      transitioning,
    });
    const minIntervalMs = 1000 / Math.max(1, targetFps);
    if (!this.dirty && this.lastRenderMs > 0 && nowMs - this.lastRenderMs < minIntervalMs - 2) {
      this.scheduleNextFrame(targetFps);
      return;
    }

    const maxDt = targetFps <= 6 ? 0.3 : targetFps <= 20 ? 0.12 : 0.06;
    const dt = clamp((nowMs - this.lastTickMs) / 1000, 0.001, maxDt);
    this.lastTickMs = nowMs;
    this.lastRenderMs = nowMs;
    this.elapsedSeconds += dt;
    this.dirty = false;

    if (
      nowMs - this.lastBackdropProbeMs >= 750 &&
      this.state &&
      this.tokens &&
      this.prefs
    ) {
      this.lastBackdropProbeMs = nowMs;
      const nextBoost = resolveBackdropContrastBoost(measureHostBackgroundOpacity(this.root));
      if (Math.abs(nextBoost - this.backdropBoost) > 0.03) {
        this.backdropBoost = nextBoost;
        const retarget = resolveAtmosphereUniformTarget(
          this.state,
          this.tokens,
          this.prefs,
          this.kind,
          nextBoost,
        );
        if (this.currentUniforms) {
          this.fromUniforms = this.currentUniforms;
          this.targetUniforms = retarget;
          this.transitionStartMs = nowMs;
          this.transitionDurationMs = 360;
        } else {
          this.currentUniforms = retarget;
          this.targetUniforms = retarget;
        }
        this.atmoFboDirty = true;
      }
    }

    const isTransitioning = this.transitionDurationMs > 0 && !!this.fromUniforms && !!this.targetUniforms;
    if (isTransitioning && this.fromUniforms && this.targetUniforms) {
      const progress = clamp((nowMs - this.transitionStartMs) / this.transitionDurationMs, 0, 1);
      this.currentUniforms = interpolateUniforms(this.fromUniforms, this.targetUniforms, progress);
      this.atmoFboDirty = true;
      if (progress >= 1) {
        this.transitionDurationMs = 0;
      }
    } else {
      this.currentUniforms = this.targetUniforms;
    }

    if (this.lightningAge >= 0) {
      this.lightningAge += dt;
      this.atmoFboDirty = true;
      if (this.lightningAge > 0.68) {
        this.lightningAge = -1;
      }
    }

    this.renderFrame(dt, nowMs);

    const nextUniforms = this.currentUniforms ?? this.targetUniforms;
    if (
      nextUniforms &&
      this.state &&
      (this.transitionDurationMs > 0 ||
        hasAtmosphereLayerContent(nextUniforms, this.state, this.lightningAge >= 0))
    ) {
      const nextFps = resolveAtmosphereTargetFps(nextUniforms, this.state, {
        windowFocused: this.windowFocused,
        lightningActive: this.lightningAge >= 0,
        transitioning: this.transitionDurationMs > 0,
      });
      this.scheduleNextFrame(nextFps);
    } else {
      this.clearCanvasOnce();
      this.setCanvasIdleHidden(true);
    }
  }

  private initWebGL(): void {
    try {
      const attrs: WebGLContextAttributes = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "low-power",
      };
      const gl =
        (this.canvas.getContext("webgl2", attrs) as WebGLRenderingContext | null) ??
        (this.canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);
      if (!gl) return;

      const atmoProgram = linkGlProgram(gl, ATMOSPHERE_VERTEX_SHADER, ATMOSPHERE_FRAGMENT_SHADER);
      const blitProgram = linkGlProgram(gl, BLIT_VERTEX_SHADER, BLIT_FRAGMENT_SHADER);
      const cloudProgram = linkGlProgram(gl, CLOUD_VERTEX_SHADER, CLOUD_FRAGMENT_SHADER);
      const particleProgram = linkGlProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);

      const quadBuffer = gl.createBuffer();
      const cloudBuffer = gl.createBuffer();
      const particleBuffer = gl.createBuffer();
      if (!quadBuffer || !cloudBuffer || !particleBuffer) return;

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, cloudBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.cloudVertices.byteLength, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.particleVertices.byteLength, gl.DYNAMIC_DRAW);

      const atmoUniformNames = [
        "u_resolution",
        "u_time",
        "u_bgStart",
        "u_bgMid",
        "u_bgEnd",
        "u_glow",
        "u_beamColor",
        "u_horizonColor",
        "u_fogColor",
        "u_mistColor",
        "u_skyOpacity",
        "u_glowOpacity",
        "u_beamOpacity",
        "u_horizonOpacity",
        "u_mistOpacity",
        "u_fogOpacity",
        "u_auroraOpacity",
        "u_moonlightOpacity",
        "u_moonIllumination",
        "u_moonPos",
        "u_windX",
        "u_isSandstorm",
        "u_isIndoor",
        "u_lightningFlash",
        "u_lightningX",
      ];
      for (const name of atmoUniformNames) {
        this.atmoLocs[name] = gl.getUniformLocation(atmoProgram, name);
      }

      this.blitTexLoc = gl.getUniformLocation(blitProgram, "u_tex");

      const cloudUniformNames = [
        "u_atlas",
        "u_aspect",
        "u_cloudCore",
        "u_cloudEdge",
        "u_rimLight",
        "u_underGlow",
        "u_shadowTint",
        "u_underGlowStrength",
        "u_detailStrength",
        "u_lightningFlash",
        "u_lightningX",
        "u_frontMask",
      ];
      for (const name of cloudUniformNames) {
        this.cloudLocs[name] = gl.getUniformLocation(cloudProgram, name);
      }

      this.particleLocs.u_frontMask = gl.getUniformLocation(particleProgram, "u_frontMask");
      this.particleLocs.u_time = gl.getUniformLocation(particleProgram, "u_time");
      this.particleLocs.u_bgContrast = gl.getUniformLocation(particleProgram, "u_bgContrast");

      this.atmoAttribs.a_pos = gl.getAttribLocation(atmoProgram, "a_pos");
      this.blitAttribs.a_pos = gl.getAttribLocation(blitProgram, "a_pos");

      this.cloudAttribs = {
        a_pos: gl.getAttribLocation(cloudProgram, "a_pos"),
        a_atlasUv: gl.getAttribLocation(cloudProgram, "a_atlasUv"),
        a_localUv: gl.getAttribLocation(cloudProgram, "a_localUv"),
        a_alpha: gl.getAttribLocation(cloudProgram, "a_alpha"),
        a_depth: gl.getAttribLocation(cloudProgram, "a_depth"),
      };

      this.particleAttribs = {
        a_pos: gl.getAttribLocation(particleProgram, "a_pos"),
        a_uv: gl.getAttribLocation(particleProgram, "a_uv"),
        a_kind: gl.getAttribLocation(particleProgram, "a_kind"),
        a_param: gl.getAttribLocation(particleProgram, "a_param"),
        a_colorA: gl.getAttribLocation(particleProgram, "a_colorA"),
        a_colorB: gl.getAttribLocation(particleProgram, "a_colorB"),
      };

      this.gl = gl;
      this.atmoProgram = atmoProgram;
      this.blitProgram = blitProgram;
      this.cloudProgram = cloudProgram;
      this.particleProgram = particleProgram;
      this.quadBuffer = quadBuffer;
      this.cloudBuffer = cloudBuffer;
      this.particleBuffer = particleBuffer;
    } catch {
      this.gl = null;
    }
  }

  private ensureAtmosphereFbo(gl: WebGLRenderingContext, targetW: number, targetH: number): boolean {
    if (this.atmoFbo && this.atmoFboTex && this.atmoFboW === targetW && this.atmoFboH === targetH) {
      return true;
    }

    if (this.atmoFboTex) gl.deleteTexture(this.atmoFboTex);
    if (this.atmoFbo) gl.deleteFramebuffer(this.atmoFbo);

    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return false;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetW, targetH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      this.atmoFbo = null;
      this.atmoFboTex = null;
      return false;
    }

    this.atmoFbo = fbo;
    this.atmoFboTex = tex;
    this.atmoFboW = targetW;
    this.atmoFboH = targetH;
    this.atmoFboDirty = true;
    return true;
  }

  private ensureCloudAtlasTexture(gl: WebGLRenderingContext): boolean {
    if (this.cloudAtlasUploaded && this.cloudAtlasTex) return true;
    const atlasPixels = ensureSharedCloudAtlas();
    if (!atlasPixels) return false;

    const tex = gl.createTexture();
    if (!tex) return false;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      ATLAS_SIZE,
      ATLAS_SIZE,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      atlasPixels,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.cloudAtlasTex = tex;
    this.cloudAtlasUploaded = true;
    return true;
  }

  private initScenePools(): void {
    const isFront = this.kind === "front";
    const layerSalt = isFront ? 1009 : 0;

    // Multi-depth billowing cloud instances (sorted back-to-front by depth)
    const cloudCount = isFront ? 8 : 18;
    for (let i = 0; i < cloudCount; i += 1) {
      const tier = i / Math.max(1, cloudCount - 1);
      const depth = clamp(0.15 + tier * 0.82, 0.1, 1);
      const row = (i + (isFront ? 1 : 0)) % 3;
      this.clouds.push({
        x: -0.16 + ((i * 0.61803398875 + poolHash(i, layerSalt + 1) * 0.24) % 1) * 1.28,
        baseY: (row === 0 ? -0.04 : row === 1 ? 0.02 : 0.08) + poolHash(i, layerSalt + 3) * 0.064,
        widthPx: (isFront ? 360 : 320) + depth * 170 + poolHash(i, layerSalt + 5) * 80,
        aspect: 0.48 + poolHash(i, layerSalt + 7) * 0.12,
        depth,
        spriteIndex: (i + (isFront ? 3 : 0)) % CLOUD_SOURCES.length,
        flipX: (i + (isFront ? 1 : 0)) % 2 === 1,
        speedFactor: 0.55 + depth * 0.65,
        bobAmp: 0.004 + depth * 0.005,
        bobPhase: poolHash(i, layerSalt + 9) * Math.PI * 2,
        opacityScale: 0.68 + depth * 0.28,
      });
    }

    // Chromatic night stars with blackbody color diversity
    const starPalettes: ReadonlyArray<readonly [readonly [number, number, number], readonly [number, number, number]]> = [
      [[1.0, 0.99, 0.98], [0.68, 0.82, 1.0]], // Blue-white Sirius / Vega
      [[1.0, 0.97, 0.90], [0.98, 0.82, 0.58]], // Warm gold Capella
      [[0.96, 0.98, 1.0], [0.54, 0.74, 1.0]], // Sapphire Rigel
      [[1.0, 0.94, 0.88], [0.96, 0.68, 0.56]], // Soft coral-gold Arcturus
    ];
    const starCount = isFront ? 28 : 88;
    for (let i = 0; i < starCount; i += 1) {
      const seed = i + (isFront ? 97 : 11);
      const pal = starPalettes[seed % starPalettes.length];
      const bright = seed % 7 === 0;
      this.stars.push({
        x: 0.02 + poolHash(i, layerSalt + 11) * 0.96,
        y: 0.02 + poolHash(i, layerSalt + 13) * 0.62,
        sizePx: bright
          ? 7.5 + poolHash(i, layerSalt + 15) * 4.2
          : 3.2 + poolHash(i, layerSalt + 17) * 4.0,
        twinkleFreq: 1.1 + poolHash(i, layerSalt + 18) * 2.7,
        phase: poolHash(i, layerSalt + 20) * Math.PI * 2,
        spikes: bright ? 0.85 : 0.0,
        coreRgb: pal[0],
        haloRgb: pal[1],
        opacity: bright ? 0.96 : 0.52 + poolHash(i, layerSalt + 21) * 0.40,
      });
    }

    // 3-depth parallax gradient raindrops
    const rainCount = isFront ? 78 : 136;
    for (let i = 0; i < rainCount; i += 1) {
      const depth = poolHash(i, layerSalt + 19);
      this.rainDrops.push({
        x: (i * 0.61803398875 + poolHash(i, layerSalt + 23) * 0.28) % 1,
        y: poolHash(i, layerSalt + 29),
        lengthPx: (isFront ? 36 : 22) + depth * (isFront ? 42 : 28),
        widthPx: (isFront ? 3.2 : 2.3) + depth * 1.6,
        speed: (isFront ? 1.18 : 0.88) + depth * 0.62,
        depth,
        threshold: (i + 0.5) / rainCount,
      });
    }

    // Expanding ground water ripples
    const rippleCount = isFront ? 14 : 24;
    for (let i = 0; i < rippleCount; i += 1) {
      this.ripples.push({
        x: 0.03 + ((i * 0.61803398875 + poolHash(i, layerSalt + 31) * 0.24) % 1) * 0.94,
        y: 0.85 + poolHash(i, layerSalt + 37) * 0.14,
        age: poolHash(i, layerSalt + 41) * 0.95,
        duration: 0.75 + poolHash(i, layerSalt + 43) * 0.45,
        sizePx: (isFront ? 22 : 15) + poolHash(i, layerSalt + 47) * 16,
        threshold: (i + 0.5) / rippleCount,
      });
    }

    // Parabolic splash crowns + leaping micro-droplets
    const splashCount = isFront ? 12 : 20;
    for (let i = 0; i < splashCount; i += 1) {
      this.splashes.push({
        x: 0.04 + ((i * 0.61803398875 + poolHash(i, layerSalt + 53) * 0.24) % 1) * 0.92,
        y: 0.86 + poolHash(i, layerSalt + 59) * 0.13,
        age: poolHash(i, layerSalt + 61) * 0.7,
        duration: 0.52 + poolHash(i, layerSalt + 67) * 0.32,
        sizePx: (isFront ? 18 : 13) + poolHash(i, layerSalt + 71) * 10,
        threshold: (i + 0.5) / splashCount,
      });
    }

    // Sweeping sinusoidal wind-gust ribbons
    const gustCount = isFront ? 4 : 8;
    for (let i = 0; i < gustCount; i += 1) {
      this.windGusts.push({
        x: -0.2 + poolHash(i, layerSalt + 73) * 1.4,
        y: 0.14 + poolHash(i, layerSalt + 79) * 0.72,
        widthPx: 180 + poolHash(i, layerSalt + 83) * 180,
        heightPx: 26 + poolHash(i, layerSalt + 89) * 22,
        speed: 0.22 + poolHash(i, layerSalt + 97) * 0.20,
        phase: poolHash(i, layerSalt + 101) * Math.PI * 2,
        opacity: 0.12 + poolHash(i, layerSalt + 103) * 0.11,
      });
    }

    // Multi-depth bokeh & 6-point crystalline snowflakes
    const snowCount = isFront ? 58 : 98;
    for (let i = 0; i < snowCount; i += 1) {
      const depth = poolHash(i, layerSalt + 107);
      const isCrystal = depth > 0.62 && (isFront || i % 2 === 0);
      this.snowFlakes.push({
        x: (i * 0.61803398875 + poolHash(i, layerSalt + 109) * 0.28) % 1,
        y: poolHash(i, layerSalt + 113),
        sizePx: isCrystal
          ? (isFront ? 11 : 8.5) + depth * 6.5
          : (isFront ? 5.5 : 4.0) + depth * 5.2,
        speedY: 0.038 + depth * 0.058,
        swayAmp: 0.014 + depth * 0.024,
        swayFreq: 0.9 + poolHash(i, layerSalt + 127) * 1.8,
        phase: poolHash(i, layerSalt + 131) * Math.PI * 2,
        crystalParam: isCrystal ? 0.58 + (i % 7) * 0.06 : 0.2,
        opacity: 0.42 + depth * 0.52,
      });
    }

    // Secondary phenomena & mote pool
    const phenomCount = isFront ? 34 : 58;
    for (let i = 0; i < phenomCount; i += 1) {
      this.phenomenonParticles.push({
        x: (i * 0.61803398875 + poolHash(i, layerSalt + 137) * 0.28) % 1,
        y: poolHash(i, layerSalt + 139),
        sizePx: 8 + poolHash(i, layerSalt + 149) * 10,
        speedX: 0.03 + poolHash(i, layerSalt + 151) * 0.05,
        speedY: 0.042 + poolHash(i, layerSalt + 157) * 0.06,
        phase: poolHash(i, layerSalt + 163) * Math.PI * 2,
        spinSpeed: 1.3 + poolHash(i, layerSalt + 167) * 2.8,
        opacity: 0.52 + poolHash(i, layerSalt + 173) * 0.45,
      });
    }

    // Refractive indoor windowpane droplets + trails
    const dropletCount = isFront ? 32 : 16;
    for (let i = 0; i < dropletCount; i += 1) {
      this.windowDroplets.push({
        x: 0.03 + ((i * 0.61803398875 + poolHash(i, layerSalt + 179) * 0.24) % 1) * 0.94,
        y: poolHash(i, layerSalt + 181),
        radiusPx: (isFront ? 4.2 : 3.2) + poolHash(i, layerSalt + 191) * 4.8,
        trailLengthPx: 28 + poolHash(i, layerSalt + 193) * 52,
        speed: 0.028 + poolHash(i, layerSalt + 197) * 0.042,
        pauseTimer: poolHash(i, layerSalt + 199) * 2.6,
        phase: poolHash(i, layerSalt + 211) * Math.PI * 2,
        opacity: 0.48 + poolHash(i, layerSalt + 223) * 0.42,
      });
    }
  }

  private generateLightningBolt(startX: number, clientW = 1280): void {
    const profile = resolveViewportFxProfile(clientW, clientW);
    this.lightningSegments = [];
    let x = startX;
    let y = -0.02;
    const steps = 15;
    for (let i = 0; i < steps; i += 1) {
      const nextY = y + (0.74 / steps) * (0.78 + Math.random() * 0.45);
      const nextX = clamp(
        x + (Math.random() - 0.5) * 0.085 * profile.lightningSpreadScale,
        0.06,
        0.94,
      );
      this.lightningSegments.push({
        x1: x,
        y1: y,
        x2: nextX,
        y2: nextY,
        halfWidthPx: (14 - (i / steps) * 5.5) * profile.lightningWidthScale,
        alpha: 0.98,
      });

      if (i > 1 && i < steps - 2 && Math.random() < 0.48) {
        let bx = nextX;
        let by = nextY;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let b = 0; b < 4; b += 1) {
          const nbx = clamp(
            bx + dir * (0.018 + Math.random() * 0.036) * profile.lightningSpreadScale,
            0.02,
            0.98,
          );
          const nby = by + 0.042 + Math.random() * 0.032;
          this.lightningSegments.push({
            x1: bx,
            y1: by,
            x2: nbx,
            y2: nby,
            halfWidthPx: (7.5 - b * 1.2) * profile.lightningWidthScale,
            alpha: 0.72 - b * 0.13,
          });
          bx = nbx;
          by = nby;
        }
      }
      x = nextX;
      y = nextY;
    }
  }

  private renderFrame(dt: number, nowMs = performance.now()): void {
    const u = this.currentUniforms;
    if (!u || !this.state) return;

    const clientW = this.cachedClientW || this.root.clientWidth || window.innerWidth || 1;
    const clientH = this.cachedClientH || this.root.clientHeight || window.innerHeight || 1;
    if (clientW < 2 || clientH < 2) return;
    if (this.cachedClientW <= 0) this.cachedClientW = clientW;
    if (this.cachedClientH <= 0) this.cachedClientH = clientH;
    this.lastClientW = clientW;
    let fxProfile = this.cachedFxProfile;
    if (!fxProfile || this.cachedFxProfileW !== clientW || this.cachedFxProfileH !== clientH) {
      fxProfile = resolveViewportFxProfile(clientW, clientH);
      this.cachedFxProfile = fxProfile;
      this.cachedFxProfileW = clientW;
      this.cachedFxProfileH = clientH;
    }

    if (!this.gl) {
      this.renderHeadlessFallback(u, clientW, clientH);
      return;
    }

    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
    const maxMainPixels = 1_350_000;
    const mainBudget = Math.sqrt(maxMainPixels / Math.max(1, clientW * clientH));
    const effDpr = Math.min(dpr, mainBudget);
    const mainW = Math.max(1, Math.floor(clientW * effDpr));
    const mainH = Math.max(1, Math.floor(clientH * effDpr));

    if (this.canvas.width !== mainW || this.canvas.height !== mainH) {
      this.canvas.width = mainW;
      this.canvas.height = mainH;
    }

    const lightningFlicker = evaluateLightningFlicker(this.lightningAge);
    const frontMaskFlag = this.kind === "front" ? 1 : 0;

    // PASS 1: Render slow volumetric sky / aurora / god-rays / fog into low-res FBO (~96k pixels)
    // and decouple its redraw cadence (~12.5 Hz active, 4 Hz calm) from faster particle frames.
    let fboReady = false;
    if (u.renderAtmosphereShader) {
      const fboScale = Math.min(0.48, Math.sqrt(96_000 / Math.max(1, clientW * clientH)));
      const fboW = Math.max(64, Math.floor(clientW * fboScale));
      const fboH = Math.max(64, Math.floor(clientH * fboScale));
      fboReady = this.ensureAtmosphereFbo(gl, fboW, fboH);

      const fogStrength = Math.max(u.fogOpacity, u.mistOpacity * 0.78);
      const hasAnimatedAtmo =
        fogStrength > 0.045 ||
        u.auroraOpacity > 0.004 ||
        u.glowOpacity > 0.003 ||
        u.beamOpacity > 0.003;
      const fboIntervalMs = hasAnimatedAtmo ? 80 : 250;
      const shouldRedrawFbo =
        this.atmoFboDirty ||
        lightningFlicker > 0.005 ||
        this.transitionDurationMs > 0 ||
        nowMs - this.lastAtmoFboMs >= fboIntervalMs;

      if (fboReady && this.atmoFbo && shouldRedrawFbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.atmoFbo);
        gl.viewport(0, 0, fboW, fboH);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.drawAtmosphereFullscreen(gl, u, fboW, fboH, lightningFlicker, fxProfile);
        this.atmoFboDirty = false;
        this.lastAtmoFboMs = nowMs;
      }
    }

    // Bind main full-resolution backbuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, mainW, mainH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (u.renderAtmosphereShader) {
      if (fboReady && this.atmoFboTex && this.blitProgram && this.quadBuffer) {
        gl.useProgram(this.blitProgram);
        this.enableOnlyAttribs(gl, [this.blitAttribs.a_pos]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(this.blitAttribs.a_pos, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atmoFboTex);
        gl.uniform1i(this.blitTexLoc, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else {
        this.drawAtmosphereFullscreen(gl, u, mainW, mainH, lightningFlicker, fxProfile);
      }
    }

    // Pre-cloud celestial pass: crisp stars & lunar disc sit behind the cloud deck!
    this.particleVertexCount = 0;
    if (u.starOpacity > 0.005) {
      this.emitStars(u, clientW, clientH, fxProfile);
    }
    if (u.moonlightOpacity > 0.005) {
      this.emitMoon(u, clientW, clientH, fxProfile);
    }
    if (this.particleVertexCount > 0) {
      this.flushParticles(gl, frontMaskFlag, u.backdropBoost);
    }

    // PASS 2: Multi-depth hand-painted cloud atlas sprites with 4-stop shader gradients
    this.renderCloudPass(gl, u, clientW, clientH, dt, lightningFlicker, frontMaskFlag, fxProfile);

    // PASS 3: Foreground & atmospheric gradient particles, wind ribbons, droplets & lightning
    this.particleVertexCount = 0;
    this.buildWeatherParticles(u, clientW, clientH, dt, lightningFlicker, fxProfile);
    if (this.particleVertexCount > 0) {
      this.flushParticles(gl, frontMaskFlag, u.backdropBoost);
    }
  }

  private enableOnlyAttribs(gl: WebGLRenderingContext, active: readonly number[]): void {
    for (let i = 0; i < 6; i += 1) {
      if (active.includes(i)) {
        gl.enableVertexAttribArray(i);
      } else {
        gl.disableVertexAttribArray(i);
      }
    }
  }

  private drawAtmosphereFullscreen(
    gl: WebGLRenderingContext,
    u: AtmosphereUniforms,
    w: number,
    h: number,
    lightningFlicker: number,
    fxProfile: ViewportFxProfile,
  ): void {
    if (!this.atmoProgram || !this.quadBuffer) return;
    gl.useProgram(this.atmoProgram);
    this.enableOnlyAttribs(gl, [this.atmoAttribs.a_pos]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(this.atmoAttribs.a_pos, 2, gl.FLOAT, false, 0, 0);

    const loc = this.atmoLocs;
    gl.uniform2f(loc.u_resolution ?? null, w, h);
    gl.uniform1f(loc.u_time ?? null, this.elapsedSeconds);
    gl.uniform4fv(loc.u_bgStart ?? null, u.bgStart);
    gl.uniform4fv(loc.u_bgMid ?? null, u.bgMid);
    gl.uniform4fv(loc.u_bgEnd ?? null, u.bgEnd);
    gl.uniform4fv(loc.u_glow ?? null, u.glow);
    gl.uniform4fv(loc.u_beamColor ?? null, u.beamColor);
    gl.uniform4fv(loc.u_horizonColor ?? null, u.horizonColor);
    gl.uniform4fv(loc.u_fogColor ?? null, u.fogColor);
    gl.uniform4fv(loc.u_mistColor ?? null, u.mistColor);

    gl.uniform1f(loc.u_skyOpacity ?? null, u.skyOpacity);
    gl.uniform1f(loc.u_glowOpacity ?? null, u.glowOpacity);
    gl.uniform1f(loc.u_beamOpacity ?? null, u.beamOpacity);
    gl.uniform1f(loc.u_horizonOpacity ?? null, u.horizonOpacity);
    gl.uniform1f(loc.u_mistOpacity ?? null, u.mistOpacity);
    gl.uniform1f(loc.u_fogOpacity ?? null, u.fogOpacity);
    gl.uniform1f(loc.u_auroraOpacity ?? null, u.auroraOpacity);
    gl.uniform1f(loc.u_moonlightOpacity ?? null, u.moonlightOpacity);
    gl.uniform1f(loc.u_moonIllumination ?? null, u.moonIllumination);
    gl.uniform2f(loc.u_moonPos ?? null, fxProfile.moonX, fxProfile.moonY);
    gl.uniform1f(loc.u_windX ?? null, u.windVelocityX);
    gl.uniform1f(loc.u_isSandstorm ?? null, u.isSandstorm);
    gl.uniform1f(loc.u_isIndoor ?? null, u.isIndoor);
    gl.uniform1f(loc.u_lightningFlash ?? null, lightningFlicker * (0.45 + u.flashOpacity));
    gl.uniform1f(loc.u_lightningX ?? null, this.lightningX);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderCloudPass(
    gl: WebGLRenderingContext,
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    dt: number,
    lightningFlicker: number,
    frontMaskFlag: number,
    fxProfile: ViewportFxProfile,
  ): void {
    if (u.cloudOpacity <= 0.005 || u.isUnderground > 0.5) return;
    if (!this.cloudProgram || !this.cloudBuffer) return;
    if (!this.ensureCloudAtlasTexture(gl) || !this.cloudAtlasTex) return;

    this.cloudVertexCount = 0;
    const isBothFront = this.kind === "front" && this.prefs?.layerMode === "both";
    const poolCount = isBothFront ? Math.min(4, this.clouds.length) : this.clouds.length;
    const activeCount = scaledPoolCount(poolCount, fxProfile.cloudCountScale, isBothFront ? 2 : 7);

    const cellW = Math.floor(ATLAS_SIZE / ATLAS_COLS);
    const cellH = Math.floor(ATLAS_SIZE / ATLAS_ROWS);
    const baseOpacityBoost = clamp(0.45 + u.cloudCore[3] * 0.85, 0.52, 0.98);
    const layerOpacityScale =
      fxProfile.cloudOpacityScale * (isBothFront && fxProfile.compact ? 0.78 : 1);

    for (let k = 0; k < activeCount; k += 1) {
      const c = this.clouds[sampledPoolIndex(k, activeCount, poolCount)];
      if (dt > 0) {
        c.x += u.windVelocityX * 0.0085 * c.speedFactor * dt;
        if (c.x > 1.28) c.x -= 1.68;
        if (c.x < -0.4) c.x += 1.68;
      }

      let wNorm = clamp(
        (c.widthPx * fxProfile.cloudSizeScale) / Math.max(1, clientW),
        0.22,
        fxProfile.cloudMaxWidthNorm,
      );
      let hNorm = (wNorm * clientW * c.aspect) / Math.max(1, clientH);
      if (hNorm > fxProfile.cloudMaxHeightNorm) {
        hNorm = fxProfile.cloudMaxHeightNorm;
        wNorm = (hNorm * Math.max(1, clientH)) / Math.max(1, clientW * c.aspect);
      }
      const bobY = Math.sin(this.elapsedSeconds * 0.28 + c.bobPhase) * c.bobAmp;
      const swell = 1.0 + Math.sin(this.elapsedSeconds * 0.22 + c.bobPhase * 0.7) * 0.025;

      const halfW = wNorm * 0.5 * swell;
      const halfH = hNorm * 0.5 * swell;
      const cx = c.x + wNorm * 0.35;
      const cy = c.baseY + hNorm * 0.42 + bobY;

      const x0 = cx - halfW;
      const y0 = cy - halfH;
      const x1 = cx + halfW;
      const y1 = cy + halfH;

      const col = c.spriteIndex % ATLAS_COLS;
      const row = Math.floor(c.spriteIndex / ATLAS_COLS);
      const uMin = (col * cellW + 14) / ATLAS_SIZE;
      const uMax = ((col + 1) * cellW - 14) / ATLAS_SIZE;
      const vMin = (row * cellH + 10) / ATLAS_SIZE;
      const vMax = ((row + 1) * cellH - 10) / ATLAS_SIZE;

      const au0 = c.flipX ? uMax : uMin;
      const au1 = c.flipX ? uMin : uMax;
      const cloudAlpha = clamp(
        u.cloudOpacity * baseOpacityBoost * c.opacityScale * layerOpacityScale,
        0,
        0.92,
      );
      if (cloudAlpha <= 0.004) continue;

      this.pushCloudQuad(x0, y0, x1, y1, au0, vMin, au1, vMax, cloudAlpha, c.depth);
    }

    if (this.cloudVertexCount === 0) return;

    gl.useProgram(this.cloudProgram);
    const ca = this.cloudAttribs;
    this.enableOnlyAttribs(gl, [ca.a_pos, ca.a_atlasUv, ca.a_localUv, ca.a_alpha, ca.a_depth]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cloudBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.cloudVertices.subarray(0, this.cloudVertexCount * CLOUD_FLOATS_PER_VERTEX),
    );

    const stride = CLOUD_FLOATS_PER_VERTEX * 4;
    gl.vertexAttribPointer(ca.a_pos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(ca.a_atlasUv, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribPointer(ca.a_localUv, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribPointer(ca.a_alpha, 1, gl.FLOAT, false, stride, 24);
    gl.vertexAttribPointer(ca.a_depth, 1, gl.FLOAT, false, stride, 28);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cloudAtlasTex);

    const loc = this.cloudLocs;
    gl.uniform1i(loc.u_atlas ?? null, 0);
    gl.uniform1f(loc.u_aspect ?? null, clientW / Math.max(1, clientH));
    gl.uniform4fv(loc.u_cloudCore ?? null, u.cloudCore);
    gl.uniform4fv(loc.u_cloudEdge ?? null, u.cloudEdge);
    gl.uniform4fv(loc.u_rimLight ?? null, u.cloudRimLight);
    gl.uniform4fv(loc.u_underGlow ?? null, u.cloudUnderGlow);
    gl.uniform4fv(loc.u_shadowTint ?? null, u.cloudShadowTint);
    gl.uniform1f(loc.u_underGlowStrength ?? null, u.cloudUnderGlowStrength);
    gl.uniform1f(loc.u_detailStrength ?? null, u.cloudDetailStrength);
    gl.uniform1f(loc.u_lightningFlash ?? null, lightningFlicker);
    gl.uniform1f(loc.u_lightningX ?? null, this.lightningX);
    gl.uniform1f(loc.u_frontMask ?? null, frontMaskFlag);

    gl.drawArrays(gl.TRIANGLES, 0, this.cloudVertexCount);
  }

  private pushCloudQuad(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    alpha: number,
    depth: number,
  ): void {
    if (this.cloudVertexCount + 6 > MAX_CLOUD_QUADS * 6) return;
    let offset = this.cloudVertexCount * CLOUD_FLOATS_PER_VERTEX;
    const buf = this.cloudVertices;

    const writeVert = (px: number, py: number, au: number, av: number, lu: number, lv: number) => {
      buf[offset++] = px;
      buf[offset++] = py;
      buf[offset++] = au;
      buf[offset++] = av;
      buf[offset++] = lu;
      buf[offset++] = lv;
      buf[offset++] = alpha;
      buf[offset++] = depth;
    };

    writeVert(x0, y0, u0, v0, 0, 0);
    writeVert(x1, y0, u1, v0, 1, 0);
    writeVert(x0, y1, u0, v1, 0, 1);
    writeVert(x0, y1, u0, v1, 0, 1);
    writeVert(x1, y0, u1, v0, 1, 0);
    writeVert(x1, y1, u1, v1, 1, 1);

    this.cloudVertexCount += 6;
  }

  private flushParticles(gl: WebGLRenderingContext, frontMaskFlag: number, bgContrast = 0): void {
    if (!this.particleProgram || !this.particleBuffer || this.particleVertexCount === 0) return;

    gl.useProgram(this.particleProgram);
    const pa = this.particleAttribs;
    this.enableOnlyAttribs(gl, [pa.a_pos, pa.a_uv, pa.a_kind, pa.a_param, pa.a_colorA, pa.a_colorB]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.particleVertices.subarray(0, this.particleVertexCount * PARTICLE_FLOATS_PER_VERTEX),
    );

    const stride = PARTICLE_FLOATS_PER_VERTEX * 4;
    gl.vertexAttribPointer(pa.a_pos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(pa.a_uv, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribPointer(pa.a_kind, 1, gl.FLOAT, false, stride, 16);
    gl.vertexAttribPointer(pa.a_param, 1, gl.FLOAT, false, stride, 20);
    gl.vertexAttribPointer(pa.a_colorA, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribPointer(pa.a_colorB, 4, gl.FLOAT, false, stride, 40);

    gl.uniform1f(this.particleLocs.u_frontMask ?? null, frontMaskFlag);
    gl.uniform1f(this.particleLocs.u_time ?? null, this.elapsedSeconds);
    gl.uniform1f(this.particleLocs.u_bgContrast ?? null, bgContrast);

    gl.drawArrays(gl.TRIANGLES, 0, this.particleVertexCount);
    this.particleVertexCount = 0;
  }

  /**
   * Emits an arbitrary oriented/scaled quad in pixel offsets around normalized `(cx, cy)`,
   * converted into normalized screen coordinates `(0..1, 0..1)`.
   */
  private pushOrientedQuad(
    cxNorm: number,
    cyNorm: number,
    halfWidthPx: number,
    halfHeightPx: number,
    angleRad: number,
    clientW: number,
    clientH: number,
    kind: number,
    param: number,
    cAr: number,
    cAg: number,
    cAb: number,
    cAa: number,
    cBr: number,
    cBg: number,
    cBb: number,
    cBa: number,
  ): void {
    if (this.particleVertexCount + 6 > MAX_PARTICLE_QUADS * 6) return;

    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const invW = 1 / Math.max(1, clientW);
    const invH = 1 / Math.max(1, clientH);

    // Local X vector & Local Y vector in normalized screen space
    const rxX = cosA * halfWidthPx * invW;
    const rxY = sinA * halfWidthPx * invH;
    const ryX = -sinA * halfHeightPx * invW;
    const ryY = cosA * halfHeightPx * invH;

    const p0x = cxNorm - rxX - ryX;
    const p0y = cyNorm - rxY - ryY;
    const p1x = cxNorm + rxX - ryX;
    const p1y = cyNorm + rxY - ryY;
    const p2x = cxNorm - rxX + ryX;
    const p2y = cyNorm - rxY + ryY;
    const p3x = cxNorm + rxX + ryX;
    const p3y = cyNorm + rxY + ryY;

    let offset = this.particleVertexCount * PARTICLE_FLOATS_PER_VERTEX;
    const buf = this.particleVertices;

    const v = (px: number, py: number, u: number, vCoord: number) => {
      buf[offset++] = px;
      buf[offset++] = py;
      buf[offset++] = u;
      buf[offset++] = vCoord;
      buf[offset++] = kind;
      buf[offset++] = param;
      buf[offset++] = cAr;
      buf[offset++] = cAg;
      buf[offset++] = cAb;
      buf[offset++] = cAa;
      buf[offset++] = cBr;
      buf[offset++] = cBg;
      buf[offset++] = cBb;
      buf[offset++] = cBa;
    };

    v(p0x, p0y, 0, 0);
    v(p1x, p1y, 1, 0);
    v(p2x, p2y, 0, 1);
    v(p2x, p2y, 0, 1);
    v(p1x, p1y, 1, 0);
    v(p3x, p3y, 1, 1);

    this.particleVertexCount += 6;
  }

  private pushSegmentQuad(
    x1Norm: number,
    y1Norm: number,
    x2Norm: number,
    y2Norm: number,
    halfWidthPx: number,
    clientW: number,
    clientH: number,
    kind: number,
    param: number,
    cAr: number,
    cAg: number,
    cAb: number,
    cAa: number,
    cBr: number,
    cBg: number,
    cBb: number,
    cBa: number,
  ): void {
    const dxPx = (x2Norm - x1Norm) * clientW;
    const dyPx = (y2Norm - y1Norm) * clientH;
    const lenPx = Math.hypot(dxPx, dyPx);
    if (lenPx < 0.5) return;

    const nxNorm = (-dyPx / lenPx) * (halfWidthPx / Math.max(1, clientW));
    const nyNorm = (dxPx / lenPx) * (halfWidthPx / Math.max(1, clientH));

    // Slightly extend endpoints so consecutive segments overlap cleanly
    const exNorm = ((dxPx / lenPx) * (halfWidthPx * 0.35)) / Math.max(1, clientW);
    const eyNorm = ((dyPx / lenPx) * (halfWidthPx * 0.35)) / Math.max(1, clientH);

    const sx1 = x1Norm - exNorm;
    const sy1 = y1Norm - eyNorm;
    const sx2 = x2Norm + exNorm;
    const sy2 = y2Norm + eyNorm;

    if (this.particleVertexCount + 6 > MAX_PARTICLE_QUADS * 6) return;
    let offset = this.particleVertexCount * PARTICLE_FLOATS_PER_VERTEX;
    const buf = this.particleVertices;

    const v = (px: number, py: number, u: number, vCoord: number) => {
      buf[offset++] = px;
      buf[offset++] = py;
      buf[offset++] = u;
      buf[offset++] = vCoord;
      buf[offset++] = kind;
      buf[offset++] = param;
      buf[offset++] = cAr;
      buf[offset++] = cAg;
      buf[offset++] = cAb;
      buf[offset++] = cAa;
      buf[offset++] = cBr;
      buf[offset++] = cBg;
      buf[offset++] = cBb;
      buf[offset++] = cBa;
    };

    v(sx1 - nxNorm, sy1 - nyNorm, 0, 0);
    v(sx1 + nxNorm, sy1 + nyNorm, 1, 0);
    v(sx2 - nxNorm, sy2 - nyNorm, 0, 1);
    v(sx2 - nxNorm, sy2 - nyNorm, 0, 1);
    v(sx1 + nxNorm, sy1 + nyNorm, 1, 0);
    v(sx2 + nxNorm, sy2 + nyNorm, 1, 1);

    this.particleVertexCount += 6;
  }

  private emitStars(
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    fxProfile: ViewportFxProfile,
  ): void {
    const starCount = scaledPoolCount(this.stars.length, fxProfile.particleCountScale, 16);
    const sizeScale = Math.max(0.78, fxProfile.particleSizeScale);
    for (let k = 0; k < starCount; k += 1) {
      const s = this.stars[sampledPoolIndex(k, starCount, this.stars.length)];
      const twinkle = 0.58 + 0.42 * Math.sin(this.elapsedSeconds * s.twinkleFreq + s.phase);
      const alpha = clamp(u.starOpacity * s.opacity * twinkle, 0, 0.98);
      if (alpha < 0.01) continue;
      const starSize = s.sizePx * sizeScale;

      this.pushOrientedQuad(
        s.x,
        s.y,
        starSize,
        starSize,
        0,
        clientW,
        clientH,
        PARTICLE_KIND.STAR,
        s.spikes,
        s.coreRgb[0],
        s.coreRgb[1],
        s.coreRgb[2],
        alpha,
        s.haloRgb[0],
        s.haloRgb[1],
        s.haloRgb[2],
        alpha,
      );
    }
  }

  private emitMoon(
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    fxProfile: ViewportFxProfile,
  ): void {
    const discAlpha = clamp(u.moonlightOpacity * 1.65, 0, 0.96);
    const coronaAlpha = clamp(u.moonlightOpacity * (0.42 + 0.58 * u.moonIllumination), 0, 0.72);
    if (discAlpha < 0.01) return;

    this.pushOrientedQuad(
      fxProfile.moonX,
      fxProfile.moonY,
      fxProfile.moonHalfSizePx,
      fxProfile.moonHalfSizePx,
      0,
      clientW,
      clientH,
      PARTICLE_KIND.MOON,
      u.moonPhaseFraction,
      0.93,
      0.96,
      1.0,
      discAlpha,
      0.66,
      0.8,
      1.0,
      coronaAlpha,
    );
  }

  private buildWeatherParticles(
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    dt: number,
    lightningFlicker: number,
    fxProfile: ViewportFxProfile,
  ): void {
    if (!this.state) return;
    const condition: WeatherCondition = this.state.condition;
    const phenomenon: WeatherPhenomenon = this.state.phenomenon ?? "none";
    const exposure: WeatherExposure = this.state.exposure ?? "outdoor";

    // 1. Sweeping sinusoidal wind-gust ribbons (cloudy, rain, storm, sandstorm)
    const showGusts =
      !this.reducedMotion &&
      exposure !== "underground" &&
      exposure !== "indoor" &&
      (condition === "cloudy" || condition === "rain" || condition === "storm" || phenomenon === "sandstorm");
    if (showGusts) {
      const gustBoost = condition === "storm" || phenomenon === "sandstorm" ? 1.0 : condition === "rain" ? 0.72 : 0.58;
      const windSign = u.windVelocityX >= 0 ? 1 : -1;
      const gustCount = scaledPoolCount(this.windGusts.length, fxProfile.particleCountScale, 2);
      for (let k = 0; k < gustCount; k += 1) {
        const g = this.windGusts[sampledPoolIndex(k, gustCount, this.windGusts.length)];
        if (dt > 0) {
          g.x += g.speed * (0.65 + Math.abs(u.windVelocityX) * 0.55) * windSign * dt;
          if (g.x > 1.25) g.x -= 1.5;
          if (g.x < -0.25) g.x += 1.5;
        }
        const gAlpha = clamp(g.opacity * gustBoost * (1 + 0.45 * u.backdropBoost), 0, 0.44);
        const isSand = phenomenon === "sandstorm";
        this.pushOrientedQuad(
          g.x,
          g.y,
          g.widthPx * 0.5 * fxProfile.streakWidthScale,
          g.heightPx * 0.5 * fxProfile.particleSizeScale,
          0,
          clientW,
          clientH,
          PARTICLE_KIND.WIND_GUST,
          this.elapsedSeconds * 2.2 + g.phase,
          isSand ? 0.95 : 0.92,
          isSand ? 0.8 : 0.96,
          isSand ? 0.58 : 1.0,
          gAlpha,
          isSand ? 0.82 : 0.72,
          isSand ? 0.64 : 0.84,
          isSand ? 0.42 : 0.98,
          gAlpha,
        );
      }
    }

    // 2. 5-stop longitudinal gradient raindrops + dual-ring ripples + parabolic splash crowns
    if (u.rainOpacity > 0.01 && u.rainDensity > 0.01 && exposure !== "underground") {
      const isStorm = condition === "storm";
      // Trajectory angle from vertical in screen pixels:
      // positive fallAngleRad = falling down-and-right; negative = falling down-and-left
      const fallAngleRad = (-u.windAngleDeg * Math.PI) / 180;
      const tanFallAngle = Math.tan(fallAngleRad);
      const fallVel = 1.12 / Math.max(0.52, u.rainSpeedScale);
      const visibleDensity = this.reducedMotion ? Math.min(u.rainDensity, 0.22) : u.rainDensity;
      const safeClientW = Math.max(1, clientW);
      const safeClientH = Math.max(1, clientH);
      const effectiveFallH = clamp(safeClientH, 560, 1080);

      const rainCount = scaledPoolCount(this.rainDrops.length, fxProfile.particleCountScale, 28);
      for (let k = 0; k < rainCount; k += 1) {
        const drop = this.rainDrops[sampledPoolIndex(k, rainCount, this.rainDrops.length)];
        const densityScale = clamp((visibleDensity - drop.threshold) / 0.09, 0, 1);
        if (densityScale <= 0.01) continue;

        const vyPx = drop.speed * fallVel * effectiveFallH;
        const vyNorm = vyPx / safeClientH;
        const vxPx = tanFallAngle * vyPx;
        const vxNorm = vxPx / safeClientW;
        // Align quad local +Y (v_uv.y = 1 droplet head) directly along pixel velocity (vxPx, vyPx)
        const quadAngleRad = Math.atan2(-vxPx, vyPx);

        if (dt > 0) {
          drop.y += vyNorm * dt;
          drop.x += vxNorm * dt;
          if (drop.y > 1.09) {
            drop.y = -0.09 - (drop.y % 0.08);
            drop.x = (((drop.x + 0.373) % 1) + 1) % 1;
          }
          if (drop.x > 1.12) drop.x -= 1.24;
          if (drop.x < -0.12) drop.x += 1.24;
        }

        const alpha = clamp(
          u.rainOpacity * densityScale * (0.38 + drop.depth * 0.58) * (this.reducedMotion ? 0.35 : 1),
          0.02,
          0.95,
        );

        this.pushOrientedQuad(
          drop.x,
          drop.y,
          drop.widthPx * 0.5 * fxProfile.particleSizeScale,
          drop.lengthPx * 0.5 * fxProfile.particleSizeScale * fxProfile.verticalSpanScale,
          quadAngleRad,
          clientW,
          clientH,
          PARTICLE_KIND.RAIN,
          drop.depth,
          isStorm ? 0.72 : 0.66,
          isStorm ? 0.84 : 0.8,
          1.0,
          alpha,
          0.92,
          0.97,
          1.0,
          alpha,
        );
      }

      if (!this.reducedMotion) {
        // Expanding elliptical water ripples
        const rippleCount = scaledPoolCount(this.ripples.length, fxProfile.particleCountScale, 6);
        for (let k = 0; k < rippleCount; k += 1) {
          const rp = this.ripples[sampledPoolIndex(k, rippleCount, this.ripples.length)];
          if (rp.threshold > visibleDensity) continue;
          if (dt > 0) {
            rp.age += dt;
            if (rp.age >= rp.duration) {
              rp.age = 0;
              rp.x = 0.03 + Math.random() * 0.94;
              rp.y = 0.85 + Math.random() * 0.14;
            }
          }
          const prog = clamp(rp.age / rp.duration, 0, 1);
          const fade = Math.sin(prog * Math.PI) * (1 - prog * 0.35);
          const rAlpha = clamp(u.rainOpacity * fade * 0.72, 0, 0.85);
          if (rAlpha < 0.01) continue;

          const rx = rp.sizePx * fxProfile.particleSizeScale * (0.45 + prog * 1.55);
          this.pushOrientedQuad(
            rp.x,
            rp.y,
            rx,
            rx * 0.38,
            0,
            clientW,
            clientH,
            PARTICLE_KIND.RIPPLE,
            prog,
            0.78,
            0.9,
            1.0,
            rAlpha,
            0.96,
            0.99,
            1.0,
            rAlpha,
          );
        }

        // Parabolic splash crowns + 3 leaping droplets
        const splashCount = scaledPoolCount(this.splashes.length, fxProfile.particleCountScale, 6);
        for (let k = 0; k < splashCount; k += 1) {
          const sp = this.splashes[sampledPoolIndex(k, splashCount, this.splashes.length)];
          if (sp.threshold > visibleDensity) continue;
          if (dt > 0) {
            sp.age += dt;
            if (sp.age >= sp.duration) {
              sp.age = 0;
              sp.x = 0.04 + Math.random() * 0.92;
              sp.y = 0.86 + Math.random() * 0.13;
            }
          }
          const prog = clamp(sp.age / sp.duration, 0, 1);
          if (prog > 0.72) continue;
          const fade = Math.sin((prog / 0.72) * Math.PI);
          const sAlpha = clamp(u.rainOpacity * fade * 0.88, 0, 0.95);
          if (sAlpha < 0.01) continue;

          this.pushOrientedQuad(
            sp.x,
            sp.y,
            sp.sizePx * 0.7 * fxProfile.particleSizeScale,
            sp.sizePx * 0.65 * fxProfile.particleSizeScale,
            0,
            clientW,
            clientH,
            PARTICLE_KIND.SPLASH,
            prog,
            0.84,
            0.93,
            1.0,
            sAlpha,
            1.0,
            1.0,
            1.0,
            sAlpha,
          );
        }
      }
    }

    // 3. Crystalline & bokeh snowflakes + corner ice-fern frost vignette
    if (u.snowOpacity > 0.01 && exposure !== "underground") {
      // Corner frost vignette quads (avoid duplicating full-screen corner fillrate on front in `both` mode)
      const renderFrostCorners = this.kind === "back" || this.prefs?.layerMode !== "both";
      const frostAlpha = renderFrostCorners
        ? clamp(u.snowOpacity * (this.kind === "front" ? 0.34 : 0.40), 0, 0.46)
        : 0;
      if (frostAlpha > 0.02) {
        const cornerW = fxProfile.frostCornerW;
        const cornerH = fxProfile.frostCornerH;
        const corners: ReadonlyArray<readonly [number, number, number]> = [
          [0.02, 0.02, 1.1],
          [0.98, 0.02, 2.7],
          [0.02, 0.98, 4.3],
          [0.98, 0.98, 5.9],
        ];
        for (let c = 0; c < corners.length; c += 1) {
          this.pushOrientedQuad(
            corners[c][0],
            corners[c][1],
            cornerW,
            cornerH,
            0,
            clientW,
            clientH,
            PARTICLE_KIND.FROST_CORNER,
            corners[c][2],
            0.9,
            0.96,
            1.0,
            frostAlpha,
            0.74,
            0.86,
            1.0,
            frostAlpha,
          );
        }
      }

      const isNight = this.state.palette === "night";
      const snowCount = scaledPoolCount(this.snowFlakes.length, fxProfile.particleCountScale, 24);
      for (let k = 0; k < snowCount; k += 1) {
        if (this.reducedMotion && k % 3 !== 0) continue;
        const f = this.snowFlakes[sampledPoolIndex(k, snowCount, this.snowFlakes.length)];
        if (dt > 0) {
          f.y += f.speedY * dt;
          f.x +=
            (u.windVelocityX * 0.028 + Math.sin(this.elapsedSeconds * f.swayFreq + f.phase) * f.swayAmp) * dt;
          if (f.y > 1.05) {
            f.y = -0.05;
            f.x = Math.random();
          }
          if (f.x > 1.05) f.x -= 1.1;
          if (f.x < -0.05) f.x += 1.1;
        }
        const shimmer = 0.76 + 0.24 * Math.sin(this.elapsedSeconds * 2.3 + f.phase);
        const sAlpha = clamp(
          u.snowOpacity * f.opacity * shimmer * (this.reducedMotion ? 0.35 : 1),
          0.02,
          0.95,
        );
        const snowSize = f.sizePx * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          f.x,
          f.y,
          snowSize,
          snowSize,
          0,
          clientW,
          clientH,
          PARTICLE_KIND.SNOW,
          f.crystalParam,
          isNight ? 0.9 : 0.99,
          isNight ? 0.95 : 0.995,
          1.0,
          sAlpha,
          0.74,
          0.86,
          1.0,
          sAlpha,
        );
      }
    }

    // 4. Sunlit golden bokeh motes / bioluminescent cavern spores
    if (u.moteOpacity > 0.008 && phenomenon === "none") {
      const moteBaseCount = Math.min(34, this.phenomenonParticles.length);
      const moteCount = scaledPoolCount(moteBaseCount, fxProfile.particleCountScale, 14);
      const isCavern = u.isUnderground > 0.5;
      for (let k = 0; k < moteCount; k += 1) {
        const m = this.phenomenonParticles[sampledPoolIndex(k, moteCount, moteBaseCount)];
        if (dt > 0) {
          m.x = (((m.x + Math.sin(this.elapsedSeconds * 0.42 + m.phase) * 0.01 * dt) % 1) + 1) % 1;
          m.y =
            (((m.y - 0.007 * dt + Math.cos(this.elapsedSeconds * 0.36 + m.phase) * 0.006 * dt) % 1) + 1) % 1;
        }
        const pulse = 0.52 + 0.48 * Math.sin(this.elapsedSeconds * 1.5 + m.phase);
        const mAlpha = clamp(u.moteOpacity * m.opacity * pulse * 2.8, 0, 0.78);
        if (mAlpha < 0.01) continue;

        const rPx = (4.5 + (m.sizePx - 8) * 0.65) * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          m.x,
          m.y,
          rPx,
          rPx,
          0,
          clientW,
          clientH,
          PARTICLE_KIND.MOTE,
          0,
          isCavern ? 0.72 : 1.0,
          isCavern ? 0.96 : 0.97,
          isCavern ? 1.0 : 0.86,
          mAlpha,
          isCavern ? 0.28 : 1.0,
          isCavern ? 0.76 : 0.84,
          isCavern ? 0.88 : 0.54,
          mAlpha,
        );
      }
    }

    // 5. Overhauled phenomena with dedicated gradient SDF shaders
    if (u.phenomenonOpacity > 0.01 && phenomenon !== "none" && phenomenon !== "aurora") {
      this.emitPhenomena(u, phenomenon, clientW, clientH, dt, fxProfile);
    }

    // 6. Refractive indoor windowpane droplets + trailing wet rivulets
    if (u.windowDropletOpacity > 0.01 && exposure === "indoor") {
      this.emitWindowpane(u, clientW, clientH, dt, fxProfile);
    }

    // 7. Multi-pulse branching plasma lightning bolts
    if (lightningFlicker > 0.015 && this.lightningSegments.length > 0) {
      for (let i = 0; i < this.lightningSegments.length; i += 1) {
        const seg = this.lightningSegments[i];
        const segAlpha = clamp(lightningFlicker * seg.alpha, 0, 1);
        this.pushSegmentQuad(
          seg.x1,
          seg.y1,
          seg.x2,
          seg.y2,
          seg.halfWidthPx,
          clientW,
          clientH,
          PARTICLE_KIND.LIGHTNING,
          0,
          0.82,
          0.92,
          1.0,
          segAlpha,
          0.46,
          0.66,
          1.0,
          segAlpha,
        );
      }
    }
  }

  private emitPhenomena(
    u: AtmosphereUniforms,
    phenomenon: WeatherPhenomenon,
    clientW: number,
    clientH: number,
    dt: number,
    fxProfile: ViewportFxProfile,
  ): void {
    const activeCount = scaledPoolCount(this.phenomenonParticles.length, fxProfile.particleCountScale, 16);
    for (let k = 0; k < activeCount; k += 1) {
      const p = this.phenomenonParticles[sampledPoolIndex(k, activeCount, this.phenomenonParticles.length)];

      let vx = 0;
      let vy = 0;

      if (phenomenon === "embers") {
        vx = u.windVelocityX * 0.038 + Math.sin(this.elapsedSeconds * 2.4 + p.phase) * 0.035;
        vy = -(p.speedY * 1.55 + 0.03);
        if (dt > 0) {
          p.x += vx * dt;
          p.y += vy * dt;
          if (p.y < -0.05) {
            p.y = 1.05;
            p.x = Math.random();
          }
        }
      } else if (phenomenon === "fireflies") {
        vx = Math.cos(this.elapsedSeconds * 0.75 + p.phase) * 0.02;
        vy = Math.sin(this.elapsedSeconds * 0.92 + p.phase * 1.3) * 0.016;
        if (dt > 0) {
          p.x += vx * dt;
          p.y = clamp(p.y + vy * dt, 0.22, 0.95);
        }
      } else if (phenomenon === "sandstorm") {
        const sign = u.windVelocityX >= 0 ? 1 : -1;
        vx = (0.62 + p.speedX * 4.5) * sign;
        vy = Math.sin(this.elapsedSeconds * 3.1 + p.phase) * 0.025;
        if (dt > 0) {
          p.x += vx * dt;
          p.y = (((p.y + vy * dt) % 1) + 1) % 1;
        }
      } else {
        // Blossoms or ashfall
        vx = u.windVelocityX * 0.048 + Math.sin(this.elapsedSeconds * 1.65 + p.phase) * 0.028;
        vy = p.speedY * (phenomenon === "blossoms" ? 0.95 : 0.72);
        if (dt > 0) {
          p.x += vx * dt;
          p.y += vy * dt;
          if (p.y > 1.06) {
            p.y = -0.06;
            p.x = Math.random();
          }
        }
      }

      p.x = ((p.x % 1) + 1) % 1;

      if (phenomenon === "blossoms") {
        const spin = this.elapsedSeconds * p.spinSpeed + p.phase;
        const pitchScale = 0.36 + 0.64 * Math.abs(Math.cos(spin * 0.85));
        const alpha = clamp(u.phenomenonOpacity * p.opacity, 0.05, 0.95);
        const rPx = p.sizePx * 0.92 * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          p.x,
          p.y,
          rPx,
          rPx * pitchScale,
          spin * 0.65,
          clientW,
          clientH,
          PARTICLE_KIND.BLOSSOM,
          0,
          1.0,
          0.77,
          0.87,
          alpha,
          0.98,
          0.52,
          0.73,
          alpha,
        );
      } else if (phenomenon === "embers") {
        const flicker = 0.65 + 0.35 * Math.sin(this.elapsedSeconds * 8.5 + p.phase);
        const alpha = clamp(u.phenomenonOpacity * p.opacity * flicker * 1.18, 0.05, 0.98);
        const angle = Math.atan2(vy * clientH, vx * clientW) - Math.PI * 0.5;
        const rPx = p.sizePx * 0.82 * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          p.x,
          p.y,
          rPx * 0.85,
          rPx * 1.45,
          angle,
          clientW,
          clientH,
          PARTICLE_KIND.EMBER,
          0,
          1.0,
          0.5,
          0.16,
          alpha,
          0.92,
          0.18,
          0.05,
          alpha,
        );
      } else if (phenomenon === "fireflies") {
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(this.elapsedSeconds * 2.15 + p.phase), 2.3);
        const alpha = clamp(u.phenomenonOpacity * pulse * 1.15, 0, 0.98);
        if (alpha < 0.02) continue;
        const rPx = p.sizePx * 1.35 * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          p.x,
          p.y,
          rPx,
          rPx,
          0,
          clientW,
          clientH,
          PARTICLE_KIND.FIREFLY,
          0,
          0.76,
          1.0,
          0.34,
          alpha,
          0.34,
          0.86,
          0.28,
          alpha,
        );
      } else if (phenomenon === "ashfall") {
        const alpha = clamp(u.phenomenonOpacity * p.opacity * 0.88, 0.04, 0.86);
        const rPx = p.sizePx * 0.68 * fxProfile.particleSizeScale;
        this.pushOrientedQuad(
          p.x,
          p.y,
          rPx,
          rPx * (0.55 + 0.45 * Math.abs(Math.sin(this.elapsedSeconds * 1.4 + p.phase))),
          this.elapsedSeconds * 0.8 + p.phase,
          clientW,
          clientH,
          PARTICLE_KIND.ASH,
          p.phase,
          0.84,
          0.87,
          0.92,
          alpha,
          0.44,
          0.47,
          0.53,
          alpha,
        );
      } else if (phenomenon === "sandstorm") {
        const alpha = clamp(u.phenomenonOpacity * p.opacity * 0.55, 0.03, 0.62);
        this.pushOrientedQuad(
          p.x,
          p.y,
          p.sizePx * 5.2 * fxProfile.streakWidthScale,
          p.sizePx * 0.42 * fxProfile.particleSizeScale,
          0.04,
          clientW,
          clientH,
          PARTICLE_KIND.SAND_STREAK,
          0,
          0.95,
          0.79,
          0.55,
          alpha,
          0.78,
          0.56,
          0.33,
          alpha,
        );
      }
    }
  }

  private emitWindowpane(
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    dt: number,
    fxProfile: ViewportFxProfile,
  ): void {
    const activeCount = scaledPoolCount(this.windowDroplets.length, fxProfile.particleCountScale, 10);
    for (let k = 0; k < activeCount; k += 1) {
      const drop = this.windowDroplets[sampledPoolIndex(k, activeCount, this.windowDroplets.length)];
      if (dt > 0) {
        if (drop.pauseTimer > 0) {
          drop.pauseTimer -= dt;
        } else {
          drop.y += drop.speed * dt;
          drop.x += Math.sin(drop.y * 22 + drop.phase) * 0.0028 * dt;
          if (Math.random() < 0.012) {
            drop.pauseTimer = 0.25 + Math.random() * 1.1;
          }
          if (drop.y > 1.06) {
            drop.y = -0.05;
            drop.x = 0.03 + Math.random() * 0.94;
          }
        }
      }

      const alpha = clamp(u.windowDropletOpacity * drop.opacity, 0.04, 0.88);
      const dropRadiusPx = drop.radiusPx * fxProfile.particleSizeScale;
      const trailHalfLenPx =
        drop.trailLengthPx * 0.5 * fxProfile.particleSizeScale * fxProfile.verticalSpanScale;
      const trailHalfHNorm = trailHalfLenPx / Math.max(1, clientH);

      // Tapered sinuous wet rivulet wake above the bead
      this.pushOrientedQuad(
        drop.x,
        drop.y - trailHalfHNorm,
        dropRadiusPx * 0.85,
        trailHalfLenPx,
        0,
        clientW,
        clientH,
        PARTICLE_KIND.WINDOW_TRAIL,
        drop.phase,
        0.84,
        0.93,
        1.0,
        alpha * 0.48,
        0.68,
        0.82,
        0.96,
        alpha * 0.48,
      );

      // 3D pseudo-refractive glass water bead
      this.pushOrientedQuad(
        drop.x,
        drop.y,
        dropRadiusPx * 1.25,
        dropRadiusPx * 1.5,
        0,
        clientW,
        clientH,
        PARTICLE_KIND.WINDOW_DROP,
        0,
        0.86,
        0.95,
        1.0,
        alpha,
        0.48,
        0.64,
        0.82,
        alpha,
      );
    }
  }

  private renderHeadlessFallback(u: AtmosphereUniforms, clientW: number, clientH: number): void {
    const ctx = this.fallbackCtx2d;
    if (!ctx) return;
    if (this.canvas.width !== clientW || this.canvas.height !== clientH) {
      this.canvas.width = clientW;
      this.canvas.height = clientH;
    }
    ctx.clearRect(0, 0, clientW, clientH);
    if (u.renderAtmosphereShader && u.skyOpacity > 0.01) {
      const grad = ctx.createLinearGradient(0, 0, 0, clientH);
      grad.addColorStop(
        0,
        `rgba(${Math.round(u.bgStart[0] * 255)}, ${Math.round(u.bgStart[1] * 255)}, ${Math.round(u.bgStart[2] * 255)}, ${u.skyOpacity})`,
      );
      grad.addColorStop(
        0.5,
        `rgba(${Math.round(u.bgMid[0] * 255)}, ${Math.round(u.bgMid[1] * 255)}, ${Math.round(u.bgMid[2] * 255)}, ${u.skyOpacity})`,
      );
      grad.addColorStop(
        1,
        `rgba(${Math.round(u.bgEnd[0] * 255)}, ${Math.round(u.bgEnd[1] * 255)}, ${Math.round(u.bgEnd[2] * 255)}, ${u.skyOpacity})`,
      );
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, clientW, clientH);
    }
  }
}

const engines = new WeakMap<HTMLElement, AtmosphereEngine>();

export function updateAtmosphereEngine(
  root: HTMLElement,
  kind: "back" | "front",
  options: AtmosphereUpdateOptions,
): AtmosphereEngine | null {
  let engine = engines.get(root);
  if (!options.visible) {
    if (engine) {
      // Release unused WebGL2 contexts when a layer is disabled (e.g., effects off or single-layer mode)
      if (!options.prefs.effectsEnabled || (options.prefs.layerMode !== "both" && options.prefs.layerMode !== kind)) {
        engine.destroy();
        engines.delete(root);
        return null;
      }
      engine.update(options);
    }
    return engine ?? null;
  }
  if (!engine) {
    engine = new AtmosphereEngine(root, kind);
    engines.set(root, engine);
  }
  engine.update(options);
  return engine;
}

export function triggerAtmosphereLightning(root: HTMLElement, boltPositionPercent: number): void {
  engines.get(root)?.triggerLightning(boltPositionPercent);
}

export function destroyAtmosphereEngine(root: HTMLElement): void {
  const engine = engines.get(root);
  if (engine) {
    engine.destroy();
    engines.delete(root);
  }
}
