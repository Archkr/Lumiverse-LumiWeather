import type { SpindleFrontendContext, SpindleUIKeyboardState } from "lumiverse-spindle-types";
import {
  destroyAtmosphereEngine,
  triggerAtmosphereLightning,
  updateAtmosphereEngine,
} from "./atmosphere-engine";
import { buildPresetWeatherState, matchWeatherScenePreset, WEATHER_SCENE_PRESETS } from "./presets";
import { resolveRainProfile } from "./fx-utils";
import { clampMobileHudPosition, isMobileHudLayout, resolveHudPresentation } from "./mobile-layout";
import { resolveSceneTokens } from "./scene-tokens";
import { resolveSceneHosts } from "./scene-hosts";
import { WeatherSoundscape } from "./soundscape";
import { conditionIcon, conditionIconLabel } from "./weather-icons";
import {
  resolveHudTimePhase as sharedResolveHudTimePhase,
  resolveLunarPhase,
  resolveSolarArc,
} from "./time-utils";
import {
  DEFAULT_PREFS,
  WEATHER_TAG_NAME,
  clamp,
  formatTemperatureForUnit,
  makeDefaultWeatherState,
  parseHourFromTimeString,
  parseStoryDateTime,
} from "./shared";
import type {
  BackendToFrontend,
  ForecastEntry,
  FrontendToBackend,
  SoundVolumeChannel,
  TemperatureUnit,
  WeatherClockMode,
  WeatherExposure,
  WeatherPhenomenon,
  SceneTokens,
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
const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m7.05 5.64 4.95 4.95 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05z"/></svg>`;
const LIGHTNING_BOLT_POSITIONS = [23, 51, 75] as const;

const DEFAULT_WIDGET_POSITION = { x: 24, y: 96 };

type FloatWidgetHandle = ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]>;

/** Token values after the front/back layer adjustments are folded in. */
type ResolvedSceneTokens = SceneTokens;

type FxRoot = {
  root: HTMLDivElement;
  host: HTMLElement | null;
  kind: "back" | "front";
  /** Tokens currently applied, used as the `from` side of the next blend. */
  sceneTokens: ResolvedSceneTokens | null;
  /** Identity of the applied scene, so an identical scene never re-blends. */
  sceneKey: string | null;
  /** Cancels the cleanup timer for an in-flight blend. */
  blendTimer: number | null;
};

/**
 * How long a scene blend lasts. Kept in sync with the longest `transition`
 * duration on `.weather-fx-root` in `ui/styles.ts`.
 */
const SCENE_TRANSITION_MS = 1300;

type HudCallbacks = {
  onToggleDrawer(): void;
  onOpenSettings(): void;
  onLockCurrentScene(): void;
  onResumeStory(): void;
  onApplyPreset(presetId: string): void;
  onChangeLayerMode(mode: WeatherPrefs["layerMode"]): void;
  onChangeIntensity(intensity: number): void;
  onChangeExposure(exposure: WeatherExposure): void;
  onChangePhenomenon(phenomenon: WeatherPhenomenon): void;
  onChangeSoundVolume(channel: SoundVolumeChannel, volume: number): void;
  onTogglePause(): void;
  onToggleSound(): void;
};

type HudVolumeControl = {
  slider: HTMLInputElement;
  valueLabel: HTMLSpanElement;
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
  phenomenonBadge: HTMLSpanElement;
  drawerToggle: HTMLButtonElement;
  drawerToggleLabel: HTMLSpanElement;
  drawerToggleIcon: HTMLSpanElement;
  launcherButton?: HTMLButtonElement;
  launcherIcon?: HTMLSpanElement;
  storyButton?: HTMLButtonElement;
  manualButton?: HTMLButtonElement;
  presetButtons: Map<string, HTMLButtonElement>;
  layerSelect?: HTMLSelectElement;
  exposureSelect?: HTMLSelectElement;
  phenomenonSelect?: HTMLSelectElement;
  intensitySlider?: HTMLInputElement;
  intensityValue?: HTMLSpanElement;
  volumeControls: Partial<Record<SoundVolumeChannel, HudVolumeControl>>;
  pauseButton?: HTMLButtonElement;
  soundButton?: HTMLButtonElement;
  resumeButton?: HTMLButtonElement;
  forecastSection?: HTMLDivElement;
  forecastLabel?: HTMLSpanElement;
  forecastList?: HTMLDivElement;
};

type HudTimePhase = "dawn" | "day" | "dusk" | "night";

function resolveHudTimePhase(state: WeatherState, liveDate: Date | null): HudTimePhase {
  const hour = liveDate?.getHours() ?? parseHourFromTimeString(state.time);
  return sharedResolveHudTimePhase(state.palette, hour);
}

