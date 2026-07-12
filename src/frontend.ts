import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { buildPresetWeatherState, matchWeatherScenePreset, WEATHER_SCENE_PRESETS } from "./presets";
import {
  resolveRainDensityThreshold,
  resolveRainParticlePool,
  resolveRainProfile,
  resolveRainVector,
} from "./fx-utils";
import {
  DEFAULT_PREFS,
  WEATHER_TAG_NAME,
  clamp,
  formatTemperatureForUnit,
  makeDefaultWeatherState,
  parseHourFromTimeString,
} from "./shared";
import type {
  BackendToFrontend,
  FrontendToBackend,
  WeatherCondition,
  WeatherPrefs,
  WeatherState,
} from "./types";
import { shouldApplyChatState } from "./state-utils";
import { createSettingsUI } from "./ui/settings";
import { WEATHER_HUD_CSS } from "./ui/styles";
import { shouldProcessWeatherTag } from "./tag-utils";

const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98a7.79 7.79 0 000-1.96l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.88 7.88 0 00-1.69-.98l-.36-2.54a.5.5 0 00-.49-.42h-3.84a.5.5 0 00-.49.42l-.36 2.54c-.6.24-1.16.56-1.69.98l-2.39-.96a.5.5 0 00-.6.22L2.43 8.8a.5.5 0 00.12.64l2.03 1.58a7.79 7.79 0 000 1.96L2.55 14.56a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.6.22l2.39-.96c.53.42 1.09.74 1.69.98l.36 2.54a.5.5 0 00.49.42h3.84a.5.5 0 00.49-.42l.36-2.54c.6-.24 1.16-.56 1.69-.98l2.39.96a.5.5 0 00.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z"/></svg>`;
const CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
const CHEVRON_UP_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m7.41 15.41 4.59-4.58 4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
const LIGHTNING_BOLT_SVGS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M55 0 L35 55 L52 55 L25 145 L48 100 L30 100 L52 230 L35 185 L58 300"/><path d="M52 55 L72 82 L62 88" stroke-width="1.8"/><path d="M48 100 L22 125 L32 130" stroke-width="1.8"/><path d="M52 230 L72 248 L62 253" stroke-width="1.5"/></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M45 0 L68 48 L45 48 L72 135 L50 88 L66 88 L42 215 L62 168 L38 300"/><path d="M45 48 L22 72 L32 77" stroke-width="1.8"/><path d="M50 88 L75 110 L65 115" stroke-width="1.8"/></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M50 0 L38 52 L55 52 L30 120 L50 80 L32 80 L55 200 L38 158 L55 300"/><path d="M55 52 L75 75 L65 80" stroke-width="1.8"/><path d="M50 80 L25 100 L35 105" stroke-width="1.8"/><path d="M55 200 L75 220 L65 225" stroke-width="1.5"/></g></svg>`,
] as const;
const LIGHTNING_BOLT_POSITIONS = [23, 51, 75] as const;

const HUD_COLLAPSED_SIZE = { width: 272, height: 148 };
const HUD_EXPANDED_SIZE = { width: 312, height: 360 };
const DEFAULT_WIDGET_POSITION = { x: 24, y: 96 };

type FloatWidgetHandle = ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]>;

type FxRoot = {
  root: HTMLDivElement;
  host: HTMLElement | null;
  kind: "back" | "front";
  poolCondition: WeatherCondition | null;
};

type SceneHostResolution = {
  backHost: HTMLElement | null;
  backBefore: HTMLElement | null;
  frontHost: HTMLElement | null;
  frontBefore: HTMLElement | null;
};

type HudCallbacks = {
  onToggleDrawer(): void;
  onOpenSettings(): void;
  onLockCurrentScene(): void;
  onResumeStory(): void;
  onApplyPreset(presetId: string): void;
  onChangeLayerMode(mode: WeatherPrefs["layerMode"]): void;
  onChangeIntensity(intensity: number): void;
  onTogglePause(): void;
};

type HudElements = {
  widget: FloatWidgetHandle;
  root: HTMLDivElement;
  location: HTMLDivElement;
  date: HTMLDivElement;
  time: HTMLDivElement;
  wind: HTMLDivElement;
  icon: HTMLDivElement;
  temp: HTMLDivElement;
  summary: HTMLDivElement;
  source: HTMLSpanElement;
  drawerToggleLabel: HTMLSpanElement;
  drawerToggleIcon: HTMLSpanElement;
  storyButton?: HTMLButtonElement;
  manualButton?: HTMLButtonElement;
  presetButtons: Map<string, HTMLButtonElement>;
  layerSelect?: HTMLSelectElement;
  intensitySlider?: HTMLInputElement;
  intensityValue?: HTMLSpanElement;
  pauseButton?: HTMLButtonElement;
  resumeButton?: HTMLButtonElement;
};

type HudTimePhase = "dawn" | "day" | "dusk" | "night";

type SceneTokens = {
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  glow: string;
  beamColor: string;
  horizonColor: string;
  cloudCore: string;
  cloudEdge: string;
  fogColor: string;
  mistColor: string;
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
  flashOpacity: number;
};

function conditionIcon(condition: WeatherCondition): string {
  switch (condition) {
    case "cloudy":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.68-1.84A4.5 4.5 0 1118.5 18H7z"/></svg>`;
    case "rain":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 17a4.5 4.5 0 010-9 6 6 0 0111.55-1.98A4.5 4.5 0 1118.5 17h-12zm2.1 5l-1.1-2.6h1.6l1.1 2.6H8.6zm5 0l-1.1-2.6h1.6l1.1 2.6h-1.6zm-2.5-3l-1.1-2.6h1.6l1.1 2.6H11.1z"/></svg>`;
    case "storm":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 16.5a4.5 4.5 0 010-9 6 6 0 0111.55-1.98A4.5 4.5 0 1118.5 16.5h-4.01l1.02-4.02-4.52 5.02h2.98L12.96 22 17 16.5H6.5z"/></svg>`;
    case "snow":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v4.1l2.85-1.64 1 1.73L14 7.83l3.54 2.04-1 1.73L13 9.56V13h4v2h-4v3.44l3.85-2.22 1 1.73L14 20.17l2.85 1.65-1 1.73L13 21.9V26h-2v-4.1l-2.85 1.65-1-1.73L10 20.17l-3.85-2.22 1-1.73L11 18.44V15H7v-2h4V9.56L7.15 11.78l-1-1.73L10 7.83 7.15 6.18l1-1.73L11 6.1V2z" transform="translate(0 -2)"/></svg>`;
    case "fog":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.5A4.5 4.5 0 019.58 5a6 6 0 0111.18 2.44A4 4 0 0119 15H5a3 3 0 010-6h14a4 4 0 010 8H7v-2h12a2 2 0 000-4H5a1 1 0 000 2h11v2H5a3 3 0 010-6h14v2H5a1 1 0 000 2h10v2H5a3 3 0 010-6z"/></svg>`;
    case "clear":
    default:
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5a1 1 0 011-1h0a1 1 0 011 1v1.1a1 1 0 01-1 1h0a1 1 0 01-1-1V5zm0 11.8a1 1 0 011 1V19a1 1 0 01-2 0v-1.2a1 1 0 011-1zM5 11a1 1 0 011-1h1.2a1 1 0 010 2H6a1 1 0 01-1-1zm11.8 0a1 1 0 011-1H19a1 1 0 010 2h-1.2a1 1 0 01-1-1zM7.05 7.05a1 1 0 011.41 0l.85.85a1 1 0 11-1.41 1.41l-.85-.85a1 1 0 010-1.41zm7.64 7.64a1 1 0 011.41 0l.85.85a1 1 0 01-1.41 1.41l-.85-.85a1 1 0 010-1.41zm1.41-7.64a1 1 0 010 1.41l-.85.85a1 1 0 01-1.41-1.41l.85-.85a1 1 0 011.41 0zm-7.64 7.64a1 1 0 010 1.41l-.85.85a1 1 0 01-1.41-1.41l.85-.85a1 1 0 011.41 0zM12 8a4 4 0 110 8 4 4 0 010-8z"/></svg>`;
  }
}

function resolveHudTimePhase(state: WeatherState, liveDate: Date | null): HudTimePhase {
  if (state.palette === "dawn" || state.palette === "day" || state.palette === "dusk" || state.palette === "night") {
    return state.palette;
  }

  const hour = liveDate?.getHours() ?? parseHourFromTimeString(state.time);
  if (hour === null) return "day";
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "dusk";
  return "night";
}

function sendToBackend(ctx: SpindleFrontendContext, payload: FrontendToBackend): void {
  ctx.sendToBackend(payload);
}

function createSpan(className: string, styles: Record<string, string>): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  for (const [key, value] of Object.entries(styles)) {
    span.style.setProperty(key, value);
  }
  return span;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function cssNumber(value: number, precision = 2): string {
  return value.toFixed(precision).replace(/\.?0+$/, "");
}

