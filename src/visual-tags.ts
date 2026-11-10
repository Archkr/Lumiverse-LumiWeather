import { resolveHudTimePhase, resolveLunarPhase } from "./time-utils";
import { parseHourFromTimeString } from "./shared";
import type { WeatherState } from "./types";

const CONDITION_VISUAL_TAGS: Record<WeatherState["condition"], (intensity: number) => string> = {
  clear: (intensity) => (intensity > 0.65 ? "crisp clear sky, vibrant atmospheric light" : "clear sky"),
  cloudy: (intensity) => (intensity > 0.65 ? "heavy overcast sky, dense cloud cover, diffused light" : "partly cloudy sky, soft clouds"),
  rain: (intensity) =>
    intensity > 0.72
      ? "heavy rain, streaking raindrops, wet reflective surfaces, rain mist"
      : intensity < 0.35
        ? "light drizzle, damp atmosphere, subtle raindrops"
        : "steady rain, falling raindrops, wet surfaces",
  storm: (intensity) =>
    intensity > 0.75
      ? "violent thunderstorm, dark cumulonimbus clouds, forked lightning flashes, torrential rain, dramatic storm lighting"
      : "thunderstorm, dark storm clouds, distant lightning, driving rain",
  snow: (intensity) =>
    intensity > 0.72
      ? "heavy snowfall, swirling blizzard flurries, frost-covered surfaces, wintry haze"
      : "falling snow, soft snowflakes, wintry atmosphere",
  fog: (intensity) =>
    intensity > 0.7
      ? "dense volumetric fog, thick low mist, shrouded silhouettes"
      : "atmospheric fog, low-lying mist, soft haze",
};

const PALETTE_VISUAL_TAGS: Record<WeatherState["palette"], string> = {
  dawn: "golden dawn lighting, warm sunrise horizon, soft morning glow",
  day: "natural daylight, balanced sky illumination",
  dusk: "warm dusk twilight, amber and violet sunset glow, long shadows",
  night: "night scene, deep nocturnal shadows",
  storm: "brooding slate-blue storm palette, high-contrast tempest lighting",
  mist: "muted pearl-grey mist palette, soft diffused contrast",
  snow: "crisp glacial blue-white palette, luminous wintry reflection",
};

const EXPOSURE_VISUAL_TAGS: Record<NonNullable<WeatherState["exposure"]>, string> = {
  outdoor: "outdoor setting, open sky",
  sheltered: "sheltered under cover, semi-open overhang, weather visible beyond shelter",
  indoor: "indoor interior setting, weather visible through windowpane, condensation on glass",
  underground: "underground subterranean setting, cavern haze, floating dust motes",
};

const PHENOMENON_VISUAL_TAGS: Record<NonNullable<WeatherState["phenomenon"]>, string> = {
  none: "",
  aurora: "aurora borealis, shimmering emerald and violet polar light ribbons in sky",
  blossoms: "drifting cherry blossom petals, floating pink sakura petals in the air",
  embers: "floating glowing embers, rising fiery cinders and warm sparks",
  ashfall: "falling volcanic ash, drifting grey soot flakes, hazy ash sky",
  fireflies: "glowing bioluminescent fireflies, soft drifting golden light motes",
  sandstorm: "swirling sandstorm, blowing ochre dust haze, airborne desert grit",
};

/**
 * Synthesizes comma-separated visual art descriptors from a `WeatherState`
 * for image-generation prompts (`{{weather_visual_tags}}`) and LumiState consumers.
 */
export function buildWeatherVisualTags(state: WeatherState | null): string {
  if (!state) return "";

  const exposure = state.exposure ?? "outdoor";
  const phenomenon = state.phenomenon ?? "none";
  const hour = parseHourFromTimeString(state.time);
  const phase = resolveHudTimePhase(state.palette, hour);
  const lunar = resolveLunarPhase(state.date, state.time);

  const segments: string[] = [];

  segments.push(EXPOSURE_VISUAL_TAGS[exposure]);

  if (exposure !== "underground") {
    segments.push(PALETTE_VISUAL_TAGS[state.palette]);

    if (phase === "night" && (state.condition === "clear" || state.condition === "cloudy")) {
      if (lunar.illumination >= 0.85) {
        segments.push("full moon, bright silver moonlight");
      } else if (lunar.illumination <= 0.12) {
        segments.push("new moon, dark starlit sky");
      } else {
        segments.push(`${lunar.label.toLowerCase()}, soft moonlight`);
      }
    }

    segments.push(CONDITION_VISUAL_TAGS[state.condition](state.intensity));
  }

  if (phenomenon !== "none") {
    segments.push(PHENOMENON_VISUAL_TAGS[phenomenon]);
  }

  if (exposure !== "underground" && exposure !== "indoor") {
    const windText = state.wind.trim().toLowerCase();
    if (/hurricane|violent|gale|hard|strong|gust/.test(windText)) {
      segments.push("strong wind, windswept motion");
    } else if (/breezy|windy|steady/.test(windText)) {
      segments.push("gentle wind drift");
    }
  }

  if (state.season && exposure !== "underground") {
    segments.push(`${state.season} season`);
  }

  return segments.filter(Boolean).join(", ");
}
