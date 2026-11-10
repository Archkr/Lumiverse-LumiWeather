import { clamp } from "./shared";
import type { WeatherExposure, WeatherPrefs, WeatherState } from "./types";

export type ShimmerStyle = "none" | "aurora" | "fireflies" | "blossoms";

export interface SoundscapeProfile {
  active: boolean;
  exposure: WeatherExposure;
  masterGain: number;
  lowpassHz: number;
  /** Convolution reverb return level (room / shelter / cave size cue). */
  reverbWet: number;
  rainWashGain: number;
  rainPatterGain: number;
  /** Individual droplet impacts per second (granular layer on top of the wash). */
  dropletRate: number;
  /** 0..1 crossfade between the sparse (light shower) and dense (downpour) ground textures. */
  rainDensity: number;
  windGain: number;
  windCenterHz: number;
  /** 0..1 how much the wind surges and lulls between gusts. */
  gustiness: number;
  windWhistleGain: number;
  sandGritGain: number;
  /** Quiet ever-present air / room tone so calm scenes are never dead silent. */
  airBedGain: number;
  airBedToneHz: number;
  emberCrackleGain: number;
  shimmerDroneGain: number;
  shimmerStyle: ShimmerStyle;
  sparkleGain: number;
  /** Sparkle chimes per second. */
  sparkleRate: number;
  cricketGain: number;
  birdGain: number;
  caveDripGain: number;
  thunderGainScale: number;
  /** 0..1 bias toward close (sharp crack, short delay) versus distant strikes. */
  thunderProximity: number;
}

const EXPOSURE_LOWPASS_HZ: Record<WeatherExposure, number> = {
  outdoor: 16000,
  sheltered: 4200,
  indoor: 420,
  underground: 240,
};

const EXPOSURE_REVERB_WET: Record<WeatherExposure, number> = {
  outdoor: 0.12,
  sheltered: 0.2,
  indoor: 0.24,
  underground: 0.5,
};

function byExposure(exposure: WeatherExposure, outdoor: number, sheltered: number, indoor: number, underground: number): number {
  switch (exposure) {
    case "sheltered":
      return sheltered;
    case "indoor":
      return indoor;
    case "underground":
      return underground;
    default:
      return outdoor;
  }
}