function createCloudElement(index: number, total: number): HTMLSpanElement {
  const depth = total <= 1 ? 0 : index / (total - 1);
  const width = randomRange(240, 420) + depth * 60;
  const height = width * randomRange(0.16, 0.24);
  const blur = Math.max(3, randomRange(5, 10) - depth * 2);
  const scale = randomRange(0.82, 0.98) + depth * 0.12;
  const driftStart = -20 - depth * 5 - randomRange(0, 8);
  const driftEnd = 20 + depth * 8 + randomRange(4, 12);
  const driftMid = (driftStart + driftEnd) / 2 + randomRange(-3, 3);
  const duration = randomRange(58, 82) - depth * 8;

  const cloud = createSpan("weather-fx-cloud", {
    "--cloud-width": `${Math.round(width)}px`,
    "--cloud-height": `${Math.round(height)}px`,
    "--cloud-top": `${cssNumber(-2 + depth * 26 + randomRange(-2, 4))}%`,
    "--cloud-left": `${cssNumber(-28 + randomRange(0, 108))}%`,
    "--cloud-duration": `${cssNumber(duration)}s`,
    "--cloud-delay": `${cssNumber(randomRange(-46, -4))}s`,
    "--cloud-blur": `${cssNumber(blur)}px`,
    "--cloud-soft-blur": `${cssNumber(Math.max(1.5, blur * 0.55))}px`,
    "--cloud-opacity-scale": `${cssNumber(0.68 + randomRange(0.1, 0.24) + depth * 0.18)}`,
    "--cloud-depth": `${cssNumber(depth)}`,
    "--cloud-scale": `${cssNumber(scale)}`,
    "--cloud-scale-mid": `${cssNumber(scale + randomRange(0.02, 0.06))}`,
    "--cloud-drift-x-start": `${cssNumber(driftStart)}vw`,
    "--cloud-drift-x-mid": `${cssNumber(driftMid)}vw`,
    "--cloud-drift-x-end": `${cssNumber(driftEnd)}vw`,
    "--cloud-drift-y": `${cssNumber(randomRange(-0.45, 0.45))}vh`,
    "--cloud-lift": `${cssNumber(randomRange(-18, -6))}%`,
    "--cloud-shear": `${cssNumber(randomRange(-1.2, 1.2))}deg`,
    "--cloud-shadow-opacity": `${cssNumber(0.14 + depth * 0.18)}`,
    "--cloud-highlight-opacity": `${cssNumber(0.46 - depth * 0.12)}`,
  });
  cloud.dataset.baseDuration = cssNumber(duration, 4);
  return cloud;
}

