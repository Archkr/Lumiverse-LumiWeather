import { clamp } from "./shared";
import type { WeatherExposure, WeatherPrefs, WeatherState } from "./types";

export interface SoundscapeProfile {
  active: boolean;
  masterGain: number;
  lowpassHz: number;
  rainWashGain: number;
  rainPatterGain: number;
  windGain: number;
  windCenterHz: number;
  emberCrackleGain: number;
  shimmerDroneGain: number;
  thunderGainScale: number;
}

const EXPOSURE_LOWPASS_HZ: Record<WeatherExposure, number> = {
  outdoor: 16000,
  sheltered: 4200,
  indoor: 420,
  underground: 240,
};

function resolveWindStrengthFactor(wind: string): number {
  const normalized = wind.trim().toLowerCase();
  if (/hurricane|violent|gale|hard|strong|gust|howl/.test(normalized)) return 0.92;
  if (/steady|breezy|windy|crosswind|brisk/.test(normalized)) return 0.54;
  if (/light|soft|cool drift|gentle/.test(normalized)) return 0.26;
  if (/still|calm|hushed|none/.test(normalized)) return 0.06;
  return 0.34;
}

/**
 * Pure acoustic profile resolver for the active weather scene.
 * Computes filter cutoffs and layer gains deterministically for both unit tests
 * and the live WebAudio synthesizer.
 */
