import {
  resolveRainProfile,
  resolveRainVector,
} from "./fx-utils";
import { clamp } from "./shared";
import { resolveLunarPhase, resolveSolarArc } from "./time-utils";
import type {
  SceneTokens,
  WeatherCondition,
  WeatherExposure,
  WeatherPhenomenon,
  WeatherPrefs,
  WeatherState,
} from "./types";

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

/**
 * Resolves the complete GPU shader & particle uniform target for a layer.
 * In `layerMode === "both"`, the heavy volumetric sky/cloud/star/aurora shader pass
 * runs only on `back` while `front` renders foreground particles & windowpane droplets,
 * cutting fragment shader work in half.
 */
export function resolveAtmosphereUniformTarget(
  state: WeatherState,
  tokens: SceneTokens,
  prefs: WeatherPrefs,
  kind: "back" | "front",
): AtmosphereUniforms {
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const rainVector = resolveRainVector(state.wind, state.windDirection);
  const solar = resolveSolarArc(state.date, state.time);
  const lunar = resolveLunarPhase(state.date, state.time);
  const exposure: WeatherExposure = state.exposure ?? "outdoor";
  const phenomenon: WeatherPhenomenon = state.phenomenon ?? "none";
  const isFront = kind === "front";
  const isBoth = prefs.layerMode === "both";

  const windSpeed = resolveWindSpeedScalar(state.wind);
  const windDirSign = rainVector.driftDirection === 0 ? 0.35 : rainVector.driftDirection;
  const windVelocityX = windSpeed * windDirSign * (exposure === "indoor" ? 0.35 : exposure === "underground" ? 0.15 : 1);

  const renderAtmosphereShader = !isFront || !isBoth;

  return {
    bgStart: parseCssColorToRgba(tokens.bgStart),
    bgMid: parseCssColorToRgba(tokens.bgMid),
    bgEnd: parseCssColorToRgba(tokens.bgEnd),
    glow: parseCssColorToRgba(tokens.glow),
    beamColor: parseCssColorToRgba(tokens.beamColor),
    horizonColor: parseCssColorToRgba(tokens.horizonColor),
    cloudCore: parseCssColorToRgba(tokens.cloudCore),
    cloudEdge: parseCssColorToRgba(tokens.cloudEdge),
    fogColor: parseCssColorToRgba(tokens.fogColor),
    mistColor: parseCssColorToRgba(tokens.mistColor),
    skyOpacity: isFront && isBoth ? 0 : tokens.skyOpacity,
    glowOpacity: isFront ? 0 : tokens.glowOpacity,
    beamOpacity: isFront ? 0 : tokens.beamOpacity,
    cloudOpacity: isFront && isBoth ? 0 : tokens.cloudOpacity,
    horizonOpacity: isFront && isBoth ? 0 : tokens.horizonOpacity,
    mistOpacity: isFront && isBoth ? tokens.mistOpacity * 0.35 : tokens.mistOpacity,
    fogOpacity: isFront && isBoth ? tokens.fogOpacity * 0.32 : tokens.fogOpacity,
    rainOpacity: tokens.rainOpacity,
    snowOpacity: tokens.snowOpacity,
    moteOpacity: isFront && isBoth ? tokens.moteOpacity * 0.45 : tokens.moteOpacity,
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

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Unified single-pass atmospheric fragment shader.
 * Uses branch-gated 2-octave analytical noise so inactive layers (stars/aurora in daytime,
 * clouds/fog in clear skies) cost zero ALU cycles.
 */
const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec4 u_bgStart;
  uniform vec4 u_bgMid;
  uniform vec4 u_bgEnd;
  uniform vec4 u_glow;
  uniform vec4 u_beamColor;
  uniform vec4 u_horizonColor;
  uniform vec4 u_cloudCore;
  uniform vec4 u_cloudEdge;
  uniform vec4 u_fogColor;
  uniform vec4 u_mistColor;

  uniform float u_skyOpacity;
  uniform float u_glowOpacity;
  uniform float u_beamOpacity;
  uniform float u_cloudOpacity;
  uniform float u_horizonOpacity;
  uniform float u_mistOpacity;
  uniform float u_fogOpacity;
  uniform float u_starOpacity;
  uniform float u_moonlightOpacity;
  uniform float u_auroraOpacity;
  uniform float u_moonIllumination;
  uniform float u_moonPhaseFraction;
  uniform float u_windX;
  uniform float u_isSandstorm;
  uniform float u_lightningFlash;
  uniform float u_lightningX;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm2(vec2 p) {
    float v = 0.62 * noise(p);
    p = mat2(0.86, -0.5, 0.5, 0.86) * p * 2.07 + vec2(11.3, 5.7);
    v += 0.38 * noise(p);
    return v;
  }

  float fbm3(vec2 p) {
    float v = 0.54 * noise(p);
    p = mat2(0.86, -0.5, 0.5, 0.86) * p * 2.03 + vec2(11.3, 5.7);
    v += 0.31 * noise(p);
    p = mat2(0.86, 0.5, -0.5, 0.86) * p * 2.01 + vec2(4.1, 9.2);
    v += 0.15 * noise(p);
    return v;
  }

  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / max(1.0, u_resolution.y);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // 1. Sky gradient + solar/horizon scattering
    if (u_skyOpacity > 0.004) {
      float yTop = 1.0 - uv.y;
      vec3 sky = yTop < 0.48
        ? mix(u_bgStart.rgb, u_bgMid.rgb, yTop / 0.48)
        : mix(u_bgMid.rgb, u_bgEnd.rgb, (yTop - 0.48) / 0.52);
      color += sky * u_skyOpacity;
      alpha = max(alpha, u_skyOpacity);
    }

    if (u_horizonOpacity > 0.004) {
      float hMask = smoothstep(0.62, 0.0, uv.y) * u_horizonOpacity * u_horizonColor.a;
      color = mix(color, u_horizonColor.rgb, hMask);
      alpha = max(alpha, hMask);
    }

    // 2. Solar / ambient corona glow & crepuscular god-rays
    if (u_glowOpacity > 0.004) {
      vec2 sunPos = vec2(0.2, 0.82);
      float dSun = length(vec2((uv.x - sunPos.x) * aspect, uv.y - sunPos.y));
      float glowMask = exp(-dSun * 3.1) * u_glowOpacity * u_glow.a;
      color += u_glow.rgb * glowMask;
      alpha = max(alpha, glowMask * 0.85);
    }

    if (u_beamOpacity > 0.004 && uv.y > 0.15) {
      float beamCoord = (uv.x * aspect + uv.y * 0.58) * 5.2 - u_time * 0.04;
      float rays = smoothstep(0.45, 0.92, sin(beamCoord) * 0.5 + 0.5)
        * smoothstep(0.15, 0.95, uv.y)
        * smoothstep(1.0, 0.08, abs(uv.x - 0.28));
      float beamA = rays * u_beamOpacity * u_beamColor.a * 0.65;
      color += u_beamColor.rgb * beamA;
      alpha = max(alpha, beamA * 0.7);
    }

    // 3. Night starfield & astronomical lunar disc
    if (u_starOpacity > 0.005 && uv.y > 0.22) {
      vec2 starGrid = uv * vec2(aspect * 38.0, 38.0);
      vec2 cell = floor(starGrid);
      vec2 local = fract(starGrid) - 0.5;
      float seed = hash21(cell);
      if (seed > 0.89) {
        vec2 jitter = vec2(hash21(cell + 7.1) - 0.5, hash21(cell + 13.7) - 0.5) * 0.62;
        float dist = length(local - jitter);
        float twinkle = 0.65 + 0.35 * sin(u_time * (1.8 + fract(seed * 19.0) * 3.2) + seed * 40.0);
        float star = smoothstep(0.16, 0.015, dist) * twinkle * smoothstep(0.22, 0.65, uv.y);
        vec3 starTint = mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.94, 0.82), fract(seed * 53.0));
        float sAlpha = star * u_starOpacity;
        color += starTint * sAlpha;
        alpha = max(alpha, sAlpha * 0.9);
      }
    }

    if (u_moonlightOpacity > 0.005) {
      vec2 moonCenter = vec2(0.83, 0.82);
      vec2 mp = vec2((uv.x - moonCenter.x) * aspect, uv.y - moonCenter.y);
      float mDist = length(mp);
      float corona = exp(-mDist * 4.2) * u_moonlightOpacity * (0.45 + 0.55 * u_moonIllumination);
      color += vec3(0.68, 0.80, 1.0) * corona * 0.65;
      alpha = max(alpha, corona * 0.55);

      float moonRadius = 0.032;
      if (mDist < moonRadius * 1.15) {
        float disc = smoothstep(moonRadius, moonRadius * 0.88, mDist);
        vec2 normP = mp / moonRadius;
        float z = sqrt(max(0.0, 1.0 - dot(normP, normP)));
        float phaseAngle = u_moonPhaseFraction * 6.2831853;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), 0.08, -cos(phaseAngle)));
        float lit = smoothstep(-0.08, 0.14, dot(vec3(normP.x, normP.y, z), lightDir));
        float moonShade = mix(0.12, 1.0, lit);
        vec3 moonCol = vec3(0.88, 0.93, 1.0) * moonShade;
        float mAlpha = disc * clamp(u_moonlightOpacity * 1.45, 0.0, 0.95);
        color = mix(color, moonCol, mAlpha);
        alpha = max(alpha, mAlpha);
      }
    }

    // 4. Aurora Borealis magnetic curtains
    if (u_auroraOpacity > 0.005 && uv.y > 0.28) {
      float yMask = smoothstep(0.28, 0.62, uv.y) * smoothstep(1.02, 0.72, uv.y);
      float wave1 = sin(p.x * 4.2 + u_time * 0.22 + sin(p.x * 2.1 - u_time * 0.14) * 1.6);
      float curtainX = p.x * 6.5 + wave1 * 1.15 - uv.y * 1.4;
      float streaks = noise(vec2(curtainX * 2.2, uv.y * 1.8 - u_time * 0.08));
      float ribbon = smoothstep(0.32, 0.88, streaks) * yMask;
      vec3 emerald = vec3(0.20, 0.96, 0.66);
      vec3 violet = vec3(0.62, 0.36, 0.98);
      vec3 auroraCol = mix(emerald, violet, smoothstep(0.45, 0.88, uv.y + wave1 * 0.08));
      float aAlpha = ribbon * u_auroraOpacity * 0.82;
      color += auroraCol * aAlpha;
      alpha = max(alpha, aAlpha * 0.75);
    }

    // 5. Volumetric multi-layer clouds
    if (u_cloudOpacity > 0.005 && uv.y > 0.18) {
      float windShift = u_time * 0.022 * u_windX;
      vec2 cloudUv1 = vec2(p.x * 1.65 - windShift, (uv.y - 0.55) * 3.1);
      vec2 cloudUv2 = vec2(p.x * 2.75 - windShift * 1.38 + 4.3, (uv.y - 0.48) * 3.8);
      float c1 = fbm3(cloudUv1);
      float c2 = fbm2(cloudUv2 + vec2(c1 * 0.35, 0.0));
      float cloudHeightMask = smoothstep(0.18, 0.58, uv.y) * smoothstep(1.04, 0.80, uv.y);
      float density = smoothstep(0.38, 0.82, c1 * 0.64 + c2 * 0.46) * cloudHeightMask;

      float topLight = clamp((uv.y - 0.45) * 1.8 + c2 * 0.35, 0.0, 1.0);
      vec3 cColor = mix(u_cloudCore.rgb, u_cloudEdge.rgb, topLight);

      if (u_lightningFlash > 0.01) {
        float lDist = length(vec2((uv.x - u_lightningX) * aspect, uv.y - 0.72));
        float lGlow = exp(-lDist * 3.4) * u_lightningFlash;
        cColor += vec3(0.78, 0.88, 1.0) * lGlow * 1.25;
      }

      float cAlpha = clamp(density * u_cloudOpacity * 1.35, 0.0, 0.92);
      color = mix(color, cColor, cAlpha);
      alpha = max(alpha, cAlpha);
    }

    // 6. Volumetric fog, valley mist & sandstorm veil
    float totalFogOpacity = max(u_fogOpacity, u_mistOpacity * 0.85);
    if (totalFogOpacity > 0.005) {
      float fogSpeed = (0.032 + u_isSandstorm * 0.065) * u_windX;
      vec2 fogUv = vec2(p.x * 2.1 - u_time * fogSpeed, uv.y * 2.6);
      float f1 = fbm2(fogUv);
      float f2 = fbm2(fogUv * 1.7 + vec2(f1 * 0.65, -u_time * 0.018));
      float lowerBias = smoothstep(0.92, 0.06, uv.y);
      float fogField = smoothstep(0.32, 0.82, f1 * 0.55 + f2 * 0.55) * mix(0.45, 1.25, lowerBias);
      vec3 baseFogCol = u_isSandstorm > 0.5
        ? vec3(0.84, 0.66, 0.42)
        : mix(u_mistColor.rgb, u_fogColor.rgb, 0.55);
      float fAlpha = clamp(fogField * totalFogOpacity * 1.25, 0.0, 0.88);
      color = mix(color, baseFogCol, fAlpha);
      alpha = max(alpha, fAlpha);
    }

    // 7. Lightning sky flash
    if (u_lightningFlash > 0.01) {
      float lDist = length(vec2((uv.x - u_lightningX) * aspect, uv.y - 0.78));
      float flashGlow = (exp(-lDist * 2.6) * 0.65 + 0.25) * u_lightningFlash;
      color += vec3(0.84, 0.91, 1.0) * flashGlow;
      alpha = max(alpha, flashGlow * 0.72);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 0.96));
  }