function resolveWindStrengthFactor(wind: string): number {
  const normalized = wind.trim().toLowerCase();
  if (/hurricane|violent|gale|hard|strong|gust|howl/.test(normalized)) return 0.92;
  if (/steady|breezy|windy|crosswind|brisk/.test(normalized)) return 0.54;
  if (/light|soft|cool drift|gentle/.test(normalized)) return 0.26;
  if (/still|calm|hushed|none/.test(normalized)) return 0.06;
  return 0.34;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function silentProfile(exposure: WeatherExposure): SoundscapeProfile {
  return {
    active: false,
    exposure,
    masterGain: 0,
    lowpassHz: EXPOSURE_LOWPASS_HZ[exposure],
    reverbWet: 0,
    rainWashGain: 0,
    rainPatterGain: 0,
    dropletRate: 0,
    rainDensity: 0,
    windGain: 0,
    windCenterHz: 200,
    gustiness: 0,
    windWhistleGain: 0,
    sandGritGain: 0,
    airBedGain: 0,
    airBedToneHz: 800,
    emberCrackleGain: 0,
    shimmerDroneGain: 0,
    shimmerStyle: "none",
    sparkleGain: 0,
    sparkleRate: 0,
    cricketGain: 0,
    birdGain: 0,
    caveDripGain: 0,
    thunderGainScale: 0,
    thunderProximity: 0,
  };
}

/**
 * Pure acoustic profile resolver for the active weather scene.
 * Computes filter cutoffs, layer gains, and event densities deterministically for
 * both unit tests and the live WebAudio synthesizer. All the moment-to-moment
 * variation (gusts, swells, droplets, wildlife) is layered on top by the engine.
 */
export function resolveSoundscapeProfile(
  state: WeatherState | null,
  prefs: WeatherPrefs,
  visible = true,
): SoundscapeProfile {
  const soundEnabled = Boolean(prefs.soundEnabled);
  const volume = clamp(Number.isFinite(prefs.soundVolume) ? (prefs.soundVolume as number) : 0.45, 0, 1);
  const rainVolume = clamp(Number.isFinite(prefs.rainVolume) ? (prefs.rainVolume as number) : 1, 0, 1);
  const windVolume = clamp(Number.isFinite(prefs.windVolume) ? (prefs.windVolume as number) : 1, 0, 1);
  const thunderVolume = clamp(Number.isFinite(prefs.thunderVolume) ? (prefs.thunderVolume as number) : 1, 0, 1);
  const ambienceVolume = clamp(
    Number.isFinite(prefs.ambienceVolume) ? (prefs.ambienceVolume as number) : 1,
    0,
    1,
  );
  const exposure: WeatherExposure = state?.exposure ?? "outdoor";
  const lowpassHz = EXPOSURE_LOWPASS_HZ[exposure];

  if (!visible || !soundEnabled || prefs.pauseEffects || !state || volume <= 0) {
    return silentProfile(exposure);
  }

  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const normalizedIntensity = clamp(effectiveIntensity / 1.2, 0, 1);
  const phenomenon = state.phenomenon ?? "none";
  const condition = state.condition;
  const rainLike = condition === "rain" || condition === "storm";
  const isStorm = condition === "storm";

  // --- Rain -----------------------------------------------------------------
  const rainWashBase =
    rainLike && exposure !== "underground"
      ? clamp(0.2 + normalizedIntensity * 0.52 + (isStorm ? 0.14 : 0), 0.15, 0.92)
      : 0;
  const rainPatterBase =
    rainLike && exposure !== "underground"
      ? clamp(0.14 + normalizedIntensity * 0.44 + (isStorm ? 0.08 : 0), 0.1, 0.78)
      : 0;

  const rainExposureScale = byExposure(exposure, 1, 0.85, 0.62, 0);
  const patterExposureScale = byExposure(exposure, 1, 0.68, 0.32, 0);
  const dropletRate =
    rainLike && exposure !== "underground" && rainVolume > 0
      ? (2 + normalizedIntensity * 9 + (isStorm ? 3 : 0)) * byExposure(exposure, 1, 0.75, 0.6, 0)
      : 0;
  const rainDensity = rainLike ? clamp(normalizedIntensity * 0.85 + (isStorm ? 0.25 : 0), 0, 1) : 0;

  // --- Wind -----------------------------------------------------------------
  const windFactor = resolveWindStrengthFactor(state.wind);
  const conditionWindBoost = isStorm ? 0.28 : condition === "snow" ? 0.12 : phenomenon === "sandstorm" ? 0.34 : 0;
  const windExposureScale = byExposure(exposure, 1, 0.78, 0.38, 0.22);
  const windGain = clamp(
    (0.04 + windFactor * 0.46 + conditionWindBoost + normalizedIntensity * 0.14) * windExposureScale,
    0,
    0.78,
  );
  const windCenterHz = Math.round(
    150 + windFactor * 220 + (phenomenon === "sandstorm" ? 90 : 0) - (condition === "snow" ? 30 : 0),
  );
  const gustiness = clamp(
    0.12 + windFactor * 0.72 + (isStorm ? 0.2 : 0) + (phenomenon === "sandstorm" ? 0.15 : 0),
    0.1,
    1,
  );
  const whistleDrive = clamp((windFactor - 0.3) * 0.9 + (isStorm ? 0.12 : 0) + (phenomenon === "sandstorm" ? 0.1 : 0), 0, 0.55);
  const windWhistleGain = windGain * whistleDrive;
  const sandGritGain =
    phenomenon === "sandstorm"
      ? clamp(0.16 + normalizedIntensity * 0.36, 0, 0.5) * windExposureScale
      : phenomenon === "ashfall"
        ? clamp(0.05 + normalizedIntensity * 0.12, 0, 0.2) * windExposureScale
        : 0;

  // --- Ambient air / room bed --------------------------------------------------
  const airBedGain =
    byExposure(exposure, 0.05, 0.045, 0.032, 0.05) +
    (condition === "fog" ? 0.02 : 0) +
    (condition === "snow" ? 0.012 : 0) +
    (phenomenon === "ashfall" ? 0.03 : 0);
  const airBedToneHz =
    exposure === "indoor"
      ? 210
      : exposure === "underground"
        ? 130
        : phenomenon === "ashfall"
          ? 280
          : condition === "fog"
            ? 360
            : condition === "snow"
              ? 480
              : rainLike
                ? 700
                : condition === "cloudy"
                  ? 850
                  : 1050;

  // --- Phenomena --------------------------------------------------------------
  const emberCrackleGain =
    phenomenon === "embers"
      ? clamp((0.18 + normalizedIntensity * 0.32) * (exposure === "indoor" ? 0.55 : 1), 0.12, 0.58)
      : 0;

  const shimmerStyle: ShimmerStyle =
    exposure !== "underground" && (phenomenon === "aurora" || phenomenon === "fireflies" || phenomenon === "blossoms")
      ? phenomenon
      : "none";
  const shimmerDroneGain =
    shimmerStyle === "aurora" || shimmerStyle === "fireflies"
      ? clamp((0.07 + normalizedIntensity * 0.12) * (exposure === "indoor" ? 0.5 : 1), 0.04, 0.24) *
        (shimmerStyle === "fireflies" ? 0.55 : 1)
      : shimmerStyle === "blossoms"
        ? clamp((0.03 + normalizedIntensity * 0.05) * (exposure === "indoor" ? 0.45 : 1), 0.02, 0.1)
        : 0;
  const sparkleGain =
    shimmerStyle === "fireflies"
      ? clamp(0.12 + normalizedIntensity * 0.1, 0, 0.24) * byExposure(exposure, 1, 0.8, 0.4, 0)
      : shimmerStyle === "aurora"
        ? clamp(0.06 + normalizedIntensity * 0.06, 0, 0.14) * byExposure(exposure, 1, 0.8, 0.4, 0)
        : shimmerStyle === "blossoms"
          ? clamp(0.07 + normalizedIntensity * 0.07, 0, 0.16) * byExposure(exposure, 1, 0.8, 0.4, 0)
          : 0;
  const sparkleRate =
    shimmerStyle === "fireflies"
      ? 0.9 + normalizedIntensity * 2.2
      : shimmerStyle === "aurora"
        ? 0.22 + normalizedIntensity * 0.35
        : shimmerStyle === "blossoms"
          ? 0.45 + normalizedIntensity * 0.9
          : 0;

  // --- Wildlife ---------------------------------------------------------------
  const season = state.season;
  const wildlifeBlocked =
    phenomenon === "sandstorm" || phenomenon === "ashfall" || windFactor > 0.8 || rainLike || condition === "snow";
  const isNight = state.palette === "night" || state.palette === "dusk";
  const isDay = state.palette === "dawn" || state.palette === "day";
  const calmSkyScale = condition === "clear" ? 1 : condition === "cloudy" ? 0.85 : condition === "fog" ? 0.55 : 0;
  const wildlifeExposure = byExposure(exposure, 1, 0.65, 0.2, 0);

  const cricketSeason = season === "summer" ? 0.2 : season === "autumn" ? 0.15 : season === "spring" ? 0.1 : 0;
  const cricketGain =
    !wildlifeBlocked && isNight
      ? cricketSeason * calmSkyScale * wildlifeExposure * (phenomenon === "fireflies" ? 1.3 : 1)
      : 0;

  const birdSeason = season === "spring" ? 0.2 : season === "summer" ? 0.17 : season === "autumn" ? 0.09 : 0.04;
  const birdGain =
    !wildlifeBlocked && isDay && phenomenon !== "embers"
      ? birdSeason * calmSkyScale * wildlifeExposure * (state.palette === "dawn" ? 1.35 : 1)
      : 0;

  const caveDripGain = exposure === "underground" ? 0.22 + (rainLike ? 0.14 : 0) : 0;

  // --- Thunder ----------------------------------------------------------------
  const thunderGainScale = isStorm
    ? clamp((0.45 + normalizedIntensity * 0.48) * byExposure(exposure, 1, 0.88, 0.58, 0.18), 0, 1)
    : 0;
  const thunderProximity = isStorm ? clamp(0.2 + normalizedIntensity * 0.6, 0, 1) : 0;

  return {
    active: true,
    exposure,
    masterGain: round3(volume),
    lowpassHz,
    reverbWet: EXPOSURE_REVERB_WET[exposure],
    rainWashGain: round3(rainWashBase * rainExposureScale * rainVolume),
    rainPatterGain: round3(rainPatterBase * patterExposureScale * rainVolume),
    dropletRate: round3(dropletRate),
    rainDensity: round3(rainDensity),
    windGain: round3(windGain * windVolume),
    windCenterHz,
    gustiness: round3(gustiness),
    windWhistleGain: round3(windWhistleGain * windVolume),
    sandGritGain: round3(sandGritGain * windVolume),
    airBedGain: round3(airBedGain * ambienceVolume),
    airBedToneHz,
    emberCrackleGain: round3(emberCrackleGain * ambienceVolume),
    shimmerDroneGain: round3(shimmerDroneGain * ambienceVolume),
    shimmerStyle,
    sparkleGain: round3(sparkleGain * ambienceVolume),
    sparkleRate: round3(sparkleRate),
    cricketGain: round3(cricketGain * ambienceVolume),
    birdGain: round3(birdGain * ambienceVolume),
    caveDripGain: round3(caveDripGain * ambienceVolume),
    thunderGainScale: round3(thunderGainScale * thunderVolume),
    thunderProximity: round3(thunderProximity),
  };
}

// ============================================================================
// Live WebAudio synthesizer
// ============================================================================

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

type NoiseMode = "white" | "pink" | "brown";

/**
 * Fills one channel with noise. Every channel gets an independent random stream so
 * stereo beds are fully decorrelated (wide) instead of a mono point source.
 */
function fillNoise(data: Float32Array, mode: NoiseMode): void {
  const length = data.length;
  if (mode === "white") {
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    return;
  }

  if (mode === "brown") {
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.2;
    }
    return;
  }

  // Paul Kellet's pink noise filter approximation
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
}

/**
 * Builds a seamlessly looping multi-channel noise buffer. Extra samples are rendered
 * past the loop point and cross-faded into the head so the loop seam has no click.
 * Different layers use different (non-multiple) lengths so their loops never line up.
 */
function createNoiseBuffer(ctx: AudioContext, seconds: number, mode: NoiseMode, channels = 2): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const fade = Math.min(Math.floor(ctx.sampleRate * 0.25), Math.floor(length / 4));
  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  const scratch = new Float32Array(length + fade);

  for (let channel = 0; channel < channels; channel += 1) {
    fillNoise(scratch, mode);
    const data = buffer.getChannelData(channel);
    data.set(scratch.subarray(0, length));
    for (let index = 0; index < fade; index += 1) {
      const mix = index / fade;
      // Equal-power crossfade from the over-rendered tail into the head.
      data[index] = scratch[index]! * Math.sin(mix * Math.PI * 0.5) + scratch[length + index]! * Math.cos(mix * Math.PI * 0.5);
    }
  }
  return buffer;
}

/** Procedural stereo impulse response: early reflections + darkening exponential tail. */
function createImpulseResponse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let smoothed = 0;
    let energy = 0;
    for (let index = 0; index < length; index += 1) {
      const t = index / length;
      // High frequencies decay faster than lows, like real air absorption.
      const alpha = 0.92 - 0.82 * t;
      smoothed += alpha * (Math.random() * 2 - 1 - smoothed);
      const value = smoothed * Math.pow(1 - t, 3.2);
      data[index] = value;
      energy += value * value;
    }
    for (let reflection = 0; reflection < 9; reflection += 1) {
      const at = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.075));
      if (at < length) data[at] = (data[at] ?? 0) + (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.35) * Math.sqrt(energy / length) * 20;
    }
    // Normalize to unit energy so the wet return sits at a predictable level.
    let total = 0;
    for (let index = 0; index < length; index += 1) total += data[index]! * data[index]!;
    const scale = total > 0 ? 1 / Math.sqrt(total) : 1;
    for (let index = 0; index < length; index += 1) data[index] = data[index]! * scale;
  }
  return buffer;
}