function sendToBackend(ctx: SpindleFrontendContext, payload: FrontendToBackend): void {
  ctx.sendToBackend(payload);
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

  return { root, host: null, kind, sceneTokens: null, sceneKey: null, blendTimer: null };
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

function createHudWidget(
  ctx: SpindleFrontendContext,
  initialPosition: { x: number; y: number },
  expanded: boolean,
  mobile: boolean,
  keyboardState: SpindleUIKeyboardState,
  callbacks: HudCallbacks,
): HudElements {
  const presentation = resolveHudPresentation(mobile, expanded);
  const widget = ctx.ui.createFloatWidget({
    width: presentation.width,
    height: presentation.height,
    initialPosition,
    snapToEdge: true,
    tooltip: presentation.kind === "mobile-launcher" ? "Open LumiWeather" : "LumiWeather HUD",
    chromeless: true,
    fullscreen: presentation.fullscreen,
  });

  const root = document.createElement("div");
  root.className = "weather-hud-widget";
  root.dataset.expanded = expanded ? "true" : "false";
  root.dataset.mobile = mobile ? "true" : "false";
  root.dataset.presentation = presentation.kind;
  root.style.setProperty("--weather-keyboard-inset-bottom", `${keyboardState.insetBottom}px`);
  root.style.setProperty("--weather-visual-viewport-height", `${keyboardState.viewportHeight}px`);
  if (presentation.kind === "mobile-panel") {
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "LumiWeather controls");
  }
  if (expanded) {
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      callbacks.onToggleDrawer();
    });
  }

  let launcherButton: HTMLButtonElement | undefined;
  let launcherIcon: HTMLSpanElement | undefined;
  if (presentation.kind === "mobile-launcher") {
    launcherButton = document.createElement("button");
    launcherButton.type = "button";
    launcherButton.className = "weather-hud-launcher";
    launcherButton.setAttribute("aria-label", "Open LumiWeather");
    launcherButton.title = "Open LumiWeather";

    launcherIcon = document.createElement("span");
    launcherIcon.className = "weather-hud-launcher-icon";
    launcherIcon.setAttribute("aria-hidden", "true");
    launcherButton.appendChild(launcherIcon);

    let pointerId: number | null = null;
    let pointerStart = { x: 0, y: 0 };
    let moved = false;
    launcherButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      pointerStart = { x: event.clientX, y: event.clientY };
      moved = false;
    });
    launcherButton.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) moved = true;
    });
    launcherButton.addEventListener("pointercancel", () => {
      pointerId = null;
      moved = false;
    });
    launcherButton.addEventListener("click", (event) => {
      event.stopPropagation();
      pointerId = null;
      if (moved) {
        moved = false;
        return;
      }
      callbacks.onToggleDrawer();
    });
    root.appendChild(launcherButton);
  }

  const header = document.createElement("div");
  header.className = "weather-hud-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "weather-hud-titlewrap";
  const eyebrow = document.createElement("div");
  eyebrow.className = "weather-hud-eyebrow";
  eyebrow.textContent = "LumiWeather";
  const badgeRow = document.createElement("div");
  badgeRow.className = "weather-hud-badges";
  const source = document.createElement("span");
  source.className = "weather-hud-source";
  const phenomenonBadge = document.createElement("span");
  phenomenonBadge.className = "weather-hud-phenomenon-badge";
  phenomenonBadge.hidden = true;
  badgeRow.appendChild(source);
  badgeRow.appendChild(phenomenonBadge);
  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(badgeRow);

  const headerActions = document.createElement("div");
  headerActions.className = "weather-hud-actions";

  const drawerToggle = document.createElement("button");
  drawerToggle.type = "button";
  drawerToggle.className = "weather-hud-control weather-hud-control-ghost";
  protectInteractive(drawerToggle);
  const drawerToggleLabel = document.createElement("span");
  drawerToggleLabel.textContent = presentation.kind === "mobile-panel" ? "Close" : expanded ? "Hide" : "Controls";
  const drawerToggleIcon = document.createElement("span");
  drawerToggleIcon.className = "weather-hud-control-icon";
  drawerToggleIcon.innerHTML = presentation.kind === "mobile-panel" ? CLOSE_SVG : expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  drawerToggle.appendChild(drawerToggleLabel);
  drawerToggle.appendChild(drawerToggleIcon);
  drawerToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  drawerToggle.setAttribute("aria-label", presentation.kind === "mobile-panel" ? "Close LumiWeather" : expanded ? "Hide LumiWeather controls" : "Show LumiWeather controls");
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
  const summaryViewport = document.createElement("div");
  summaryViewport.className = "weather-hud-summary-viewport";
  const summary = document.createElement("div");
  summary.className = "weather-hud-summary";
  summaryViewport.appendChild(summary);
  right.appendChild(icon);
  right.appendChild(temp);
  right.appendChild(summaryViewport);

  body.appendChild(left);
  body.appendChild(right);

  root.appendChild(header);
  root.appendChild(body);

  const presetButtons = new Map<string, HTMLButtonElement>();
  const volumeControls: Partial<Record<SoundVolumeChannel, HudVolumeControl>> = {};
  let storyButton: HTMLButtonElement | undefined;
  let manualButton: HTMLButtonElement | undefined;
  let layerSelect: HTMLSelectElement | undefined;
  let exposureSelect: HTMLSelectElement | undefined;
  let phenomenonSelect: HTMLSelectElement | undefined;
  let intensitySlider: HTMLInputElement | undefined;
  let intensityValue: HTMLSpanElement | undefined;
  let pauseButton: HTMLButtonElement | undefined;
  let soundButton: HTMLButtonElement | undefined;
  let resumeButton: HTMLButtonElement | undefined;
  let forecastSection: HTMLDivElement | undefined;
  let forecastLabel: HTMLSpanElement | undefined;
  let forecastList: HTMLDivElement | undefined;

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

    forecastSection = document.createElement("div");
    forecastSection.className = "weather-hud-drawer-section";
    forecastSection.hidden = true;
    forecastLabel = document.createElement("span");
    forecastLabel.className = "weather-hud-section-label";
    forecastLabel.textContent = "Outlook";
    forecastList = document.createElement("div");
    forecastList.className = "weather-hud-forecast";
    forecastSection.appendChild(forecastLabel);
    forecastSection.appendChild(forecastList);

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

    const exposureWrap = document.createElement("label");
    exposureWrap.className = "weather-hud-field";
    const exposureText = document.createElement("span");
    exposureText.textContent = "Exposure";
    exposureSelect = document.createElement("select");
    exposureSelect.className = "weather-hud-select";
    exposureSelect.innerHTML = `
      <option value="outdoor">Outdoor</option>
      <option value="sheltered">Sheltered</option>
      <option value="indoor">Indoor</option>
      <option value="underground">Underground</option>
    `;
    protectInteractive(exposureSelect);
    exposureSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangeExposure(exposureSelect!.value as WeatherExposure);
    });
    exposureWrap.appendChild(exposureText);
    exposureWrap.appendChild(exposureSelect);

    const phenomenonWrap = document.createElement("label");
    phenomenonWrap.className = "weather-hud-field";
    const phenomenonText = document.createElement("span");
    phenomenonText.textContent = "Phenomenon";
    phenomenonSelect = document.createElement("select");
    phenomenonSelect.className = "weather-hud-select";
    phenomenonSelect.innerHTML = `
      <option value="none">None</option>
      <option value="aurora">Aurora</option>
      <option value="blossoms">Blossoms</option>
      <option value="embers">Embers</option>
      <option value="ashfall">Ashfall</option>
      <option value="fireflies">Fireflies</option>
      <option value="sandstorm">Sandstorm</option>
    `;
    protectInteractive(phenomenonSelect);
    phenomenonSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      callbacks.onChangePhenomenon(phenomenonSelect!.value as WeatherPhenomenon);
    });
    phenomenonWrap.appendChild(phenomenonText);
    phenomenonWrap.appendChild(phenomenonSelect);

    controlGrid.appendChild(exposureWrap);
    controlGrid.appendChild(phenomenonWrap);

    controlsSection.appendChild(controlsLabel);
    controlsSection.appendChild(controlGrid);

    const soundSection = document.createElement("div");
    soundSection.className = "weather-hud-drawer-section";
    const soundLabel = document.createElement("span");
    soundLabel.className = "weather-hud-section-label";
    soundLabel.textContent = "Soundscape volume";

    const soundGrid = document.createElement("div");
    soundGrid.className = "weather-hud-volume-grid";

    const createHudVolumeSlider = (
      channel: SoundVolumeChannel,
      label: string,
      wide = false,
    ): HTMLLabelElement => {
      const wrap = document.createElement("label");
      wrap.className = wide ? "weather-hud-field weather-hud-field-wide" : "weather-hud-field";
      const headerRow = document.createElement("div");
      headerRow.className = "weather-hud-field-row";
      const text = document.createElement("span");
      text.textContent = label;
      const valueLabel = document.createElement("span");
      valueLabel.className = "weather-hud-inline-value";
      headerRow.appendChild(text);
      headerRow.appendChild(valueLabel);

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "weather-hud-range";
      slider.min = "0.00";
      slider.max = "1.00";
      slider.step = "0.05";
      slider.setAttribute("aria-label", `${label} volume`);
      protectInteractive(slider);
      slider.addEventListener("input", (event) => {
        event.stopPropagation();
        callbacks.onChangeSoundVolume(channel, Number.parseFloat(slider.value));
      });

      wrap.appendChild(headerRow);
      wrap.appendChild(slider);
      volumeControls[channel] = { slider, valueLabel };
      return wrap;
    };

    soundGrid.appendChild(createHudVolumeSlider("soundVolume", "Master", true));
    soundGrid.appendChild(createHudVolumeSlider("rainVolume", "Rain"));
    soundGrid.appendChild(createHudVolumeSlider("windVolume", "Wind"));
    soundGrid.appendChild(createHudVolumeSlider("thunderVolume", "Thunder"));
    soundGrid.appendChild(createHudVolumeSlider("ambienceVolume", "Ambience"));

    soundSection.appendChild(soundLabel);
    soundSection.appendChild(soundGrid);

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

    soundButton = document.createElement("button");
    soundButton.type = "button";
    soundButton.className = "weather-hud-control";
    protectInteractive(soundButton);
    soundButton.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onToggleSound();
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
    actionRow.appendChild(soundButton);
    actionRow.appendChild(resumeButton);
    actionsSection.appendChild(actionRow);

    drawer.appendChild(modeSection);
    drawer.appendChild(presetsSection);
    drawer.appendChild(forecastSection);
    drawer.appendChild(controlsSection);
    drawer.appendChild(soundSection);
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
    phenomenonBadge,
    drawerToggle,
    drawerToggleLabel,
    drawerToggleIcon,
    launcherButton,
    launcherIcon,
    storyButton,
    manualButton,
    presetButtons,
    layerSelect,
    exposureSelect,
    phenomenonSelect,
    intensitySlider,
    intensityValue,
    volumeControls,
    pauseButton,
    soundButton,
    resumeButton,
    forecastSection,
    forecastLabel,
    forecastList,
  };
}