`;

interface RainDropParticle {
  x: number;
  y: number;
  length: number;
  speed: number;
  depth: number;
  threshold: number;
}

interface SplashParticle {
  x: number;
  y: number;
  age: number;
  duration: number;
  size: number;
  threshold: number;
}

interface SnowParticle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  opacity: number;
}

interface PhenomenonParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  phase: number;
  spinSpeed: number;
  opacity: number;
}

interface WindowDroplet {
  x: number;
  y: number;
  radius: number;
  trailLength: number;
  speed: number;
  pauseTimer: number;
  opacity: number;
}

interface LightningBoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
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

export class AtmosphereEngine {
  private readonly glCanvas: HTMLCanvasElement;
  private readonly particleCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private glProgram: WebGLProgram | null = null;
  private glBuffer: WebGLBuffer | null = null;
  private glUniforms: Record<string, WebGLUniformLocation | null> = {};
  private ctx2d: CanvasRenderingContext2D | null = null;

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
  private elapsedSeconds = Math.random() * 50;
  private lastTickMs = 0;
  private lastRenderMs = 0;

  private lightningFlash = 0;
  private lightningX = 0.5;
  private lightningSegments: LightningBoltSegment[] = [];

  private readonly rainDrops: RainDropParticle[] = [];
  private readonly splashes: SplashParticle[] = [];
  private readonly snowFlakes: SnowParticle[] = [];
  private readonly phenomenonParticles: PhenomenonParticle[] = [];
  private readonly windowDroplets: WindowDroplet[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly kind: "back" | "front",
  ) {
    this.glCanvas = document.createElement("canvas");
    this.glCanvas.className = "weather-fx-shader-canvas";
    this.glCanvas.setAttribute("aria-hidden", "true");

    this.particleCanvas = document.createElement("canvas");
    this.particleCanvas.className = "weather-fx-particle-canvas";
    this.particleCanvas.setAttribute("aria-hidden", "true");

    this.root.appendChild(this.glCanvas);
    this.root.appendChild(this.particleCanvas);

    this.initParticlePools();
    this.initWebGL();
    this.ctx2d = this.particleCanvas.getContext("2d", { alpha: true });
    this.tick = this.tick.bind(this);
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
    this.lightningX = clamp(boltPositionPercent / 100, 0.1, 0.9);
    this.lightningFlash = 1;
    if (this.kind === "back" || this.prefs?.layerMode === "front") {
      this.generateLightningBolt(this.lightningX);
    }
    this.dirty = true;
    this.syncLoopState();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.gl) {
      if (this.glBuffer) this.gl.deleteBuffer(this.glBuffer);
      if (this.glProgram) this.gl.deleteProgram(this.glProgram);
      this.gl = null;
    }
    this.glCanvas.remove();
    this.particleCanvas.remove();
  }

  /**
   * Ensures `requestAnimationFrame` ONLY runs when the layer is visible and animating,
   * dropping CPU/GPU usage to 0.0% when hidden, paused, or in reduced-motion mode.
   */
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

  private tick(nowMs: number): void {
    this.animationFrame = null;
    if (this.destroyed) return;

    const docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    if (!this.visible || !docVisible || this.paused || this.reducedMotion) {
      this.syncLoopState();
      return;
    }

    const dt = clamp((nowMs - this.lastTickMs) / 1000, 0.001, 0.065);
    this.lastTickMs = nowMs;

    // Cap rendering at an efficient 30 FPS (33.3ms) so fans remain completely quiet.
    const frameIntervalMs = 1000 / 30;
    if (this.dirty || nowMs - this.lastRenderMs >= frameIntervalMs) {
      const renderDt = this.lastRenderMs > 0 ? clamp((nowMs - this.lastRenderMs) / 1000, 0.01, 0.08) : dt;
      this.elapsedSeconds += renderDt;
      this.lastRenderMs = nowMs;
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

      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - renderDt * 2.2);
      }

      this.renderFrame(renderDt);
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  private initWebGL(): void {
    try {
      const contextOptions: WebGLContextAttributes = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      };
      const gl =
        (this.glCanvas.getContext("webgl2", contextOptions) as WebGLRenderingContext | null) ??
        (this.glCanvas.getContext("webgl", contextOptions) as WebGLRenderingContext | null);
      if (!gl) return;

      const vs = compileGlShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fs = compileGlShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return;
      }

      const buffer = gl.createBuffer();
      if (!buffer) {
        gl.deleteProgram(program);
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );

      gl.useProgram(program);
      const posLoc = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const uniformNames = [
        "u_resolution",
        "u_time",
        "u_bgStart",
        "u_bgMid",
        "u_bgEnd",
        "u_glow",
        "u_beamColor",
        "u_horizonColor",
        "u_cloudCore",
        "u_cloudEdge",
        "u_fogColor",
        "u_mistColor",
        "u_skyOpacity",
        "u_glowOpacity",
        "u_beamOpacity",
        "u_cloudOpacity",
        "u_horizonOpacity",
        "u_mistOpacity",
        "u_fogOpacity",
        "u_starOpacity",
        "u_moonlightOpacity",
        "u_auroraOpacity",
        "u_moonIllumination",
        "u_moonPhaseFraction",
        "u_windX",
        "u_isSandstorm",
        "u_lightningFlash",
        "u_lightningX",
      ];
      for (const name of uniformNames) {
        this.glUniforms[name] = gl.getUniformLocation(program, name);
      }

      this.gl = gl;
      this.glProgram = program;
      this.glBuffer = buffer;
    } catch {
      this.gl = null;
    }
  }

  private initParticlePools(): void {
    const isFront = this.kind === "front";
    const rainCount = isFront ? 54 : 84;
    for (let i = 0; i < rainCount; i += 1) {
      const depth = ((i * 37) % 100) / 100;
      this.rainDrops.push({
        x: ((i * 53.7) % 100) / 100,
        y: ((i * 29.3) % 100) / 100,
        length: (isFront ? 26 : 16) + depth * (isFront ? 28 : 18),
        speed: (isFront ? 1.15 : 0.85) + depth * 0.55,
        depth,
        threshold: (i + 0.5) / rainCount,
      });
    }

    const splashCount = isFront ? 10 : 18;
    for (let i = 0; i < splashCount; i += 1) {
      this.splashes.push({
        x: ((i * 41.9) % 96 + 2) / 100,
        y: 0.88 + ((i * 19.1) % 11) / 100,
        age: (i * 0.17) % 0.85,
        duration: 0.55 + ((i * 13) % 40) / 100,
        size: (isFront ? 9 : 6) + ((i * 7) % 9),
        threshold: (i + 0.5) / splashCount,
      });
    }

    const snowCount = isFront ? 42 : 64;
    for (let i = 0; i < snowCount; i += 1) {
      const depth = ((i * 43) % 100) / 100;
      this.snowFlakes.push({
        x: ((i * 61.3) % 100) / 100,
        y: ((i * 31.7) % 100) / 100,
        radius: (isFront ? 1.6 : 1.1) + depth * (isFront ? 2.6 : 2.0),
        speedY: 0.045 + depth * 0.055,
        swayAmp: 0.012 + depth * 0.02,
        swayFreq: 1.1 + ((i * 17) % 20) / 10,
        phase: i * 1.37,
        opacity: 0.35 + depth * 0.55,
      });
    }

    const phenomCount = isFront ? 26 : 42;
    for (let i = 0; i < phenomCount; i += 1) {
      this.phenomenonParticles.push({
        x: ((i * 47.3) % 100) / 100,
        y: ((i * 73.1) % 100) / 100,
        size: 3 + ((i * 19) % 6),
        speedX: 0.03 + ((i * 23) % 50) / 1000,
        speedY: 0.04 + ((i * 31) % 60) / 1000,
        phase: i * 2.13,
        spinSpeed: 1.2 + ((i * 11) % 30) / 10,
        opacity: 0.45 + ((i * 13) % 50) / 100,
      });
    }

    const dropletCount = isFront ? 26 : 16;
    for (let i = 0; i < dropletCount; i += 1) {
      this.windowDroplets.push({
        x: 0.03 + ((i * 39.7) % 94) / 100,
        y: ((i * 57.1) % 100) / 100,
        radius: 1.6 + ((i * 7) % 5) * 0.55,
        trailLength: 14 + ((i * 13) % 26),
        speed: 0.035 + ((i * 19) % 45) / 1000,
        pauseTimer: (i * 0.7) % 2.4,
        opacity: 0.35 + ((i * 11) % 45) / 100,
      });
    }
  }

  private generateLightningBolt(startX: number): void {
    this.lightningSegments = [];
    let x = startX;
    let y = 0.0;
    const steps = 12;
    for (let i = 0; i < steps; i += 1) {
      const nextY = y + (0.68 / steps) * (0.8 + Math.random() * 0.4);
      const nextX = clamp(x + (Math.random() - 0.5) * 0.09, 0.05, 0.95);
      this.lightningSegments.push({
        x1: x,
        y1: y,
        x2: nextX,
        y2: nextY,
        width: 2.4 - (i / steps) * 1.1,
        alpha: 0.95,
      });

      if (i > 1 && i < steps - 2 && Math.random() < 0.42) {
        let bx = nextX;
        let by = nextY;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let b = 0; b < 4; b += 1) {
          const nbx = clamp(bx + dir * (0.02 + Math.random() * 0.035), 0.02, 0.98);
          const nby = by + 0.045 + Math.random() * 0.03;
          this.lightningSegments.push({
            x1: bx,
            y1: by,
            x2: nbx,
            y2: nby,
            width: 1.2 - b * 0.2,
            alpha: 0.65 - b * 0.12,
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

    this.renderShaderPass(u, clientW, clientH);
    this.renderParticlePass(u, clientW, clientH, dt);
  }

  private renderShaderPass(u: AtmosphereUniforms, clientW: number, clientH: number): void {
    if (!u.renderAtmosphereShader) {
      this.glCanvas.style.display = "none";
      return;
    }
    this.glCanvas.style.display = "block";

    const gl = this.gl;
    if (!gl || !this.glProgram) return;

    // Low-power resolution budget: soft atmospheric fields look identical at 0.55x DPR
    // while using < 20% of the fragment shader fill rate.
    const maxPixels = 240_000;
    const budgetScale = Math.sqrt(maxPixels / Math.max(1, clientW * clientH));
    const scale = Math.min(0.6, window.devicePixelRatio || 1, budgetScale);
    const w = Math.max(1, Math.floor(clientW * scale));
    const h = Math.max(1, Math.floor(clientH * scale));

    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.glCanvas.width = w;
      this.glCanvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.glProgram);

    const loc = this.glUniforms;
    gl.uniform2f(loc.u_resolution ?? null, w, h);
    gl.uniform1f(loc.u_time ?? null, this.elapsedSeconds);
    gl.uniform4fv(loc.u_bgStart ?? null, u.bgStart);
    gl.uniform4fv(loc.u_bgMid ?? null, u.bgMid);
    gl.uniform4fv(loc.u_bgEnd ?? null, u.bgEnd);
    gl.uniform4fv(loc.u_glow ?? null, u.glow);
    gl.uniform4fv(loc.u_beamColor ?? null, u.beamColor);
    gl.uniform4fv(loc.u_horizonColor ?? null, u.horizonColor);
    gl.uniform4fv(loc.u_cloudCore ?? null, u.cloudCore);
    gl.uniform4fv(loc.u_cloudEdge ?? null, u.cloudEdge);
    gl.uniform4fv(loc.u_fogColor ?? null, u.fogColor);
    gl.uniform4fv(loc.u_mistColor ?? null, u.mistColor);

    gl.uniform1f(loc.u_skyOpacity ?? null, u.skyOpacity);
    gl.uniform1f(loc.u_glowOpacity ?? null, u.glowOpacity);
    gl.uniform1f(loc.u_beamOpacity ?? null, u.beamOpacity);
    gl.uniform1f(loc.u_cloudOpacity ?? null, u.cloudOpacity);
    gl.uniform1f(loc.u_horizonOpacity ?? null, u.horizonOpacity);
    gl.uniform1f(loc.u_mistOpacity ?? null, u.mistOpacity);
    gl.uniform1f(loc.u_fogOpacity ?? null, u.fogOpacity);
    gl.uniform1f(loc.u_starOpacity ?? null, u.starOpacity);
    gl.uniform1f(loc.u_moonlightOpacity ?? null, u.moonlightOpacity);
    gl.uniform1f(loc.u_auroraOpacity ?? null, u.auroraOpacity);
    gl.uniform1f(loc.u_moonIllumination ?? null, u.moonIllumination);
    gl.uniform1f(loc.u_moonPhaseFraction ?? null, u.moonPhaseFraction);
    gl.uniform1f(loc.u_windX ?? null, u.windVelocityX);
    gl.uniform1f(loc.u_isSandstorm ?? null, u.isSandstorm);
    gl.uniform1f(loc.u_lightningFlash ?? null, this.lightningFlash);
    gl.uniform1f(loc.u_lightningX ?? null, this.lightningX);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderParticlePass(
    u: AtmosphereUniforms,
    clientW: number,
    clientH: number,
    dt: number,
  ): void {
    const ctx = this.ctx2d;
    if (!ctx || !this.state) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.15);
    const w = Math.max(1, Math.floor(clientW * dpr));
    const h = Math.max(1, Math.floor(clientH * dpr));
    if (this.particleCanvas.width !== w || this.particleCanvas.height !== h) {
      this.particleCanvas.width = w;
      this.particleCanvas.height = h;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientW, clientH);

    // Fallback sky/atmosphere fill if WebGL is unavailable in headless environments
    if (!this.gl && u.renderAtmosphereShader && u.skyOpacity > 0.01) {
      const grad = ctx.createLinearGradient(0, 0, 0, clientH);
      grad.addColorStop(0, `rgba(${Math.round(u.bgStart[0] * 255)}, ${Math.round(u.bgStart[1] * 255)}, ${Math.round(u.bgStart[2] * 255)}, ${u.skyOpacity})`);
      grad.addColorStop(0.5, `rgba(${Math.round(u.bgMid[0] * 255)}, ${Math.round(u.bgMid[1] * 255)}, ${Math.round(u.bgMid[2] * 255)}, ${u.skyOpacity})`);
      grad.addColorStop(1, `rgba(${Math.round(u.bgEnd[0] * 255)}, ${Math.round(u.bgEnd[1] * 255)}, ${Math.round(u.bgEnd[2] * 255)}, ${u.skyOpacity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, clientW, clientH);
    }

    const condition: WeatherCondition = this.state.condition;
    const phenomenon: WeatherPhenomenon = this.state.phenomenon ?? "none";
    const exposure: WeatherExposure = this.state.exposure ?? "outdoor";

    // 1. Rain streaks + splash crowns + ripples
    if (u.rainOpacity > 0.01 && u.rainDensity > 0.01 && exposure !== "underground") {
      this.drawRain(ctx, u, clientW, clientH, dt, condition === "storm");
    }

    // 2. Snowflakes + corner frost vignette
    if (u.snowOpacity > 0.01 && exposure !== "underground") {
      this.drawSnow(ctx, u, clientW, clientH, dt);
    }

    // 3. Sunlit motes / subterranean dust
    if (u.moteOpacity > 0.01 && phenomenon === "none") {
      this.drawMotes(ctx, u, clientW, clientH, dt);
    }

    // 4. Secondary phenomena particles (blossoms, embers, ashfall, fireflies, sandstorm)
    if (u.phenomenonOpacity > 0.01 && phenomenon !== "none" && phenomenon !== "aurora") {
      this.drawPhenomenonParticles(ctx, u, phenomenon, clientW, clientH, dt);
    }

    // 5. Indoor windowpane condensation & sliding water rivulets
    if (u.windowDropletOpacity > 0.01 && exposure === "indoor") {
      this.drawWindowpane(ctx, u, clientW, clientH, dt);
    }

    // 6. Procedural branching lightning bolts
    if (this.lightningFlash > 0.02 && this.lightningSegments.length > 0) {
      this.drawLightningBolts(ctx, clientW, clientH);
    }
  }

  private drawRain(
    ctx: CanvasRenderingContext2D,
    u: AtmosphereUniforms,
    w: number,
    h: number,
    dt: number,
    isStorm: boolean,
  ): void {
    const rad = (-u.windAngleDeg * Math.PI) / 180;
    const sinA = Math.sin(rad);
    const cosA = Math.cos(rad);
    const fallVelocity = 1.05 / Math.max(0.55, u.rainSpeedScale);

    ctx.lineCap = "round";
    ctx.strokeStyle = isStorm ? "rgba(214, 232, 255, 0.85)" : "rgba(192, 222, 255, 0.76)";

    for (let i = 0; i < this.rainDrops.length; i += 1) {
      const drop = this.rainDrops[i];
      const densityAlpha = clamp((u.rainDensity - drop.threshold) / 0.1, 0, 1);
      if (densityAlpha <= 0.01) continue;

      if (dt > 0) {
        drop.y += drop.speed * fallVelocity * dt;
        drop.x += sinA * drop.speed * fallVelocity * dt * 0.45;
        if (drop.y > 1.08) {
          drop.y = -0.08 - (drop.y % 0.08);
          drop.x = ((drop.x + 0.37) % 1 + 1) % 1;
        }
        if (drop.x > 1.06) drop.x -= 1.12;
        if (drop.x < -0.06) drop.x += 1.12;
      }

      const alpha = clamp(u.rainOpacity * densityAlpha * (0.35 + drop.depth * 0.55), 0.04, 0.9);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = (this.kind === "front" ? 1.35 : 1.0) + drop.depth * 0.7;

      const x1 = drop.x * w;
      const y1 = drop.y * h;
      const x2 = x1 + sinA * drop.length;
      const y2 = y1 + cosA * drop.length;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Ground splashes and expanding elliptical ripples
    ctx.strokeStyle = "rgba(216, 236, 255, 0.78)";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < this.splashes.length; i += 1) {
      const sp = this.splashes[i];
      if (sp.threshold > u.rainDensity) continue;

      if (dt > 0) {
        sp.age += dt;
        if (sp.age >= sp.duration) {
          sp.age = 0;
          sp.x = 0.03 + Math.random() * 0.94;
          sp.y = 0.87 + Math.random() * 0.12;
        }
      }

      const progress = clamp(sp.age / sp.duration, 0, 1);
      const fade = Math.sin(progress * Math.PI);
      ctx.globalAlpha = clamp(u.rainOpacity * fade * 0.65, 0, 0.8);

      const cx = sp.x * w;
      const cy = sp.y * h;
      const rx = sp.size * (0.35 + progress * 1.45);
      const ry = rx * 0.32;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (progress < 0.55) {
        const crownLift = Math.sin((progress / 0.55) * Math.PI) * sp.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx - sp.size * 0.3, cy);
        ctx.lineTo(cx - sp.size * 0.48, cy - crownLift);
        ctx.moveTo(cx + sp.size * 0.3, cy);
        ctx.lineTo(cx + sp.size * 0.48, cy - crownLift);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawSnow(
    ctx: CanvasRenderingContext2D,
    u: AtmosphereUniforms,
    w: number,
    h: number,
    dt: number,
  ): void {
    ctx.fillStyle = this.state?.palette === "night" ? "rgba(220, 234, 255, 0.92)" : "rgba(248, 251, 255, 0.96)";

    for (let i = 0; i < this.snowFlakes.length; i += 1) {
      const flake = this.snowFlakes[i];
      if (dt > 0) {
        flake.y += flake.speedY * dt;
        flake.x += (u.windVelocityX * 0.025 + Math.sin(this.elapsedSeconds * flake.swayFreq + flake.phase) * flake.swayAmp) * dt;
        if (flake.y > 1.04) {
          flake.y = -0.04;
          flake.x = Math.random();
        }
        if (flake.x > 1.04) flake.x -= 1.08;
        if (flake.x < -0.04) flake.x += 1.08;
      }

      const shimmer = 0.78 + 0.22 * Math.sin(this.elapsedSeconds * 2.4 + flake.phase);
      ctx.globalAlpha = clamp(u.snowOpacity * flake.opacity * shimmer, 0.03, 0.92);
      const px = flake.x * w;
      const py = flake.y * h;

      ctx.beginPath();
      ctx.arc(px, py, flake.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMotes(
    ctx: CanvasRenderingContext2D,
    u: AtmosphereUniforms,
    w: number,
    h: number,
    dt: number,
  ): void {
    const count = Math.min(18, this.phenomenonParticles.length);
    ctx.fillStyle = u.isUnderground > 0.5 ? "rgba(182, 224, 238, 0.78)" : "rgba(255, 245, 214, 0.88)";

    for (let i = 0; i < count; i += 1) {
      const p = this.phenomenonParticles[i];
      if (dt > 0) {
        p.x = ((p.x + Math.sin(this.elapsedSeconds * 0.4 + p.phase) * 0.008 * dt) % 1 + 1) % 1;
        p.y = ((p.y - 0.006 * dt + Math.cos(this.elapsedSeconds * 0.35 + p.phase) * 0.005 * dt) % 1 + 1) % 1;
      }
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSeconds * 1.6 + p.phase);
      ctx.globalAlpha = clamp(u.moteOpacity * p.opacity * pulse * 2.4, 0, 0.75);
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(1.4, p.size * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPhenomenonParticles(
    ctx: CanvasRenderingContext2D,
    u: AtmosphereUniforms,
    phenomenon: WeatherPhenomenon,
    w: number,
    h: number,
    dt: number,
  ): void {
    for (let i = 0; i < this.phenomenonParticles.length; i += 1) {
      const p = this.phenomenonParticles[i];

      if (dt > 0) {
        if (phenomenon === "embers") {
          p.y -= (p.speedY * 1.45 + 0.025) * dt;
          p.x += (u.windVelocityX * 0.03 + Math.sin(this.elapsedSeconds * 2.2 + p.phase) * 0.028) * dt;
          if (p.y < -0.04) {
            p.y = 1.04;
            p.x = Math.random();
          }
        } else if (phenomenon === "fireflies") {
          p.x += Math.cos(this.elapsedSeconds * 0.75 + p.phase) * 0.018 * dt;
          p.y += Math.sin(this.elapsedSeconds * 0.9 + p.phase * 1.3) * 0.014 * dt;
          p.y = clamp(p.y, 0.25, 0.95);
        } else if (phenomenon === "sandstorm") {
          p.x += (0.55 + p.speedX * 4.2) * (u.windVelocityX >= 0 ? 1 : -1) * dt;
          p.y += Math.sin(this.elapsedSeconds * 3.0 + p.phase) * 0.02 * dt;
        } else {
          // blossoms or ashfall
          p.y += p.speedY * (phenomenon === "blossoms" ? 0.95 : 0.72) * dt;
          p.x += (u.windVelocityX * 0.045 + Math.sin(this.elapsedSeconds * 1.6 + p.phase) * 0.024) * dt;
          if (p.y > 1.05) {
            p.y = -0.05;
            p.x = Math.random();
          }
        }
        p.x = ((p.x % 1) + 1) % 1;
      }

      const px = p.x * w;
      const py = p.y * h;

      if (phenomenon === "blossoms") {
        const tilt = this.elapsedSeconds * p.spinSpeed + p.phase;
        const pitchScale = 0.35 + 0.65 * Math.abs(Math.cos(tilt * 0.85));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(tilt * 0.6);
        ctx.scale(1, pitchScale);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity, 0.05, 0.9);
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 212, 230, 0.94)" : "rgba(255, 174, 206, 0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.95, p.size * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (phenomenon === "embers") {
        const flicker = 0.62 + 0.38 * Math.sin(this.elapsedSeconds * 7.5 + p.phase);
        const r = Math.max(1.4, p.size * 0.46);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * flicker, 0.06, 0.95);
        ctx.fillStyle = "rgba(255, 138, 44, 0.9)";
        ctx.beginPath();
        ctx.arc(px, py, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 242, 192, 0.98)";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      } else if (phenomenon === "fireflies") {
        const glow = Math.pow(0.5 + 0.5 * Math.sin(this.elapsedSeconds * 2.1 + p.phase), 2.4);
        if (glow < 0.06) continue;
        const r = Math.max(1.8, p.size * 0.52);
        ctx.globalAlpha = clamp(u.phenomenonOpacity * glow * 0.42, 0, 0.55);
        ctx.fillStyle = "rgba(182, 250, 88, 0.85)";
        ctx.beginPath();
        ctx.arc(px, py, r * 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = clamp(u.phenomenonOpacity * glow, 0, 0.96);
        ctx.fillStyle = "rgba(246, 255, 190, 0.98)";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      } else if (phenomenon === "ashfall") {
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * 0.82, 0.05, 0.78);
        ctx.fillStyle = "rgba(208, 213, 222, 0.84)";
        ctx.beginPath();
        ctx.ellipse(
          px,
          py,
          p.size * 0.55,
          p.size * 0.36,
          this.elapsedSeconds + p.phase,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (phenomenon === "sandstorm") {
        ctx.globalAlpha = clamp(u.phenomenonOpacity * p.opacity * 0.55, 0.04, 0.6);
        ctx.strokeStyle = "rgba(232, 190, 130, 0.78)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - p.size * 4.5, py);
        ctx.lineTo(px + p.size * 4.5, py + 1.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawWindowpane(
    ctx: CanvasRenderingContext2D,
    u: AtmosphereUniforms,
    w: number,
    h: number,
    dt: number,
  ): void {
    for (let i = 0; i < this.windowDroplets.length; i += 1) {
      const drop = this.windowDroplets[i];
      if (dt > 0) {
        if (drop.pauseTimer > 0) {
          drop.pauseTimer -= dt;
        } else {
          drop.y += drop.speed * dt;
          drop.x += Math.sin(drop.y * 18 + i) * 0.0025 * dt;
          if (Math.random() < 0.015) {
            drop.pauseTimer = 0.25 + Math.random() * 0.9;
          }
          if (drop.y > 1.05) {
            drop.y = -0.04;
            drop.x = 0.03 + Math.random() * 0.94;
          }
        }
      }

      const px = drop.x * w;
      const py = drop.y * h;
      const alpha = clamp(u.windowDropletOpacity * drop.opacity, 0.04, 0.75);

      // Subtle trailing wet rivulet
      ctx.globalAlpha = alpha * 0.42;
      ctx.strokeStyle = "rgba(220, 238, 255, 0.72)";
      ctx.lineWidth = drop.radius * 0.85;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py - drop.trailLength);
      ctx.lineTo(px, py);
      ctx.stroke();

      // Refractive water bead head
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = "rgba(238, 247, 255, 0.92)";
      ctx.beginPath();
      ctx.ellipse(px, py, drop.radius, drop.radius * 1.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawLightningBolts(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let pass = 0; pass < 2; pass += 1) {
      const isGlowPass = pass === 0;
      ctx.strokeStyle = isGlowPass ? "rgba(155, 198, 255, 0.42)" : "rgba(248, 252, 255, 0.96)";

      for (let i = 0; i < this.lightningSegments.length; i += 1) {
        const seg = this.lightningSegments[i];
        ctx.globalAlpha = clamp(this.lightningFlash * seg.alpha, 0, 1);
        ctx.lineWidth = isGlowPass ? seg.width * 3.8 : seg.width;
        ctx.beginPath();
        ctx.moveTo(seg.x1 * w, seg.y1 * h);
        ctx.lineTo(seg.x2 * w, seg.y2 * h);
        ctx.stroke();
      }
    }
    ctx.restore();
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