function createWindGustElement(): HTMLSpanElement {
  const length = randomRange(90, 260);
  const curve = randomRange(6, 22);
  const height = curve * 2 + 6;
  const midpoint = height / 2;
  const gust = createSpan("weather-fx-wind-gust", {
    "--gust-left": `${cssNumber(randomRange(-45, 45))}%`,
    "--gust-top": `${cssNumber(randomRange(12, 90))}%`,
    "--gust-width": `${cssNumber(length)}px`,
    "--gust-height": `${cssNumber(height)}px`,
    "--gust-duration": `${cssNumber(randomRange(5.5, 12))}s`,
    "--gust-delay": `${cssNumber(randomRange(-12, -0.4))}s`,
    "--gust-opacity": cssNumber(randomRange(0.04, 0.16)),
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${cssNumber(length)} ${cssNumber(height)}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M 0 ${cssNumber(midpoint)} C ${cssNumber(length * 0.3)} ${cssNumber(midpoint - curve)}, ${cssNumber(length * 0.7)} ${cssNumber(midpoint + curve)}, ${cssNumber(length)} ${cssNumber(midpoint)}`,
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", cssNumber(randomRange(0.6, 1.6)));
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  gust.appendChild(svg);
  return gust;
}

function createSnowflakeElement(front: boolean): HTMLSpanElement {
  const size = randomRange(front ? 1.6 : 1.2, front ? 5.2 : 4.3);
  const direction = Math.random() < 0.5 ? -1 : 1;
  const drift = randomRange(1.2, front ? 5.8 : 4.6) * direction;

  return createSpan(front ? "weather-fx-snow-flake weather-fx-snow-flake-front" : "weather-fx-snow-flake", {
    "--flake-left": `${cssNumber(randomRange(-4, 104))}%`,
    "--flake-top": `${cssNumber(randomRange(-24, -6))}%`,
    "--flake-size": `${cssNumber(size)}px`,
    "--flake-glow": `${cssNumber(size * (front ? 3.1 : 2.7))}px`,
    "--flake-duration": `${cssNumber(randomRange(front ? 7 : 8, front ? 16 : 20))}s`,
    "--flake-shimmer-duration": `${cssNumber(randomRange(1.8, 3.8))}s`,
    "--flake-delay": `${cssNumber(randomRange(-18, -0.2))}s`,
    "--flake-drift-a": `${cssNumber(drift)}vw`,
    "--flake-drift-b": `${cssNumber(drift * -0.65)}vw`,
    "--flake-drift-c": `${cssNumber(drift * 0.85)}vw`,
    "--flake-drift-end": `${cssNumber(drift * -0.45 - 0.8)}vw`,
    "--flake-static-y": `${cssNumber(randomRange(12, 88))}vh`,
    "--flake-opacity-scale": cssNumber(randomRange(0.3, 0.85)),
  });
}

function protectInteractive(element: HTMLElement): void {
  const stop = (event: Event) => event.stopPropagation();
  element.addEventListener("pointerdown", stop);
  element.addEventListener("mousedown", stop);
  element.addEventListener("touchstart", stop);
}

function createFxMarkup(kind: "back" | "front"): FxRoot {
  const root = document.createElement("div");
  root.className = "weather-fx-root";
  root.dataset.kind = kind;

  const flash = document.createElement("div");
  flash.className = "weather-fx-flash";

  if (kind === "back") {
    const sky = document.createElement("div");
    sky.className = "weather-fx-sky";
    root.appendChild(sky);

    const glow = document.createElement("div");
    glow.className = "weather-fx-glow";
    root.appendChild(glow);

    const beams = document.createElement("div");
    beams.className = "weather-fx-beams";
    root.appendChild(beams);

    const clouds = document.createElement("div");
    clouds.className = "weather-fx-clouds";
    root.appendChild(clouds);

    const horizon = document.createElement("div");
    horizon.className = "weather-fx-horizon";
    root.appendChild(horizon);

    const mist = document.createElement("div");
    mist.className = "weather-fx-mist";
    root.appendChild(mist);

    const fog = document.createElement("div");
    fog.className = "weather-fx-fog";
    root.appendChild(fog);

    const motes = document.createElement("div");
    motes.className = "weather-fx-motes";
    root.appendChild(motes);

    const windGusts = document.createElement("div");
    windGusts.className = "weather-fx-wind-gusts";
    root.appendChild(windGusts);

    const rain = document.createElement("div");
    rain.className = "weather-fx-rain";
    root.appendChild(rain);

    const snow = document.createElement("div");
    snow.className = "weather-fx-snow";
    root.appendChild(snow);

    const compact = window.matchMedia("(max-width: 768px)").matches;
    const cloudCount = compact ? 6 : 8;
    for (let index = 0; index < cloudCount; index += 1) {
      clouds.appendChild(createCloudElement(index, cloudCount));
    }

    for (let index = 0; index < (compact ? 3 : 4); index += 1) {
      fog.appendChild(
        createSpan("weather-fx-fog-band", {
          "--fog-width": `${240 + Math.round(Math.random() * 320)}px`,
          "--fog-height": `${52 + Math.round(Math.random() * 44)}px`,
          "--fog-top": `${14 + index * 12 + Math.round(Math.random() * 5)}%`,
          "--fog-left": `${-14 + Math.round(Math.random() * 90)}%`,
          "--fog-duration": `${18 + Math.round(Math.random() * 16)}s`,
          "--fog-delay": `${Math.round(Math.random() * -18)}s`,
          "--fog-opacity-scale": `${(0.55 + Math.random() * 0.6).toFixed(2)}`,
        }),
      );
    }

    for (let index = 0; index < (compact ? 2 : 3); index += 1) {
      mist.appendChild(
        createSpan("weather-fx-mist-plume", {
          "--mist-width": `${260 + Math.round(Math.random() * 280)}px`,
          "--mist-height": `${80 + Math.round(Math.random() * 42)}px`,
          "--mist-left": `${-12 + Math.round(Math.random() * 88)}%`,
          "--mist-bottom": `${-3 + Math.round(Math.random() * 16)}%`,
          "--mist-duration": `${16 + Math.round(Math.random() * 14)}s`,
          "--mist-delay": `${Math.round(Math.random() * -16)}s`,
          "--mist-opacity-scale": `${(0.6 + Math.random() * 0.55).toFixed(2)}`,
        }),
      );
    }

    for (let index = 0; index < (compact ? 4 : 8); index += 1) {
      motes.appendChild(
        createSpan("weather-fx-mote", {
          "--mote-left": `${Math.round(Math.random() * 100)}%`,
          "--mote-top": `${18 + Math.round(Math.random() * 64)}%`,
          "--mote-size": `${2 + Math.random() * 4}px`,
          "--mote-duration": `${10 + Math.random() * 10}s`,
          "--mote-delay": `${Math.random() * -10}s`,
          "--mote-drift-x": `${(-2 + Math.random() * 4).toFixed(2)}vw`,
          "--mote-drift-y": `${(-1 + Math.random() * 3).toFixed(2)}vh`,
          "--mote-opacity-scale": `${(0.45 + Math.random() * 0.7).toFixed(2)}`,
        }),
      );
    }

    for (let index = 0; index < (compact ? 10 : 16); index += 1) {
      windGusts.appendChild(createWindGustElement());
    }

    const backRainCount = resolveRainParticlePool(compact).back;
    for (let index = 0; index < backRainCount; index += 1) {
      const duration = 1.05 + Math.random() * 0.75;
      const drift = randomRange(4.5, 10);
      const drop = createSpan("weather-fx-rain-drop", {
        "--drop-left": `${Math.round(Math.random() * 104)}%`,
        "--drop-top": `${(-20 - Math.random() * 28).toFixed(2)}%`,
        "--drop-width": `${1 + Math.round(Math.random())}px`,
        "--drop-length": `${18 + Math.round(Math.random() * 28)}px`,
        "--drop-duration": `${duration}s`,
        "--drop-delay": `${Math.random() * -2.3}s`,
        "--drop-drift": `${cssNumber(drift * -1)}vw`,
        "--drop-opacity-scale": `${(0.36 + Math.random() * 0.56).toFixed(2)}`,
      });
      drop.dataset.densityThreshold = cssNumber(resolveRainDensityThreshold(index, backRainCount), 4);
      drop.dataset.baseDuration = cssNumber(duration, 4);
      drop.dataset.baseDrift = cssNumber(drift, 4);
      rain.appendChild(drop);
    }

    const splashes = document.createElement("div");
    splashes.className = "weather-fx-rain-splashes";
    root.appendChild(splashes);

    const ripples = document.createElement("div");
    ripples.className = "weather-fx-rain-ripples";
    root.appendChild(ripples);

    const backImpactCount = compact ? 12 : 20;
    for (let index = 0; index < backImpactCount; index += 1) {
      const position = randomRange(1, 99);
      const bottom = randomRange(0, 10);
      const duration = randomRange(0.65, 0.95);
      const delay = randomRange(-3.4, -0.1);
      const threshold = cssNumber(resolveRainDensityThreshold(index, backImpactCount), 4);
      const splashSize = randomRange(6, 15);
      const rippleSize = randomRange(12, 30);
      const splash = createSpan("weather-fx-rain-splash", {
        "--splash-left": `${cssNumber(position)}%`,
        "--splash-bottom": `${cssNumber(bottom)}%`,
        "--impact-duration": `${cssNumber(duration)}s`,
        "--impact-delay": `${cssNumber(delay)}s`,
        "--splash-size": `${cssNumber(splashSize)}px`,
        "--splash-height": `${cssNumber(splashSize * 0.72)}px`,
        "--splash-lift": `${cssNumber(randomRange(-10, -5))}px`,
        "--splash-tilt": `${cssNumber(randomRange(-12, 12))}deg`,
        "margin-left": `${cssNumber(splashSize * -0.5)}px`,
      });
      splash.dataset.densityThreshold = threshold;
      splashes.appendChild(splash);

      const ripple = createSpan("weather-fx-rain-ripple", {
        "--ripple-left": `${cssNumber(position)}%`,
        "--ripple-bottom": `${cssNumber(bottom)}%`,
        "--impact-duration": `${cssNumber(duration)}s`,
        "--impact-delay": `${cssNumber(delay)}s`,
        "--ripple-size": `${cssNumber(rippleSize)}px`,
        "margin-left": `${cssNumber(rippleSize * -0.5)}px`,
      });
      ripple.dataset.densityThreshold = threshold;
      ripples.appendChild(ripple);
    }

    for (let index = 0; index < (compact ? 48 : 72); index += 1) {
      snow.appendChild(createSnowflakeElement(false));
    }

    const frost = document.createElement("div");
    frost.className = "weather-fx-frost";
    root.appendChild(frost);

    const lightning = document.createElement("div");
    lightning.className = "weather-fx-lightning";
    for (let index = 0; index < LIGHTNING_BOLT_SVGS.length; index += 1) {
      const bolt = document.createElement("div");
      bolt.className = "weather-fx-lightning-bolt";
      bolt.dataset.boltIndex = String(index);
      bolt.innerHTML = LIGHTNING_BOLT_SVGS[index];
      lightning.appendChild(bolt);
    }
    root.appendChild(lightning);
  } else {
    const rain = document.createElement("div");
    rain.className = "weather-fx-rain weather-fx-rain-front";
    root.appendChild(rain);

    const snow = document.createElement("div");
    snow.className = "weather-fx-snow weather-fx-snow-front";
    root.appendChild(snow);

    const compact = window.matchMedia("(max-width: 768px)").matches;
    const frontRainCount = resolveRainParticlePool(compact).front;
    for (let index = 0; index < frontRainCount; index += 1) {
      const duration = 0.72 + Math.random() * 0.55;
      const drift = randomRange(7, 15);
      const drop = createSpan("weather-fx-rain-drop weather-fx-rain-drop-front", {
        "--drop-left": `${Math.round(Math.random() * 104)}%`,
        "--drop-top": `${(-24 - Math.random() * 30).toFixed(2)}%`,
        "--drop-width": `${1 + Math.round(Math.random() * 2)}px`,
        "--drop-length": `${32 + Math.round(Math.random() * 40)}px`,
        "--drop-duration": `${duration}s`,
        "--drop-delay": `${Math.random() * -2.1}s`,
        "--drop-drift": `${cssNumber(drift * -1)}vw`,
        "--drop-opacity-scale": `${(0.32 + Math.random() * 0.64).toFixed(2)}`,
      });
      drop.dataset.densityThreshold = cssNumber(resolveRainDensityThreshold(index, frontRainCount), 4);
      drop.dataset.baseDuration = cssNumber(duration, 4);
      drop.dataset.baseDrift = cssNumber(drift, 4);
      rain.appendChild(drop);
    }

    const splashes = document.createElement("div");
    splashes.className = "weather-fx-rain-splashes weather-fx-rain-splashes-front";
    root.appendChild(splashes);

    for (let index = 0; index < (compact ? 4 : 8); index += 1) {
      const size = randomRange(6, 16);
      splashes.appendChild(createSpan("weather-fx-rain-splash weather-fx-rain-splash-front", {
        "--splash-left": `${cssNumber(randomRange(1, 99))}%`,
        "--splash-bottom": `${cssNumber(randomRange(0, 14))}%`,
        "--impact-duration": `${cssNumber(randomRange(0.65, 1.05))}s`,
        "--impact-delay": `${cssNumber(randomRange(-1.4, -0.1))}s`,
        "--splash-size": `${cssNumber(size)}px`,
        "--splash-height": `${cssNumber(size * 0.72)}px`,
        "--splash-lift": `${cssNumber(randomRange(-12, -6))}px`,
        "--splash-tilt": `${cssNumber(randomRange(-12, 12))}deg`,
        "margin-left": `${cssNumber(size * -0.5)}px`,
      }));
    }

    for (let index = 0; index < (compact ? 30 : 48); index += 1) {
      snow.appendChild(createSnowflakeElement(true));
    }

    const lightningGlow = document.createElement("div");
    lightningGlow.className = "weather-fx-lightning-glow";
    root.appendChild(lightningGlow);
  }

  root.appendChild(flash);

  return { root, host: null, kind, poolCondition: null };
}

function pruneFxMarkup(root: HTMLElement, condition: WeatherCondition | null): void {
  const rainLike = condition === "rain" || condition === "storm";
  const windLike = condition === "cloudy" || rainLike;
  const cloudLike = condition === "cloudy" || rainLike || condition === "snow";
  const fogLike = condition === "fog" || condition === "snow" || rainLike;

  if (!cloudLike) root.querySelector(".weather-fx-clouds")?.remove();
  if (!fogLike) {
    root.querySelector(".weather-fx-fog")?.remove();
    root.querySelector(".weather-fx-mist")?.remove();
  }
  if (condition !== "clear") root.querySelector(".weather-fx-motes")?.remove();
  if (!windLike) root.querySelector(".weather-fx-wind-gusts")?.remove();
  if (!rainLike) {
    root.querySelector(".weather-fx-rain")?.remove();
    root.querySelector(".weather-fx-rain-splashes")?.remove();
    root.querySelector(".weather-fx-rain-ripples")?.remove();
  }
  if (condition !== "snow") {
    root.querySelector(".weather-fx-snow")?.remove();
    root.querySelector(".weather-fx-frost")?.remove();
  }
  if (condition !== "storm") {
    root.querySelector(".weather-fx-lightning")?.remove();
    root.querySelector(".weather-fx-lightning-glow")?.remove();
  }
  if (root.dataset.kind === "front" && !rainLike) root.querySelector(".weather-fx-rain-splashes")?.remove();
}

function syncFxCondition(fxRoot: FxRoot, condition: WeatherCondition | null): void {
  if (fxRoot.poolCondition === condition) return;

  const next = createFxMarkup(fxRoot.kind);
  pruneFxMarkup(next.root, condition);
  fxRoot.root.replaceChildren(...Array.from(next.root.childNodes));
  fxRoot.poolCondition = condition;
}

function asHTMLElement(element: Element | null): HTMLElement | null {
  return element instanceof HTMLElement ? element : null;
}

function closestByClassFragment(start: Element | null, fragment: string): HTMLElement | null {
  if (!(start instanceof Element)) return null;
  return asHTMLElement(start.closest(`[class*="${fragment}"]`));
}

function resolveSceneHosts(): SceneHostResolution {
  const backgroundLayer = asHTMLElement(document.querySelector('[class*="sceneBackgroundLayer"]'));
  const sceneTextLayer = asHTMLElement(document.querySelector('[class*="sceneTextContextLayer"]'));
  const sceneHost = backgroundLayer?.parentElement instanceof HTMLElement ? backgroundLayer.parentElement : null;
  const scrollRegion = asHTMLElement(document.querySelector('[data-chat-scroll="true"]'));
  const chatColumnInner =
    closestByClassFragment(scrollRegion, "chatColumnInner") ??
    (scrollRegion?.parentElement instanceof HTMLElement ? scrollRegion.parentElement : null);
  const chatColumn =
    closestByClassFragment(scrollRegion, "chatColumn") ??
    (chatColumnInner?.parentElement instanceof HTMLElement ? chatColumnInner.parentElement : chatColumnInner);

  return {
    // Lumiverse fades the scene-background element itself to zero opacity when
    // no generated backdrop is active. Mount beside it inside the scene host,
    // beneath the text scrim and chat body, so back-only FX remain visible.
    backHost: sceneHost ?? backgroundLayer,
    backBefore: sceneTextLayer?.parentElement === sceneHost ? sceneTextLayer : null,
    frontHost: chatColumn ?? chatColumnInner ?? scrollRegion,
    frontBefore: null,
  };
}

function readChatIdFromSettingsUpdate(payload: unknown): string | null | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const key = "key" in payload ? (payload as { key?: unknown }).key : undefined;
  if (key !== "activeChatId") return undefined;

  const value = "value" in payload ? (payload as { value?: unknown }).value : undefined;
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

function readChatIdFromChatSwitch(payload: unknown): string | null | undefined {
  if (!payload || typeof payload !== "object" || !("chatId" in payload)) return undefined;
  const value = (payload as { chatId?: unknown }).chatId;
  if (typeof value === "string" && value.trim()) return value;
  return value === null ? null : undefined;
}

function resolveSceneTokens(state: WeatherState, intensity: number): SceneTokens {
  const paletteMap: Record<
    WeatherState["palette"],
    {
      start: string;
      mid: string;
      end: string;
      glow: string;
      beam: string;
      horizon: string;
    }
  > = {
    dawn: {
      start: "#20385f",
      mid: "#5a77a9",
      end: "#f0a56e",
      glow: "rgba(255, 203, 145, 0.82)",
      beam: "rgba(255, 218, 165, 0.48)",
      horizon: "rgba(255, 182, 125, 0.44)",
    },
    day: {
      start: "#4d77ad",
      mid: "#7fa8de",
      end: "#d8ebff",
      glow: "rgba(255, 243, 202, 0.78)",
      beam: "rgba(255, 244, 212, 0.44)",
      horizon: "rgba(185, 212, 244, 0.28)",
    },
    dusk: {
      start: "#221f4c",
      mid: "#68487a",
      end: "#f09067",
      glow: "rgba(255, 173, 128, 0.72)",
      beam: "rgba(255, 189, 150, 0.38)",
      horizon: "rgba(224, 149, 114, 0.34)",
    },
    night: {
      start: "#05101d",
      mid: "#10253c",
      end: "#274768",
      glow: "rgba(143, 180, 255, 0.48)",
      beam: "rgba(130, 164, 234, 0.2)",
      horizon: "rgba(74, 104, 154, 0.26)",
    },
    storm: {
      start: "#04101a",
      mid: "#13283a",
      end: "#33475f",
      glow: "rgba(188, 220, 255, 0.26)",
      beam: "rgba(168, 203, 236, 0.16)",
      horizon: "rgba(108, 139, 170, 0.26)",
    },
    mist: {
      start: "#213141",
      mid: "#586c7d",
      end: "#a7bac2",
      glow: "rgba(226, 240, 255, 0.32)",
      beam: "rgba(228, 239, 248, 0.18)",
      horizon: "rgba(206, 220, 228, 0.36)",
    },
    snow: {
      start: "#415b76",
      mid: "#7d93a8",
      end: "#e0e9f1",
      glow: "rgba(255, 252, 244, 0.66)",
      beam: "rgba(242, 245, 255, 0.32)",
      horizon: "rgba(229, 238, 248, 0.4)",
    },
  };

  const basePalette = paletteMap[state.palette];
  const palette =
    state.condition === "storm"
      ? paletteMap.storm
      : state.condition === "rain"
        ? {
            start: state.palette === "night" ? "#07131f" : "#102032",
            mid: state.palette === "night" ? "#1d3148" : "#324b67",
            end: state.palette === "night" ? "#41566e" : "#61748b",
            glow: "rgba(176, 206, 240, 0.22)",
            beam: "rgba(135, 165, 198, 0.1)",
            horizon: "rgba(120, 147, 174, 0.24)",
          }
        : state.condition === "cloudy" && (state.palette === "dawn" || state.palette === "dusk")
          ? {
              ...basePalette,
              end: state.palette === "dawn" ? "#9baec3" : "#7f90a6",
              glow: "rgba(214, 224, 238, 0.24)",
              beam: "rgba(176, 191, 209, 0.12)",
              horizon: "rgba(154, 169, 187, 0.24)",
            }
          : basePalette;
  const baseIntensity = clamp(intensity, 0, 1.5);
  let cloudCore = "rgba(237, 244, 255, 0.34)";
  let cloudEdge = "rgba(255, 255, 255, 0.12)";
  let fogColor = "rgba(236, 241, 255, 0.18)";
  let mistColor = "rgba(228, 238, 248, 0.24)";

  const values = {
    skyOpacity: 0.08,
    glowOpacity: 0.13,
    beamOpacity: 0.14,
    cloudOpacity: 0.1,
    horizonOpacity: 0.06,
    mistOpacity: 0.03,
    fogOpacity: 0,
    rainOpacity: 0,
    snowOpacity: 0,
    moteOpacity: 0.06,
    flashOpacity: 0.26,
  };

  switch (state.condition) {
    case "cloudy":
      values.skyOpacity = 0.14;
      values.glowOpacity = 0.09;
      values.beamOpacity = 0.04;
      values.cloudOpacity = 0.5;
      values.horizonOpacity = 0.1;
      values.mistOpacity = 0.06;
      values.moteOpacity = 0.02;
      cloudCore = "rgba(205, 216, 231, 0.34)";
      cloudEdge = "rgba(238, 244, 255, 0.12)";
      fogColor = "rgba(210, 223, 239, 0.18)";
      mistColor = "rgba(217, 227, 239, 0.2)";
      break;
    case "rain":
      values.skyOpacity = 0.2;
      values.glowOpacity = 0.06;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.7;
      values.horizonOpacity = 0.16;
      values.mistOpacity = 0.22;
      values.fogOpacity = 0.12;
      values.rainOpacity = 0.82;
      values.moteOpacity = 0;
      cloudCore = "rgba(87, 106, 128, 0.48)";
      cloudEdge = "rgba(158, 178, 201, 0.12)";
      fogColor = "rgba(162, 180, 198, 0.2)";
      mistColor = "rgba(174, 188, 204, 0.22)";
      break;
    case "storm":
      values.skyOpacity = 0.24;
      values.glowOpacity = 0.05;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.86;
      values.horizonOpacity = 0.24;
      values.mistOpacity = 0.28;
      values.fogOpacity = 0.18;
      values.rainOpacity = 1.04;
      values.flashOpacity = 0.64;
      values.moteOpacity = 0;
      cloudCore = "rgba(56, 73, 93, 0.62)";
      cloudEdge = "rgba(118, 138, 163, 0.12)";
      fogColor = "rgba(130, 149, 171, 0.22)";
      mistColor = "rgba(151, 167, 186, 0.24)";
      break;
    case "snow":
      values.skyOpacity = 0.15;
      values.glowOpacity = 0.2;
      values.beamOpacity = 0.08;
      values.cloudOpacity = 0.34;
      values.horizonOpacity = 0.2;
      values.mistOpacity = 0.12;
      values.fogOpacity = 0.08;
      values.snowOpacity = 0.84;
      values.moteOpacity = 0.02;
      cloudCore = "rgba(232, 238, 247, 0.34)";
      cloudEdge = "rgba(255, 255, 255, 0.14)";
      fogColor = "rgba(230, 236, 245, 0.22)";
      mistColor = "rgba(225, 233, 242, 0.22)";
      break;
    case "fog":
      values.skyOpacity = 0.12;
      values.glowOpacity = 0.08;
      values.beamOpacity = 0.02;
      values.cloudOpacity = 0.18;
      values.horizonOpacity = 0.22;
      values.mistOpacity = 0.38;
      values.fogOpacity = 0.68;
      values.moteOpacity = 0.01;
      cloudCore = "rgba(186, 198, 207, 0.28)";
      cloudEdge = "rgba(232, 239, 244, 0.1)";
      fogColor = "rgba(223, 230, 236, 0.26)";
      mistColor = "rgba(217, 224, 231, 0.28)";
      break;
    case "clear":
    default:
      if (state.palette === "night") {
        values.skyOpacity = 0.06;
        values.glowOpacity = 0.08;
        values.beamOpacity = 0.03;
        values.cloudOpacity = 0.02;
        values.moteOpacity = 0.02;
      }
      break;
  }

  const detailScale = clamp(0.82 + baseIntensity * 0.28, 0.75, 1.18);
  const atmosphereScale = clamp(0.92 + baseIntensity * 0.24, 0.84, 1.2);

  return {
    bgStart: palette.start,
    bgMid: palette.mid,
    bgEnd: palette.end,
    glow: palette.glow,
    beamColor: palette.beam,
    horizonColor: palette.horizon,
    cloudCore,
    cloudEdge,
    fogColor,
    mistColor,
    skyOpacity: values.skyOpacity * atmosphereScale,
    glowOpacity: values.glowOpacity * atmosphereScale,
    beamOpacity: values.beamOpacity * atmosphereScale,
    cloudOpacity: values.cloudOpacity * detailScale,
    horizonOpacity: values.horizonOpacity * atmosphereScale,
    mistOpacity: values.mistOpacity * detailScale,
    fogOpacity: values.fogOpacity * detailScale,
    rainOpacity: values.rainOpacity * detailScale,
    snowOpacity: values.snowOpacity * detailScale,
    moteOpacity: state.condition === "clear" && baseIntensity > 0.48 ? values.moteOpacity * detailScale : values.moteOpacity * 0.4,
    flashOpacity: values.flashOpacity,
  };
}

function createHudWidget(
  ctx: SpindleFrontendContext,
  initialPosition: { x: number; y: number },
  expanded: boolean,
  callbacks: HudCallbacks,
): HudElements {
  const size = expanded ? HUD_EXPANDED_SIZE : HUD_COLLAPSED_SIZE;
  const widget = ctx.ui.createFloatWidget({
    width: size.width,
    height: size.height,
    initialPosition,
    snapToEdge: true,
    tooltip: "LumiWeather HUD",
    chromeless: true,
  });

  const root = document.createElement("div");
  root.className = "weather-hud-widget";
  root.dataset.expanded = expanded ? "true" : "false";

  const header = document.createElement("div");
  header.className = "weather-hud-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "weather-hud-titlewrap";
  const eyebrow = document.createElement("div");
  eyebrow.className = "weather-hud-eyebrow";
  eyebrow.textContent = "LumiWeather";
  const source = document.createElement("span");
  source.className = "weather-hud-source";
  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(source);

  const headerActions = document.createElement("div");
  headerActions.className = "weather-hud-actions";

  const drawerToggle = document.createElement("button");
  drawerToggle.type = "button";
  drawerToggle.className = "weather-hud-control weather-hud-control-ghost";
  protectInteractive(drawerToggle);
  const drawerToggleLabel = document.createElement("span");
  drawerToggleLabel.textContent = expanded ? "Hide" : "Controls";
  const drawerToggleIcon = document.createElement("span");
  drawerToggleIcon.className = "weather-hud-control-icon";
  drawerToggleIcon.innerHTML = expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  drawerToggle.appendChild(drawerToggleLabel);
  drawerToggle.appendChild(drawerToggleIcon);
  drawerToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onToggleDrawer();
  });

  const settingsButton = document.createElement("button");
  settingsButton.className = "weather-hud-gear";
  settingsButton.type = "button";
  settingsButton.innerHTML = GEAR_SVG;
  settingsButton.title = "Open extension settings";
  settingsButton.setAttribute("aria-label", "Open extension settings");
  protectInteractive(settingsButton);
  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onOpenSettings();
  });

  headerActions.appendChild(drawerToggle);
  headerActions.appendChild(settingsButton);
  header.appendChild(titleWrap);
  header.appendChild(headerActions);

  const body = document.createElement("div");
  body.className = "weather-hud-body";

  const left = document.createElement("div");
  left.className = "weather-hud-primary";
  const location = document.createElement("div");
  location.className = "weather-hud-location";
  const date = document.createElement("div");
  date.className = "weather-hud-date";
  const time = document.createElement("div");
  time.className = "weather-hud-time";
  const wind = document.createElement("div");
  wind.className = "weather-hud-wind";
  left.appendChild(location);
  left.appendChild(date);
  left.appendChild(time);
  left.appendChild(wind);

  const right = document.createElement("div");
  right.className = "weather-hud-weather";
  const icon = document.createElement("div");
  icon.className = "weather-hud-icon";
  const temp = document.createElement("div");
  temp.className = "weather-hud-temp";
  const summary = document.createElement("div");
  summary.className = "weather-hud-summary";
  right.appendChild(icon);
  right.appendChild(temp);
  right.appendChild(summary);

  body.appendChild(left);
  body.appendChild(right);

  root.appendChild(header);
  root.appendChild(body);

  const presetButtons = new Map<string, HTMLButtonElement>();
  let storyButton: HTMLButtonElement | undefined;
  let manualButton: HTMLButtonElement | undefined;
  let layerSelect: HTMLSelectElement | undefined;
  let intensitySlider: HTMLInputElement | undefined;
  let intensityValue: HTMLSpanElement | undefined;
  let pauseButton: HTMLButtonElement | undefined;
  let resumeButton: HTMLButtonElement | undefined;

  if (expanded) {
    const drawer = document.createElement("div");
    drawer.className = "weather-hud-drawer";

    const modeSection = document.createElement("div");
    modeSection.className = "weather-hud-drawer-section";
    const modeLabel = document.createElement("span");
    modeLabel.className = "weather-hud-section-label";
    modeLabel.textContent = "Mode";
    const modeRow = document.createElement("div");
    modeRow.className = "weather-hud-mode-row";

    storyButton = document.createElement("button");
    storyButton.type = "button";
    storyButton.className = "weather-hud-chip";
    storyButton.textContent = "Follow story";
    protectInteractive(storyButton);
    storyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onResumeStory();
    });

    manualButton = document.createElement("button");
    manualButton.type = "button";
    manualButton.className = "weather-hud-chip";
    manualButton.textContent = "Lock scene";
    protectInteractive(manualButton);
    manualButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onLockCurrentScene();
    });

    modeRow.appendChild(storyButton);
    modeRow.appendChild(manualButton);
    modeSection.appendChild(modeLabel);
    modeSection.appendChild(modeRow);

    const presetsSection = document.createElement("div");
    presetsSection.className = "weather-hud-drawer-section";
    const presetsLabel = document.createElement("span");
    presetsLabel.className = "weather-hud-section-label";
    presetsLabel.textContent = "Scene";
    const presetGrid = document.createElement("div");
    presetGrid.className = "weather-hud-preset-grid";

    for (const preset of WEATHER_SCENE_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "weather-hud-preset";
      button.textContent = preset.shortLabel;
      button.title = preset.description;
      protectInteractive(button);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.onApplyPreset(preset.id);
      });
      presetButtons.set(preset.id, button);
      presetGrid.appendChild(button);
    }

    presetsSection.appendChild(presetsLabel);
    presetsSection.appendChild(presetGrid);

    const controlsSection = document.createElement("div");
    controlsSection.className = "weather-hud-drawer-section";
    const controlsLabel = document.createElement("span");
    controlsLabel.className = "weather-hud-section-label";
    controlsLabel.textContent = "Scene mix";

    const controlGrid = document.createElement("div");
    controlGrid.className = "weather-hud-control-grid";

    const layerWrap = document.createElement("label");
    layerWrap.className = "weather-hud-field";
    const layerText = document.createElement("span");
    layerText.textContent = "Placement";
    layerSelect = document.createElement("select");
    layerSelect.className = "weather-hud-select";
    layerSelect.innerHTML = `
      <option value="back">Back</option>
      <option value="front">Front</option>
      <option value="both">Both</option>
    `;
    protectInteractive(layerSelect);
    layerSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangeLayerMode(layerSelect!.value as WeatherPrefs["layerMode"]);
    });
    layerWrap.appendChild(layerText);
    layerWrap.appendChild(layerSelect);

    const intensityWrap = document.createElement("label");
    intensityWrap.className = "weather-hud-field";
    const intensityHeader = document.createElement("div");
    intensityHeader.className = "weather-hud-field-row";
    const intensityText = document.createElement("span");
    intensityText.textContent = "Density";
    intensityValue = document.createElement("span");
    intensityValue.className = "weather-hud-inline-value";
    intensityHeader.appendChild(intensityText);
    intensityHeader.appendChild(intensityValue);

    intensitySlider = document.createElement("input");
    intensitySlider.type = "range";
    intensitySlider.className = "weather-hud-range";
    intensitySlider.min = "0.25";
    intensitySlider.max = "1.50";
    intensitySlider.step = "0.05";
    protectInteractive(intensitySlider);
    intensitySlider.addEventListener("input", (event) => {
      event.stopPropagation();
      callbacks.onChangeIntensity(Number.parseFloat(intensitySlider!.value));
    });
    intensityWrap.appendChild(intensityHeader);
    intensityWrap.appendChild(intensitySlider);

    controlGrid.appendChild(layerWrap);
    controlGrid.appendChild(intensityWrap);

    controlsSection.appendChild(controlsLabel);
    controlsSection.appendChild(controlGrid);

    const actionsSection = document.createElement("div");
    actionsSection.className = "weather-hud-drawer-section";
    const actionRow = document.createElement("div");
    actionRow.className = "weather-hud-action-row";

    pauseButton = document.createElement("button");
    pauseButton.type = "button";
    pauseButton.className = "weather-hud-control";
    protectInteractive(pauseButton);
    pauseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onTogglePause();
    });

    resumeButton = document.createElement("button");
    resumeButton.type = "button";
    resumeButton.className = "weather-hud-control weather-hud-control-ghost";
    resumeButton.textContent = "Resume story";
    protectInteractive(resumeButton);
    resumeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onResumeStory();
    });

    actionRow.appendChild(pauseButton);
    actionRow.appendChild(resumeButton);
    actionsSection.appendChild(actionRow);

    drawer.appendChild(modeSection);
    drawer.appendChild(presetsSection);
    drawer.appendChild(controlsSection);
    drawer.appendChild(actionsSection);

    root.appendChild(drawer);
  }

  widget.root.appendChild(root);

  return {
    widget,
    root,
    location,
    date,
    time,
    wind,
    icon,
    temp,
    summary,
    source,
    drawerToggleLabel,
    drawerToggleIcon,
    storyButton,
    manualButton,
    presetButtons,
    layerSelect,
    intensitySlider,
    intensityValue,
    pauseButton,
    resumeButton,
  };
}

function getLiveDate(state: WeatherState): Date | null {
  if (state.source !== "manual") return null;
  return new Date();
}

function syncHudState(hud: HudElements, prefs: WeatherPrefs, state: WeatherState | null, expanded: boolean): void {
  const displayState = state ?? makeDefaultWeatherState();
  const liveDate = getLiveDate(displayState);
  const phase = resolveHudTimePhase(displayState, liveDate);
  const sceneIntensity = clamp(displayState.intensity * prefs.intensity, 0.25, 1.5);
  hud.root.dataset.expanded = expanded ? "true" : "false";
  hud.root.dataset.empty = state ? "false" : "true";
  hud.root.dataset.source = state?.source ?? "empty";
  hud.root.dataset.condition = displayState.condition;
  hud.root.dataset.palette = displayState.palette;
  hud.root.dataset.timePhase = phase;
  hud.root.dataset.layer = prefs.layerMode;
  hud.root.dataset.paused = prefs.pauseEffects ? "true" : "false";
  hud.root.style.setProperty("--weather-hud-scene-intensity", sceneIntensity.toFixed(2));

  hud.icon.innerHTML = conditionIcon(displayState.condition);
  hud.temp.textContent = state ? formatTemperatureForUnit(displayState.temperature, prefs.temperatureUnit) : "—";
  hud.summary.textContent = state ? displayState.summary : "Waiting for the first weather tag";
  hud.wind.textContent = state ? `Wind ${displayState.wind}` : "Add {{weather_tracker}} to the prompt";
  hud.location.textContent = state ? displayState.location : "Waiting for LumiWeather";
  hud.source.textContent = state ? (displayState.source === "manual" ? "Scene lock" : "Story sync") : "Waiting";
  hud.drawerToggleLabel.textContent = expanded ? "Hide" : "Controls";
  hud.drawerToggleIcon.innerHTML = expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;

  if (liveDate) {
    hud.date.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(liveDate);
    hud.time.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(liveDate);
  } else {
    hud.date.textContent = state ? displayState.date : "No tag yet";
    hud.time.textContent = state ? displayState.time : "—";
  }

  if (hud.storyButton && hud.manualButton) {
    hud.storyButton.classList.toggle("weather-hud-chip-active", state?.source === "story");
    hud.manualButton.classList.toggle("weather-hud-chip-active", state?.source === "manual");
    hud.storyButton.disabled = !state || state.source === "story";
    hud.manualButton.disabled = !state;
  }

  const activePresetId = matchWeatherScenePreset(state);
  for (const [presetId, button] of hud.presetButtons) {
    button.classList.toggle("weather-hud-preset-active", presetId === activePresetId);
  }

  if (hud.layerSelect) {
    hud.layerSelect.value = prefs.layerMode;
  }

  if (hud.intensitySlider && hud.intensityValue) {
    hud.intensitySlider.value = prefs.intensity.toFixed(2);
    hud.intensityValue.textContent = `${Math.round(prefs.intensity * 100)}%`;
  }

  if (hud.pauseButton) {
    hud.pauseButton.textContent = prefs.pauseEffects ? "Resume motion" : "Pause motion";
    hud.pauseButton.classList.toggle("weather-hud-control-active", prefs.pauseEffects);
  }

  if (hud.resumeButton) {
    hud.resumeButton.disabled = !state || state.source === "story";
  }
}

function setFxVisibility(root: FxRoot, visible: boolean): void {
  root.root.classList.toggle("weather-hidden", !visible);
  root.root.classList.toggle("weather-visible", visible);
}

function applySceneState(root: FxRoot, state: WeatherState, prefs: WeatherPrefs, reducedMotion: boolean): void {
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const tokens = resolveSceneTokens(state, effectiveIntensity);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const rainVector = resolveRainVector(state.wind, state.windDirection);
  const isFront = root.kind === "front";
  const visibleRainDensity = reducedMotion ? Math.min(rainProfile.density, 0.22) : rainProfile.density;
  const rainLayerOpacity = tokens.rainOpacity * rainProfile.opacityScale * (isFront ? 0.82 : 0.72);
  const cloudSpeedScale = state.condition === "storm" ? 0.76 : state.condition === "rain" ? 0.9 : 1;

  root.root.dataset.condition = state.condition;
  root.root.dataset.palette = state.palette;
  root.root.classList.toggle("weather-reduced-motion", reducedMotion);
  root.root.classList.toggle("weather-paused", prefs.pauseEffects || document.visibilityState === "hidden");
  root.root.classList.toggle("weather-rain-active", state.condition === "rain" || state.condition === "storm");
  root.root.classList.toggle("weather-snow-active", state.condition === "snow");

  root.root.style.setProperty("--weather-bg-start", tokens.bgStart);
  root.root.style.setProperty("--weather-bg-mid", tokens.bgMid);
  root.root.style.setProperty("--weather-bg-end", tokens.bgEnd);
  root.root.style.setProperty("--weather-glow", tokens.glow);
  root.root.style.setProperty("--weather-beam-color", tokens.beamColor);
  root.root.style.setProperty("--weather-horizon-color", tokens.horizonColor);
  root.root.style.setProperty("--weather-cloud-core", tokens.cloudCore);
  root.root.style.setProperty("--weather-cloud-edge", tokens.cloudEdge);
  root.root.style.setProperty("--weather-fog-color", tokens.fogColor);
  root.root.style.setProperty("--weather-mist-color", tokens.mistColor);
  root.root.style.setProperty("--weather-sky-opacity", String(isFront ? 0 : tokens.skyOpacity));
  root.root.style.setProperty("--weather-glow-opacity", String(isFront ? 0 : tokens.glowOpacity));
  root.root.style.setProperty("--weather-beam-opacity", String(isFront ? 0 : tokens.beamOpacity));
  root.root.style.setProperty("--weather-cloud-opacity", String(isFront ? 0 : tokens.cloudOpacity));
  root.root.style.setProperty("--weather-horizon-opacity", String(isFront ? 0 : tokens.horizonOpacity));
  root.root.style.setProperty("--weather-mist-opacity", String(isFront ? 0 : tokens.mistOpacity));
  root.root.style.setProperty("--weather-fog-opacity", String(isFront ? 0 : tokens.fogOpacity));
  root.root.style.setProperty("--weather-rain-opacity", String(rainLayerOpacity));
  root.root.style.setProperty("--weather-rain-density", String(visibleRainDensity));
  root.root.style.setProperty("--weather-rain-speed-scale", String(rainProfile.speedScale));
  root.root.style.setProperty("--weather-snow-opacity", String(tokens.snowOpacity * (isFront ? 0.96 : 0.82)));
  root.root.style.setProperty("--weather-mote-opacity", String(isFront ? 0 : tokens.moteOpacity));
  root.root.style.setProperty("--weather-flash-opacity", String(tokens.flashOpacity));
  root.root.style.setProperty("--weather-rain-angle", `${rainVector.angle}deg`);
  root.root.style.setProperty(
    "--weather-rain-color",
    state.condition === "storm" ? "rgba(212, 231, 255, 0.96)" : "rgba(190, 220, 255, 0.84)",
  );
  root.root.style.setProperty(
    "--weather-snow-color",
    state.palette === "night" ? "rgba(219, 232, 255, 0.92)" : "rgba(247, 250, 255, 0.95)",
  );
  root.root.style.setProperty(
    "--weather-particle-opacity-static",
    state.condition === "snow"
      ? String(clamp(tokens.snowOpacity * 0.2, 0.04, 0.22))
      : String(clamp(rainLayerOpacity * 0.13, 0.025, 0.12)),
  );

  root.root.querySelectorAll<HTMLElement>(".weather-fx-rain-drop").forEach((drop) => {
    const threshold = Number.parseFloat(drop.dataset.densityThreshold ?? "1");
    const baseDuration = Number.parseFloat(drop.dataset.baseDuration ?? "1");
    const baseDrift = Number.parseFloat(drop.dataset.baseDrift ?? "0");
    drop.classList.toggle("weather-density-hidden", threshold > visibleRainDensity);
    drop.style.animationDuration = `${baseDuration * rainProfile.speedScale}s`;
    drop.style.setProperty("--drop-drift", `${baseDrift * rainVector.driftDirection}vw`);
  });
  if (!isFront) {
    root.root.querySelectorAll<HTMLElement>(".weather-fx-rain-splash, .weather-fx-rain-ripple").forEach((impact) => {
      const threshold = Number.parseFloat(impact.dataset.densityThreshold ?? "1");
      impact.classList.toggle("weather-density-hidden", threshold > visibleRainDensity);
    });
  }
  root.root.querySelectorAll<HTMLElement>(".weather-fx-cloud").forEach((cloud) => {
    const baseDuration = Number.parseFloat(cloud.dataset.baseDuration ?? "60");
    cloud.style.animationDuration = `${baseDuration * cloudSpeedScale}s`;
  });
}

export function setup(ctx: SpindleFrontendContext) {
  const cleanups: Array<() => void> = [];
  const removeStyle = ctx.dom.addStyle(WEATHER_HUD_CSS);
  cleanups.push(removeStyle);

  let currentPrefs: WeatherPrefs = DEFAULT_PREFS;
  let currentState: WeatherState | null = null;
  // The route can contain a character UUID, so only Lumiverse's active-chat state
  // and CHAT_SWITCHED events are authoritative for chat-scoped weather storage.
  let activeChatId: string | null = null;
  let activeChatRequestId = 0;
  let hudExpanded = false;
  let permissionWarning: string | null = null;
  const processedWeatherTags = new Map<string, string>();

  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const getReducedMotion = () =>
    currentPrefs.reducedMotion === "always" ||
    (currentPrefs.reducedMotion === "system" && motionMedia.matches);

  const sendManualState = (state: Partial<WeatherState>) => {
    sendToBackend(ctx, { type: "set_manual_state", chatId: activeChatId, state });
  };

  const resumeStorySync = () => {
    sendToBackend(ctx, { type: "clear_manual_override", chatId: activeChatId });
  };

  const applyPreset = (presetId: string) => {
    const nextState = buildPresetWeatherState(presetId, currentState);
    if (!nextState) return;
    sendManualState(nextState);
  };

  const lockCurrentScene = () => {
    const state = currentState ?? makeDefaultWeatherState();
    sendManualState({
      ...state,
      source: "manual",
    });
  };

  const settingsMount = ctx.ui.mount("settings_extensions");
  const settingsUI = createSettingsUI((payload) => {
    const message = payload as FrontendToBackend;
    if (message.type === "set_manual_state" || message.type === "clear_manual_override") {
      sendToBackend(ctx, { ...message, chatId: activeChatId });
      return;
    }
    sendToBackend(ctx, message);
  });
  settingsMount.appendChild(settingsUI.root);
  cleanups.push(() => settingsUI.destroy());

  const backFx = createFxMarkup("back");
  const frontFx = createFxMarkup("front");
  let hostSyncFrame: number | null = null;

  const detachFxRoot = (fxRoot: FxRoot) => {
    fxRoot.root.remove();
    fxRoot.host = null;
  };

  const attachFxRoot = (fxRoot: FxRoot, nextHost: HTMLElement | null, before: HTMLElement | null): boolean => {
    if (!nextHost) {
      const hadHost = !!fxRoot.host || fxRoot.root.isConnected;
      detachFxRoot(fxRoot);
      return hadHost;
    }

    if (
      fxRoot.host === nextHost &&
      fxRoot.root.parentElement === nextHost &&
      (!before || fxRoot.root.nextElementSibling === before)
    ) {
      return false;
    }

    detachFxRoot(fxRoot);
    fxRoot.host = nextHost;
    if (before && before.parentElement === nextHost) {
      nextHost.insertBefore(fxRoot.root, before);
    } else {
      nextHost.appendChild(fxRoot.root);
    }
    return true;
  };

  const attachFxRoots = (): boolean => {
    hostSyncFrame = null;
    const nextHosts = resolveSceneHosts();
    const backChanged = attachFxRoot(backFx, nextHosts.backHost, nextHosts.backBefore);
    const frontChanged = attachFxRoot(frontFx, nextHosts.frontHost, nextHosts.frontBefore);
    return backChanged || frontChanged;
  };

  let hostObserver: MutationObserver | null = null;
  const stopHostObserver = () => {
    hostObserver?.disconnect();
    hostObserver = null;
  };

  const ensureHostObserver = () => {
    if (hostObserver || !document.body) return;
    hostObserver = new MutationObserver(() => {
      if (attachFxRoots()) {
        updateScene();
      }
      if (backFx.host?.isConnected && frontFx.host?.isConnected) stopHostObserver();
    });
    hostObserver.observe(document.body, { childList: true, subtree: true });
  };

  const queueFxRootAttach = () => {
    if (hostSyncFrame !== null) return;
    hostSyncFrame = window.requestAnimationFrame(() => {
      const changed = attachFxRoots();
      if (changed) updateScene();
      if (backFx.host?.isConnected && frontFx.host?.isConnected) stopHostObserver();
      else ensureHostObserver();
    });
  };
  cleanups.push(() => {
    if (hostSyncFrame !== null) {
      window.cancelAnimationFrame(hostSyncFrame);
      hostSyncFrame = null;
    }
    stopHostObserver();
    detachFxRoot(backFx);
    detachFxRoot(frontFx);
  });

  let hud: HudElements | null = null;
  let removeHudDragListener: (() => void) | null = null;

  const destroyHud = () => {
    if (removeHudDragListener) {
      removeHudDragListener();
      removeHudDragListener = null;
    }
    if (hud) {
      hud.widget.destroy();
      hud = null;
    }
  };

  const buildHud = (position?: { x: number; y: number } | null) => {
    const nextPosition =
      position ??
      hud?.widget.getPosition() ??
      currentPrefs.widgetPosition ??
      DEFAULT_WIDGET_POSITION;

    destroyHud();
    hud = createHudWidget(ctx, nextPosition, hudExpanded, {
      onToggleDrawer: () => {
        const currentPosition = hud?.widget.getPosition() ?? currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
        hudExpanded = !hudExpanded;
        buildHud(currentPosition);
        updateScene();
      },
      onOpenSettings: () => {
        ctx.events.emit("open-settings", { view: "extensions" });
      },
      onLockCurrentScene: () => {
        lockCurrentScene();
      },
      onResumeStory: () => {
        resumeStorySync();
      },
      onApplyPreset: (presetId) => {
        applyPreset(presetId);
      },
      onChangeLayerMode: (mode) => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { layerMode: mode } });
      },
      onChangeIntensity: (intensity) => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { intensity } });
      },
      onTogglePause: () => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { pauseEffects: !currentPrefs.pauseEffects } });
      },
    });
    removeHudDragListener = hud.widget.onDragEnd((nextPositionFromDrag) => {
      sendToBackend(ctx, { type: "save_prefs", prefs: { widgetPosition: nextPositionFromDrag } });
    });
    syncHudState(hud, currentPrefs, currentState, hudExpanded);
  };

  buildHud(currentPrefs.widgetPosition);
  cleanups.push(() => destroyHud());

  let flashTimer: number | null = null;

  const resetFlashTimer = () => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
  };

  const scheduleStormFlash = () => {
    resetFlashTimer();
    if (
      currentState?.condition !== "storm" ||
      getReducedMotion() ||
      currentPrefs.pauseEffects ||
      !currentPrefs.effectsEnabled ||
      document.visibilityState === "hidden" ||
      !activeChatId
    ) {
      backFx.root.classList.remove("weather-storm-flash");
      frontFx.root.classList.remove("weather-storm-flash");
      frontFx.root.classList.remove("weather-lightning-glow-flash");
      backFx.root.querySelectorAll(".weather-fx-lightning-bolt").forEach((bolt) => {
        bolt.classList.remove("weather-lightning-strike");
      });
      return;
    }

    const trigger = () => {
      backFx.root.classList.add("weather-storm-flash");
      frontFx.root.classList.add("weather-storm-flash");

      const bolts = backFx.root.querySelectorAll<HTMLElement>(".weather-fx-lightning-bolt");
      if (bolts.length > 0) {
        const boltIndex = Math.floor(Math.random() * bolts.length);
        const bolt = bolts[boltIndex];
        const boltX = LIGHTNING_BOLT_POSITIONS[boltIndex] ?? 50;

        bolt.classList.remove("weather-lightning-strike");
        void bolt.offsetWidth;
        bolt.classList.add("weather-lightning-strike");

        frontFx.root.style.setProperty("--weather-lightning-x", `${boltX}%`);
        frontFx.root.classList.remove("weather-lightning-glow-flash");
        void frontFx.root.offsetWidth;
        frontFx.root.classList.add("weather-lightning-glow-flash");

        window.setTimeout(() => {
          bolt.classList.remove("weather-lightning-strike");
        }, 700);
      }

      window.setTimeout(() => {
        backFx.root.classList.remove("weather-storm-flash");
        frontFx.root.classList.remove("weather-storm-flash");
        frontFx.root.classList.remove("weather-lightning-glow-flash");
      }, 650);
      flashTimer = window.setTimeout(trigger, 3200 + Math.random() * 5200);
    };

    flashTimer = window.setTimeout(trigger, 1400 + Math.random() * 2800);
  };

  const updateScene = () => {
    const reducedMotion = getReducedMotion();
    const layerMode = currentPrefs.layerMode;
    const showEffects = currentPrefs.effectsEnabled && document.visibilityState !== "hidden" && !!activeChatId && !!currentState;
    const sceneState = currentState ?? makeDefaultWeatherState();

    syncFxCondition(backFx, currentState?.condition ?? null);
    syncFxCondition(frontFx, currentState?.condition ?? null);

    if (hud) {
      syncHudState(hud, currentPrefs, currentState, hudExpanded);
    }
    settingsUI.sync(currentPrefs, currentState, !activeChatId ? "No active chat" : permissionWarning ?? undefined);
    applySceneState(backFx, sceneState, currentPrefs, reducedMotion);
    applySceneState(frontFx, sceneState, currentPrefs, reducedMotion);
    setFxVisibility(backFx, showEffects && !!backFx.host && (layerMode === "back" || layerMode === "both"));
    setFxVisibility(frontFx, showEffects && !!frontFx.host && (layerMode === "front" || layerMode === "both"));
    scheduleStormFlash();
  };

  const clockTimer = window.setInterval(() => {
    if (hud) {
      syncHudState(hud, currentPrefs, currentState, hudExpanded);
    }
  }, 1000);
  cleanups.push(() => window.clearInterval(clockTimer));

  const onMotionChange = () => updateScene();
  motionMedia.addEventListener("change", onMotionChange);
  cleanups.push(() => motionMedia.removeEventListener("change", onMotionChange));
  const onResize = () => queueFxRootAttach();
  window.addEventListener("resize", onResize);
  cleanups.push(() => window.removeEventListener("resize", onResize));
  const onVisibilityChange = () => updateScene();
  document.addEventListener("visibilitychange", onVisibilityChange);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));

  const tagUnsub = ctx.messages.registerTagInterceptor(
    { tagName: WEATHER_TAG_NAME, removeFromMessage: true },
    (payload) => {
      if (!shouldProcessWeatherTag(payload)) return;
      const chatId = payload.chatId ?? activeChatId;
      if (!chatId) return;
      const dedupeKey = `${chatId}:${payload.messageId ?? ""}:${payload.fullMatch}`;
      if (processedWeatherTags.has(dedupeKey)) return;
      processedWeatherTags.set(dedupeKey, payload.fullMatch);
      if (processedWeatherTags.size > 200) {
        const oldest = processedWeatherTags.keys().next().value;
        if (oldest) processedWeatherTags.delete(oldest);
      }
      sendToBackend(ctx, {
        type: "weather_tag_intercepted",
        chatId,
        messageId: payload.messageId ?? null,
        attrs: payload.attrs,
        isStreaming: false,
      });
    },
  );
  cleanups.push(tagUnsub);

  const msgUnsub = ctx.onBackendMessage((raw) => {
    const message = raw as BackendToFrontend;

    switch (message.type) {
      case "prefs":
        currentPrefs = message.prefs;
        if (hud && currentPrefs.widgetPosition) {
          hud.widget.moveTo(currentPrefs.widgetPosition.x, currentPrefs.widgetPosition.y);
        } else if (hud && !currentPrefs.widgetPosition) {
          hud.widget.moveTo(DEFAULT_WIDGET_POSITION.x, DEFAULT_WIDGET_POSITION.y);
        }
        updateScene();
        break;

      case "active_chat_state":
        if (!shouldApplyChatState(activeChatId, message.chatId, message.requestId, activeChatRequestId)) break;
        activeChatId = message.chatId;
        currentState = message.state;
        updateScene();
        break;

      case "weather_state":
        if (message.chatId !== activeChatId) break;
        currentState = message.state;
        updateScene();
        break;

      case "error":
        console.warn(`[weather_hud] ${message.message}`);
        break;
    }
  });
  cleanups.push(msgUnsub);

  const requestActiveChatState = (chatId: string | null) => {
    if (chatId === activeChatId && activeChatRequestId > 0) return;
    activeChatId = chatId;
    currentState = null;
    processedWeatherTags.clear();
    queueFxRootAttach();
    activeChatRequestId += 1;
    sendToBackend(ctx, { type: "chat_changed", chatId, requestId: activeChatRequestId });
    updateScene();
  };

  const chatSwitchedUnsub = ctx.events.on("CHAT_SWITCHED", (payload: unknown) => {
    const chatId = readChatIdFromChatSwitch(payload);
    if (typeof chatId !== "undefined") requestActiveChatState(chatId);
  });
  cleanups.push(chatSwitchedUnsub);

  const settingsChangedUnsub = ctx.events.on("SETTINGS_UPDATED", (payload: unknown) => {
    const nextChatId = readChatIdFromSettingsUpdate(payload);
    if (typeof nextChatId !== "undefined") requestActiveChatState(nextChatId);
  });
  cleanups.push(settingsChangedUnsub);

  sendToBackend(ctx, { type: "frontend_ready" });
  queueFxRootAttach();
  updateScene();
  void ctx.permissions.getGranted().then((granted) => {
    if (!granted.includes("interceptor")) {
      permissionWarning = "Enable the Interceptor permission to inject the current weather scene into prompts.";
      updateScene();
    }
  }).catch(() => {
    // Permission status is informational; the extension remains usable for tag-driven HUD updates.
  });

  return () => {
    resetFlashTimer();
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}