export function resolveSoundscapeProfile(
  state: WeatherState | null,
  prefs: WeatherPrefs,
  visible = true,
): SoundscapeProfile {
  const soundEnabled = Boolean(prefs.soundEnabled);
  const volume = clamp(Number.isFinite(prefs.soundVolume) ? (prefs.soundVolume as number) : 0.45, 0.05, 1);
  const exposure: WeatherExposure = state?.exposure ?? "outdoor";
  const lowpassHz = EXPOSURE_LOWPASS_HZ[exposure];

  if (!visible || !soundEnabled || prefs.pauseEffects || !state) {
    return {
      active: false,
      masterGain: 0,
      lowpassHz,
      rainWashGain: 0,
      rainPatterGain: 0,
      windGain: 0,
      windCenterHz: 200,
      emberCrackleGain: 0,
      shimmerDroneGain: 0,
      thunderGainScale: 0,
    };
  }

  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const normalizedIntensity = clamp(effectiveIntensity / 1.2, 0, 1);
  const phenomenon = state.phenomenon ?? "none";
  const rainLike = state.condition === "rain" || state.condition === "storm";

  const rainWashBase =
    rainLike && exposure !== "underground"
      ? clamp(0.2 + normalizedIntensity * 0.52 + (state.condition === "storm" ? 0.14 : 0), 0.15, 0.92)
      : 0;
  const rainPatterBase =
    rainLike && exposure !== "underground"
      ? clamp(0.14 + normalizedIntensity * 0.44 + (state.condition === "storm" ? 0.08 : 0), 0.1, 0.78)
      : 0;

  const rainExposureScale =
    exposure === "indoor" ? 0.62 : exposure === "sheltered" ? 0.85 : exposure === "underground" ? 0 : 1;
  const patterExposureScale =
    exposure === "indoor" ? 0.32 : exposure === "sheltered" ? 0.68 : exposure === "underground" ? 0 : 1;

  const windFactor = resolveWindStrengthFactor(state.wind);
  const conditionWindBoost =
    state.condition === "storm"
      ? 0.28
      : state.condition === "snow"
        ? 0.12
        : phenomenon === "sandstorm"
          ? 0.34
          : 0;
  const windExposureScale =
    exposure === "indoor" ? 0.38 : exposure === "sheltered" ? 0.78 : exposure === "underground" ? 0.22 : 1;
  const windGain = clamp(
    (0.04 + windFactor * 0.46 + conditionWindBoost + normalizedIntensity * 0.14) * windExposureScale,
    0,
    0.78,
  );
  const windCenterHz = Math.round(150 + windFactor * 220 + (phenomenon === "sandstorm" ? 90 : 0));

  const emberCrackleGain =
    phenomenon === "embers"
      ? clamp((0.18 + normalizedIntensity * 0.32) * (exposure === "indoor" ? 0.55 : 1), 0.12, 0.58)
      : 0;

  const shimmerDroneGain =
    (phenomenon === "aurora" || phenomenon === "fireflies") && exposure !== "underground"
      ? clamp((0.07 + normalizedIntensity * 0.12) * (exposure === "indoor" ? 0.5 : 1), 0.04, 0.24)
      : 0;

  const thunderGainScale =
    state.condition === "storm"
      ? clamp(
          (0.45 + normalizedIntensity * 0.48) *
            (exposure === "indoor" ? 0.58 : exposure === "sheltered" ? 0.88 : exposure === "underground" ? 0.18 : 1),
          0,
          1,
        )
      : 0;

  return {
    active: true,
    masterGain: Number(volume.toFixed(3)),
    lowpassHz,
    rainWashGain: Number((rainWashBase * rainExposureScale).toFixed(3)),
    rainPatterGain: Number((rainPatterBase * patterExposureScale).toFixed(3)),
    windGain: Number(windGain.toFixed(3)),
    windCenterHz,
    emberCrackleGain: Number(emberCrackleGain.toFixed(3)),
    shimmerDroneGain: Number(shimmerDroneGain.toFixed(3)),
    thunderGainScale: Number(thunderGainScale.toFixed(3)),
  };
}

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function createNoiseBuffer(ctx: AudioContext, seconds: number, mode: "pink" | "brown" | "crackle"): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (mode === "brown") {
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.2;
    }
    return buffer;
  }

  if (mode === "crackle") {
    let envelope = 0;
    for (let index = 0; index < length; index += 1) {
      if (Math.random() < 0.0045) envelope = 0.65 + Math.random() * 0.35;
      envelope *= 0.985;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    return buffer;
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
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

export class WeatherSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private occlusionFilter: BiquadFilterNode | null = null;
  private rainWashGain: GainNode | null = null;
  private rainPatterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private crackleGain: GainNode | null = null;
  private shimmerGain: GainNode | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private thunderTimers = new Set<number>();
  private lastProfile: SoundscapeProfile | null = null;
  private destroyed = false;

  sync(state: WeatherState | null, prefs: WeatherPrefs, visible: boolean): SoundscapeProfile {
    const profile = resolveSoundscapeProfile(state, prefs, visible);
    this.lastProfile = profile;
    if (this.destroyed) return profile;

    if (!profile.active) {
      this.rampToSilence();
      return profile;
    }

    if (!this.ensureGraph()) {
      return profile;
    }

    const ctx = this.ctx!;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const timeConstant = 0.28;
    this.masterGain?.gain.setTargetAtTime(profile.masterGain * 0.36, now, timeConstant);
    this.occlusionFilter?.frequency.setTargetAtTime(profile.lowpassHz, now, timeConstant);
    this.rainWashGain?.gain.setTargetAtTime(profile.rainWashGain, now, timeConstant);
    this.rainPatterGain?.gain.setTargetAtTime(profile.rainPatterGain * 0.55, now, timeConstant);
    this.windGain?.gain.setTargetAtTime(profile.windGain, now, timeConstant);
    this.windFilter?.frequency.setTargetAtTime(profile.windCenterHz, now, timeConstant);
    this.crackleGain?.gain.setTargetAtTime(profile.emberCrackleGain * 0.65, now, timeConstant);
    this.shimmerGain?.gain.setTargetAtTime(profile.shimmerDroneGain * 0.28, now, timeConstant);

    return profile;
  }

  triggerThunder(boltPositionPercent = 50): void {
    const profile = this.lastProfile;
    if (this.destroyed || !profile || !profile.active || profile.thunderGainScale <= 0) return;
    if (!this.ensureGraph() || !this.ctx || !this.occlusionFilter) return;

    const ctx = this.ctx;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const delayMs = 110 + Math.round(Math.random() * 240);
    const timer = window.setTimeout(() => {
      this.thunderTimers.delete(timer);
      if (this.destroyed || !this.ctx || !this.occlusionFilter || !this.brownBuffer) return;

      try {
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.brownBuffer;
        source.loop = true;
        source.playbackRate.value = 0.58 + Math.random() * 0.28;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(165, now);
        filter.frequency.exponentialRampToValueAtTime(52, now + 2.1);

        const gain = this.ctx.createGain();
        const peak = clamp(profile.thunderGainScale * 0.72, 0.08, 0.85);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(peak * 0.48, now + 0.38);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.35);

        source.connect(filter);
        if (typeof this.ctx.createStereoPanner === "function") {
          const panner = this.ctx.createStereoPanner();
          panner.pan.value = clamp((boltPositionPercent - 50) / 65, -0.75, 0.75);
          filter.connect(panner);
          panner.connect(gain);
        } else {
          filter.connect(gain);
        }
        gain.connect(this.occlusionFilter);

        source.start(now);
        source.stop(now + 2.45);
      } catch {
        // Ignore transient WebAudio scheduling errors on backgrounded tabs.
      }
    }, delayMs);

    this.thunderTimers.add(timer);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const timer of this.thunderTimers) window.clearTimeout(timer);
    this.thunderTimers.clear();
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.sources = [];
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private rampToSilence(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.14);
    } catch {
      // Ignore if context is closing
    }
  }

  private ensureGraph(): boolean {
    if (this.ctx) return true;
    const Ctor = resolveAudioContextConstructor();
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      this.pinkBuffer = createNoiseBuffer(ctx, 4, "pink");
      this.brownBuffer = createNoiseBuffer(ctx, 4, "brown");
      const crackleBuffer = createNoiseBuffer(ctx, 3.5, "crackle");

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;

      const occlusionFilter = ctx.createBiquadFilter();
      occlusionFilter.type = "lowpass";
      occlusionFilter.frequency.value = 16000;
      occlusionFilter.Q.value = 0.5;

      occlusionFilter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Rain wash branch
      const rainWashSource = ctx.createBufferSource();
      rainWashSource.buffer = this.pinkBuffer;
      rainWashSource.loop = true;
      const rainWashFilter = ctx.createBiquadFilter();
      rainWashFilter.type = "bandpass";
      rainWashFilter.frequency.value = 1350;
      rainWashFilter.Q.value = 0.65;
      const rainWashGain = ctx.createGain();
      rainWashGain.gain.value = 0;
      rainWashSource.connect(rainWashFilter);
      rainWashFilter.connect(rainWashGain);
      rainWashGain.connect(occlusionFilter);

      // Rain patter / surface droplets branch
      const rainPatterSource = ctx.createBufferSource();
      rainPatterSource.buffer = crackleBuffer;
      rainPatterSource.loop = true;
      const rainPatterFilter = ctx.createBiquadFilter();
      rainPatterFilter.type = "bandpass";
      rainPatterFilter.frequency.value = 2850;
      rainPatterFilter.Q.value = 1.1;
      const rainPatterGain = ctx.createGain();
      rainPatterGain.gain.value = 0;
      rainPatterSource.connect(rainPatterFilter);
      rainPatterFilter.connect(rainPatterGain);
      rainPatterGain.connect(occlusionFilter);

      // Wind howl branch
      const windSource = ctx.createBufferSource();
      windSource.buffer = this.brownBuffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 220;
      windFilter.Q.value = 2.4;
      const windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(occlusionFilter);

      // Ember crackle branch
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = crackleBuffer;
      crackleSource.loop = true;
      crackleSource.playbackRate.value = 0.84;
      const crackleFilter = ctx.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.value = 1950;
      crackleFilter.Q.value = 1.4;
      const crackleGain = ctx.createGain();
      crackleGain.gain.value = 0;
      crackleSource.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(occlusionFilter);

      // Shimmer harmonic drone for aurora / fireflies
      const oscA = ctx.createOscillator();
      oscA.type = "sine";
      oscA.frequency.value = 220;
      const oscB = ctx.createOscillator();
      oscB.type = "sine";
      oscB.frequency.value = 329.63;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0;
      oscA.connect(shimmerGain);
      oscB.connect(shimmerGain);
      shimmerGain.connect(occlusionFilter);

      for (const source of [rainWashSource, rainPatterSource, windSource, crackleSource, oscA, oscB]) {
        source.start(0);
        this.sources.push(source);
      }

      this.masterGain = masterGain;
      this.occlusionFilter = occlusionFilter;
      this.rainWashGain = rainWashGain;
      this.rainPatterGain = rainPatterGain;
      this.windGain = windGain;
      this.windFilter = windFilter;
      this.crackleGain = crackleGain;
      this.shimmerGain = shimmerGain;
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }
}
