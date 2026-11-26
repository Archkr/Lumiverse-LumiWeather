import { clamp } from "./shared";
import type {
  SoundscapeSampleKey,
  WeatherExposure,
  WeatherPrefs,
  WeatherState,
  WeatherWindDirection,
} from "./types";

export interface WeatherSoundscapeOptions {
  requestSample?: (key: SoundscapeSampleKey) => void;
}

export type ShimmerStyle = "none" | "aurora" | "fireflies" | "blossoms";
export type SoundscapeBiome = "none" | "coastal" | "forest" | "water";
export type SoundscapeReverbKind = "room" | "wide";

export interface SoundscapeProfile {
  active: boolean;
  exposure: WeatherExposure;
  biome: SoundscapeBiome;
  reverbKind: SoundscapeReverbKind;
  wildlifeEnabled: boolean;
  warmthEnabled: boolean;
  masterGain: number;
  lowpassHz: number;
  /** Convolution reverb return level (room / shelter / cave size cue). */
  reverbWet: number;
  rainWashGain: number;
  rainPatterGain: number;
  /** Warm hollow wooden/awning rain resonance when sheltered under eaves/porch. */
  shelteredRoofGain: number;
  /** Individual droplet impacts per second (granular layer on top of the wash). */
  dropletRate: number;
  /** 0..1 crossfade between the sparse (light shower) and dense (downpour) ground textures. */
  rainDensity: number;
  windGain: number;
  windCenterHz: number;
  /** -0.5..0.5 stereo pan bias derived from tagged wind direction. */
  windPanBias: number;
  /** 0..1 how much the wind surges and lulls between gusts. */
  gustiness: number;
  windWhistleGain: number;
  sandGritGain: number;
  /** Quiet ever-present air / room tone so calm scenes are never dead silent. */
  airBedGain: number;
  airBedToneHz: number;
  emberCrackleGain: number;
  /** Cozy subtle indoor hearth crackle on freezing/winter indoor scenes. */
  winterHearthGain: number;
  shimmerDroneGain: number;
  shimmerStyle: ShimmerStyle;
  sparkleGain: number;
  /** Sparkle chimes per second. */
  sparkleRate: number;
  /** Wind-driven pentatonic chimes for cherry blossoms. */
  windChimeGain: number;
  /** Coastal rolling ocean surf bed. */
  surfGain: number;
  /** Daytime coastal distant gull calls. */
  gullGain: number;
  /** Rare distant coastal harbor foghorn during fog. */
  foghornGain: number;
  /** River/creek/lake continuous flowing water bed. */
  brookGain: number;
  /** Sharp glassy sleet/ice-pellet taps in windy or heavy snow. */
  sleetGain: number;
  /** Dry autumn leaf skittering bursts driven by wind gusts. */
  autumnLeafGain: number;
  /** Slow mellow condensation drips during fog. */
  condensationDripGain: number;
  /** Subtle wood/shutter/branch creaks in indoor storms or cold windy winter. */
  creakGain: number;
  /** Deep sub-bass subterranean airflow/draft when underground. */
  cavernRumbleGain: number;
  /** Eerie muted subterranean rumble beneath volcanic ashfall. */
  volcanicRumbleGain: number;
  /** Subtle distant rolling thunder swells between visible lightning flashes. */
  stormRumbleGain: number;
  cricketGain: number;
  birdGain: number;
  /** Livelier overlapping birdsong cadence at dawn. */
  dawnChorus: boolean;
  /** Distant nocturnal owl hoots on calm/misty autumn, winter, or forest nights. */
  owlGain: number;
  /** Warm spring/summer nocturnal frogs & peepers (boosted near water or damp air). */
  frogGain: number;
  /** Undulating hot-afternoon summer cicada shimmer. */
  cicadaGain: number;
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

export function resolveSoundscapeBiome(location: string, summary = ""): SoundscapeBiome {
  const text = `${location} ${summary}`.trim();
  if (!text) return "none";
  if (
    /\b(ocean|sea|seaside|coast|coastal|beach|shore|shoreline|harbor|harbour|bay|port|pier|dock|wharf|island|cove|lighthouse|reef|tide|marina|boardwalk|surf|wingull|seagull|gulls?)\b/i.test(
      text,
    ) ||
    /[a-z](cove|port|bay|shore|beach|harbor|harbour)\b/i.test(text)
  ) {
    return "coastal";
  }
  if (/\b(river|creek|stream|brook|waterfall|falls|lake|pond|marsh|swamp|wetland|lagoon|spring|canal|estuary)\b/i.test(text)) {
    return "water";
  }
  if (/\b(forest|woods|woodland|park|grove|glade|jungle|rainforest|meadow|orchard|garden|pine|timber|trail|thicket|canopy)\b/i.test(text)) {
    return "forest";
  }
  return "none";
}

export function parseTemperatureFahrenheit(temperature: string): number | null {
  const match = temperature.trim().match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*(F(?:ahrenheit)?|C(?:elsius)?)\b/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  if (!Number.isFinite(amount)) return null;
  const isCelsius = match[2]![0]!.toUpperCase() === "C";
  return isCelsius ? amount * (9 / 5) + 32 : amount;
}

export function resolveWindDirectionPan(windDirection: WeatherWindDirection, wind: string): number {
  if (windDirection === "west" || windDirection === "northwest" || windDirection === "southwest") return -0.35;
  if (windDirection === "east" || windDirection === "northeast" || windDirection === "southeast") return 0.35;
  if (windDirection === "north" || windDirection === "south") return 0;
  const normalized = wind.trim().toLowerCase();
  if (/\b(west|westerly|northwest|southwest|from left)\b/.test(normalized)) return -0.35;
  if (/\b(east|easterly|northeast|southeast|from right)\b/.test(normalized)) return 0.35;
  return 0;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function silentProfile(exposure: WeatherExposure): SoundscapeProfile {
  return {
    active: false,
    exposure,
    biome: "none",
    reverbKind: exposure === "indoor" || exposure === "sheltered" ? "room" : "wide",
    wildlifeEnabled: false,
    warmthEnabled: true,
    masterGain: 0,
    lowpassHz: EXPOSURE_LOWPASS_HZ[exposure],
    reverbWet: 0,
    rainWashGain: 0,
    rainPatterGain: 0,
    shelteredRoofGain: 0,
    dropletRate: 0,
    rainDensity: 0,
    windGain: 0,
    windCenterHz: 200,
    windPanBias: 0,
    gustiness: 0,
    windWhistleGain: 0,
    sandGritGain: 0,
    airBedGain: 0,
    airBedToneHz: 800,
    emberCrackleGain: 0,
    winterHearthGain: 0,
    shimmerDroneGain: 0,
    shimmerStyle: "none",
    sparkleGain: 0,
    sparkleRate: 0,
    windChimeGain: 0,
    surfGain: 0,
    gullGain: 0,
    foghornGain: 0,
    brookGain: 0,
    sleetGain: 0,
    autumnLeafGain: 0,
    condensationDripGain: 0,
    creakGain: 0,
    cavernRumbleGain: 0,
    volcanicRumbleGain: 0,
    stormRumbleGain: 0,
    cricketGain: 0,
    birdGain: 0,
    dawnChorus: false,
    owlGain: 0,
    frogGain: 0,
    cicadaGain: 0,
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
  const warmthEnabled = prefs.soundWarmthEnabled !== false;
  const waterEnabled = prefs.waterEnabled !== false;
  const wildlifeEnabled = prefs.wildlifeEnabled !== false;
  const airBedEnabled = prefs.airBedEnabled !== false;
  const phenomenaAudioEnabled = prefs.phenomenaAudioEnabled !== false;
  const hearthMode = prefs.soundHearthMode ?? "auto";
  const biomeOverride = prefs.soundBiomeOverride ?? "auto";
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
  const baseLowpassHz = EXPOSURE_LOWPASS_HZ[exposure];

  if (!visible || !soundEnabled || prefs.pauseEffects || !state || volume <= 0) {
    return silentProfile(exposure);
  }

  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const normalizedIntensity = clamp(effectiveIntensity / 1.2, 0, 1);
  const phenomenon = state.phenomenon ?? "none";
  const condition = state.condition;
  const rainLike = condition === "rain" || condition === "storm";
  const isStorm = condition === "storm";
  const isSnow = condition === "snow";
  const isFog = condition === "fog";
  const biome: SoundscapeBiome =
    biomeOverride !== "auto" ? biomeOverride : resolveSoundscapeBiome(state.location, state.summary);
  const tempF = parseTemperatureFahrenheit(state.temperature);
  const isFreezing = (tempF !== null && tempF <= 36) || isSnow;
  const isHot = tempF !== null && tempF >= 78;
  const isHotSpring = tempF !== null && tempF >= 80;
  const reverbKind: SoundscapeReverbKind = exposure === "indoor" || exposure === "sheltered" ? "room" : "wide";

  // Snow blankets high frequencies outdoors, creating a hushed winter acoustic feel.
  const lowpassHz = isSnow && exposure === "outdoor" ? 9200 : baseLowpassHz;

  // --- Rain & sheltered roof resonance ----------------------------------------
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
  const shelteredRoofGain =
    rainLike && exposure === "sheltered"
      ? clamp(0.22 + normalizedIntensity * 0.38 + (isStorm ? 0.1 : 0), 0.18, 0.72)
      : 0;
  const dropletRate =
    rainLike && exposure !== "underground" && rainVolume > 0
      ? (2 + normalizedIntensity * 9 + (isStorm ? 3 : 0)) * byExposure(exposure, 1, 0.75, 0.6, 0)
      : 0;
  const rainDensity = rainLike ? clamp(normalizedIntensity * 0.85 + (isStorm ? 0.25 : 0), 0, 1) : 0;

  // --- Wind, sleet & autumn leaves --------------------------------------------
  const windFactor = resolveWindStrengthFactor(state.wind);
  const windPanBias = resolveWindDirectionPan(state.windDirection, state.wind);
  const conditionWindBoost = isStorm ? 0.28 : isSnow ? 0.12 : phenomenon === "sandstorm" ? 0.34 : 0;
  const windExposureScale = byExposure(exposure, 1, 0.78, 0.38, 0.22);
  const windGain = clamp(
    (0.04 + windFactor * 0.46 + conditionWindBoost + normalizedIntensity * 0.14) * windExposureScale,
    0,
    0.78,
  );
  const windCenterHz = Math.round(
    150 + windFactor * 220 + (phenomenon === "sandstorm" ? 90 : 0) - (isSnow ? 30 : 0),
  );
  const gustiness = clamp(
    0.12 + windFactor * 0.72 + (isStorm ? 0.2 : 0) + (phenomenon === "sandstorm" ? 0.15 : 0),
    0.1,
    1,
  );
  const whistleDrive = clamp((windFactor - 0.3) * 0.9 + (isStorm ? 0.12 : 0) + (phenomenon === "sandstorm" ? 0.1 : 0), 0, 0.55);
  const windWhistleGain = windGain * whistleDrive;
  const sandGritGain = !phenomenaAudioEnabled
    ? 0
    : phenomenon === "sandstorm"
      ? clamp(0.16 + normalizedIntensity * 0.36, 0, 0.5) * windExposureScale
      : phenomenon === "ashfall"
        ? clamp(0.05 + normalizedIntensity * 0.12, 0, 0.2) * windExposureScale
        : 0;

  // Snow sleet/ice-pellet micro-taps when snowfall is brisk or heavy.
  const sleetGain =
    isSnow && exposure !== "underground" && (windFactor >= 0.45 || normalizedIntensity >= 0.62)
      ? clamp(0.12 + normalizedIntensity * 0.22 + windFactor * 0.16, 0.1, 0.48) * byExposure(exposure, 1, 0.78, 0.52, 0)
      : 0;

  // Dry autumn leaves skittering on wind gusts.
  const autumnLeafGain =
    state.season === "autumn" && !rainLike && !isSnow && exposure !== "underground" && exposure !== "indoor" && windFactor >= 0.22
      ? clamp(0.1 + windFactor * 0.34, 0.1, 0.42) * byExposure(exposure, 1, 0.7, 0, 0)
      : 0;

  // Subtle wood/shutter creaks during indoor storms/gales or cold windy winter outdoors.
  const indoorStormCreak =
    exposure === "indoor" && (isStorm || windFactor >= 0.52)
      ? clamp(0.14 + windFactor * 0.24 + (isStorm ? 0.1 : 0), 0.12, 0.44)
      : 0;
  const winterBranchCreak =
    (exposure === "outdoor" || exposure === "sheltered") && (isSnow || (state.season === "winter" && isFreezing)) && windFactor >= 0.3
      ? clamp(0.1 + windFactor * 0.22, 0.08, 0.34) * (biome === "forest" ? 1.25 : 1)
      : 0;
  const creakGain = Math.max(indoorStormCreak, winterBranchCreak);

  // --- Biome beds (coastal surf/foghorn, woodland brook) ----------------------
  const surfGain =
    waterEnabled && biome === "coastal" && exposure !== "underground"
      ? clamp(0.18 + windFactor * 0.22 + (isStorm ? 0.16 : 0) + normalizedIntensity * 0.08, 0.16, 0.62) *
        byExposure(exposure, 1, 0.76, 0.34, 0)
      : 0;
  const foghornGain =
    waterEnabled && biome === "coastal" && isFog && exposure !== "underground"
      ? clamp(0.2 + normalizedIntensity * 0.16, 0.16, 0.38) * byExposure(exposure, 1, 0.85, 0.55, 0)
      : 0;
  const brookGain =
    waterEnabled && biome === "water" && exposure !== "underground"
      ? clamp(0.16 + normalizedIntensity * 0.12 + (rainLike ? 0.08 : 0), 0.14, 0.38) *
        byExposure(exposure, 1, 0.75, 0.26, 0)
      : 0;

  // Fog condensation drips off leaves/eaves.
  const condensationDripGain =
    isFog && (exposure === "outdoor" || exposure === "sheltered")
      ? clamp(0.14 + normalizedIntensity * 0.16, 0.12, 0.32) * (biome === "forest" ? 1.2 : 1)
      : 0;

  // --- Ambient air / room bed & deep rumbles ----------------------------------
  const airBedGain = airBedEnabled
    ? byExposure(exposure, 0.05, 0.045, 0.032, 0.05) +
      (isFog ? 0.02 : 0) +
      (isSnow ? 0.012 : 0) +
      (phenomenon === "ashfall" ? 0.03 : 0)
    : 0;
  const airBedToneHz =
    exposure === "indoor"
      ? 210
      : exposure === "underground"
        ? 130
        : phenomenon === "ashfall"
          ? 280
          : isFog
            ? 360
            : isSnow
              ? 440
              : rainLike
                ? 700
                : condition === "cloudy"
                  ? 850
                  : 1050;

  const cavernRumbleGain = exposure === "underground" ? 0.18 + (isStorm ? 0.06 : 0) : 0;
  const volcanicRumbleGain =
    phenomenaAudioEnabled && phenomenon === "ashfall"
      ? clamp(0.14 + normalizedIntensity * 0.22, 0.12, 0.38) * byExposure(exposure, 1, 0.85, 0.6, 0.9)
      : 0;

  // --- Phenomena & cozy hearth ------------------------------------------------
  const emberCrackleGain =
    hearthMode !== "off" && phenomenaAudioEnabled && phenomenon === "embers"
      ? clamp((0.18 + normalizedIntensity * 0.32) * (exposure === "indoor" ? 0.55 : 1), 0.12, 0.58)
      : 0;
  const winterHearthGain =
    hearthMode === "off"
      ? 0
      : hearthMode === "on"
        ? 0.28
        : exposure === "indoor" && phenomenon !== "embers" && (state.season === "winter" || isFreezing)
          ? 0.22
          : 0;

  const shimmerStyle: ShimmerStyle =
    phenomenaAudioEnabled &&
    exposure !== "underground" &&
    (phenomenon === "aurora" || phenomenon === "fireflies" || phenomenon === "blossoms")
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
  const windChimeGain =
    shimmerStyle === "blossoms" && exposure !== "underground"
      ? clamp(0.1 + windFactor * 0.18 + normalizedIntensity * 0.08, 0.08, 0.32) * byExposure(exposure, 1, 0.85, 0.4, 0)
      : 0;

  // --- Wildlife (gated by `wildlifeEnabled`) ----------------------------------
  const season = state.season;
  const wildlifeBlocked =
    !wildlifeEnabled ||
    phenomenon === "sandstorm" ||
    phenomenon === "ashfall" ||
    windFactor > 0.8 ||
    rainLike ||
    isSnow;
  const isNight = state.palette === "night" || state.palette === "dusk";
  const isDay = state.palette === "dawn" || state.palette === "day";
  const calmSkyScale = condition === "clear" ? 1 : condition === "cloudy" ? 0.85 : isFog ? 0.55 : 0;
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
  const dawnChorus = birdGain > 0 && state.palette === "dawn";

  // Distant coastal gulls during daytime (non-stormy).
  const gullGain =
    wildlifeEnabled &&
    biome === "coastal" &&
    isDay &&
    !isStorm &&
    phenomenon !== "sandstorm" &&
    phenomenon !== "ashfall" &&
    exposure !== "underground"
      ? 0.18 * wildlifeExposure * (rainLike ? 0.5 : 1)
      : 0;

  // Nocturnal owl hoots in autumn, winter, or forest nights when calm/foggy.
  const owlHabitat = season === "autumn" || season === "winter" || biome === "forest";
  const owlGain =
    !wildlifeBlocked && isNight && owlHabitat && phenomenon !== "embers"
      ? 0.18 * (isFog ? 1.15 : calmSkyScale) * wildlifeExposure * (biome === "forest" ? 1.2 : 1)
      : 0;

  // Warm spring/summer nocturnal frogs & peepers (love water & damp/light-rain air!).
  const frogBlocked =
    !wildlifeEnabled ||
    isStorm ||
    isSnow ||
    phenomenon === "sandstorm" ||
    phenomenon === "ashfall" ||
    phenomenon === "embers" ||
    windFactor > 0.7;
  const frogWarmSeason = season === "spring" || season === "summer";
  const frogTrigger = biome === "water" || condition === "rain" || isFog || (frogWarmSeason && state.palette === "dusk");
  const frogGain =
    !frogBlocked && isNight && frogWarmSeason && frogTrigger
      ? 0.17 * wildlifeExposure * (biome === "water" ? 1.35 : condition === "rain" ? 1.15 : 0.9)
      : 0;

  // Hot-afternoon cicadas on clear/cloudy summer days (>= 78F) or hot late-spring days (>= 80F).
  const cicadaSeasonMatch = (season === "summer" && isHot) || (season === "spring" && isHotSpring);
  const cicadaGain =
    !wildlifeBlocked &&
    cicadaSeasonMatch &&
    state.palette === "day" &&
    (condition === "clear" || condition === "cloudy") &&
    phenomenon !== "embers"
      ? 0.16 * wildlifeExposure * (biome === "forest" ? 1.2 : 1)
      : 0;

  const caveDripGain = exposure === "underground" ? 0.22 + (rainLike ? 0.14 : 0) : 0;

  // --- Thunder & distant storm rumble between flashes -------------------------
  const thunderGainScale = isStorm
    ? clamp((0.45 + normalizedIntensity * 0.48) * byExposure(exposure, 1, 0.88, 0.58, 0.18), 0, 1)
    : 0;
  const thunderProximity = isStorm ? clamp(0.2 + normalizedIntensity * 0.6, 0, 1) : 0;
  const stormRumbleGain =
    isStorm
      ? clamp((0.24 + normalizedIntensity * 0.28) * byExposure(exposure, 1, 0.85, 0.55, 0.2), 0, 0.6)
      : condition === "rain" && normalizedIntensity >= 0.72
        ? clamp(0.14 * byExposure(exposure, 1, 0.8, 0.45, 0.15), 0, 0.22)
        : 0;

  return {
    active: true,
    exposure,
    biome,
    reverbKind,
    wildlifeEnabled,
    warmthEnabled,
    masterGain: round3(volume),
    lowpassHz,
    reverbWet: EXPOSURE_REVERB_WET[exposure],
    rainWashGain: round3(rainWashBase * rainExposureScale * rainVolume),
    rainPatterGain: round3(rainPatterBase * patterExposureScale * rainVolume),
    shelteredRoofGain: round3(shelteredRoofGain * rainVolume),
    dropletRate: round3(dropletRate),
    rainDensity: round3(rainDensity),
    windGain: round3(windGain * windVolume),
    windCenterHz,
    windPanBias: round3(windPanBias),
    gustiness: round3(gustiness),
    windWhistleGain: round3(windWhistleGain * windVolume),
    sandGritGain: round3(sandGritGain * windVolume),
    airBedGain: round3(airBedGain * ambienceVolume),
    airBedToneHz,
    emberCrackleGain: round3(emberCrackleGain * ambienceVolume),
    winterHearthGain: round3(winterHearthGain * ambienceVolume),
    shimmerDroneGain: round3(shimmerDroneGain * ambienceVolume),
    shimmerStyle,
    sparkleGain: round3(sparkleGain * ambienceVolume),
    sparkleRate: round3(sparkleRate),
    windChimeGain: round3(windChimeGain * ambienceVolume),
    surfGain: round3(surfGain * ambienceVolume),
    gullGain: round3(gullGain * ambienceVolume),
    foghornGain: round3(foghornGain * ambienceVolume),
    brookGain: round3(brookGain * ambienceVolume),
    sleetGain: round3(sleetGain * rainVolume),
    autumnLeafGain: round3(autumnLeafGain * windVolume),
    condensationDripGain: round3(condensationDripGain * rainVolume),
    creakGain: round3(creakGain * ambienceVolume),
    cavernRumbleGain: round3(cavernRumbleGain * ambienceVolume),
    volcanicRumbleGain: round3(volcanicRumbleGain * ambienceVolume),
    stormRumbleGain: round3(stormRumbleGain * thunderVolume),
    cricketGain: round3(cricketGain * ambienceVolume),
    birdGain: round3(birdGain * ambienceVolume),
    dawnChorus,
    owlGain: round3(owlGain * ambienceVolume),
    frogGain: round3(frogGain * ambienceVolume),
    cicadaGain: round3(cicadaGain * ambienceVolume),
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
      const value = smoothed * Math.pow(1 - t, 2.6);
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

const SCHEDULER_INTERVAL_MS = 180;
const LOOKAHEAD_SECONDS = 0.42;
const BRANCH_IDLE_STOP_MS = 2600;

type BranchKey =
  | "rainWash"
  | "rainPatter"
  | "shelteredRoof"
  | "wind"
  | "whistle"
  | "grit"
  | "surf"
  | "brook"
  | "gulls"
  | "cicada"
  | "deepRumble"
  | "air"
  | "ember"
  | "pad";
type ThunderDistanceBucket = "close" | "mid" | "far";

interface LoopBranch {
  active: boolean;
  stopTimer: number | null;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

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
  masterWarmth: BiquadFilterNode;
  occlusion: BiquadFilterNode;
  wetOcclusion: BiquadFilterNode;
  reverbSend: GainNode;
  roomConvolver: ConvolverNode | null;
  wideConvolver: ConvolverNode | null;
  activeReverbKind: SoundscapeReverbKind | null;
  reverbStopTimer: number | null;
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
  rainLight: AudioBuffer | null;
  rainDense: AudioBuffer | null;
  fireBed: AudioBuffer | null;
  thunderPool: Partial<Record<ThunderDistanceBucket, AudioBuffer>>;

  rainGain: GainNode;
  rainSwell: GainNode;
  rainWashFilter: BiquadFilterNode;
  rainLowFilter: BiquadFilterNode;
  rainHighFilter: BiquadFilterNode;
  patterGain: GainNode;
  patterLightGain: GainNode;
  patterDenseGain: GainNode;
  patterFilter: BiquadFilterNode;
  shelteredRoofGain: GainNode;
  shelteredRoofBodyFilter: BiquadFilterNode;
  shelteredRoofRunoffFilter: BiquadFilterNode;
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
  gritFilter: BiquadFilterNode;
  gritGust: GainNode;
  gritPan: AudioParam | null;

  surfGain: GainNode;
  surfSwell: GainNode;
  surfFoamSwell: GainNode;
  surfBodyFilter: BiquadFilterNode;
  surfFoamFilter: BiquadFilterNode;
  surfSampleWarmth: BiquadFilterNode;

  brookGain: GainNode;
  brookSwell: GainNode;
  brookFilter: BiquadFilterNode;
  brookSparkleFilter: BiquadFilterNode;
  brookSampleWarmth: BiquadFilterNode;

  emberSampleWarmth: BiquadFilterNode;

  cicadaGain: GainNode;
  cicadaSwell: GainNode;
  cicadaFilter: BiquadFilterNode;

  deepRumbleGain: GainNode;
  deepRumbleDrift: GainNode;
  deepRumbleFilter: BiquadFilterNode;

  airGain: GainNode;
  airDrift: GainNode;
  airFilter: BiquadFilterNode;

  emberGain: GainNode;
  fireFlicker: GainNode;
  emberLowFilter: BiquadFilterNode;
  emberMidFilter: BiquadFilterNode;
  emberBedFilter: BiquadFilterNode;

  padGain: GainNode;
  padFilter: BiquadFilterNode;
  padVoices: PadVoice[];
  sparkleGain: GainNode;
  windChimeGain: GainNode;

  sleetGain: GainNode;
  autumnLeafGain: GainNode;
  condensationGain: GainNode;
  creakGain: GainNode;
  foghornGain: GainNode;
  stormRumbleGain: GainNode;

  cricketGain: GainNode;
  birdGain: GainNode;
  gullGain: GainNode;
  owlGain: GainNode;
  frogGain: GainNode;
  caveGain: GainNode;

  branches: Record<BranchKey, LoopBranch>;
}

type GeneratorKey =
  | "gust"
  | "rainSwell"
  | "surfSwell"
  | "brookSwell"
  | "cicadaSwell"
  | "rumbleSwell"
  | "air"
  | "flicker"
  | "pad"
  | "drops"
  | "pops"
  | "sparkle"
  | "bird"
  | "cave"
  | "gull"
  | "foghorn"
  | "owl"
  | "frog"
  | "sleet"
  | "condensation"
  | "creak"
  | "stormRumble";

const GENERATOR_KEYS: GeneratorKey[] = [
  "gust",
  "rainSwell",
  "surfSwell",
  "brookSwell",
  "cicadaSwell",
  "rumbleSwell",
  "air",
  "flicker",
  "pad",
  "drops",
  "pops",
  "sparkle",
  "bird",
  "cave",
  "gull",
  "foghorn",
  "owl",
  "frog",
  "sleet",
  "condensation",
  "creak",
  "stormRumble",
];

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
  private schedulerTimer: number | null = null;
  private suspendTimer: number | null = null;
  private lastProfile: SoundscapeProfile | null = null;
  private appliedWindCenter = 0;
  private requestSampleCb?: (key: SoundscapeSampleKey) => void;
  private sampleState = new Map<SoundscapeSampleKey, "loading" | "ready" | "missing">();
  private sampleBuffers = new Map<SoundscapeSampleKey, AudioBuffer>();
  private pendingBase64 = new Map<SoundscapeSampleKey, string>();
  private next: Record<GeneratorKey, number> = {
    gust: 0,
    rainSwell: 0,
    surfSwell: 0,
    brookSwell: 0,
    cicadaSwell: 0,
    rumbleSwell: 0,
    air: 0,
    flicker: 0,
    pad: 0,
    drops: 0,
    pops: 0,
    sparkle: 0,
    bird: 0,
    cave: 0,
    gull: 0,
    foghorn: 0,
    owl: 0,
    frog: 0,
    sleet: 0,
    condensation: 0,
    creak: 0,
    stormRumble: 0,
  };
  private crickets: CricketVoice[] = [];
  private destroyed = false;

  constructor(options?: WeatherSoundscapeOptions) {
    this.requestSampleCb = options?.requestSample;
  }

  /** Supplies a lazily fetched base64 audio sample from extension storage. */
  provideSample(key: SoundscapeSampleKey, base64: string | null): void {
    if (this.destroyed) return;
    if (!base64) {
      this.sampleState.set(key, "missing");
      return;
    }
    if (!this.graph) {
      this.pendingBase64.set(key, base64);
      return;
    }
    void this.decodeAndInstallSample(key, base64);
  }

  private ensureSampleRequested(key: SoundscapeSampleKey): void {
    if (!this.requestSampleCb || this.sampleState.has(key)) return;
    this.sampleState.set(key, "loading");
    this.requestSampleCb(key);
  }

  private async decodeAndInstallSample(key: SoundscapeSampleKey, base64: string): Promise<void> {
    const g = this.graph;
    if (this.destroyed || !g || typeof g.ctx.decodeAudioData !== "function") return;
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const decoded = await g.ctx.decodeAudioData(bytes.buffer.slice(0));
      if (this.destroyed || this.graph !== g) return;
      this.sampleBuffers.set(key, decoded);
      this.sampleState.set(key, "ready");
      this.hotSwapSampleBranch(g, key);
    } catch {
      if (!this.destroyed) this.sampleState.set(key, "missing");
    }
  }

  private hotSwapSampleBranch(g: SoundscapeGraph, key: SoundscapeSampleKey): void {
    const profile = this.lastProfile;
    if (!profile || !profile.active) return;
    const now = g.ctx.currentTime;
    const swap = (branchKey: BranchKey, shouldRun: boolean): void => {
      const branch = g.branches[branchKey];
      if (branch.active) {
        this.stopBranchNow(branch);
      }
      if (shouldRun) {
        this.startBranch(g, branchKey);
      }
    };
    switch (key) {
      case "coastal_surf":
        g.surfGain.gain.setTargetAtTime(profile.surfGain * 1.1, now, 0.45);
        swap("surf", profile.surfGain > 0.0005);
        break;
      case "brook":
        g.brookGain.gain.setTargetAtTime(profile.brookGain * 0.95, now, 0.45);
        swap("brook", profile.brookGain > 0.0005);
        break;
      case "hearth": {
        const hearthOrEmber = Math.max(profile.emberCrackleGain, profile.winterHearthGain);
        g.emberGain.gain.setTargetAtTime(hearthOrEmber * 1.05, now, 0.45);
        swap("ember", hearthOrEmber > 0.0005);
        break;
      }
      case "gulls":
        g.gullGain.gain.setTargetAtTime(profile.gullGain * 0.52, now, 0.45);
        swap("gulls", profile.gullGain > 0.0005);
        break;
      case "foghorn":
        g.foghornGain.gain.setTargetAtTime(profile.foghornGain * 0.85, now, 0.45);
        break;
    }
  }

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
      g.masterWarmth.gain.setTargetAtTime(profile.warmthEnabled ? -4.5 : 0, now, 0.35);
      g.occlusion.frequency.setTargetAtTime(profile.lowpassHz, now, 0.45);
      g.wetOcclusion.frequency.setTargetAtTime(profile.lowpassHz, now, 0.45);
      g.reverbReturn.gain.setTargetAtTime(profile.reverbWet, now, layer);

      g.rainGain.gain.setTargetAtTime(profile.rainWashGain, now, layer);
      g.patterGain.gain.setTargetAtTime(profile.rainPatterGain * 0.72, now, layer);
      g.patterLightGain.gain.setTargetAtTime(1 - profile.rainDensity * 0.55, now, layer);
      g.patterDenseGain.gain.setTargetAtTime(profile.rainDensity, now, layer);
      g.shelteredRoofGain.gain.setTargetAtTime(profile.shelteredRoofGain * 0.52, now, layer);
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

      const hasSurfSample = this.sampleBuffers.has("coastal_surf");
      const hasBrookSample = this.sampleBuffers.has("brook");
      const hasHearthSample = this.sampleBuffers.has("hearth");
      const hasGullsSample = this.sampleBuffers.has("gulls");
      const hasFoghornSample = this.sampleBuffers.has("foghorn");

      if (profile.surfGain > 0.0005) this.ensureSampleRequested("coastal_surf");
      if (profile.brookGain > 0.0005) this.ensureSampleRequested("brook");
      if (profile.gullGain > 0.0005) this.ensureSampleRequested("gulls");
      if (profile.foghornGain > 0.0005) this.ensureSampleRequested("foghorn");

      g.surfGain.gain.setTargetAtTime(profile.surfGain * (hasSurfSample ? 1.1 : 0.62), now, 1.1);
      g.brookGain.gain.setTargetAtTime(profile.brookGain * (hasBrookSample ? 0.95 : 0.48), now, 1.1);
      g.cicadaGain.gain.setTargetAtTime(profile.cicadaGain * 0.45, now, 1.2);
      const deepRumbleTarget = Math.max(profile.cavernRumbleGain, profile.volcanicRumbleGain);
      g.deepRumbleGain.gain.setTargetAtTime(deepRumbleTarget * 0.72, now, 1.2);
      g.deepRumbleFilter.frequency.setTargetAtTime(profile.volcanicRumbleGain > profile.cavernRumbleGain ? 95 : 68, now, 1.2);

      g.airGain.gain.setTargetAtTime(profile.airBedGain, now, layer);
      g.airFilter.frequency.setTargetAtTime(profile.airBedToneHz, now, layer);

      const hearthOrEmber = Math.max(profile.emberCrackleGain, profile.winterHearthGain);
      if (hearthOrEmber > 0.0005) this.ensureSampleRequested("hearth");
      g.emberGain.gain.setTargetAtTime(hearthOrEmber * (hasHearthSample ? 1.05 : 0.65), now, layer);
      g.padGain.gain.setTargetAtTime(profile.shimmerDroneGain * 0.3, now, 1.2);
      g.sparkleGain.gain.setTargetAtTime(profile.sparkleGain, now, layer);
      g.windChimeGain.gain.setTargetAtTime(profile.windChimeGain, now, layer);

      g.sleetGain.gain.setTargetAtTime(profile.sleetGain * 0.55, now, layer);
      g.autumnLeafGain.gain.setTargetAtTime(profile.autumnLeafGain * 0.6, now, layer);
      g.condensationGain.gain.setTargetAtTime(profile.condensationDripGain * 0.55, now, layer);
      g.creakGain.gain.setTargetAtTime(profile.creakGain * 0.62, now, layer);
      g.foghornGain.gain.setTargetAtTime(profile.foghornGain * (hasFoghornSample ? 0.85 : 0.42), now, 1.2);
      g.stormRumbleGain.gain.setTargetAtTime(profile.stormRumbleGain * 0.72, now, 1.1);

      g.cricketGain.gain.setTargetAtTime(profile.cricketGain, now, 1.2);
      g.birdGain.gain.setTargetAtTime(profile.birdGain, now, 1.2);
      g.gullGain.gain.setTargetAtTime(profile.gullGain * (hasGullsSample ? 0.52 : 0.65), now, 1.2);
      g.owlGain.gain.setTargetAtTime(profile.owlGain * 0.75, now, 1.2);
      g.frogGain.gain.setTargetAtTime(profile.frogGain * 0.65, now, 1.2);
      g.caveGain.gain.setTargetAtTime(profile.caveDripGain, now, layer);

      // Gate continuous DSP branches and exposure-matched convolution reverb so
      // silent layers stop running on the WebAudio render thread.
      this.syncReverbActive(g, profile.reverbWet > 0.001, profile.reverbKind);
      this.syncBranchActive(g, "rainWash", profile.rainWashGain > 0.0005);
      this.syncBranchActive(g, "rainPatter", profile.rainPatterGain > 0.0005);
      this.syncBranchActive(g, "shelteredRoof", profile.shelteredRoofGain > 0.0005);
      this.syncBranchActive(g, "wind", profile.windGain > 0.0005);
      this.syncBranchActive(g, "whistle", profile.windWhistleGain > 0.0005);
      this.syncBranchActive(g, "grit", profile.sandGritGain > 0.0005);
      this.syncBranchActive(g, "surf", profile.surfGain > 0.0005);
      this.syncBranchActive(g, "brook", profile.brookGain > 0.0005);
      this.syncBranchActive(g, "gulls", profile.gullGain > 0.0005 && hasGullsSample);
      this.syncBranchActive(g, "cicada", profile.cicadaGain > 0.0005);
      this.syncBranchActive(g, "deepRumble", deepRumbleTarget > 0.0005);
      this.syncBranchActive(g, "air", profile.airBedGain > 0.0005);
      this.syncBranchActive(g, "ember", hearthOrEmber > 0.0005);
      this.syncBranchActive(g, "pad", profile.shimmerDroneGain > 0.0005);
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

      const bucket: ThunderDistanceBucket = distance < 0.34 ? "close" : distance < 0.68 ? "mid" : "far";
      let strikeBuffer = g.thunderPool[bucket];
      if (!strikeBuffer) {
        const canonicalDistance = bucket === "close" ? 0.16 : bucket === "mid" ? 0.5 : 0.84;
        strikeBuffer = renderThunderBuffer(ctx, canonicalDistance);
        g.thunderPool[bucket] = strikeBuffer;
      }
      const playbackRate = rand(0.88, 1.12);
      const duration = strikeBuffer.duration / playbackRate;

      const source = ctx.createBufferSource();
      source.buffer = strikeBuffer;
      source.playbackRate.value = playbackRate;

      const out = ctx.createGain();
      out.gain.value = loudness;
      const panner = this.createPanner(basePan);
      if (panner.pan) {
        panner.pan.setValueAtTime(basePan, t0);
        // The rumble rolls across the sky biased by the prevailing wind direction.
        const rollTarget = clamp(basePan + profile.windPanBias * 0.65 + rand(-0.35, 0.35), -0.85, 0.85);
        panner.pan.linearRampToValueAtTime(rollTarget, t0 + duration);
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
    if (this.graph) {
      if (this.graph.reverbStopTimer !== null) {
        window.clearTimeout(this.graph.reverbStopTimer);
        this.graph.reverbStopTimer = null;
      }
      for (const branch of Object.values(this.graph.branches)) {
        this.stopBranchNow(branch);
      }
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
      if (p.windGain > 0 || p.sandGritGain > 0 || p.autumnLeafGain > 0 || p.windChimeGain > 0) {
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
      if (p.surfGain > 0 && !this.sampleBuffers.has("coastal_surf")) {
        this.runInterval("surfSwell", now, horizon, (t) => {
          // Slow 6-11 s coastal surf swell: crest rolls in, followed by receding foam hiss.
          const crest = rand(0.65, 1.28);
          const period = rand(6.2, 10.8);
          const riseTc = period * 0.22;
          g.surfSwell.gain.setTargetAtTime(crest, t, riseTc);
          g.surfBodyFilter.frequency.setTargetAtTime(220 + crest * 190, t, riseTc);
          g.surfFoamSwell.gain.setTargetAtTime(crest * 0.85, t + period * 0.24, period * 0.16);
          g.surfSwell.gain.setTargetAtTime(rand(0.28, 0.48), t + period * 0.44, period * 0.25);
          g.surfFoamSwell.gain.setTargetAtTime(rand(0.14, 0.3), t + period * 0.56, period * 0.22);
          return period;
        });
      }
      if (p.brookGain > 0 && !this.sampleBuffers.has("brook")) {
        this.runInterval("brookSwell", now, horizon, (t) => {
          g.brookSwell.gain.setTargetAtTime(rand(0.78, 1.22), t, rand(0.7, 1.8));
          g.brookFilter.frequency.setTargetAtTime(rand(760, 1180), t, rand(0.9, 2.1));
          return rand(1.2, 3.2);
        });
      }
      if (p.cicadaGain > 0) {
        this.runInterval("cicadaSwell", now, horizon, (t) => {
          const swell = rand(0.42, 1.25);
          const dur = rand(1.8, 4.2);
          g.cicadaSwell.gain.setTargetAtTime(swell, t, dur * 0.35);
          g.cicadaFilter.frequency.setTargetAtTime(rand(4200, 5200), t, dur * 0.4);
          return dur;
        });
      }
      if (p.cavernRumbleGain > 0 || p.volcanicRumbleGain > 0) {
        this.runInterval("rumbleSwell", now, horizon, (t) => {
          g.deepRumbleDrift.gain.setTargetAtTime(rand(0.6, 1.32), t, rand(1.8, 4.2));
          return rand(3.2, 7.5);
        });
      }
      if (p.airBedGain > 0) {
        this.runInterval("air", now, horizon, (t) => {
          g.airDrift.gain.setTargetAtTime(rand(0.6, 1.3), t, rand(1.5, 3.5));
          return rand(2.5, 6.5);
        });
      }
      const hearthOrEmber = Math.max(p.emberCrackleGain, p.winterHearthGain);
      if (hearthOrEmber > 0 && !this.sampleBuffers.has("hearth")) {
        this.runInterval("flicker", now, horizon, (t) => {
          g.fireFlicker.gain.setTargetAtTime(rand(0.68, 1.28), t, rand(0.14, 0.45));
          return rand(0.22, 0.75);
        });
        // Sparse, natural hearth snaps (~0.6 to 2.2 per second) rather than a rapid Geiger click stream.
        this.runPoisson("pops", 0.38 + hearthOrEmber * 2.6, now, horizon, (t) => this.spawnPop(t));
      }
      if (p.shimmerDroneGain > 0) {
        this.runInterval("pad", now, horizon, (t) => {
          const isAurora = p.shimmerStyle === "aurora";
          for (const voice of g.padVoices) {
            voice.gain.gain.setTargetAtTime(rand(0.02, isAurora ? 0.38 : 0.32), t, rand(1.8, 4.5));
            voice.osc.detune.setTargetAtTime(rand(-9, 9), t, rand(2, 5));
          }
          // Aurora breathes with slow choral/harmonic filter sweeps.
          g.padFilter.frequency.setTargetAtTime(isAurora ? rand(480, 2600) : rand(650, 2200), t, rand(2.5, 5.5));
          g.padFilter.Q.setTargetAtTime(isAurora ? rand(0.6, 2.4) : 0.45, t, rand(2.2, 4.5));
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
      if (p.sleetGain > 0) {
        this.runPoisson("sleet", 2.2 + p.sleetGain * 10, now, horizon, (t) => this.spawnSleet(t));
      }
      if (p.condensationDripGain > 0) {
        this.runPoisson("condensation", 0.3 + p.condensationDripGain * 1.6, now, horizon, (t) =>
          this.spawnCondensationDrip(t),
        );
      }
      if (p.creakGain > 0) {
        this.runInterval("creak", now, horizon, (t) => this.spawnCreak(t));
      }
      if (p.foghornGain > 0) {
        this.runInterval("foghorn", now, horizon, (t) => this.spawnFoghorn(t));
      }
      if (p.stormRumbleGain > 0) {
        this.runInterval("stormRumble", now, horizon, (t) => this.spawnDistantRumble(t, p.windPanBias));
      }
      if (p.caveDripGain > 0) {
        this.runPoisson("cave", 0.25 + p.caveDripGain * 1.2, now, horizon, (t) => this.spawnDrop(t, "cave", g.caveGain));
      }
      if (p.birdGain > 0) {
        this.runInterval("bird", now, horizon, (t) => this.spawnBirdPhrase(t, p.dawnChorus));
      }
      if (p.gullGain > 0 && !this.sampleBuffers.has("gulls")) {
        this.runInterval("gull", now, horizon, (t) => this.spawnGull(t));
      }
      if (p.owlGain > 0) {
        this.runInterval("owl", now, horizon, (t) => this.spawnOwl(t));
      }
      if (p.frogGain > 0) {
        this.runInterval("frog", now, horizon, (t) => this.spawnFrog(t));
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
    const panTarget = clamp(p.windPanBias + rand(-0.42, 0.42), -0.82, 0.82);
    g.windPan?.setTargetAtTime(panTarget, t, rise);
    // Sandstorm / ash grit sweeps across the stereo field following the gust direction.
    if (g.gritPan && p.sandGritGain > 0) {
      const startPan = clamp(p.windPanBias - 0.35 + rand(-0.15, 0.15), -0.85, 0.85);
      const endPan = clamp(p.windPanBias + 0.35 + rand(-0.15, 0.15), -0.85, 0.85);
      g.gritPan.setTargetAtTime(startPan, t, tc * 0.6);
      g.gritPan.setTargetAtTime(endPan, t + rise * 0.55, rise * 0.8);
    }
    // Gust-coupled events: dry autumn leaf skittering & blossom wind chimes.
    if (p.autumnLeafGain > 0 && level > 0.62 && Math.random() < 0.75) {
      this.spawnAutumnLeaf(t + rise * 0.35, panTarget);
    }
    if (p.windChimeGain > 0 && level > 0.52 && Math.random() < 0.68) {
      this.spawnWindChime(t + rise * 0.3, level);
    }
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
        // Mix shallow crystalline cave plinks with deeper echoing pool plops.
        if (Math.random() < 0.42) {
          this.spawnPlink(t, destination, rand(240, 480), rand(0.18, 0.42), rand(0.11, 0.22), rand(-0.82, 0.82));
        } else {
          this.spawnPlink(t, destination, rand(560, 1450), rand(0.14, 0.36), rand(0.075, 0.15), rand(-0.82, 0.82));
        }
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
  private spawnBirdPhrase(t: number, dawnChorus = false): number {
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
    // Dawn chorus brings livelier, gently overlapping song phrases.
    return dawnChorus ? rand(0.65, 2.4) : at - t + rand(1.8, 8);
  }

  /** Sharp glassy sleet / ice-pellet tap in heavy or windy snow. */
  private spawnSleet(t: number): void {
    this.spawnNoiseGrain(t, this.graph!.sleetGain, {
      freq: rand(3800, 6400),
      q: rand(2.2, 4.2),
      peak: rand(0.12, 0.36),
      decay: rand(0.0025, 0.0065),
      pan: rand(-0.88, 0.88),
    });
  }

  /** Soft, mellow condensation drip from leaves or eaves during fog. */
  private spawnCondensationDrip(t: number): void {
    this.spawnPlink(t, this.graph!.condensationGain, rand(420, 820), rand(0.06, 0.16), rand(0.045, 0.09), rand(-0.8, 0.8));
  }

  /** Brief cluster of dry autumn leaves skittering across the ground on a wind gust. */
  private spawnAutumnLeaf(t: number, basePan: number): void {
    const count = 3 + Math.floor(Math.random() * 4);
    let at = t;
    for (let i = 0; i < count; i += 1) {
      this.spawnNoiseGrain(at, this.graph!.autumnLeafGain, {
        freq: rand(2400, 5200),
        q: rand(1.2, 2.6),
        peak: rand(0.08, 0.22),
        decay: rand(0.016, 0.042),
        pan: clamp(basePan + (i - count * 0.5) * 0.09 + rand(-0.1, 0.1), -0.9, 0.9),
      });
      at += rand(0.045, 0.14);
    }
  }

  /** Wind-driven pentatonic glass/bamboo chimes for blossom scenes. */
  private spawnWindChime(t: number, gustLevel: number): void {
    const g = this.graph!;
    const ctx = g.ctx;
    const count = Math.min(4, 2 + Math.floor(gustLevel * 2));
    let at = t;
    for (let i = 0; i < count; i += 1) {
      const freq = pick(BLOSSOM_SPARKLE_NOTES) * (Math.random() < 0.35 ? 2 : 1);
      const decay = rand(0.9, 2.2);
      const peak = rand(0.05, 0.14) * clamp(gustLevel, 0.5, 1.2);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = rand(-5, 5);
      const overtone = ctx.createOscillator();
      overtone.type = "sine";
      overtone.frequency.value = freq * 2.756;
      const overGain = ctx.createGain();
      overGain.gain.value = 0.24;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(peak, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      const panner = this.createPanner(rand(-0.7, 0.7));
      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(panner.node);
      panner.node.connect(g.windChimeGain);
      osc.start(at);
      overtone.start(at);
      osc.stop(at + decay + 0.04);
      overtone.stop(at + decay + 0.04);
      this.disposeOnEnd(overtone, [overGain]);
      this.disposeOnEnd(osc, [gain, panner.node]);
      at += rand(0.08, 0.24);
    }
  }

  /** Subtle timber/shutter/branch stress creak during indoor storms or cold winter winds. */
  private spawnCreak(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const dur = rand(0.32, 0.82);
    const f0 = rand(155, 310);
    const source = ctx.createBufferSource();
    source.buffer = g.brown;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f0 * rand(0.68, 1.38), t + dur);
    filter.Q.value = rand(8, 15);
    const gain = ctx.createGain();
    const peak = rand(0.14, 0.28);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const panner = this.createPanner(rand(-0.75, 0.75));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(g.creakGain);
    source.start(t, Math.random() * 5);
    source.stop(t + dur + 0.04);
    this.disposeOnEnd(source, [filter, gain, panner.node]);
    return dur + rand(6.5, 19);
  }

  /** Distant coastal seabird gull cry (soft, far-off, reverberant). */
  private spawnGull(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const cries = 1 + (Math.random() < 0.5 ? 1 : 0);
    const panner = this.createPanner(rand(-0.8, 0.8));
    panner.node.connect(g.gullGain);
    let at = t;
    let lastOsc: OscillatorNode | null = null;
    for (let i = 0; i < cries; i += 1) {
      const dur = rand(0.36, 0.58);
      const base = rand(1350, 1750);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.24, at + dur * 0.35);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, at + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = base * 1.1;
      filter.Q.value = 1.6;
      const gain = ctx.createGain();
      const peak = rand(0.055, 0.11);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(peak, at + dur * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner.node);
      osc.start(at);
      osc.stop(at + dur + 0.03);
      this.disposeOnEnd(osc, [filter, gain]);
      lastOsc = osc;
      at += dur + rand(0.18, 0.42);
    }
    if (lastOsc) {
      const prev = lastOsc.onended;
      lastOsc.onended = (ev) => {
        if (typeof prev === "function") prev.call(lastOsc!, ev);
        try {
          panner.node.disconnect();
        } catch {
          // Already disconnected
        }
      };
    }
    return at - t + rand(7, 22);
  }

  /** Rare distant coastal harbor foghorn during foggy scenes. */
  private spawnFoghorn(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const sample = this.sampleBuffers.get("foghorn");
    if (sample) {
      const rate = rand(0.95, 1.05);
      const dur = sample.duration / rate;
      const source = ctx.createBufferSource();
      source.buffer = sample;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = rand(0.55, 0.85);
      const panner = this.createPanner(rand(-0.65, 0.65));
      source.connect(gain);
      gain.connect(panner.node);
      panner.node.connect(g.foghornGain);
      source.start(t);
      source.stop(t + dur + 0.08);
      this.disposeOnEnd(source, [gain, panner.node]);
      return dur + rand(18, 38);
    }

    const dur = rand(2.1, 3.1);
    const fundamental = rand(82, 106);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 340;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    const peak = rand(0.12, 0.22);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.38);
    gain.gain.setValueAtTime(peak * 0.92, t + dur * 0.68);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const panner = this.createPanner(rand(-0.65, 0.65));
    filter.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(g.foghornGain);

    const partials = [
      { mult: 1, amp: 0.72 },
      { mult: 2, amp: 0.34 },
      { mult: 3, amp: 0.16 },
    ];
    let lastOsc: OscillatorNode | null = null;
    for (const part of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(fundamental * part.mult, t);
      osc.frequency.linearRampToValueAtTime(fundamental * part.mult * 0.985, t + dur);
      const pGain = ctx.createGain();
      pGain.gain.value = part.amp;
      osc.connect(pGain);
      pGain.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.06);
      this.disposeOnEnd(osc, [pGain]);
      lastOsc = osc;
    }
    if (lastOsc) {
      const prev = lastOsc.onended;
      lastOsc.onended = (ev) => {
        if (typeof prev === "function") prev.call(lastOsc!, ev);
        for (const node of [filter, gain, panner.node]) {
          try {
            node.disconnect();
          } catch {
            // Already disconnected
          }
        }
      };
    }
    return dur + rand(18, 38);
  }

  /** Distant nocturnal owl hoot ("hoo... hoo-hoo") with soft flute timbre. */
  private spawnOwl(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const base = rand(365, 455);
    const panner = this.createPanner(rand(-0.78, 0.78));
    panner.node.connect(g.owlGain);
    const pattern = Math.random() < 0.55
      ? [
          { delay: 0, dur: 0.34, pitch: 1.04 },
          { delay: 0.62, dur: 0.18, pitch: 1.0 },
          { delay: 0.88, dur: 0.44, pitch: 0.94 },
        ]
      : [
          { delay: 0, dur: 0.38, pitch: 1.02 },
          { delay: 0.68, dur: 0.46, pitch: 0.92 },
        ];
    let lastOsc: OscillatorNode | null = null;
    let endAt = t;
    for (const hoot of pattern) {
      const at = t + hoot.delay;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * hoot.pitch, at);
      osc.frequency.exponentialRampToValueAtTime(base * hoot.pitch * 0.91, at + hoot.dur);
      const gain = ctx.createGain();
      const peak = rand(0.09, 0.16);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(peak, at + hoot.dur * 0.24);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + hoot.dur);
      osc.connect(gain);
      gain.connect(panner.node);
      osc.start(at);
      osc.stop(at + hoot.dur + 0.04);
      this.disposeOnEnd(osc, [gain]);
      lastOsc = osc;
      endAt = Math.max(endAt, at + hoot.dur);
    }
    if (lastOsc) {
      const prev = lastOsc.onended;
      lastOsc.onended = (ev) => {
        if (typeof prev === "function") prev.call(lastOsc!, ev);
        try {
          panner.node.disconnect();
        } catch {
          // Already disconnected
        }
      };
    }
    return endAt - t + rand(10, 26);
  }

  /** Warm spring/summer nocturnal marsh frog croak or peeper chirp. */
  private spawnFrog(t: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const isPeeper = Math.random() < 0.55;
    const panner = this.createPanner(rand(-0.82, 0.82));
    panner.node.connect(g.frogGain);

    if (isPeeper) {
      const dur = rand(0.075, 0.125);
      const f0 = rand(1850, 2350);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.12, t + dur);
      const gain = ctx.createGain();
      const peak = rand(0.055, 0.11);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(panner.node);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      this.disposeOnEnd(osc, [gain, panner.node]);
      return dur + rand(0.85, 3.4);
    }

    // Resonant low marsh frog double-croak.
    const pulses = 2;
    const base = rand(210, 320);
    let at = t;
    let lastOsc: OscillatorNode | null = null;
    for (let i = 0; i < pulses; i += 1) {
      const dur = rand(0.14, 0.24);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * 0.84, at + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = base * 2.2;
      filter.Q.value = 3.5;
      const gain = ctx.createGain();
      const peak = rand(0.09, 0.16);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(peak, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner.node);
      osc.start(at);
      osc.stop(at + dur + 0.03);
      this.disposeOnEnd(osc, [filter, gain]);
      lastOsc = osc;
      at += dur + rand(0.14, 0.28);
    }
    if (lastOsc) {
      const prev = lastOsc.onended;
      lastOsc.onended = (ev) => {
        if (typeof prev === "function") prev.call(lastOsc!, ev);
        try {
          panner.node.disconnect();
        } catch {
          // Already disconnected
        }
      };
    }
    return at - t + rand(2.6, 7.5);
  }

  /** Subtle distant rolling thunder swell between visible lightning strikes. */
  private spawnDistantRumble(t: number, windPanBias: number): number {
    const g = this.graph!;
    const ctx = g.ctx;
    const dur = rand(2.8, 5.2);
    const source = ctx.createBufferSource();
    source.buffer = g.brown;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(rand(85, 135), t);
    filter.frequency.exponentialRampToValueAtTime(48, t + dur);
    const gain = ctx.createGain();
    const peak = rand(0.18, 0.36);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + dur * 0.34);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const startPan = clamp(windPanBias + rand(-0.45, 0.45), -0.82, 0.82);
    const panner = this.createPanner(startPan);
    if (panner.pan) {
      panner.pan.setValueAtTime(startPan, t);
      panner.pan.linearRampToValueAtTime(clamp(startPan + windPanBias * 0.5 + rand(-0.25, 0.25), -0.85, 0.85), t + dur);
    }
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(g.stormRumbleGain);
    source.start(t, Math.random() * 4);
    source.stop(t + dur + 0.08);
    this.disposeOnEnd(source, [filter, gain, panner.node]);
    return dur + rand(6, 16);
  }

  // --------------------------------------------------------------------------
  // Graph construction
  // --------------------------------------------------------------------------

  private syncReverbActive(g: SoundscapeGraph, active: boolean, kind: SoundscapeReverbKind): void {
    const getConvolver = (target: SoundscapeReverbKind): ConvolverNode => {
      if (target === "room") {
        if (!g.roomConvolver) {
          const conv = g.ctx.createConvolver();
          conv.normalize = false;
          conv.buffer = createImpulseResponse(g.ctx, 0.45);
          conv.connect(g.reverbReturn);
          g.roomConvolver = conv;
        }
        return g.roomConvolver;
      }
      if (!g.wideConvolver) {
        const conv = g.ctx.createConvolver();
        conv.normalize = false;
        conv.buffer = createImpulseResponse(g.ctx, 1.5);
        conv.connect(g.reverbReturn);
        g.wideConvolver = conv;
      }
      return g.wideConvolver;
    };

    if (active) {
      if (g.reverbStopTimer !== null) {
        window.clearTimeout(g.reverbStopTimer);
        g.reverbStopTimer = null;
      }
      if (g.activeReverbKind !== kind) {
        if (g.activeReverbKind !== null) {
          const prev = g.activeReverbKind === "room" ? g.roomConvolver : g.wideConvolver;
          if (prev) {
            try {
              g.reverbSend.disconnect(prev);
            } catch {
              // Already disconnected
            }
          }
        }
        g.reverbSend.connect(getConvolver(kind));
        g.activeReverbKind = kind;
      }
      return;
    }

    if (g.activeReverbKind !== null && g.reverbStopTimer === null) {
      g.reverbStopTimer = window.setTimeout(() => {
        g.reverbStopTimer = null;
        if (this.destroyed || !this.graph || this.graph !== g) return;
        if ((this.lastProfile?.reverbWet ?? 0) > 0.001) return;
        const current = g.activeReverbKind === "room" ? g.roomConvolver : g.wideConvolver;
        if (current) {
          try {
            g.reverbSend.disconnect(current);
          } catch {
            // Already disconnected
          }
        }
        g.activeReverbKind = null;
      }, BRANCH_IDLE_STOP_MS);
    }
  }

  private stopBranchNow(branch: LoopBranch): void {
    if (branch.stopTimer !== null) {
      window.clearTimeout(branch.stopTimer);
      branch.stopTimer = null;
    }
    for (const source of branch.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    for (const node of branch.nodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    }
    branch.sources = [];
    branch.nodes = [];
    branch.active = false;
  }

  private syncBranchActive(g: SoundscapeGraph, key: BranchKey, active: boolean): void {
    const branch = g.branches[key];
    if (active) {
      if (branch.stopTimer !== null) {
        window.clearTimeout(branch.stopTimer);
        branch.stopTimer = null;
      }
      if (!branch.active) {
        this.startBranch(g, key);
      }
      return;
    }

    if (branch.active && branch.stopTimer === null) {
      branch.stopTimer = window.setTimeout(() => {
        branch.stopTimer = null;
        if (this.destroyed || this.graph !== g) return;
        this.stopBranchNow(branch);
        if (key === "pad") g.padVoices = [];
      }, BRANCH_IDLE_STOP_MS);
    }
  }

  private startBranch(g: SoundscapeGraph, key: BranchKey): void {
    const branch = g.branches[key];
    const audio = g.ctx;
    const startLoop = (buffer: AudioBuffer, rate: number, destination: AudioNode): void => {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = rate;
      source.connect(destination);
      source.start(0, Math.random() * (buffer.duration || 1));
      branch.sources.push(source);
    };

    const startSampleLoop = (buffer: AudioBuffer, destination: AudioNode): void => {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      // Trim ~30ms MP3 encoder padding at loop boundaries for click-free seamless looping.
      if (buffer.duration > 1) {
        source.loopStart = 0.03;
        source.loopEnd = Math.max(0.5, buffer.duration - 0.03);
      }
      source.connect(destination);
      const span = Math.max(0.1, (source.loopEnd || buffer.duration || 1) - (source.loopStart || 0));
      source.start(0, (source.loopStart || 0) + Math.random() * span);
      branch.sources.push(source);
    };

    switch (key) {
      case "rainWash":
        startLoop(g.pink, 1, g.rainWashFilter);
        startLoop(g.brown, 1.05, g.rainLowFilter);
        startLoop(g.pink, 0.93, g.rainHighFilter);
        break;
      case "rainPatter":
        if (!g.rainLight) g.rainLight = createRainTextureBuffer(audio, 6.7, 260);
        if (!g.rainDense) g.rainDense = createRainTextureBuffer(audio, 5.9, 1350);
        startLoop(g.rainLight, 1, g.patterLightGain);
        startLoop(g.rainDense, 1, g.patterDenseGain);
        break;
      case "shelteredRoof":
        startLoop(g.brown, 0.92, g.shelteredRoofBodyFilter);
        startLoop(g.pink, 1.04, g.shelteredRoofRunoffFilter);
        break;
      case "wind":
        startLoop(g.brown, 1, g.windFilter);
        break;
      case "whistle":
        startLoop(g.pink, 1.07, g.whistleFilter);
        break;
      case "grit":
        startLoop(g.pink, 1.13, g.gritFilter);
        break;
      case "surf": {
        const surfSample = this.sampleBuffers.get("coastal_surf");
        if (surfSample) {
          startSampleLoop(surfSample, g.surfSampleWarmth);
        } else {
          startLoop(g.brown, 0.78, g.surfBodyFilter);
          startLoop(g.pink, 0.91, g.surfFoamFilter);
        }
        break;
      }
      case "brook": {
        const brookSample = this.sampleBuffers.get("brook");
        if (brookSample) {
          startSampleLoop(brookSample, g.brookSampleWarmth);
        } else {
          startLoop(g.pink, 1.03, g.brookFilter);
          startLoop(g.pink, 1.19, g.brookSparkleFilter);
        }
        break;
      }
      case "gulls": {
        const gullsSample = this.sampleBuffers.get("gulls");
        if (gullsSample) {
          startSampleLoop(gullsSample, g.gullGain);
        }
        break;
      }
      case "cicada":
        startLoop(g.pink, 1.21, g.cicadaFilter);
        break;
      case "deepRumble":
        startLoop(g.brown, 0.62, g.deepRumbleFilter);
        break;
      case "air":
        startLoop(g.pink, 0.81, g.airFilter);
        break;
      case "ember": {
        const hearthSample = this.sampleBuffers.get("hearth");
        if (hearthSample) {
          startSampleLoop(hearthSample, g.emberSampleWarmth);
        } else {
          if (!g.fireBed) g.fireBed = createFireBedBuffer(audio, 7.3);
          startLoop(g.brown, 0.88, g.emberLowFilter);
          startLoop(g.pink, 0.94, g.emberMidFilter);
          startLoop(g.fireBed, 0.96, g.emberBedFilter);
        }
        break;
      }
      case "pad": {
        const voices: PadVoice[] = PAD_FREQUENCIES.map((frequency, index) => {
          const osc = audio.createOscillator();
          osc.type = index === 0 ? "triangle" : "sine";
          osc.frequency.value = frequency;
          const gain = audio.createGain();
          gain.gain.value = 0.15;
          osc.connect(gain);
          gain.connect(g.padFilter);
          osc.start(0);
          branch.sources.push(osc);
          branch.nodes.push(gain);
          return { osc, gain };
        });
        g.padVoices = voices;
        break;
      }
    }
    branch.active = true;
  }

  private ensureGraph(): boolean {
    if (this.graph) return true;
    const Ctor = resolveAudioContextConstructor();
    if (!Ctor) return false;

    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctor();
      const audio = ctx;

      // Distinct, non-multiple loop lengths so beds never phase-align audibly.
      // Heavy granular textures (`rainLight`, `rainDense`, `fireBed`) and convolution
      // IRs (`roomConvolver`, `wideConvolver`) are built lazily only when needed.
      const pink = createNoiseBuffer(audio, 11.3, "pink");
      const brown = createNoiseBuffer(audio, 9.7, "brown");
      const white = createNoiseBuffer(audio, 2.5, "white", 1);

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
      const chain = (...nodes: AudioNode[]): void => {
        for (let index = 0; index < nodes.length - 1; index += 1) nodes[index]!.connect(nodes[index + 1]!);
      };

      // ---- Master / spatial section ----
      const master = gainNode(0);
      const masterWarmth = filterNode("highshelf", 2600, 0.7);
      masterWarmth.gain.value = -4.5;
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.3;
      chain(master, masterWarmth, compressor, audio.destination);

      const occlusion = filterNode("lowpass", 16000, 0.5);
      const wetOcclusion = filterNode("lowpass", 16000, 0.5);
      const reverbSend = gainNode(1);
      const reverbReturn = gainNode(0.12);
      reverbReturn.connect(master);

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

      // ---- Rain: wash + low body + airy hiss, all under one slow "swell" ----
      const rainGain = gainNode(0);
      const rainSwell = gainNode(1);
      const rainWashFilter = filterNode("bandpass", 1350, 0.55);
      const rainLowFilter = filterNode("lowpass", 520);
      const rainHighFilter = filterNode("highpass", 4800);
      chain(rainWashFilter, rainSwell);
      chain(rainLowFilter, gainNode(0.55), rainSwell);
      chain(rainHighFilter, gainNode(0.22), rainSwell);
      chain(rainSwell, rainGain, bus);

      // Ground rain texture: two lazily pre-rendered micro-impact beds
      // crossfaded by `rainDensity`, plus soft discrete foreground droplets.
      const patterGain = gainNode(0);
      const patterLightGain = gainNode(1);
      const patterDenseGain = gainNode(0);
      const patterFilter = filterNode("bandpass", 1950, 0.65);
      patterLightGain.connect(patterFilter);
      patterDenseGain.connect(patterFilter);
      chain(patterFilter, patterGain, bus);

      // Sheltered overhead roof / awning resonance (near space).
      const shelteredRoofGain = gainNode(0);
      const shelteredRoofBodyFilter = filterNode("bandpass", 340, 1.8);
      const shelteredRoofRunoffFilter = filterNode("bandpass", 1250, 1.1);
      chain(shelteredRoofBodyFilter, shelteredRoofGain);
      chain(shelteredRoofRunoffFilter, gainNode(0.45), shelteredRoofGain);
      shelteredRoofGain.connect(nearBus);

      const dropsGain = gainNode(0);
      dropsGain.connect(bus);
      const glassDropsGain = gainNode(0);
      // Indoor windowpane taps stay dry (`master` only, not `reverbSend`) so they don't echo like cave drips.
      chain(glassDropsGain, filterNode("lowpass", 2200), master);

      // ---- Wind: gusting body, whistle, and directional sand grit ----
      const windGain = gainNode(0);
      const windGust = gainNode(1);
      const windFilter = filterNode("bandpass", 220, 1.4);
      const windPanNode = this.createPannerFor(audio, 0);
      chain(windFilter, windGust, windPanNode.node, windGain, bus);

      const whistleGain = gainNode(0);
      const whistleGust = gainNode(0);
      const whistleFilter = filterNode("bandpass", 700, 9);
      chain(whistleFilter, whistleGust, whistleGain, bus);

      const gritGain = gainNode(0);
      const gritFilter = filterNode("highpass", 2600);
      const gritGust = gainNode(1);
      const gritPanNode = this.createPannerFor(audio, 0);
      chain(gritFilter, gritGust, gritPanNode.node, gritGain, bus);

      // ---- Biome water & summer beds: coastal surf, babbling brook, hot cicadas ----
      const surfGain = gainNode(0);
      const surfSwell = gainNode(0.5);
      const surfFoamSwell = gainNode(0.25);
      const surfBodyFilter = filterNode("lowpass", 300, 0.65);
      const surfFoamFilter = filterNode("bandpass", 2100, 0.7);
      const surfSampleWarmth = filterNode("highshelf", 2600, 0.7);
      surfSampleWarmth.gain.value = -4.5;
      chain(surfBodyFilter, surfSwell, surfGain);
      chain(surfFoamFilter, surfFoamSwell, gainNode(0.32), surfGain);
      chain(surfSampleWarmth, surfGain);
      surfGain.connect(bus);

      const brookGain = gainNode(0);
      const brookSwell = gainNode(1);
      const brookFilter = filterNode("bandpass", 920, 0.85);
      const brookSparkleFilter = filterNode("bandpass", 2800, 1.4);
      const brookSampleWarmth = filterNode("highshelf", 2600, 0.7);
      brookSampleWarmth.gain.value = -4.5;
      chain(brookFilter, brookSwell);
      chain(brookSparkleFilter, gainNode(0.3), brookSwell);
      chain(brookSwell, brookGain, bus);
      chain(brookSampleWarmth, brookGain);

      const cicadaGain = gainNode(0);
      const cicadaSwell = gainNode(0.7);
      const cicadaFilter = filterNode("bandpass", 4600, 4.5);
      chain(cicadaFilter, cicadaSwell, cicadaGain, bus);

      // ---- Sub-bass cavern airflow / volcanic rumble ----
      const deepRumbleGain = gainNode(0);
      const deepRumbleDrift = gainNode(1);
      const deepRumbleFilter = filterNode("lowpass", 75, 0.7);
      chain(deepRumbleFilter, deepRumbleDrift, deepRumbleGain, nearBus);

      // ---- Air / room tone ----
      const airGain = gainNode(0);
      const airDrift = gainNode(1);
      const airFilter = filterNode("lowpass", 900, 0.3);
      chain(airFilter, airDrift, airGain, bus);

      // ---- Embers / indoor winter hearth ----
      const emberGain = gainNode(0);
      const fireFlicker = gainNode(1);
      const emberLowFilter = filterNode("lowpass", 220);
      const emberMidFilter = filterNode("bandpass", 420, 0.75);
      const emberBedFilter = filterNode("lowpass", 2400);
      const emberSampleWarmth = filterNode("highshelf", 2600, 0.7);
      emberSampleWarmth.gain.value = -3;
      chain(emberLowFilter, gainNode(0.95), fireFlicker);
      chain(emberMidFilter, gainNode(0.42), fireFlicker);
      chain(fireFlicker, emberGain);
      chain(emberBedFilter, gainNode(0.65), emberGain);
      chain(emberSampleWarmth, emberGain);
      emberGain.connect(nearBus);

      // ---- Shimmer pad, sparkles, and blossom wind chimes ----
      const padGain = gainNode(0);
      const padFilter = filterNode("lowpass", 1400, 0.4);
      chain(padFilter, padGain, wetBus);
      const sparkleGain = gainNode(0);
      sparkleGain.connect(wetBus);
      const windChimeGain = gainNode(0);
      windChimeGain.connect(wetBus);

      // ---- Weather & atmospheric discrete event buses ----
      const sleetGain = gainNode(0);
      sleetGain.connect(bus);
      const autumnLeafGain = gainNode(0);
      autumnLeafGain.connect(bus);
      const condensationGain = gainNode(0);
      condensationGain.connect(bus);
      const creakGain = gainNode(0);
      creakGain.connect(nearBus);
      const foghornGain = gainNode(0);
      foghornGain.connect(wetBus);
      const stormRumbleGain = gainNode(0);
      stormRumbleGain.connect(wetBus);

      // ---- Wildlife and cave ----
      const cricketGain = gainNode(0);
      cricketGain.connect(bus);
      const birdGain = gainNode(0);
      birdGain.connect(wetBus);
      const gullGain = gainNode(0);
      gullGain.connect(wetBus);
      const owlGain = gainNode(0);
      owlGain.connect(wetBus);
      const frogGain = gainNode(0);
      frogGain.connect(wetBus);
      const caveGain = gainNode(0);
      caveGain.connect(nearBus);

      const emptyBranch = (): LoopBranch => ({
        active: false,
        stopTimer: null,
        sources: [],
        nodes: [],
      });

      this.graph = {
        ctx: audio,
        master,
        masterWarmth,
        occlusion,
        wetOcclusion,
        reverbSend,
        roomConvolver: null,
        wideConvolver: null,
        activeReverbKind: null,
        reverbStopTimer: null,
        reverbReturn,
        bus,
        wetBus,
        nearBus,
        white,
        brown,
        pink,
        rainLight: null,
        rainDense: null,
        fireBed: null,
        thunderPool: {},
        rainGain,
        rainSwell,
        rainWashFilter,
        rainLowFilter,
        rainHighFilter,
        patterGain,
        patterLightGain,
        patterDenseGain,
        patterFilter,
        shelteredRoofGain,
        shelteredRoofBodyFilter,
        shelteredRoofRunoffFilter,
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
        gritFilter,
        gritGust,
        gritPan: gritPanNode.pan,
        surfGain,
        surfSwell,
        surfFoamSwell,
        surfBodyFilter,
        surfFoamFilter,
        surfSampleWarmth,
        brookGain,
        brookSwell,
        brookFilter,
        brookSparkleFilter,
        brookSampleWarmth,
        emberSampleWarmth,
        cicadaGain,
        cicadaSwell,
        cicadaFilter,
        deepRumbleGain,
        deepRumbleDrift,
        deepRumbleFilter,
        airGain,
        airDrift,
        airFilter,
        emberGain,
        fireFlicker,
        emberLowFilter,
        emberMidFilter,
        emberBedFilter,
        padGain,
        padFilter,
        padVoices: [],
        sparkleGain,
        windChimeGain,
        sleetGain,
        autumnLeafGain,
        condensationGain,
        creakGain,
        foghornGain,
        stormRumbleGain,
        cricketGain,
        birdGain,
        gullGain,
        owlGain,
        frogGain,
        caveGain,
        branches: {
          rainWash: emptyBranch(),
          rainPatter: emptyBranch(),
          shelteredRoof: emptyBranch(),
          wind: emptyBranch(),
          whistle: emptyBranch(),
          grit: emptyBranch(),
          surf: emptyBranch(),
          brook: emptyBranch(),
          gulls: emptyBranch(),
          cicada: emptyBranch(),
          deepRumble: emptyBranch(),
          air: emptyBranch(),
          ember: emptyBranch(),
          pad: emptyBranch(),
        },
      };
      this.appliedWindCenter = 0;
      if (this.pendingBase64.size > 0) {
        for (const [pendingKey, pendingData] of this.pendingBase64) {
          void this.decodeAndInstallSample(pendingKey, pendingData);
        }
        this.pendingBase64.clear();
      }
      return true;
    } catch {
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