/**
 * Pre-renders a seamlessly looping "rain hitting the ground" texture out of thousands
 * of tiny individual drop impacts. Each impact is a few milliseconds of decaying noise
 * through its own band-pass resonance (small drops bright and short, big drops duller
 * and longer), with a heavily skewed loudness distribution: a bed of countless faint
 * hits with a few nearer, louder ones poking out. Grains wrap around the buffer end,
 * so the loop has no seam.
 */
function createRainTextureBuffer(ctx: AudioContext, seconds: number, dropsPerSecond: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const count = Math.floor(seconds * dropsPerSecond);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let drop = 0; drop < count; drop += 1) {
      const start = Math.floor(Math.random() * length);
      const size = Math.random(); // 0 = tiny droplet, 1 = fat drop
      const centerHz = 5200 * Math.pow(600 / 5200, size * 0.85 + Math.random() * 0.15);
      const tau = sampleRate * (0.0012 + size * 0.006 + Math.random() * 0.002);
      const amp = Math.pow(Math.random(), 3.2) * (0.4 + size * 0.6);
      const q = 0.7 + Math.random() * 1.3;

      // RBJ band-pass (constant 0 dB peak gain).
      const w0 = (2 * Math.PI * centerHz) / sampleRate;
      const alpha = Math.sin(w0) / (2 * q);
      const a0 = 1 + alpha;
      const b0 = alpha / a0;
      const b2 = -alpha / a0;
      const a1 = (-2 * Math.cos(w0)) / a0;
      const a2 = (1 - alpha) / a0;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      let env = 1;
      const decay = Math.exp(-1 / tau);
      const grainLength = Math.min(length, Math.floor(tau * 6));
      for (let index = 0; index < grainLength; index += 1) {
        const x = (Math.random() * 2 - 1) * env;
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        env *= decay;
        const at = (start + index) % length;
        data[at] = data[at]! + y * amp;
      }
    }

    // Normalize to a consistent RMS so light and heavy textures crossfade evenly.
    let energy = 0;
    for (let index = 0; index < length; index += 1) energy += data[index]! * data[index]!;
    const rms = Math.sqrt(energy / length);
    const scale = rms > 0 ? 0.16 / rms : 1;
    for (let index = 0; index < length; index += 1) data[index] = clamp(data[index]! * scale, -1, 1);
  }
  return buffer;
}

/**
 * Pre-renders a seamlessly looping hearth/ember bed: soft resin sizzles, warm woody
 * micro-pops, and fluttering flame-draft swells so embers sound like a living fire
 * instead of a Geiger-counter click train.
 */
function createFireBedBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);

    // 1. Soft resin/charcoal sizzles: gentle 25-180ms band-passed hisses.
    const sizzles = Math.floor(seconds * 14);
    for (let sizzle = 0; sizzle < sizzles; sizzle += 1) {
      const start = Math.floor(Math.random() * length);
      const dur = Math.floor(sampleRate * rand(0.025, 0.18));
      const attack = Math.max(1, Math.floor(dur * 0.22));
      const centerHz = rand(650, 2200);
      const q = rand(0.6, 1.3);
      const amp = Math.pow(Math.random(), 2) * 0.18;

      const w0 = (2 * Math.PI * centerHz) / sampleRate;
      const alpha = Math.sin(w0) / (2 * q);
      const a0 = 1 + alpha;
      const b0 = alpha / a0;
      const b2 = -alpha / a0;
      const a1 = (-2 * Math.cos(w0)) / a0;
      const a2 = (1 - alpha) / a0;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      for (let index = 0; index < dur; index += 1) {
        const env = index < attack ? index / attack : Math.exp(-(index - attack) / (dur * 0.35));
        const x = (Math.random() * 2 - 1) * env;
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        const at = (start + index) % length;
        data[at] = data[at]! + y * amp;
      }
    }

    // 2. Warm woody micro-crackles: damped low-mid thuds + soft wood resonance (no harsh high ticks).
    const crackles = Math.floor(seconds * 28);
    for (let crack = 0; crack < crackles; crack += 1) {
      const start = Math.floor(Math.random() * length);
      const centerHz = rand(280, 1450);
      const tau = sampleRate * rand(0.0025, 0.012);
      const amp = Math.pow(Math.random(), 3) * 0.38;
      const q = rand(0.9, 2.1);

      const w0 = (2 * Math.PI * centerHz) / sampleRate;
      const alpha = Math.sin(w0) / (2 * q);
      const a0 = 1 + alpha;
      const b0 = alpha / a0;
      const b2 = -alpha / a0;
      const a1 = (-2 * Math.cos(w0)) / a0;
      const a2 = (1 - alpha) / a0;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      let env = 1;
      const decay = Math.exp(-1 / tau);
      const grainLength = Math.min(length, Math.floor(tau * 6));
      for (let index = 0; index < grainLength; index += 1) {
        const x = (Math.random() * 2 - 1) * env;
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        env *= decay;
        const at = (start + index) % length;
        data[at] = data[at]! + y * amp;
      }
    }

    let energy = 0;
    for (let index = 0; index < length; index += 1) energy += data[index]! * data[index]!;
    const rms = Math.sqrt(energy / length);
    const scale = rms > 0 ? 0.14 / rms : 1;
    for (let index = 0; index < length; index += 1) data[index] = clamp(data[index]! * scale, -1, 1);
  }
  return buffer;
}

/**
 * Renders one complete thunder strike offline.
 *
 * Models the lightning channel as many segments at different distances from the
 * listener: each segment's shock wave arrives at a different time, so the result is
 * a cluster of overlapping low bursts (the "rolling") grouped around a few return
 * strokes, over a fluctuating rumble bed. Close strikes add a dense train of tiny
 * bright impulses (the tearing "crack") and start bright, closing down quickly as air
 * absorbs the highs; distant strikes have no crack, a softer onset, a later peak, and
 * stay dark throughout. Rendered at a reduced sample rate since thunder is mostly
 * low-frequency energy, which keeps the main-thread cost to a few milliseconds.
 */