/**
 * Compact multi-day strip inside the HUD drawer. Rebuilt only when the
 * projection itself changes, since `syncHudState` runs on a one-second clock.
 */
function renderForecastStrip(list: HTMLDivElement, entries: ForecastEntry[], unit: TemperatureUnit): void {
  list.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "weather-hud-forecast-row";
    row.dataset.forecastDate = entry.date;

    const day = document.createElement("span");
    day.className = "weather-hud-forecast-day";
    day.textContent = formatForecastDayLabel(entry.date);
    day.title = entry.date;

    const icon = document.createElement("span");
    icon.className = "weather-hud-forecast-icon";
    icon.innerHTML = conditionIcon(entry.condition);
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "weather-hud-forecast-copy";
    text.textContent = entry.temperature
      ? `${entry.condition} · ${formatTemperatureForUnit(entry.temperature, unit)}`
      : entry.condition;
    if (entry.summary) {
      const summary = document.createElement("span");
      summary.className = "weather-hud-forecast-summary";
      summary.textContent = entry.summary;
      text.appendChild(summary);
    }
    text.title = [entry.date, entry.condition, entry.temperature, entry.summary].filter(Boolean).join(" · ");

    row.appendChild(day);
    row.appendChild(icon);
    row.appendChild(text);
    list.appendChild(row);
  }
}

