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
import { resolveRainProfile, resolveRainVector } from "./fx-utils";
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

  if (palette === "dawn" && !isStorm) {
    core = mixRgb(cloudCore, [0.84, 0.78, 0.86, 1], isRain ? 0.18 : 0.35, cloudCore[3]);
    edge = mixRgb(cloudEdge, [1.0, 0.88, 0.74, 1], 0.48, cloudEdge[3]);
    rimLight = [1.0, 0.87, 0.7, 1];
    underGlow = [0.98, 0.68, 0.48, 1];
    shadowTint = [0.22, 0.26, 0.44, 1];
    underGlowStrength = isRain ? 0.22 : 0.46;
  } else if (palette === "dusk" && !isStorm) {
    core = mixRgb(cloudCore, [0.68, 0.6, 0.76, 1], isRain ? 0.22 : 0.42, cloudCore[3]);
    edge = mixRgb(cloudEdge, [1.0, 0.76, 0.62, 1], 0.46, cloudEdge[3]);
    rimLight = [1.0, 0.78, 0.6, 1];
    underGlow = [0.96, 0.56, 0.42, 1];
    shadowTint = [0.18, 0.15, 0.34, 1];
    underGlowStrength = isRain ? 0.24 : 0.52;
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
    shadowTint = isRain ? [0.16, 0.24, 0.34, 1] : [0.36, 0.48, 0.64, 1];
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
 * Resolves the complete GPU shader & particle uniform target for a layer.
 * In `layerMode === "both"`, the offscreen atmosphere FBO pass runs only on `back`
 * while `front` renders crisp foreground parallax particles, wisps, and windowpane droplets.
 */
export function resolveAtmosphereUniformTarget(
  state: WeatherState,
  tokens: SceneTokens,
  prefs: WeatherPrefs,
  kind: "back" | "front",
): AtmosphereUniforms {
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
    skyOpacity: isFront && isBoth ? 0 : tokens.skyOpacity,
    glowOpacity: isFront && isBoth ? 0 : tokens.glowOpacity,
    beamOpacity: isFront && isBoth ? 0 : tokens.beamOpacity,
    cloudOpacity: isFront && isBoth ? tokens.cloudOpacity * 0.24 : tokens.cloudOpacity,
    horizonOpacity: isFront && isBoth ? 0 : tokens.horizonOpacity,
    mistOpacity: isFront && isBoth ? tokens.mistOpacity * 0.32 : tokens.mistOpacity,
    fogOpacity: isFront && isBoth ? tokens.fogOpacity * 0.28 : tokens.fogOpacity,
    rainOpacity: tokens.rainOpacity,
    snowOpacity: tokens.snowOpacity,
    moteOpacity: isFront && isBoth ? tokens.moteOpacity * 0.48 : tokens.moteOpacity,
    starOpacity: isFront && isBoth ? 0 : tokens.starOpacity,
    moonlightOpacity: isFront && isBoth ? 0 : tokens.moonlightOpacity,
    auroraOpacity: isFront && isBoth ? 0 : tokens.auroraOpacity,
    windowDropletOpacity: tokens.windowDropletOpacity,
    phenomenonOpacity: tokens.phenomenonOpacity,
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

// Shared HTMLCanvasElement atlas built once across all engine instances
let sharedCloudAtlasCanvas: HTMLCanvasElement | null = null;
let sharedCloudAtlasLoading = false;
const activeEngines = new Set<AtmosphereEngine>();

function ensureSharedCloudAtlas(): HTMLCanvasElement | null {
  if (sharedCloudAtlasCanvas) return sharedCloudAtlasCanvas;
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
      const ctx = canvas.getContext("2d");
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

      sharedCloudAtlasCanvas = canvas;
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

  return sharedCloudAtlasCanvas;
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
  private prefs: WeatherPrefs | null = null;
  private visible = false;
  private paused = false;
  private reducedMotion = false;
  private destroyed = false;
  private dirty = true;

  private animationFrame: number | null = null;
  private elapsedSeconds = Math.random() * 40;
  private lastTickMs = 0;

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
  }

  notifyAtlasReady(): void {
    if (this.destroyed) return;
    this.dirty = true;
    this.syncLoopState();
  }

  update(options: AtmosphereUpdateOptions): void {
    if (this.destroyed) return;

    const nextTarget = resolveAtmosphereUniformTarget(
      options.state,
      options.tokens,
      options.prefs,
      options.kind,
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
      this.transitionStartMs = performance.now();
      this.transitionDurationMs = 1200;
    } else {
      this.currentUniforms = nextTarget;
      this.fromUniforms = nextTarget;
      this.targetUniforms = nextTarget;
      this.transitionDurationMs = 0;
    }

    this.state = options.state;
    this.prefs = options.prefs;
    this.visible = options.visible;
    this.paused = options.paused;
    this.reducedMotion = options.reducedMotion;
    this.dirty = true;

    this.syncLoopState();
  }

  triggerLightning(boltPositionPercent = 50): void {
    if (this.destroyed || !this.visible || this.paused || this.reducedMotion) return;
    this.lightningX = clamp(boltPositionPercent / 100, 0.12, 0.88);
    this.lightningAge = 0;
    if (this.kind === "back" || this.prefs?.layerMode === "front") {
      this.generateLightningBolt(this.lightningX);
    } else {
      this.lightningSegments = [];
    }
    this.dirty = true;
    this.syncLoopState();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    activeEngines.delete(this);

    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
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
      this.gl = null;
    }
    this.canvas.remove();
  }

  private syncLoopState(): void {
    if (this.destroyed) return;
    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    const shouldAnimate = this.visible && docVisible && !this.paused && !this.reducedMotion;

    if (!this.visible || !docVisible) {
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      return;
    }

    if (!shouldAnimate) {
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      if (this.dirty) {
        this.currentUniforms = this.targetUniforms;
        this.renderFrame(0);
        this.dirty = false;
      }
      return;
    }

    if (this.animationFrame === null) {
      this.lastTickMs = performance.now();
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }
  }

  /**
   * Runs at smooth native display VSync (60/120/144+ Hz) with zero artificial frame skipping.
   * Because the atmospheric noise shader runs inside a tiny ~480x270 FBO and all sprites/particles
   * are single-draw-call GPU batches, each frame takes < 0.25ms on integrated GPUs.
   */
  private tick(nowMs: number): void {
    this.animationFrame = null;
    if (this.destroyed) return;

    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    if (!this.visible || !docVisible || this.paused || this.reducedMotion) {
      this.syncLoopState();
      return;
    }

    const dt = clamp((nowMs - this.lastTickMs) / 1000, 0.001, 0.05);
    this.lastTickMs = nowMs;
    this.elapsedSeconds += dt;
    this.dirty = false;

    if (this.transitionDurationMs > 0 && this.fromUniforms && this.targetUniforms) {
      const progress = clamp((nowMs - this.transitionStartMs) / this.transitionDurationMs, 0, 1);
      this.currentUniforms = interpolateUniforms(this.fromUniforms, this.targetUniforms, progress);
      if (progress >= 1) {
        this.transitionDurationMs = 0;
      }
    } else {
      this.currentUniforms = this.targetUniforms;
    }

    if (this.lightningAge >= 0) {
      this.lightningAge += dt;
      if (this.lightningAge > 0.68) {
        this.lightningAge = -1;
      }
    }

    this.renderFrame(dt);
    this.animationFrame = window.requestAnimationFrame(this.tick);
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
    return true;
  }

  private ensureCloudAtlasTexture(gl: WebGLRenderingContext): boolean {
    if (this.cloudAtlasUploaded && this.cloudAtlasTex) return true;
    const atlasCanvas = ensureSharedCloudAtlas();
    if (!atlasCanvas) return false;

    const tex = gl.createTexture();
    if (!tex) return false;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
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

    // Multi-depth billowing cloud instances (sorted back-to-front by depth)
    const cloudCount = isFront ? 8 : 18;
    for (let i = 0; i < cloudCount; i += 1) {
      const tier = i / Math.max(1, cloudCount - 1);
      const depth = clamp(0.15 + tier * 0.82, 0.1, 1);
      const row = i % 3;
      this.clouds.push({
        x: ((i * 1.37) / cloudCount + ((i * 17) % 13) * 0.02) % 1.35 - 0.18,
        baseY: (row === 0 ? -0.04 : row === 1 ? 0.02 : 0.08) + ((i * 7) % 9) * 0.008,
        widthPx: (isFront ? 360 : 320) + depth * 170 + ((i * 29) % 80),
        aspect: 0.48 + ((i * 11) % 7) * 0.02,
        depth,
        spriteIndex: i % CLOUD_SOURCES.length,
        flipX: i % 2 === 1,
        speedFactor: 0.55 + depth * 0.65,
        bobAmp: 0.004 + depth * 0.005,
        bobPhase: i * 1.91,
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
        x: 0.02 + ((seed * 47.31) % 96) / 100,
        y: 0.02 + ((seed * 29.17) % 62) / 100,
        sizePx: bright ? 7.5 + (seed % 4) * 1.2 : 3.2 + (seed % 5) * 0.85,
        twinkleFreq: 1.1 + (seed % 9) * 0.32,
        phase: seed * 1.73,
        spikes: bright ? 0.85 : 0.0,
        coreRgb: pal[0],
        haloRgb: pal[1],
        opacity: bright ? 0.96 : 0.52 + (seed % 5) * 0.09,
      });
    }

    // 3-depth parallax gradient raindrops
    const rainCount = isFront ? 78 : 136;
    for (let i = 0; i < rainCount; i += 1) {
      const depth = ((i * 37) % 100) / 100;
      this.rainDrops.push({
        x: ((i * 53.7) % 100) / 100,
        y: ((i * 29.3) % 100) / 100,
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
        x: 0.03 + ((i * 41.9) % 94) / 100,
        y: 0.85 + ((i * 19.3) % 14) / 100,
        age: (i * 0.19) % 0.95,
        duration: 0.75 + ((i * 17) % 45) / 100,
        sizePx: (isFront ? 22 : 15) + ((i * 11) % 16),
        threshold: (i + 0.5) / rippleCount,
      });
    }

    // Parabolic splash crowns + leaping micro-droplets
    const splashCount = isFront ? 12 : 20;
    for (let i = 0; i < splashCount; i += 1) {
      this.splashes.push({
        x: 0.04 + ((i * 59.3) % 92) / 100,
        y: 0.86 + ((i * 23.7) % 13) / 100,
        age: (i * 0.23) % 0.7,
        duration: 0.52 + ((i * 13) % 32) / 100,
        sizePx: (isFront ? 18 : 13) + ((i * 7) % 10),
        threshold: (i + 0.5) / splashCount,
      });
    }

    // Sweeping sinusoidal wind-gust ribbons
    const gustCount = isFront ? 4 : 8;
    for (let i = 0; i < gustCount; i += 1) {
      this.windGusts.push({
        x: ((i * 37) % 140) / 100 - 0.2,
        y: 0.14 + ((i * 29) % 72) / 100,
        widthPx: 180 + ((i * 53) % 180),
        heightPx: 26 + ((i * 17) % 22),
        speed: 0.22 + ((i * 13) % 20) / 100,
        phase: i * 1.4,
        opacity: 0.12 + ((i * 7) % 10) * 0.012,
      });
    }

    // Multi-depth bokeh & 6-point crystalline snowflakes
    const snowCount = isFront ? 58 : 98;
    for (let i = 0; i < snowCount; i += 1) {
      const depth = ((i * 43) % 100) / 100;
      const isCrystal = depth > 0.62 && (isFront || i % 2 === 0);
      this.snowFlakes.push({
        x: ((i * 61.3) % 100) / 100,
        y: ((i * 31.7) % 100) / 100,
        sizePx: isCrystal
          ? (isFront ? 11 : 8.5) + depth * 6.5
          : (isFront ? 5.5 : 4.0) + depth * 5.2,
        speedY: 0.038 + depth * 0.058,
        swayAmp: 0.014 + depth * 0.024,
        swayFreq: 0.9 + ((i * 17) % 18) / 10,
        phase: i * 1.37,
        crystalParam: isCrystal ? 0.58 + (i % 7) * 0.06 : 0.2,
        opacity: 0.42 + depth * 0.52,
      });
    }

    // Secondary phenomena & mote pool
    const phenomCount = isFront ? 34 : 58;
    for (let i = 0; i < phenomCount; i += 1) {
      this.phenomenonParticles.push({
        x: ((i * 47.3) % 100) / 100,
        y: ((i * 73.1) % 100) / 100,
        sizePx: 8 + ((i * 19) % 10),
        speedX: 0.03 + ((i * 23) % 50) / 1000,
        speedY: 0.042 + ((i * 31) % 60) / 1000,
        phase: i * 2.13,
        spinSpeed: 1.3 + ((i * 11) % 28) / 10,
        opacity: 0.52 + ((i * 13) % 45) / 100,
      });
    }

    // Refractive indoor windowpane droplets + trails
    const dropletCount = isFront ? 32 : 16;
    for (let i = 0; i < dropletCount; i += 1) {
      this.windowDroplets.push({
        x: 0.03 + ((i * 39.7) % 94) / 100,
        y: ((i * 57.1) % 100) / 100,
        radiusPx: (isFront ? 4.2 : 3.2) + ((i * 7) % 6) * 0.85,
        trailLengthPx: 28 + ((i * 17) % 52),
        speed: 0.028 + ((i * 19) % 42) / 1000,
        pauseTimer: (i * 0.7) % 2.6,
        phase: i * 1.61,
        opacity: 0.48 + ((i * 11) % 42) / 100,
      });
    }
  }

  private generateLightningBolt(startX: number): void {
    this.lightningSegments = [];
    let x = startX;
    let y = -0.02;
    const steps = 15;
    for (let i = 0; i < steps; i += 1) {
      const nextY = y + (0.74 / steps) * (0.78 + Math.random() * 0.45);
      const nextX = clamp(x + (Math.random() - 0.5) * 0.085, 0.06, 0.94);
      this.lightningSegments.push({
        x1: x,
        y1: y,
        x2: nextX,
        y2: nextY,
        halfWidthPx: 14 - (i / steps) * 5.5,
        alpha: 0.98,
      });

      if (i > 1 && i < steps - 2 && Math.random() < 0.48) {
        let bx = nextX;
        let by = nextY;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let b = 0; b < 4; b += 1) {
          const nbx = clamp(bx + dir * (0.018 + Math.random() * 0.036), 0.02, 0.98);
          const nby = by + 0.042 + Math.random() * 0.032;
          this.lightningSegments.push({
            x1: bx,
            y1: by,
            x2: nbx,
            y2: nby,
            halfWidthPx: 7.5 - b * 1.2,
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

  private renderFrame(dt: number): void {
    const u = this.currentUniforms;
    if (!u || !this.state) return;

    const clientW = this.root.clientWidth || window.innerWidth || 1;
    const clientH = this.root.clientHeight || window.innerHeight || 1;
    if (clientW < 2 || clientH < 2) return;

    if (!this.gl) {
      this.renderHeadlessFallback(u, clientW, clientH);
      return;
    }

    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    const maxMainPixels = 2_400_000;
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

    // PASS 1: Render volumetric sky / aurora / god-rays / 4-octave fog into low-res FBO (~135k pixels)
    let fboReady = false;
    if (u.renderAtmosphereShader) {
      const fboScale = Math.min(0.42, Math.sqrt(138_000 / Math.max(1, clientW * clientH)));
      const fboW = Math.max(64, Math.floor(clientW * fboScale));
      const fboH = Math.max(64, Math.floor(clientH * fboScale));
      fboReady = this.ensureAtmosphereFbo(gl, fboW, fboH);

      if (fboReady && this.atmoFbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.atmoFbo);
        gl.viewport(0, 0, fboW, fboH);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.drawAtmosphereFullscreen(gl, u, fboW, fboH, lightningFlicker);
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
        this.drawAtmosphereFullscreen(gl, u, mainW, mainH, lightningFlicker);
      }
    }

    // Pre-cloud celestial pass: crisp stars & lunar disc sit behind the cloud deck!
    this.particleVertexCount = 0;
    if (u.starOpacity > 0.005) {
      this.emitStars(u, clientW, clientH);
    }
    if (u.moonlightOpacity > 0.005) {
      this.emitMoon(u, clientW, clientH);
    }
    if (this.particleVertexCount > 0) {
      this.flushParticles(gl, frontMaskFlag);
    }

    // PASS 2: Multi-depth hand-painted cloud atlas sprites with 4-stop shader gradients
    this.renderCloudPass(gl, u, clientW, clientH, dt, lightningFlicker, frontMaskFlag);

    // PASS 3: Foreground & atmospheric gradient particles, wind ribbons, droplets & lightning
    this.particleVertexCount = 0;
    this.buildWeatherParticles(u, clientW, clientH, dt, lightningFlicker);
    if (this.particleVertexCount > 0) {
      this.flushParticles(gl, frontMaskFlag);
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
  ): void {
    if (u.cloudOpacity <= 0.005 || u.isUnderground > 0.5) return;
    if (!this.cloudProgram || !this.cloudBuffer) return;
    if (!this.ensureCloudAtlasTexture(gl) || !this.cloudAtlasTex) return;

    this.cloudVertexCount = 0;
    const isBothFront = this.kind === "front" && this.prefs?.layerMode === "both";
    const activeCount = isBothFront ? Math.min(4, this.clouds.length) : this.clouds.length;

    const cellW = Math.floor(ATLAS_SIZE / ATLAS_COLS);
    const cellH = Math.floor(ATLAS_SIZE / ATLAS_ROWS);
    const baseOpacityBoost = clamp(0.45 + u.cloudCore[3] * 0.85, 0.52, 0.98);

    for (let i = 0; i < activeCount; i += 1) {
      const c = this.clouds[i];
      if (dt > 0) {
        c.x += u.windVelocityX * 0.0085 * c.speedFactor * dt;
        if (c.x > 1.28) c.x -= 1.68;
        if (c.x < -0.4) c.x += 1.68;
      }

      const wNorm = clamp((c.widthPx / clientW) * (clientW < 768 ? 1.35 : 1.0), 0.24, 0.72);
      const hNorm = (wNorm * clientW * c.aspect) / Math.max(1, clientH);
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
      const cloudAlpha = clamp(u.cloudOpacity * baseOpacityBoost * c.opacityScale, 0, 0.92);
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

  private flushParticles(gl: WebGLRenderingContext, frontMaskFlag: number): void {
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

  private emitStars(u: AtmosphereUniforms, clientW: number, clientH: number): void {
    for (let i = 0; i < this.stars.length; i += 1) {
      const s = this.stars[i];
      const twinkle = 0.58 + 0.42 * Math.sin(this.elapsedSeconds * s.twinkleFreq + s.phase);
      const alpha = clamp(u.starOpacity * s.opacity * twinkle, 0, 0.98);
      if (alpha < 0.01) continue;

      this.pushOrientedQuad(
        s.x,
        s.y,
        s.sizePx,
        s.sizePx,
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

  private emitMoon(u: AtmosphereUniforms, clientW: number, clientH: number): void {
    const moonHalfSizePx = clamp(Math.min(clientW, clientH) * 0.13, 72, 145);
    const discAlpha = clamp(u.moonlightOpacity * 1.65, 0, 0.96);
    const coronaAlpha = clamp(u.moonlightOpacity * (0.42 + 0.58 * u.moonIllumination), 0, 0.72);
    if (discAlpha < 0.01) return;

    this.pushOrientedQuad(
      0.84,
      0.16,
      moonHalfSizePx,
      moonHalfSizePx,
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
      for (let i = 0; i < this.windGusts.length; i += 1) {
        const g = this.windGusts[i];
        if (dt > 0) {
          g.x += g.speed * (0.65 + Math.abs(u.windVelocityX) * 0.55) * windSign * dt;
          if (g.x > 1.25) g.x -= 1.5;
          if (g.x < -0.25) g.x += 1.5;
        }
        const gAlpha = clamp(g.opacity * gustBoost, 0, 0.32);
        const isSand = phenomenon === "sandstorm";
        this.pushOrientedQuad(
          g.x,
          g.y,
          g.widthPx * 0.5,
          g.heightPx * 0.5,
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

      for (let i = 0; i < this.rainDrops.length; i += 1) {
        const drop = this.rainDrops[i];
        const densityScale = clamp((visibleDensity - drop.threshold) / 0.09, 0, 1);
        if (densityScale <= 0.01) continue;

        const vyNorm = drop.speed * fallVel;
        const vyPx = vyNorm * safeClientH;
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
          drop.widthPx * 0.5,
          drop.lengthPx * 0.5,
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
        for (let i = 0; i < this.ripples.length; i += 1) {
          const rp = this.ripples[i];
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

          const rx = rp.sizePx * (0.45 + prog * 1.55);
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
        for (let i = 0; i < this.splashes.length; i += 1) {
          const sp = this.splashes[i];
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
            sp.sizePx * 0.7,
            sp.sizePx * 0.65,
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
      // Corner frost vignette quads
      const frostAlpha = clamp(u.snowOpacity * (this.kind === "front" ? 0.28 : 0.36), 0, 0.42);
      if (frostAlpha > 0.02) {
        const cornerW = Math.max(220, clientW * 0.34);
        const cornerH = Math.max(180, clientH * 0.34);
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
      for (let i = 0; i < this.snowFlakes.length; i += 1) {
        if (this.reducedMotion && i % 3 !== 0) continue;
        const f = this.snowFlakes[i];
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
        this.pushOrientedQuad(
          f.x,
          f.y,
          f.sizePx,
          f.sizePx,
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
      const moteCount = Math.min(34, this.phenomenonParticles.length);
      const isCavern = u.isUnderground > 0.5;
      for (let i = 0; i < moteCount; i += 1) {
        const m = this.phenomenonParticles[i];
        if (dt > 0) {
          m.x = (((m.x + Math.sin(this.elapsedSeconds * 0.42 + m.phase) * 0.01 * dt) % 1) + 1) % 1;
          m.y =
            (((m.y - 0.007 * dt + Math.cos(this.elapsedSeconds * 0.36 + m.phase) * 0.006 * dt) % 1) + 1) % 1;
        }
        const pulse = 0.52 + 0.48 * Math.sin(this.elapsedSeconds * 1.5 + m.phase);
        const mAlpha = clamp(u.moteOpacity * m.opacity * pulse * 2.8, 0, 0.78);
        if (mAlpha < 0.01) continue;

        const rPx = 4.5 + (m.sizePx - 8) * 0.65;
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
      this.emitPhenomena(u, phenomenon, clientW, clientH, dt);
    }

    // 6. Refractive indoor windowpane droplets + trailing wet rivulets
    if (u.windowDropletOpacity > 0.01 && exposure === "indoor") {
      this.emitWindowpane(u, clientW, clientH, dt);
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
  ): void {
    for (let i = 0; i < this.phenomenonParticles.length; i += 1) {
      const p = this.phenomenonParticles[i];

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
        const rPx = p.sizePx * 0.92;
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
        const rPx = p.sizePx * 0.82;
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
        const rPx = p.sizePx * 1.35;
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
        const rPx = p.sizePx * 0.68;
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
          p.sizePx * 5.2,
          p.sizePx * 0.42,
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
  ): void {
    for (let i = 0; i < this.windowDroplets.length; i += 1) {
      const drop = this.windowDroplets[i];
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
      const trailHalfHNorm = (drop.trailLengthPx * 0.5) / Math.max(1, clientH);

      // Tapered sinuous wet rivulet wake above the bead
      this.pushOrientedQuad(
        drop.x,
        drop.y - trailHalfHNorm,
        drop.radiusPx * 0.85,
        drop.trailLengthPx * 0.5,
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
        drop.radiusPx * 1.25,
        drop.radiusPx * 1.5,
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
): AtmosphereEngine {
  let engine = engines.get(root);
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