function renderThunderBuffer(ctx: AudioContext, distance: number): AudioBuffer {
  const sampleRate = 22050;
  const close = 1 - distance;
  const duration = 4.5 + Math.random() * 3 + distance * 2.5;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  // ---- Shared event plan (both ears hear the same strike) ----
  const strokeTimes: number[] = [];
  const strokes = 2 + Math.floor(Math.random() * 4);
  let strokeAt = 0;
  for (let index = 0; index < strokes; index += 1) {
    strokeTimes.push(strokeAt);
    strokeAt += 0.05 + Math.random() * 0.3;
  }
  interface ThunderEvent {
    t: number;
    amp: number;
    seconds: number;
    tone: number;
  }
  const events: ThunderEvent[] = [];
  const segments = 60 + Math.floor(Math.random() * 90);
  for (let index = 0; index < segments; index += 1) {
    const r1 = Math.random();
    const r2 = Math.random();
    // Close: energy front-loaded. Far: arrivals spread out with a later, softer peak.
    const spread = close * Math.pow(r1, 1.8) + (1 - close) * ((r1 + r2) / 2);
    const t = pick(strokeTimes) + 0.02 + spread * duration * 0.7;
    const amp = (0.2 + 0.8 * Math.pow(Math.random(), 2)) * Math.exp(-t / (duration * 0.45));
    events.push({ t, amp, seconds: 0.04 + Math.random() * (0.2 + distance * 0.35), tone: Math.random() });
  }
  // A few dominant booms on the main return strokes.
  for (const t of strokeTimes) {
    events.push({ t: t + distance * 0.25 * Math.random(), amp: 0.9 + Math.random() * 0.5, seconds: 0.25 + Math.random() * 0.4, tone: 0.3 });
  }

  const cutoffStart = 260 + close * close * 2600;
  const cutoffEnd = 85 + close * 80;
  const crackWeight = clamp((close - 0.5) / 0.5, 0, 1);
  const crackSeconds = 0.15 + Math.random() * 0.35;
  const crackImpulses = Math.floor(120 + close * 520);
  const fadeOut = Math.floor(sampleRate * 0.4);
  let peak = 0;

  for (let channel = 0; channel < 2; channel += 1) {
    const rumble = new Float32Array(length);

    // Overlapping low bursts, slightly decorrelated per ear for width.
    for (const event of events) {
      const start = Math.floor((event.t + Math.random() * 0.012) * sampleRate);
      const samples = Math.floor(event.seconds * sampleRate);
      const attack = Math.max(1, Math.floor(sampleRate * (0.004 + distance * 0.04)));
      const tau = samples / 3;
      const c = 0.015 + event.tone * 0.07;
      const compensation = 1 / Math.sqrt(c / 2);
      let brown = 0;
      for (let index = 0; index < samples * 2 && start + index < length; index += 1) {
        brown += c * (Math.random() * 2 - 1 - brown);
        const env = index < attack ? index / attack : Math.exp(-(index - attack) / tau);
        rumble[start + index] = rumble[start + index]! + brown * compensation * env * event.amp * 0.3;
      }
    }

    // Fluctuating rumble bed that fills the gaps between arrivals.
    let bedNoise = 0;
    let bedLevel = 0;
    let bedTarget = 0.5;
    const retarget = Math.floor(sampleRate * 0.12);
    for (let index = 0; index < length; index += 1) {
      if (index % retarget === 0) bedTarget = Math.random();
      bedLevel += 0.0004 * (bedTarget - bedLevel);
      bedNoise += 0.02 * (Math.random() * 2 - 1 - bedNoise);
      const t = index / sampleRate;
      const bedEnv = Math.min(1, t / (0.15 + distance * 0.6)) * Math.exp(-t / (duration * 0.4));
      rumble[index] = rumble[index]! + bedNoise * 10 * bedLevel * bedEnv * 0.25;
    }

    // Time-varying 2-pole low-pass: bright onset closing down as the highs are absorbed.
    let lp1 = 0;
    let lp2 = 0;
    let coefficient = 0;
    for (let index = 0; index < length; index += 1) {
      if (index % 32 === 0) {
        const t = index / sampleRate;
        const cutoff = cutoffEnd + (cutoffStart - cutoffEnd) * Math.exp(-t / 0.5);
        coefficient = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      }
      lp1 += coefficient * (rumble[index]! - lp1);
      lp2 += coefficient * (lp1 - lp2);
      rumble[index] = lp2;
    }

    // Crack: a dense, decaying train of tiny N-wave shocks (the tearing sound). N-waves
    // rather than noise bursts, so it rips and snaps instead of hissing like static.
    if (crackWeight > 0) {
      const crack = new Float32Array(length);
      for (let impulse = 0; impulse < crackImpulses; impulse += 1) {
        const position = Math.pow(Math.random(), 1.6);
        const start = Math.floor(position * crackSeconds * sampleRate);
        const samples = Math.max(2, Math.floor(sampleRate * (0.0006 + Math.random() * 0.0035)));
        const amp = (0.25 + 0.75 * Math.random()) * Math.pow(1 - position, 1.4) * (Math.random() < 0.5 ? -1 : 1);
        for (let index = 0; index < samples && start + index < length; index += 1) {
          crack[start + index] = crack[start + index]! + amp * (1 - (2 * index) / samples);
        }
      }
      // Soften the very top end slightly.
      let soft = 0;
      for (let index = 0; index < length; index += 1) {
        soft += 0.6 * (crack[index]! - soft);
        rumble[index] = rumble[index]! + soft * crackWeight * 0.35;
      }
    }

    // DC-blocking high-pass (~25 Hz) and a short fade so the tail ends cleanly.
    const hpCoefficient = Math.exp((-2 * Math.PI * 25) / sampleRate);
    let hpOut = 0;
    let hpIn = 0;
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const x = rumble[index]!;
      hpOut = hpCoefficient * (hpOut + x - hpIn);
      hpIn = x;
      const fade = index > length - fadeOut ? (length - index) / fadeOut : 1;
      const value = hpOut * fade;
      data[index] = value;
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
    }
  }

  const scale = peak > 0 ? 0.95 / peak : 1;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) data[index] = data[index]! * scale;
  }
  return buffer;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Exponentially distributed wait for a Poisson process of the given rate. */
function poissonGap(rate: number): number {
  return -Math.log(1 - Math.random()) / Math.max(rate, 0.0001);
}

// A major 7/9 colours: airy and unresolved, good for aurora shimmer.
const PAD_FREQUENCIES = [110, 220, 277.18, 329.63, 493.88] as const;
const AURORA_SPARKLE_NOTES = [440, 554.37, 659.25, 830.61, 987.77, 1108.73] as const;
const FIREFLY_SPARKLE_NOTES = [1318.51, 1479.98, 1661.22, 1975.53, 2217.46, 2637.02, 2959.96] as const;
const BLOSSOM_SPARKLE_NOTES = [587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51] as const;

const SCHEDULER_INTERVAL_MS = 80;
const LOOKAHEAD_SECONDS = 0.22;

interface PanNode {
  node: AudioNode;
  pan: AudioParam | null;
}

interface PadVoice {
  osc: OscillatorNode;
  gain: GainNode;
}

interface CricketVoice {
  pitch: number;
  pan: number;
  period: number;
  pulses: number;
  level: number;
  next: number;
  restUntil: number;
}

interface SoundscapeGraph {
  ctx: AudioContext;
  master: GainNode;
  occlusion: BiquadFilterNode;
  wetOcclusion: BiquadFilterNode;
  reverbReturn: GainNode;
  /** Outside-world sounds: passes through wall occlusion. */
  bus: GainNode;
  /** Same as `bus`, plus a heavier reverb send (thunder, birds, chimes). */
  wetBus: GainNode;
  /** Sounds in the listener's own space (bypass occlusion). */
  nearBus: GainNode;
  white: AudioBuffer;
  brown: AudioBuffer;
  pink: AudioBuffer;

  rainGain: GainNode;
  rainSwell: GainNode;
  rainWashFilter: BiquadFilterNode;
  patterGain: GainNode;
  patterLightGain: GainNode;
  patterDenseGain: GainNode;
  patterFilter: BiquadFilterNode;
  dropsGain: GainNode;
  glassDropsGain: GainNode;

  windGain: GainNode;
  windGust: GainNode;
  windFilter: BiquadFilterNode;
  windPan: AudioParam | null;
  whistleGain: GainNode;
  whistleGust: GainNode;
  whistleFilter: BiquadFilterNode;
  gritGain: GainNode;
  gritGust: GainNode;

  airGain: GainNode;
  airDrift: GainNode;
  airFilter: BiquadFilterNode;

  emberGain: GainNode;
  fireFlicker: GainNode;

  padGain: GainNode;
  padFilter: BiquadFilterNode;
  padVoices: PadVoice[];
  sparkleGain: GainNode;

  cricketGain: GainNode;
  birdGain: GainNode;
  caveGain: GainNode;
}

type GeneratorKey = "gust" | "rainSwell" | "air" | "flicker" | "pad" | "drops" | "pops" | "sparkle" | "bird" | "cave";

const GENERATOR_KEYS: GeneratorKey[] = ["gust", "rainSwell", "air", "flicker", "pad", "drops", "pops", "sparkle", "bird", "cave"];

/**
 * Procedural, asset-free weather soundscape.
 *
 * Continuous beds (rain wash, wind, air tone, fire roar, harmonic pad) run as
 * seamlessly looping stereo noise / oscillators, but are constantly re-shaped by a
 * lookahead scheduler: wind surges and lulls in gusts that sweep its filter and
 * stereo position, rain swells and thins, the fire flickers, the pad drifts. On top
 * of that, discrete events are synthesized one at a time - individual raindrops,
 * window taps, ember pops, firefly chimes, crickets, birdsong, cave drips - so the
 * scene never repeats. Thunder is distance-modelled (delay, crack, rolling rumble)
 * and everything sits in a procedural convolution reverb sized by the exposure.
 */