/** `Fri` for the next day, falling back to the raw date when it cannot be parsed. */
function formatForecastDayLabel(dateValue: string): string {
  const timestamp = parseStoryDateTime(dateValue, "12:00");
  if (timestamp === null) return dateValue;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(timestamp);
}

/**
 * `auto` keeps the historical behavior: story time normally, live wall-clock time
 * only while a manual lock is active. `live` and `story` force one source.
 */
function resolveClockDate(state: WeatherState, clockMode: WeatherClockMode): Date | null {
  if (clockMode === "story") return null;
  if (clockMode === "live") return new Date();
  return state.source === "manual" ? new Date() : null;
}

/**
 * `Intl.DateTimeFormat` construction is comparatively expensive and this runs on
 * a one-second tick, so instances are cached per locale rather than rebuilt.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(locale: string): Intl.DateTimeFormat {
  const existing = dateFormatters.get(locale);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  dateFormatters.set(locale, formatter);
  return formatter;
}

function getTimeFormatter(locale: string): Intl.DateTimeFormat {
  const existing = timeFormatters.get(locale);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  timeFormatters.set(locale, formatter);
  return formatter;
}

function syncHudClock(hud: HudElements, displayState: WeatherState, hasState: boolean, liveDate: Date | null): void {
  const locale = document.documentElement.lang || navigator.language || "en-US";
  const nextDate = liveDate ? getDateFormatter(locale).format(liveDate) : hasState ? displayState.date : "No tag yet";
  const nextTime = liveDate ? getTimeFormatter(locale).format(liveDate) : hasState ? displayState.time : "\u2014";

  // The one-second tick only needs to touch these two nodes when a displayed
  // minute actually rolls over, so the cache is keyed on the rendered text.
  if (hud.root.dataset.clockDate !== nextDate) {
    hud.root.dataset.clockDate = nextDate;
    hud.date.textContent = nextDate;
  }
  if (hud.root.dataset.clockTime !== nextTime) {
    hud.root.dataset.clockTime = nextTime;
    hud.time.textContent = nextTime;
  }
  hud.root.dataset.clockSource = liveDate ? "live" : "story";
}

function syncHudState(hud: HudElements, prefs: WeatherPrefs, state: WeatherState | null, expanded: boolean, hasActiveChat: boolean): void {
  const displayState = state ?? makeDefaultWeatherState();
  const liveDate = resolveClockDate(displayState, prefs.clockMode);
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

  // Solar altitude is published for stylesheet use: -90 is solar midnight and
  // +90 is solar noon, so gradient stops can key off real light rather than the
  // coarse phase label alone. An unparseable story date leaves it at 0.
  const solar = resolveSolarArc(displayState.date, displayState.time);
  const lunar = resolveLunarPhase(displayState.date, displayState.time);
  const exposure = displayState.exposure ?? "outdoor";
  const phenomenon = displayState.phenomenon ?? "none";
  hud.root.style.setProperty("--weather-sun-altitude", solar.sunAltitude.toFixed(1));
  hud.root.dataset.season = state ? displayState.season : "unknown";
  hud.root.dataset.exposure = exposure;
  hud.root.dataset.phenomenon = phenomenon;
  hud.root.dataset.lunarPhase = lunar.phase;

  const hasPhenomenon = Boolean(state && phenomenon !== "none");
  hud.phenomenonBadge.hidden = !hasPhenomenon;
  if (hasPhenomenon) {
    hud.phenomenonBadge.textContent = phenomenon;
    hud.phenomenonBadge.dataset.phenomenon = phenomenon;
  } else {
    hud.phenomenonBadge.textContent = "";
    delete hud.phenomenonBadge.dataset.phenomenon;
  }

  const iconMarkup = conditionIcon(displayState.condition, phase);
  hud.icon.innerHTML = iconMarkup;
  const iconLabel = conditionIconLabel(displayState.condition, phase);
  hud.icon.setAttribute("role", "img");
  hud.icon.setAttribute("aria-label", iconLabel);
  hud.icon.title = iconLabel;
  hud.temp.textContent = state ? formatTemperatureForUnit(displayState.temperature, prefs.temperatureUnit) : "—";
  const summaryText = state ? displayState.summary : "Waiting for the first weather tag";
  hud.summary.textContent = summaryText;
  hud.summary.title = summaryText;
  hud.summary.dataset.tickerText = summaryText;
  const windBase = `Wind ${displayState.wind}${displayState.windDirection === "none" ? "" : ` from ${displayState.windDirection}`}`;
  const windExtras: string[] = [];
  if (exposure !== "outdoor") windExtras.push(exposure);
  if (phenomenon !== "none") windExtras.push(phenomenon);
  hud.wind.textContent = state
    ? [windBase, ...windExtras].join(" · ")
    : "Add {{weather_tracker}} to the prompt";
  hud.location.textContent = state ? displayState.location : "Waiting for LumiWeather";
  hud.location.title = hud.location.textContent;
  hud.wind.title = state
    ? `${hud.wind.textContent} · ${lunar.label} (${Math.round(lunar.illumination * 100)}% moon)`
    : hud.wind.textContent;
  // A missing interceptor permission used to be visible only inside the settings
  // panel; surface it on the HUD itself, where the user is already looking.
  const permissionLimited = hud.root.dataset.permission === "limited";
  hud.source.textContent = hud.root.dataset.error === "true"
    ? "Update failed"
    : permissionLimited
    ? "Permission needed"
    : state
      ? displayState.source === "manual" ? "Scene lock" : "Story sync"
      : "Waiting";
  const mobilePanel = hud.root.dataset.presentation === "mobile-panel";
  hud.drawerToggleLabel.textContent = mobilePanel ? "Close" : expanded ? "Hide" : "Controls";
  hud.drawerToggleIcon.innerHTML = mobilePanel ? CLOSE_SVG : expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  hud.drawerToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  hud.drawerToggle.setAttribute(
    "aria-label",
    mobilePanel ? "Close LumiWeather" : expanded ? "Hide LumiWeather controls" : "Show LumiWeather controls",
  );

  if (hud.launcherButton && hud.launcherIcon) {
    hud.launcherIcon.innerHTML = iconMarkup;
    const launcherLabel = state
      ? `Open LumiWeather: ${displayState.location}, ${displayState.condition}, ${formatTemperatureForUnit(displayState.temperature, prefs.temperatureUnit)}`
      : "Open LumiWeather: waiting for a weather update";
    hud.launcherButton.setAttribute("aria-label", launcherLabel);
    hud.launcherButton.title = launcherLabel;
  }

  syncHudClock(hud, displayState, state !== null, liveDate);

  if (hud.storyButton && hud.manualButton) {
    hud.storyButton.classList.toggle("weather-hud-chip-active", state?.source === "story");
    hud.manualButton.classList.toggle("weather-hud-chip-active", state?.source === "manual");
    hud.storyButton.setAttribute("aria-pressed", String(state?.source === "story"));
    hud.manualButton.setAttribute("aria-pressed", String(state?.source === "manual"));
    hud.storyButton.disabled = !state || state.source === "story";
    hud.manualButton.disabled = !state;
  }

  const activePresetId = matchWeatherScenePreset(state);
  for (const [presetId, button] of hud.presetButtons) {
    button.classList.toggle("weather-hud-preset-active", presetId === activePresetId);
    button.setAttribute("aria-pressed", String(presetId === activePresetId));
    button.disabled = !hasActiveChat;
  }

  if (hud.layerSelect) {
    hud.layerSelect.value = prefs.layerMode;
  }

  if (hud.exposureSelect) {
    hud.exposureSelect.value = exposure;
    hud.exposureSelect.disabled = !hasActiveChat;
  }

  if (hud.phenomenonSelect) {
    hud.phenomenonSelect.value = phenomenon;
    hud.phenomenonSelect.disabled = !hasActiveChat;
  }

  if (hud.intensitySlider && hud.intensityValue) {
    hud.intensitySlider.value = prefs.intensity.toFixed(2);
    hud.intensityValue.textContent = `${Math.round(prefs.intensity * 100)}%`;
  }

  const volumeChannelValues: Record<SoundVolumeChannel, number> = {
    soundVolume: prefs.soundVolume ?? 0.45,
    rainVolume: prefs.rainVolume ?? 1,
    windVolume: prefs.windVolume ?? 1,
    thunderVolume: prefs.thunderVolume ?? 1,
    ambienceVolume: prefs.ambienceVolume ?? 1,
  };
  for (const [channel, val] of Object.entries(volumeChannelValues) as Array<[SoundVolumeChannel, number]>) {
    const control = hud.volumeControls[channel];
    if (!control) continue;
    const clamped = clamp(val, 0, 1);
    control.slider.value = clamped.toFixed(2);
    control.valueLabel.textContent = `${Math.round(clamped * 100)}%`;
    control.slider.setAttribute("aria-valuetext", control.valueLabel.textContent);
  }

  if (hud.pauseButton) {
    hud.pauseButton.textContent = prefs.pauseEffects ? "Resume motion" : "Pause motion";
    hud.pauseButton.classList.toggle("weather-hud-control-active", prefs.pauseEffects);
    hud.pauseButton.setAttribute("aria-pressed", String(prefs.pauseEffects));
  }

  if (hud.soundButton) {
    const soundEnabled = Boolean(prefs.soundEnabled);
    hud.soundButton.textContent = soundEnabled ? "Soundscape on" : "Soundscape off";
    hud.soundButton.classList.toggle("weather-hud-control-active", soundEnabled);
    hud.soundButton.setAttribute("aria-pressed", String(soundEnabled));
  }

  if (hud.resumeButton) {
    hud.resumeButton.disabled = !state || state.source === "story";
  }

  // The outlook strip is expensive to rebuild, so it is keyed on the projection
  // itself and the unit preference rather than on the one-second clock.
  if (hud.forecastSection && hud.forecastList) {
    const entries = prefs.showForecast && state ? state.forecast : [];
    const show = entries.length > 0 && expanded;
    hud.forecastSection.hidden = !show;
    if (show) {
      const forecastKey = `${prefs.temperatureUnit}|${entries
        .map((entry) => `${entry.date}:${entry.condition}:${entry.temperature}:${entry.summary}`)
        .join("|")}`;
      if (hud.forecastList.dataset.forecastKey !== forecastKey) {
        hud.forecastList.dataset.forecastKey = forecastKey;
        renderForecastStrip(hud.forecastList, entries, prefs.temperatureUnit);
      }
    } else if (hud.forecastList.dataset.forecastKey) {
      hud.forecastList.dataset.forecastKey = "";
      hud.forecastList.replaceChildren();
    }
  }
}

function setFxVisibility(root: FxRoot, visible: boolean): void {
  root.root.classList.toggle("weather-hidden", !visible);
  root.root.classList.toggle("weather-visible", visible);
}

function sceneKeyFor(state: WeatherState, effectiveIntensity: number, prefs: WeatherPrefs): string {
  return [
    state.condition,
    state.palette,
    state.exposure ?? "outdoor",
    state.phenomenon ?? "none",
    Math.round(effectiveIntensity * 1000),
    Math.round(state.intensity * 1000),
    prefs.layerMode,
  ].join(":");
}

/** Tracks transition completion timing while `AtmosphereEngine` interpolates uniforms on GPU. */
function applySceneBlend(root: FxRoot, _to: ResolvedSceneTokens, onComplete: () => void): void {
  if (root.blendTimer !== null) window.clearTimeout(root.blendTimer);
  root.blendTimer = window.setTimeout(() => {
    root.blendTimer = null;
    onComplete();
  }, SCENE_TRANSITION_MS);
}