export class WeatherSoundscape {
  private graph: SoundscapeGraph | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private schedulerTimer: number | null = null;
  private suspendTimer: number | null = null;
  private lastProfile: SoundscapeProfile | null = null;
  private appliedWindCenter = 0;
  private next: Record<GeneratorKey, number> = {
    gust: 0,
    rainSwell: 0,
    air: 0,
    flicker: 0,
    pad: 0,
    drops: 0,
    pops: 0,
    sparkle: 0,
    bird: 0,
    cave: 0,
  };
  private crickets: CricketVoice[] = [];
  private destroyed = false;

  sync(state: WeatherState | null, prefs: WeatherPrefs, visible: boolean): SoundscapeProfile {
    const profile = resolveSoundscapeProfile(state, prefs, visible);
    this.lastProfile = profile;
    if (this.destroyed) return profile;

    if (!profile.active) {
      this.rampToSilence();
      return profile;
    }

    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }

    if (!this.ensureGraph()) {
      return profile;
    }

    const g = this.graph!;
    if (g.ctx.state === "suspended") {
      void g.ctx.resume().catch(() => {});
    }

    try {
      const now = g.ctx.currentTime;
      // Slow-ish glides so weather/exposure changes crossfade rather than snap.
      const layer = 0.7;
      const indoor = profile.exposure === "indoor";
      g.master.gain.setTargetAtTime(profile.masterGain * 0.4, now, 0.25);
      g.occlusion.frequency.setTargetAtTime(profile.lowpassHz, now, 0.45);
      g.wetOcclusion.frequency.setTargetAtTime(profile.lowpassHz, now, 0.45);
      g.reverbReturn.gain.setTargetAtTime(profile.reverbWet, now, layer);

      g.rainGain.gain.setTargetAtTime(profile.rainWashGain, now, layer);
      g.patterGain.gain.setTargetAtTime(profile.rainPatterGain * 0.72, now, layer);
      g.patterLightGain.gain.setTargetAtTime(1 - profile.rainDensity * 0.55, now, layer);
      g.patterDenseGain.gain.setTargetAtTime(profile.rainDensity, now, layer);
      g.dropsGain.gain.setTargetAtTime(indoor ? 0 : profile.rainPatterGain * 0.45, now, layer);
      g.glassDropsGain.gain.setTargetAtTime(indoor ? profile.rainPatterGain * 1.15 : 0, now, layer);

      g.windGain.gain.setTargetAtTime(profile.windGain, now, layer);
      g.whistleGain.gain.setTargetAtTime(profile.windWhistleGain * 3, now, layer);
      g.gritGain.gain.setTargetAtTime(profile.sandGritGain, now, layer);
      if (Math.abs(this.appliedWindCenter - profile.windCenterHz) > 1) {
        this.appliedWindCenter = profile.windCenterHz;
        g.windFilter.frequency.setTargetAtTime(profile.windCenterHz, now, layer);
        g.whistleFilter.frequency.setTargetAtTime(profile.windCenterHz * 3.2, now, layer);
      }

      g.airGain.gain.setTargetAtTime(profile.airBedGain, now, layer);
      g.airFilter.frequency.setTargetAtTime(profile.airBedToneHz, now, layer);

      g.emberGain.gain.setTargetAtTime(profile.emberCrackleGain * 0.65, now, layer);
      g.padGain.gain.setTargetAtTime(profile.shimmerDroneGain * 0.3, now, 1.2);
      g.sparkleGain.gain.setTargetAtTime(profile.sparkleGain, now, layer);

      g.cricketGain.gain.setTargetAtTime(profile.cricketGain, now, 1.2);
      g.birdGain.gain.setTargetAtTime(profile.birdGain, now, 1.2);
      g.caveGain.gain.setTargetAtTime(profile.caveDripGain, now, layer);
    } catch {
      // Ignore transient automation errors while the context is closing.
    }

    this.startScheduler();
    return profile;
  }

  triggerThunder(boltPositionPercent = 50): void {
    const profile = this.lastProfile;
    if (this.destroyed || !profile || !profile.active || profile.thunderGainScale <= 0) return;
    if (!this.ensureGraph() || !this.graph) return;

    const g = this.graph;
    const ctx = g.ctx;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    try {
      // 0 = overhead, 1 = far away. Stronger storms throw more close strikes.
      const distance = clamp(Math.random() * (1.15 - profile.thunderProximity * 0.7), 0, 1);
      // Sound lags the flash; distant strikes arrive later, softer, and darker.
      const t0 = ctx.currentTime + 0.12 + distance * 2.4 + Math.random() * 0.18;
      const loudness = profile.thunderGainScale * (1 - distance * 0.52);
      const basePan = clamp((boltPositionPercent - 50) / 65, -0.75, 0.75);

      const strikeBuffer = renderThunderBuffer(ctx, distance);
      const duration = strikeBuffer.duration;

      const source = ctx.createBufferSource();
      source.buffer = strikeBuffer;

      const out = ctx.createGain();
      out.gain.value = loudness;
      const panner = this.createPanner(basePan);
      if (panner.pan) {
        panner.pan.setValueAtTime(basePan, t0);
        // The rumble rolls across the sky as it decays.
        panner.pan.linearRampToValueAtTime(clamp(basePan + rand(-0.45, 0.45), -0.85, 0.85), t0 + duration);
      }

      source.connect(panner.node);
      panner.node.connect(out);
      out.connect(g.wetBus);
      source.start(t0);
      source.stop(t0 + duration + 0.05);
      this.disposeOnEnd(source, [panner.node, out]);
    } catch {
      // Ignore transient WebAudio scheduling errors on backgrounded tabs.
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopScheduler();
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.sources = [];
    if (this.graph) {
      void this.graph.ctx.close().catch(() => {});
      this.graph = null;
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  private rampToSilence(): void {
    this.stopScheduler();
    const g = this.graph;
    if (!g) return;
    try {
      g.master.gain.setTargetAtTime(0, g.ctx.currentTime, 0.08);
      if (this.suspendTimer === null && g.ctx.state === "running") {
        this.suspendTimer = window.setTimeout(() => {
          this.suspendTimer = null;
          if (!this.destroyed && this.graph && !this.lastProfile?.active && this.graph.ctx.state === "running") {
            void this.graph.ctx.suspend().catch(() => {});
          }
        }, 260);
      }
    } catch {
      // Ignore if context is closing
    }
  }

  private startScheduler(): void {
    if (this.schedulerTimer !== null || !this.graph) return;
    const now = this.graph.ctx.currentTime;
    for (const key of GENERATOR_KEYS) this.next[key] = now + Math.random() * 0.4;
    for (const cricket of this.crickets) {
      cricket.next = now + Math.random() * cricket.period;
      cricket.restUntil = 0;
    }
    this.schedulerTimer = window.setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
    this.tick();
  }

  private stopScheduler(): void {
    if (this.schedulerTimer === null) return;
    window.clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
  }

  // --------------------------------------------------------------------------
  // Lookahead scheduler
  // --------------------------------------------------------------------------

  private tick(): void {
    const g = this.graph;
    const p = this.lastProfile;
    if (this.destroyed || !g || !p || !p.active || g.ctx.state !== "running") return;

    const now = g.ctx.currentTime;
    const horizon = now + LOOKAHEAD_SECONDS;

    try {
      if (p.windGain > 0 || p.sandGritGain > 0) {
        this.runInterval("gust", now, horizon, (t) => this.scheduleGust(t, p));
      }
      if (p.rainWashGain > 0) {
        this.runInterval("rainSwell", now, horizon, (t) => {
          g.rainSwell.gain.setTargetAtTime(rand(0.76, 1.15), t, rand(0.8, 2.2));
          g.rainWashFilter.frequency.setTargetAtTime(rand(1100, 1700), t, rand(1.5, 3));
          g.patterFilter.frequency.setTargetAtTime(rand(1500, 2600), t, rand(1.2, 2.8));
          return rand(1.5, 4.5);
        });
      }
      if (p.airBedGain > 0) {
        this.runInterval("air", now, horizon, (t) => {
          g.airDrift.gain.setTargetAtTime(rand(0.6, 1.3), t, rand(1.5, 3.5));
          return rand(2.5, 6.5);
        });
      }
      if (p.emberCrackleGain > 0) {
        this.runInterval("flicker", now, horizon, (t) => {
          g.fireFlicker.gain.setTargetAtTime(rand(0.68, 1.28), t, rand(0.14, 0.45));
          return rand(0.22, 0.75);
        });
        // Sparse, natural hearth snaps (~0.6 to 2.2 per second) rather than a rapid Geiger click stream.
        this.runPoisson("pops", 0.45 + p.emberCrackleGain * 2.8, now, horizon, (t) => this.spawnPop(t));
      }
      if (p.shimmerDroneGain > 0) {
        this.runInterval("pad", now, horizon, (t) => {
          for (const voice of g.padVoices) {
            voice.gain.gain.setTargetAtTime(rand(0.02, 0.32), t, rand(1.8, 4.5));
            voice.osc.detune.setTargetAtTime(rand(-9, 9), t, rand(2, 5));
          }
          g.padFilter.frequency.setTargetAtTime(rand(650, 2400), t, rand(2.5, 5));
          return rand(2.5, 6);
        });
      }
      if (p.sparkleGain > 0 && p.sparkleRate > 0) {
        this.runPoisson("sparkle", p.sparkleRate, now, horizon, (t) => this.spawnSparkle(t, p.shimmerStyle));
      }
      if (p.dropletRate > 0 && p.rainPatterGain > 0) {
        const indoor = p.exposure === "indoor";
        const plinkChance = p.exposure === "sheltered" ? 0.08 : 0.015;
        this.runPoisson("drops", p.dropletRate, now, horizon, (t) => {
          if (indoor) this.spawnDrop(t, "glass", g.glassDropsGain);
          else this.spawnDrop(t, Math.random() < plinkChance ? "plink" : "tick", g.dropsGain);
        });
      }
      if (p.caveDripGain > 0) {
        this.runPoisson("cave", 0.25 + p.caveDripGain * 1.2, now, horizon, (t) => this.spawnDrop(t, "cave", g.caveGain));
      }
      if (p.birdGain > 0) {
        this.runInterval("bird", now, horizon, (t) => this.spawnBirdPhrase(t));
      }
      if (p.cricketGain > 0) {
        this.runCrickets(now, horizon);
      }
    } catch {
      // Never let a scheduling hiccup break the scheduler loop.
    }
  }

  /** Runs a periodic generator; `step` schedules at `t` and returns the wait until the next step. */
  private runInterval(key: GeneratorKey, now: number, horizon: number, step: (t: number) => number): void {
    let t = this.next[key];
    if (t < now - 0.5) t = now; // fell behind (tab throttled / resumed)
    let guard = 0;
    while (t < horizon && guard < 16) {
      t = Math.max(t, now) + step(Math.max(t, now));
      guard += 1;
    }
    this.next[key] = t;
  }

  /** Runs a random (Poisson) event stream at `rate` events per second. */
  private runPoisson(key: GeneratorKey, rate: number, now: number, horizon: number, spawn: (t: number) => void): void {
    let t = this.next[key];
    if (t < now - 0.25) t = now + poissonGap(rate);
    let guard = 0;
    while (t < horizon && guard < 48) {
      spawn(Math.max(t, now));
      t += poissonGap(rate);
      guard += 1;
    }
    this.next[key] = t;
  }

  private scheduleGust(t: number, p: SoundscapeProfile): number {
    const g = this.graph!;
    const gust = p.gustiness;
    // Lulls dip lower and surges climb higher as gustiness rises.
    const level = 1 - gust * 0.7 + Math.random() * gust * 0.95;
    const rise = rand(0.4, 2.6 - gust * 1.4);
    const tc = rise / 3;
    g.windGust.gain.setTargetAtTime(level, t, tc);
    g.whistleGust.gain.setTargetAtTime(clamp((level - 0.7) * 2.8, 0, 1.5), t, tc);
    g.gritGust.gain.setTargetAtTime(Math.pow(Math.max(level, 0.05), 1.6), t, tc);
    g.windFilter.frequency.setTargetAtTime(p.windCenterHz * (0.72 + level * 0.45), t, tc);
    g.whistleFilter.frequency.setTargetAtTime(p.windCenterHz * 3.2 * (0.8 + level * 0.45), t, tc * 1.5);
    g.windPan?.setTargetAtTime(rand(-0.45, 0.45), t, rise);
    return rise * rand(0.8, 2) + (1 - gust) * 2;
  }

  private runCrickets(now: number, horizon: number): void {
    if (this.crickets.length === 0) {
      const count = 3;
      for (let index = 0; index < count; index += 1) {
        const period = rand(0.55, 1.2);
        this.crickets.push({
          pitch: rand(4100, 5200),
          pan: rand(-0.8, 0.8),
          period,
          pulses: 2 + Math.floor(Math.random() * 3),
          level: rand(0.35, 1),
          next: now + Math.random() * period,
          restUntil: 0,
        });
      }
    }

    for (const cricket of this.crickets) {
      if (cricket.next < now - 0.5) cricket.next = now + Math.random() * cricket.period;
      let guard = 0;
      while (cricket.next < horizon && guard < 4) {
        guard += 1;
        if (cricket.next < cricket.restUntil) {
          cricket.next = cricket.restUntil;
          continue;
        }
        this.spawnChirp(Math.max(cricket.next, now), cricket);
        cricket.next += cricket.period * rand(0.94, 1.06);
        // Crickets fall silent now and then, so the chorus thins and rebuilds.
        if (Math.random() < 0.035) cricket.restUntil = cricket.next + rand(2.5, 11);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Event voices
  // --------------------------------------------------------------------------

  private createPanner(pan: number): PanNode {
    return this.createPannerFor(this.graph!.ctx, pan);
  }

  private disposeOnEnd(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    source.onended = () => {
      for (const node of [source, ...nodes]) {
        try {
          node.disconnect();
        } catch {
          // Already disconnected
        }
      }
    };
  }

  /** Short noise burst through a band-pass: the basic "impact" grain. */
  private spawnNoiseGrain(
    t: number,
    destination: AudioNode,
    options: { freq: number; q: number; peak: number; decay: number; pan: number },
  ): void {
    const ctx = this.graph!.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.graph!.white;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = options.freq;
    filter.Q.value = options.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(options.peak, t + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + options.decay);
    const panner = this.createPanner(options.pan);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(destination);
    source.start(t, Math.random() * 1.5);
    source.stop(t + options.decay + 0.02);
    this.disposeOnEnd(source, [filter, gain, panner.node]);
  }

  /** Pitched water-drop "bloop": a sine whose pitch rises as the bubble resonates. */
  private spawnPlink(t: number, destination: AudioNode, f0: number, peak: number, decay: number, pan: number): void {
    const ctx = this.graph!.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * rand(1.3, 1.9), t + decay * 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const panner = this.createPanner(pan);
    osc.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(destination);
    osc.start(t);
    osc.stop(t + decay + 0.02);
    this.disposeOnEnd(osc, [gain, panner.node]);
  }

  private spawnDrop(t: number, kind: "tick" | "plink" | "glass" | "cave", destination: AudioNode): void {
    switch (kind) {
      case "tick":
        // Soft, matte ground splat — broad band-pass and tiny decay so it never sounds like static clicks.
        this.spawnNoiseGrain(t, destination, {
          freq: rand(950, 3200),
          q: rand(0.65, 1.45),
          peak: rand(0.18, 0.55),
          decay: rand(0.004, 0.014),
          pan: rand(-0.9, 0.9),
        });
        return;
      case "glass":
        // Rain against a nearby windowpane: short muted thud/tap, never resonant enough to sound like a cave drip.
        this.spawnNoiseGrain(t, destination, {
          freq: rand(850, 2150),
          q: rand(0.8, 1.75),
          peak: rand(0.22, 0.68),
          decay: rand(0.004, 0.011),
          pan: rand(-0.7, 0.7),
        });
        return;
      case "plink":
        this.spawnPlink(t, destination, rand(780, 1850), rand(0.018, 0.055), rand(0.028, 0.06), rand(-0.85, 0.85));
        return;
      case "cave":
        this.spawnPlink(t, destination, rand(500, 1400), rand(0.15, 0.4), rand(0.08, 0.16), rand(-0.8, 0.8));
        return;
    }
  }

  private spawnPop(t: number): void {
    const g = this.graph!;
    const ctx = g.ctx;
    const pan = rand(-0.55, 0.55);
    const kind = Math.random();

    if (kind < 0.35) {
      // Soft resin/sap hiss puff: gentle swell and decay, zero click.
      const dur = rand(0.06, 0.22);
      const attack = dur * 0.28;
      const source = ctx.createBufferSource();
      source.buffer = g.pink;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = rand(650, 1650);
      filter.Q.value = rand(0.7, 1.4);
      const gain = ctx.createGain();
      const peak = rand(0.08, 0.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const panner = this.createPanner(pan);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(panner.node);
      panner.node.connect(g.emberGain);
      source.start(t, Math.random() * 4);
      source.stop(t + dur + 0.02);
      this.disposeOnEnd(source, [filter, gain, panner.node]);
      return;
    }

    // Warm woody ember pop: low-mid body thud + damped woody resonance (never a bright white-noise tick).
    const big = kind > 0.82;
    this.spawnNoiseGrain(t, g.emberGain, {
      freq: big ? rand(320, 780) : rand(480, 1250),
      q: rand(1.1, 2.2),
      peak: big ? rand(0.32, 0.58) : rand(0.14, 0.32),
      decay: big ? rand(0.014, 0.032) : rand(0.007, 0.018),
      pan,
    });
    if (big && Math.random() < 0.5) {
      // Occasional soft secondary settle as the ember shifts.
      this.spawnNoiseGrain(t + rand(0.025, 0.07), g.emberGain, {
        freq: rand(420, 1100),
        q: rand(1.0, 1.8),
        peak: rand(0.1, 0.22),
        decay: rand(0.006, 0.015),
        pan: clamp(pan + rand(-0.1, 0.1), -0.7, 0.7),
      });
    }
  }

  private spawnSparkle(t: number, style: ShimmerStyle): void {
    const g = this.graph!;
    const ctx = g.ctx;
    const aurora = style === "aurora";
    const blossom = style === "blossoms";
    const freq = pick(aurora ? AURORA_SPARKLE_NOTES : blossom ? BLOSSOM_SPARKLE_NOTES : FIREFLY_SPARKLE_NOTES);
    const attack = aurora ? rand(0.25, 0.7) : blossom ? rand(0.015, 0.045) : rand(0.003, 0.01);
    const decay = aurora ? rand(2.5, 4.5) : blossom ? rand(0.9, 2.1) : rand(0.5, 1.5);
    const peak = aurora ? rand(0.12, 0.28) : blossom ? rand(0.06, 0.15) : rand(0.08, 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    const panner = this.createPanner(rand(-0.85, 0.85));
    gain.connect(panner.node);
    panner.node.connect(g.sparkleGain);

    const fundamental = ctx.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.value = freq;
    fundamental.detune.value = rand(-6, 6);
    // Inharmonic upper partial gives a small glassy bell character.
    const partial = ctx.createOscillator();
    partial.type = "sine";
    partial.frequency.value = freq * (aurora ? 2.0 : 2.76);
    const partialGain = ctx.createGain();
    partialGain.gain.value = aurora ? 0.18 : 0.3;
    fundamental.connect(gain);
    partial.connect(partialGain);
    partialGain.connect(gain);

    const end = t + attack + decay + 0.05;
    fundamental.start(t);
    partial.start(t);
    fundamental.stop(end);
    partial.stop(end);
    this.disposeOnEnd(partial, [partialGain]);
    this.disposeOnEnd(fundamental, [gain, panner.node]);
  }

  private spawnChirp(t: number, cricket: CricketVoice): void {
    const g = this.graph!;
    const ctx = g.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = cricket.pitch * rand(0.995, 1.005);
    const gain = ctx.createGain();
    const peak = 0.22 * cricket.level;
    const spacing = 0.032;
    gain.gain.setValueAtTime(0, t);
    for (let pulse = 0; pulse < cricket.pulses; pulse += 1) {
      const start = t + pulse * spacing;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.004);
      gain.gain.linearRampToValueAtTime(0, start + 0.017);
    }
    const panner = this.createPanner(cricket.pan);
    osc.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(g.cricketGain);
    osc.start(t);
    osc.stop(t + cricket.pulses * spacing + 0.03);
    this.disposeOnEnd(osc, [gain, panner.node]);
  }

  /** Schedules one bird phrase and returns the wait until the next one. */
  private spawnBirdPhrase(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const distance = rand(0.35, 1);
    const panner = this.createPanner(rand(-0.8, 0.8));
    panner.node.connect(g.birdGain);

    const species = Math.random();
    let notes: number;
    let base: number;
    let noteDuration: () => number;
    let gap: () => number;
    let glide: (f0: number) => number;
    if (species < 0.45) {
      // Warbler: quick tumbling run of notes.
      notes = 4 + Math.floor(Math.random() * 6);
      base = rand(2800, 4600);
      noteDuration = () => rand(0.04, 0.09);
      gap = () => rand(0.02, 0.05);
      glide = (f0) => f0 * rand(0.7, 1.4);
    } else if (species < 0.8) {
      // Whistler: a few long, sliding tones.
      notes = 2 + Math.floor(Math.random() * 2);
      base = rand(1700, 2600);
      noteDuration = () => rand(0.18, 0.35);
      gap = () => rand(0.08, 0.16);
      const direction = Math.random() < 0.5 ? 1.25 : 0.8;
      glide = (f0) => f0 * direction;
    } else {
      // Chip calls: short bright clicks.
      notes = 1 + Math.floor(Math.random() * 3);
      base = rand(4500, 6000);
      noteDuration = () => rand(0.015, 0.03);
      gap = () => rand(0.08, 0.2);
      glide = (f0) => f0 * 0.75;
    }

    let at = t;
    let lastOsc: OscillatorNode | null = null;
    for (let index = 0; index < notes; index += 1) {
      const duration = noteDuration();
      const f0 = base * rand(0.85, 1.15);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(glide(f0), at + duration);
      const gain = ctx.createGain();
      const peak = 0.16 * distance;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(peak, at + Math.min(0.012, duration * 0.3));
      gain.gain.setValueAtTime(peak, at + duration * 0.7);
      gain.gain.linearRampToValueAtTime(0, at + duration);
      osc.connect(gain);
      gain.connect(panner.node);
      osc.start(at);
      osc.stop(at + duration + 0.01);
      this.disposeOnEnd(osc, [gain]);
      lastOsc = osc;
      at += duration + gap();
    }
    if (lastOsc) {
      const previous = lastOsc.onended;
      lastOsc.onended = (event) => {
        if (typeof previous === "function") previous.call(lastOsc!, event);
        try {
          panner.node.disconnect();
        } catch {
          // Already disconnected
        }
      };
    }
    return at - t + rand(1.8, 8);
  }

  // --------------------------------------------------------------------------
  // Graph construction
  // --------------------------------------------------------------------------

  private ensureGraph(): boolean {
    if (this.graph) return true;
    const Ctor = resolveAudioContextConstructor();
    if (!Ctor) return false;

    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctor();
      const audio = ctx;

      // Distinct, non-multiple loop lengths so beds never phase-align audibly.
      const pink = createNoiseBuffer(audio, 11.3, "pink");
      const brown = createNoiseBuffer(audio, 9.7, "brown");
      const white = createNoiseBuffer(audio, 2.5, "white", 1);
      const rainLight = createRainTextureBuffer(audio, 6.7, 260);
      const rainDense = createRainTextureBuffer(audio, 5.9, 1350);
      const fireBed = createFireBedBuffer(audio, 7.3);

      const gainNode = (value = 0): GainNode => {
        const node = audio.createGain();
        node.gain.value = value;
        return node;
      };
      const filterNode = (type: BiquadFilterType, frequency: number, q = 0.707): BiquadFilterNode => {
        const node = audio.createBiquadFilter();
        node.type = type;
        node.frequency.value = frequency;
        node.Q.value = q;
        return node;
      };
      const loop = (buffer: AudioBuffer, rate = 1): AudioBufferSourceNode => {
        const node = audio.createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        node.playbackRate.value = rate;
        return node;
      };
      const chain = (...nodes: AudioNode[]): void => {
        for (let index = 0; index < nodes.length - 1; index += 1) nodes[index]!.connect(nodes[index + 1]!);
      };

      // ---- Master / spatial section ----
      const master = gainNode(0);
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.3;
      chain(master, compressor, audio.destination);

      const occlusion = filterNode("lowpass", 16000, 0.5);
      const wetOcclusion = filterNode("lowpass", 16000, 0.5);
      const reverbSend = gainNode(1);
      const convolver = audio.createConvolver();
      convolver.normalize = false;
      convolver.buffer = createImpulseResponse(audio, 3.2);
      const reverbReturn = gainNode(0.12);
      chain(reverbSend, convolver, reverbReturn, master);

      const bus = gainNode(1);
      const wetBus = gainNode(1);
      const nearBus = gainNode(1);
      const wetBoost = gainNode(2.5);
      bus.connect(occlusion);
      wetBus.connect(occlusion);
      wetBus.connect(wetOcclusion);
      occlusion.connect(master);
      occlusion.connect(reverbSend);
      chain(wetOcclusion, wetBoost, reverbSend);
      nearBus.connect(master);
      nearBus.connect(reverbSend);

      const startables: AudioScheduledSourceNode[] = [];
      const loopStarts = new Map<AudioBufferSourceNode, number>();
      const addLoop = (source: AudioBufferSourceNode): AudioBufferSourceNode => {
        startables.push(source);
        loopStarts.set(source, Math.random() * (source.buffer?.duration ?? 1));
        return source;
      };

      // ---- Rain: wash + low body + airy hiss, all under one slow "swell" ----
      const rainGain = gainNode(0);
      const rainSwell = gainNode(1);
      const rainWashFilter = filterNode("bandpass", 1350, 0.55);
      chain(addLoop(loop(pink)), rainWashFilter, rainSwell);
      chain(addLoop(loop(brown, 1.05)), filterNode("lowpass", 520), gainNode(0.55), rainSwell);
      chain(addLoop(loop(pink, 0.93)), filterNode("highpass", 4800), gainNode(0.22), rainSwell);
      chain(rainSwell, rainGain, bus);

      // Ground rain texture: two pre-rendered micro-impact beds (sparse shower + dense downpour)
      // crossfaded by `rainDensity`, plus soft discrete foreground droplets.
      const patterGain = gainNode(0);
      const patterLightGain = gainNode(1);
      const patterDenseGain = gainNode(0);
      const patterFilter = filterNode("bandpass", 1950, 0.65);
      chain(addLoop(loop(rainLight)), patterLightGain, patterFilter);
      chain(addLoop(loop(rainDense)), patterDenseGain, patterFilter);
      chain(patterFilter, patterGain, bus);
      const dropsGain = gainNode(0);
      dropsGain.connect(bus);
      const glassDropsGain = gainNode(0);
      // Indoor windowpane taps stay dry (`master` only, not `reverbSend`) so they don't echo like cave drips.
      chain(glassDropsGain, filterNode("lowpass", 2200), master);

      // ---- Wind: gusting body, whistle, and sand grit ----
      const windGain = gainNode(0);
      const windGust = gainNode(1);
      const windFilter = filterNode("bandpass", 220, 1.4);
      const windPanNode = this.createPannerFor(audio, 0);
      chain(addLoop(loop(brown)), windFilter, windGust, windPanNode.node, windGain, bus);

      const whistleGain = gainNode(0);
      const whistleGust = gainNode(0);
      const whistleFilter = filterNode("bandpass", 700, 9);
      chain(addLoop(loop(pink, 1.07)), whistleFilter, whistleGust, whistleGain, bus);

      const gritGain = gainNode(0);
      const gritGust = gainNode(1);
      chain(addLoop(loop(pink, 1.13)), filterNode("highpass", 2600), gritGust, gritGain, bus);

      // ---- Air / room tone ----
      const airGain = gainNode(0);
      const airDrift = gainNode(1);
      const airFilter = filterNode("lowpass", 900, 0.3);
      chain(addLoop(loop(pink, 0.81)), airFilter, airDrift, airGain, bus);

      // ---- Embers: warm hearth draft + glowing coal rumble + resin/wood bed + sparse pops ----
      const emberGain = gainNode(0);
      const fireFlicker = gainNode(1);
      chain(addLoop(loop(brown, 0.88)), filterNode("lowpass", 220), gainNode(0.95), fireFlicker);
      chain(addLoop(loop(pink, 0.94)), filterNode("bandpass", 420, 0.75), gainNode(0.42), fireFlicker);
      chain(fireFlicker, emberGain);
      chain(addLoop(loop(fireBed, 0.96)), filterNode("lowpass", 2400), gainNode(0.65), emberGain);
      emberGain.connect(bus);

      // ---- Shimmer pad: slowly drifting detuned partials ----
      const padGain = gainNode(0);
      const padFilter = filterNode("lowpass", 1400, 0.4);
      const padVoices: PadVoice[] = PAD_FREQUENCIES.map((frequency, index) => {
        const osc = audio.createOscillator();
        osc.type = index === 0 ? "triangle" : "sine";
        osc.frequency.value = frequency;
        const gain = gainNode(0.15);
        chain(osc, gain, padFilter);
        startables.push(osc);
        return { osc, gain };
      });
      chain(padFilter, padGain, wetBus);
      const sparkleGain = gainNode(0);
      sparkleGain.connect(wetBus);

      // ---- Wildlife and cave ----
      const cricketGain = gainNode(0);
      cricketGain.connect(bus);
      const birdGain = gainNode(0);
      birdGain.connect(wetBus);
      const caveGain = gainNode(0);
      caveGain.connect(nearBus);

      for (const source of startables) {
        const offset = loopStarts.get(source as AudioBufferSourceNode);
        if (offset !== undefined) (source as AudioBufferSourceNode).start(0, offset);
        else source.start(0);
        this.sources.push(source);
      }

      this.graph = {
        ctx: audio,
        master,
        occlusion,
        wetOcclusion,
        reverbReturn,
        bus,
        wetBus,
        nearBus,
        white,
        brown,
        pink,
        rainGain,
        rainSwell,
        rainWashFilter,
        patterGain,
        patterLightGain,
        patterDenseGain,
        patterFilter,
        dropsGain,
        glassDropsGain,
        windGain,
        windGust,
        windFilter,
        windPan: windPanNode.pan,
        whistleGain,
        whistleGust,
        whistleFilter,
        gritGain,
        gritGust,
        airGain,
        airDrift,
        airFilter,
        emberGain,
        fireFlicker,
        padGain,
        padFilter,
        padVoices,
        sparkleGain,
        cricketGain,
        birdGain,
        caveGain,
      };
      this.appliedWindCenter = 0;
      return true;
    } catch {
      for (const source of this.sources) {
        try {
          source.stop();
        } catch {
          // Never started
        }
      }
      this.sources = [];
      if (ctx) void ctx.close().catch(() => {});
      this.graph = null;
      return false;
    }
  }

  private createPannerFor(ctx: AudioContext, pan: number): PanNode {
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      return { node: panner, pan: panner.pan };
    }
    return { node: ctx.createGain(), pan: null };
  }
}