function clearSceneBlend(root: FxRoot): void {
  if (root.blendTimer !== null) {
    window.clearTimeout(root.blendTimer);
    root.blendTimer = null;
  }
}

function applySceneState(
  root: FxRoot,
  state: WeatherState,
  prefs: WeatherPrefs,
  reducedMotion: boolean,
  visible: boolean,
  onBlendComplete: () => void,
): void {
  const effectiveIntensity = clamp(state.intensity * prefs.intensity, 0, 1.5);
  const tokens = resolveSceneTokens(state, effectiveIntensity);
  const rainProfile = resolveRainProfile(effectiveIntensity, state.condition);
  const isFront = root.kind === "front";
  const isBoth = prefs.layerMode === "both";
  const rainLayerOpacity = tokens.rainOpacity * rainProfile.opacityScale * (isFront ? 0.82 : 0.72);
  const paused = prefs.pauseEffects || document.visibilityState === "hidden";

  root.root.dataset.condition = state.condition;
  root.root.dataset.palette = state.palette;
  root.root.dataset.exposure = state.exposure ?? "outdoor";
  root.root.dataset.phenomenon = state.phenomenon ?? "none";
  root.root.classList.toggle("weather-reduced-motion", reducedMotion);
  root.root.classList.toggle("weather-paused", paused);
  root.root.classList.toggle("weather-rain-active", state.condition === "rain" || state.condition === "storm");
  root.root.classList.toggle("weather-snow-active", state.condition === "snow");
  root.root.classList.toggle("weather-night-active", tokens.starOpacity > 0 || tokens.moonlightOpacity > 0);
  root.root.classList.toggle("weather-aurora-active", tokens.auroraOpacity > 0);
  root.root.classList.toggle("weather-windowpane-active", tokens.windowDropletOpacity > 0);
  root.root.classList.toggle("weather-phenomenon-active", tokens.phenomenonOpacity > 0);

  // In `both` mode the front layer skips sky/glow/beam/deep-fog so `back` owns the
  // atmosphere behind chat; in `front`-only mode `front` retains scaled atmosphere.
  const resolvedTokens: ResolvedSceneTokens = {
    ...tokens,
    glowOpacity: isFront ? (isBoth ? 0 : tokens.glowOpacity * 0.6) : tokens.glowOpacity,
    beamOpacity: isFront ? (isBoth ? 0 : tokens.beamOpacity * 0.55) : tokens.beamOpacity,
    fogOpacity: isFront ? (isBoth ? 0 : tokens.fogOpacity * 0.72) : tokens.fogOpacity,
    rainOpacity: rainLayerOpacity,
    snowOpacity: tokens.snowOpacity * (isFront ? 0.96 : 0.82),
    starOpacity: tokens.starOpacity * (isFront ? (isBoth ? 0.4 : 0.78) : 1),
    moonlightOpacity: tokens.moonlightOpacity * (isFront ? (isBoth ? 0.22 : 0.65) : 1),
    auroraOpacity: tokens.auroraOpacity * (isFront ? (isBoth ? 0.25 : 0.75) : 1),
    windowDropletOpacity: tokens.windowDropletOpacity * (isFront ? 1 : (isBoth ? 0.35 : 0.9)),
    phenomenonOpacity: tokens.phenomenonOpacity * (isFront ? 0.95 : 0.85),
  };

  const nextKey = sceneKeyFor(state, effectiveIntensity, prefs);
  const canBlend =
    prefs.effectsEnabled &&
    (prefs.layerMode === "both" || prefs.layerMode === root.kind) &&
    prefs.transitionsEnabled &&
    !reducedMotion &&
    !paused &&
    root.sceneTokens !== null &&
    visible;

  if (canBlend && root.sceneKey !== nextKey) {
    applySceneBlend(root, resolvedTokens, onBlendComplete);
  } else if (!canBlend || root.blendTimer === null) {
    clearSceneBlend(root);
  }

  root.sceneTokens = resolvedTokens;
  root.sceneKey = nextKey;

  updateAtmosphereEngine(root.root, root.kind, {
    state,
    tokens: resolvedTokens,
    prefs,
    kind: root.kind,
    visible,
    reducedMotion,
    paused,
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
  let backendWarning: string | null = null;
  let keyboardState = ctx.ui.events.getKeyboardState();
  const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
  let mobileHudLayout = isMobileHudLayout(keyboardState.viewportWidth, coarsePointerMedia.matches);

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

  const soundscape = new WeatherSoundscape();
  cleanups.push(() => soundscape.destroy());

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
    // Chat/background hosts can be replaced without a route or viewport change.
    // Ignore mutations inside our own FX/HUD roots or when both hosts remain
    // connected with our roots attached, avoiding expensive DOM queries on every
    // streamed chat token.
    hostObserver = new MutationObserver((records) => {
      if (
        backFx.host &&
        backFx.host.isConnected &&
        backFx.root.parentElement === backFx.host &&
        frontFx.host &&
        frontFx.host.isConnected &&
        frontFx.root.parentElement === frontFx.host
      ) {
        let relevant = false;
        for (let i = 0; i < records.length; i += 1) {
          const record = records[i];
          const target = record.target as Node;
          if (backFx.root.contains(target) || frontFx.root.contains(target) || hud?.root.contains(target)) {
            continue;
          }
          if (target === document.body || target === backFx.host.parentElement || target === frontFx.host.parentElement) {
            relevant = true;
            break;
          }
        }
        if (!relevant) return;
      }
      queueFxRootAttach();
    });
    hostObserver.observe(document.body, { childList: true, subtree: true });
  };

  const queueFxRootAttach = () => {
    if (hostSyncFrame !== null) return;
    hostSyncFrame = window.requestAnimationFrame(() => {
      const changed = attachFxRoots();
      if (changed) updateScene();
      ensureHostObserver();
    });
  };
  cleanups.push(() => {
    if (hostSyncFrame !== null) {
      window.cancelAnimationFrame(hostSyncFrame);
      hostSyncFrame = null;
    }
    stopHostObserver();
    clearSceneBlend(backFx);
    clearSceneBlend(frontFx);
    destroyAtmosphereEngine(backFx.root);
    destroyAtmosphereEngine(frontFx.root);
    detachFxRoot(backFx);
    detachFxRoot(frontFx);
  });

  let hud: HudElements | null = null;
  let removeHudDragListener: (() => void) | null = null;
  let windowedHudPosition = currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;

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
    const mountedWindowedPosition = hud && !hud.widget.isFullscreen() ? hud.widget.getPosition() : null;
    let nextPosition =
      position ??
      mountedWindowedPosition ??
      windowedHudPosition ??
      currentPrefs.widgetPosition ??
      DEFAULT_WIDGET_POSITION;
    if (mobileHudLayout) {
      nextPosition = clampMobileHudPosition(nextPosition, {
        width: keyboardState.viewportWidth,
        height: keyboardState.viewportHeight,
      });
    }
    windowedHudPosition = nextPosition;

    destroyHud();
    hud = createHudWidget(ctx, nextPosition, hudExpanded, mobileHudLayout, keyboardState, {
      onToggleDrawer: () => {
        const restoreFocus = !!hud?.root.contains(document.activeElement);
        const currentPosition = hud && !hud.widget.isFullscreen() ? hud.widget.getPosition() : windowedHudPosition;
        windowedHudPosition = currentPosition;
        hudExpanded = !hudExpanded;
        buildHud(currentPosition);
        updateScene();
        if (restoreFocus && hud) (hud.launcherButton ?? hud.drawerToggle).focus({ preventScroll: true });
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
      onChangeExposure: (exposure) => {
        const state = currentState ?? makeDefaultWeatherState();
        sendManualState({ ...state, exposure, source: "manual" });
      },
      onChangePhenomenon: (phenomenon) => {
        const state = currentState ?? makeDefaultWeatherState();
        sendManualState({ ...state, phenomenon, source: "manual" });
      },
      onChangeIntensity: (intensity) => {
        currentPrefs = { ...currentPrefs, intensity };
        updateScene();
        sendToBackend(ctx, { type: "save_prefs", prefs: { intensity } });
      },
      onChangeSoundVolume: (channel, volume) => {
        const clamped = clamp(volume, 0, 1);
        currentPrefs = { ...currentPrefs, [channel]: clamped };
        if (hud) {
          syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
        }
        const showEffects =
          currentPrefs.effectsEnabled &&
          document.visibilityState !== "hidden" &&
          !!activeChatId &&
          !!currentState;
        soundscape.sync(currentState, currentPrefs, showEffects);
        sendToBackend(ctx, { type: "save_prefs", prefs: { [channel]: clamped } });
      },
      onTogglePause: () => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { pauseEffects: !currentPrefs.pauseEffects } });
      },
      onToggleSound: () => {
        sendToBackend(ctx, { type: "save_prefs", prefs: { soundEnabled: !currentPrefs.soundEnabled } });
      },
    });
    hud.root.dataset.reducedMotion = String(getReducedMotion());
    removeHudDragListener = hud.widget.onDragEnd((nextPositionFromDrag) => {
      windowedHudPosition = nextPositionFromDrag;
      sendToBackend(ctx, { type: "save_prefs", prefs: { widgetPosition: nextPositionFromDrag } });
    });
    syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
  };

  buildHud(currentPrefs.widgetPosition);
  cleanups.push(() => destroyHud());

  const syncHudViewportVariables = () => {
    if (!hud) return;
    hud.root.style.setProperty("--weather-keyboard-inset-bottom", `${keyboardState.insetBottom}px`);
    hud.root.style.setProperty("--weather-visual-viewport-height", `${keyboardState.viewportHeight}px`);
  };

  const refreshMobileHudLayout = (nextKeyboardState: SpindleUIKeyboardState, coarsePointer: boolean) => {
    const previousKeyboardState = keyboardState;
    const previousMobileHudLayout = mobileHudLayout;
    keyboardState = nextKeyboardState;
    mobileHudLayout = isMobileHudLayout(keyboardState.viewportWidth, coarsePointer);

    const layoutChanged = mobileHudLayout !== previousMobileHudLayout;
    const widthChanged = keyboardState.viewportWidth !== previousKeyboardState.viewportWidth;
    const heightChanged = keyboardState.viewportHeight !== previousKeyboardState.viewportHeight;
    if (!layoutChanged && mobileHudLayout && !hudExpanded && (widthChanged || heightChanged)) {
      windowedHudPosition = clampMobileHudPosition(windowedHudPosition, {
        width: keyboardState.viewportWidth,
        height: keyboardState.viewportHeight,
      });
      if (hud && !hud.widget.isFullscreen()) {
        hud.widget.moveTo(windowedHudPosition.x, windowedHudPosition.y);
      }
    }

    const shouldRebuild = layoutChanged || (mobileHudLayout && hudExpanded && widthChanged);
    if (shouldRebuild) {
      buildHud(windowedHudPosition);
      return;
    }
    syncHudViewportVariables();
  };

  const keyboardUnsub = ctx.ui.events.onKeyboardChange((nextKeyboardState) => {
    refreshMobileHudLayout(nextKeyboardState, coarsePointerMedia.matches);
  });
  cleanups.push(keyboardUnsub);
  const onCoarsePointerChange = () => {
    refreshMobileHudLayout(ctx.ui.events.getKeyboardState(), coarsePointerMedia.matches);
  };
  coarsePointerMedia.addEventListener("change", onCoarsePointerChange);
  cleanups.push(() => coarsePointerMedia.removeEventListener("change", onCoarsePointerChange));

  let flashTimer: number | null = null;
  const resetFlashTimer = () => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
  };

  let disposed = false;
  const canRunLightning = () => !disposed &&
    currentState?.condition === "storm" && !getReducedMotion() &&
    !currentPrefs.pauseEffects && currentPrefs.effectsEnabled && currentPrefs.lightningFlashEnabled &&
    document.visibilityState !== "hidden" && !!activeChatId;

  const scheduleStormFlash = () => {
    resetFlashTimer();

    if (!canRunLightning()) return;
    if (backFx.blendTimer !== null || frontFx.blendTimer !== null) return;

    const trigger = () => {
      flashTimer = null;
      if (!canRunLightning() || backFx.blendTimer !== null || frontFx.blendTimer !== null) {
        scheduleStormFlash();
        return;
      }

      const boltIndex = Math.floor(Math.random() * LIGHTNING_BOLT_POSITIONS.length);
      const boltX = LIGHTNING_BOLT_POSITIONS[boltIndex] ?? 50;

      triggerAtmosphereLightning(backFx.root, boltX);
      triggerAtmosphereLightning(frontFx.root, boltX);
      soundscape.triggerThunder(boltX);

      flashTimer = window.setTimeout(trigger, 3200 + Math.random() * 5200);
    };

    flashTimer = window.setTimeout(trigger, 1400 + Math.random() * 2800);
  };

  const updateScene = () => {
    const reducedMotion = getReducedMotion();
    const layerMode = currentPrefs.layerMode;
    const showEffects = currentPrefs.effectsEnabled && document.visibilityState !== "hidden" && !!activeChatId && !!currentState;
    const sceneState = currentState ?? makeDefaultWeatherState();
    const showBack = showEffects && !!backFx.host && (layerMode === "back" || layerMode === "both");
    const showFront = showEffects && !!frontFx.host && (layerMode === "front" || layerMode === "both");

    if (hud) {
      hud.root.dataset.permission = permissionWarning ? "limited" : "ok";
      hud.root.dataset.error = String(!!backendWarning);
      hud.source.title = backendWarning ?? permissionWarning ?? "";
      hud.root.dataset.reducedMotion = String(reducedMotion);
      syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
    }
    settingsUI.sync(currentPrefs, currentState, !activeChatId ? "No active chat" : backendWarning ?? permissionWarning ?? undefined, activeChatId);
    setFxVisibility(backFx, showBack);
    setFxVisibility(frontFx, showFront);
    applySceneState(backFx, sceneState, currentPrefs, reducedMotion, showBack, scheduleStormFlash);
    applySceneState(frontFx, sceneState, currentPrefs, reducedMotion, showFront, scheduleStormFlash);
    soundscape.sync(currentState, currentPrefs, showEffects);
    scheduleStormFlash();
  };

  // The one-second tick only exists to advance a live clock. All other HUD fields
  // are pushed by scene changes, so a tick skips the full sync whenever both clock
  // sources are frozen and nothing the timer affects depends on the wall clock.
  const clockTimer = window.setInterval(() => {
    if (!hud) return;
    const clockMode = currentPrefs.clockMode;
    if (clockMode === "story") return;
    if (clockMode === "auto" && currentState?.source !== "manual") return;
    syncHudState(hud, currentPrefs, currentState, hudExpanded, !!activeChatId);
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
      // The backend deduplicates successfully saved tags. A frontend cache would
      // suppress restored swipes/edits and retries after a failed save.
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
        backendWarning = null;
        currentPrefs = message.prefs;
        windowedHudPosition = currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
        if (mobileHudLayout) {
          windowedHudPosition = clampMobileHudPosition(windowedHudPosition, {
            width: keyboardState.viewportWidth,
            height: keyboardState.viewportHeight,
          });
        }
        if (hud && !hud.widget.isFullscreen()) {
          hud.widget.moveTo(windowedHudPosition.x, windowedHudPosition.y);
        }
        updateScene();
        break;

      case "active_chat_state":
        if (!shouldApplyChatState(activeChatId, message.chatId, message.requestId, activeChatRequestId)) break;
        backendWarning = null;
        activeChatId = message.chatId;
        currentState = message.state;
        updateScene();
        break;

      case "weather_state":
        if (message.chatId !== activeChatId) break;
        backendWarning = null;
        currentState = message.state;
        updateScene();
        break;

      case "error":
        console.warn(`[weather_hud] ${message.message}`);
        backendWarning = message.message;
        settingsUI.reportError(message.message);
        updateScene();
        break;
    }
  });
  cleanups.push(msgUnsub);

  const requestActiveChatState = (chatId: string | null) => {
    if (chatId === activeChatId && activeChatRequestId > 0) return;
    activeChatId = chatId;
    currentState = null;
    backendWarning = null;
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
  requestActiveChatState(ctx.getActiveChat().chatId);
  queueFxRootAttach();
  updateScene();
  void ctx.permissions.getGranted().then((granted) => {
    if (disposed) return;
    if (!granted.includes("interceptor")) {
      permissionWarning = "Enable the Interceptor permission to inject the current weather scene into prompts.";
      updateScene();
    }
  }).catch(() => {
    // Permission status is informational; the extension remains usable for tag-driven HUD updates.
  });

  return () => {
    disposed = true;
    scheduleStormFlash();
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}
