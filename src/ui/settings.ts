import { buildPresetWeatherState, matchWeatherScenePreset, WEATHER_SCENE_PRESETS } from "../presets";
import { formatTemperatureForUnit, parseStoryDateTime, WEATHER_WIND_DIRECTIONS } from "../shared";
import type { WeatherCondition, WeatherPalette, WeatherPrefs, WeatherState, WeatherWindDirection } from "../types";

const CONDITIONS: WeatherCondition[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
const PALETTES: WeatherPalette[] = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];

export interface SettingsUI {
  root: HTMLElement;
  sync(prefs: WeatherPrefs, state: WeatherState | null, statusOverride?: string): void;
  destroy(): void;
}

function createCodeBlock(text: string): HTMLPreElement {
  const code = document.createElement("pre");
  code.className = "weather-settings-code";
  code.textContent = text;
  return code;
}

function createLabeledInput(labelText: string, input: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "weather-settings-label";
  label.textContent = labelText;
  label.appendChild(input);
  return label;
}

function createSection(titleText: string, copyText?: string) {
  const section = document.createElement("section");
  section.className = "weather-settings-section weather-settings-glass-panel";

  const header = document.createElement("div");
  header.className = "weather-settings-section-header";

  const title = document.createElement("strong");
  title.className = "weather-settings-section-title";
  title.textContent = titleText;
  header.appendChild(title);

  if (copyText) {
    const copy = document.createElement("p");
    copy.className = "weather-settings-section-copy";
    copy.textContent = copyText;
    header.appendChild(copy);
  }

  const body = document.createElement("div");
  body.className = "weather-settings-section-body";

  section.appendChild(header);
  section.appendChild(body);

  return { section, body };
}

function formatRelativeTime(timestampMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function applyStateToInputs(
  state: Partial<WeatherState>,
  fields: {
    conditionSelect: HTMLSelectElement;
    paletteSelect: HTMLSelectElement;
    locationInput: HTMLInputElement;
    dateInput: HTMLInputElement;
    timeInput: HTMLInputElement;
    temperatureInput: HTMLInputElement;
    windInput: HTMLInputElement;
    windDirectionSelect: HTMLSelectElement;
    summaryInput: HTMLInputElement;
    sceneIntensity: HTMLInputElement;
    sceneIntensityValue: HTMLSpanElement;
  },
): void {
  if (state.condition) fields.conditionSelect.value = state.condition;
  if (state.palette) fields.paletteSelect.value = state.palette;
  if (state.location) fields.locationInput.value = state.location;
  if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) fields.dateInput.value = state.date;
  if (state.time) fields.timeInput.value = state.time;
  if (state.temperature) fields.temperatureInput.value = state.temperature;
  if (state.wind) fields.windInput.value = state.wind;
  if (state.windDirection) fields.windDirectionSelect.value = state.windDirection;
  if (state.summary) fields.summaryInput.value = state.summary;
  if (typeof state.intensity === "number" && Number.isFinite(state.intensity)) {
    fields.sceneIntensity.value = state.intensity.toFixed(2);
    fields.sceneIntensityValue.textContent = `${Math.round(state.intensity * 100)}%`;
  }
}

export function createSettingsUI(sendToBackend: (payload: unknown) => void): SettingsUI {
  const root = document.createElement("section");
  root.className = "weather-settings-card";

  const header = document.createElement("header");
  header.className = "weather-settings-card-header";

  const headerGlow = document.createElement("span");
  headerGlow.className = "weather-settings-header-glow";

  const titleWrap = document.createElement("div");
  titleWrap.className = "weather-settings-titlewrap";

  const eyebrow = document.createElement("span");
  eyebrow.className = "weather-settings-eyebrow";
  eyebrow.textContent = "Ambient scene studio";

  const title = document.createElement("h3");
  title.textContent = "LumiWeather Studio";

  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(title);

  const status = document.createElement("span");
  status.className = "weather-settings-status";

  header.appendChild(headerGlow);
  header.appendChild(titleWrap);
  header.appendChild(status);

  const body = document.createElement("div");
  body.className = "weather-settings-card-body";

  const preview = document.createElement("div");
  preview.className = "weather-settings-preview weather-settings-scene-hero";

  const previewGlow = document.createElement("span");
  previewGlow.className = "weather-settings-preview-glow";
  const previewLabel = document.createElement("span");
  previewLabel.className = "weather-settings-preview-label";
  previewLabel.textContent = "Live chat scene";
  const previewValue = document.createElement("strong");
  previewValue.className = "weather-settings-preview-value";
  const previewHint = document.createElement("span");
  previewHint.className = "weather-settings-preview-hint";
  previewHint.textContent = "Updates only from this chat's weather tag.";
  preview.appendChild(previewGlow);
  preview.appendChild(previewLabel);
  preview.appendChild(previewValue);
  preview.appendChild(previewHint);

  const promptSection = createSection(
    "Prompt integration",
    "To make the main model emit the hidden weather tag consistently, add the recommended macro to your system prompt or preset, just like simtracker uses {{sim_tracker}}.",
  );
  const effectsSection = createSection("Effects", "Overall ambience, density, and motion.");
  const placementSection = createSection("Placement", "Control whether the weather stays behind the chat, in front, or both.");
  const motionSection = createSection("Motion", "Fine-tune animation pacing without breaking story sync.");

  const promptRecommended = document.createElement("div");
  promptRecommended.className = "weather-settings-copy-group";

  const promptRecommendedLabel = document.createElement("strong");
  promptRecommendedLabel.className = "weather-settings-copy-title";
  promptRecommendedLabel.textContent = "Recommended prompt snippet";

  const promptRecommendedCopy = document.createElement("p");
  promptRecommendedCopy.className = "weather-settings-section-copy";
  promptRecommendedCopy.textContent = "Place this directly in the active character or preset system prompt so the main model sees the weather instruction during generation.";

  promptRecommended.appendChild(promptRecommendedLabel);
  promptRecommended.appendChild(promptRecommendedCopy);
  promptRecommended.appendChild(createCodeBlock("{{weather_tracker}}"));

  const promptOptional = document.createElement("div");
  promptOptional.className = "weather-settings-copy-group";

  const promptOptionalLabel = document.createElement("strong");
  promptOptionalLabel.className = "weather-settings-copy-title";
  promptOptionalLabel.textContent = "Optional reference macros";

  const promptOptionalCopy = document.createElement("p");
  promptOptionalCopy.className = "weather-settings-section-copy";
  promptOptionalCopy.textContent = "These legacy aliases remain available for existing prompts. Current scene state is injected automatically; the format alias is useful only when you want to show the tag contract explicitly.";

  promptOptional.appendChild(promptOptionalLabel);
  promptOptional.appendChild(promptOptionalCopy);
  promptOptional.appendChild(createCodeBlock("{{weather_state}}\n{{weather_format}}"));

  promptSection.body.appendChild(promptRecommended);
  promptSection.body.appendChild(promptOptional);

  const effectsLabel = document.createElement("label");
  effectsLabel.className = "weather-settings-label";
  effectsLabel.textContent = "Animated effects";

  const effectsToggle = document.createElement("input");
  effectsToggle.type = "checkbox";
  effectsToggle.className = "weather-settings-checkbox";
  effectsToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { effectsEnabled: effectsToggle.checked } });
  });
  effectsLabel.appendChild(effectsToggle);

  const lightningLabel = document.createElement("label");
  lightningLabel.className = "weather-settings-label";
  lightningLabel.textContent = "Lightning flashes";

  const lightningToggle = document.createElement("input");
  lightningToggle.type = "checkbox";
  lightningToggle.className = "weather-settings-checkbox";
  lightningToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { lightningFlashEnabled: lightningToggle.checked } });
  });
  lightningLabel.appendChild(lightningToggle);

  const layerLabel = document.createElement("label");
  layerLabel.className = "weather-settings-label";
  layerLabel.textContent = "Effect placement";

  const layerSelect = document.createElement("select");
  layerSelect.className = "weather-settings-select";
  layerSelect.innerHTML = `
    <option value="back">Back only</option>
    <option value="front">Front only</option>
    <option value="both">Front and back</option>
  `;
  layerSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { layerMode: layerSelect.value } });
  });
  layerLabel.appendChild(layerSelect);

  const temperatureUnitLabel = document.createElement("label");
  temperatureUnitLabel.className = "weather-settings-label";
  temperatureUnitLabel.textContent = "Temperature unit";

  const temperatureUnitSelect = document.createElement("select");
  temperatureUnitSelect.className = "weather-settings-select";
  temperatureUnitSelect.innerHTML = `
    <option value="fahrenheit">Fahrenheit</option>
    <option value="celsius">Celsius</option>
  `;
  temperatureUnitSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { temperatureUnit: temperatureUnitSelect.value } });
  });
  temperatureUnitLabel.appendChild(temperatureUnitSelect);

  const intensityLabel = document.createElement("label");
  intensityLabel.className = "weather-settings-label";
  intensityLabel.textContent = "Animation intensity";

  const intensityRow = document.createElement("div");
  intensityRow.className = "weather-settings-row";

  const intensitySlider = document.createElement("input");
  intensitySlider.type = "range";
  intensitySlider.className = "weather-settings-range";
  intensitySlider.min = "0.25";
  intensitySlider.max = "1.50";
  intensitySlider.step = "0.05";

  const intensityValue = document.createElement("span");
  intensityValue.className = "weather-settings-value";

  intensitySlider.addEventListener("input", () => {
    intensityValue.textContent = `${Math.round(Number.parseFloat(intensitySlider.value) * 100)}%`;
    if (intensitySaveTimer !== null) window.clearTimeout(intensitySaveTimer);
    intensitySaveTimer = window.setTimeout(() => {
      sendToBackend({ type: "save_prefs", prefs: { intensity: Number.parseFloat(intensitySlider.value) } });
      intensitySaveTimer = null;
    }, 120);
  });

  intensityRow.appendChild(intensitySlider);
  intensityRow.appendChild(intensityValue);
  intensityLabel.appendChild(intensityRow);

  const motionLabel = document.createElement("label");
  motionLabel.className = "weather-settings-label";
  motionLabel.textContent = "Reduced motion";

  const motionSelect = document.createElement("select");
  motionSelect.className = "weather-settings-select";
  motionSelect.innerHTML = `
    <option value="never">Always animate</option>
    <option value="system">Follow system setting</option>
    <option value="always">Always reduce motion</option>
  `;
  motionSelect.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { reducedMotion: motionSelect.value } });
  });
  motionLabel.appendChild(motionSelect);

  const pauseLabel = document.createElement("label");
  pauseLabel.className = "weather-settings-label";
  pauseLabel.textContent = "Pause motion";

  const pauseToggle = document.createElement("input");
  pauseToggle.type = "checkbox";
  pauseToggle.className = "weather-settings-checkbox";
  pauseToggle.addEventListener("change", () => {
    sendToBackend({ type: "save_prefs", prefs: { pauseEffects: pauseToggle.checked } });
  });
  pauseLabel.appendChild(pauseToggle);

  effectsSection.body.appendChild(effectsLabel);
  effectsSection.body.appendChild(lightningLabel);
  placementSection.body.appendChild(layerLabel);
  placementSection.body.appendChild(temperatureUnitLabel);
  motionSection.body.appendChild(intensityLabel);
  motionSection.body.appendChild(motionLabel);
  motionSection.body.appendChild(pauseLabel);

  const manualCard = document.createElement("section");
  manualCard.className = "weather-settings-manual-card weather-settings-glass-panel";

  const manualHeader = document.createElement("div");
  manualHeader.className = "weather-settings-manual-header";

  const manualTitleWrap = document.createElement("div");
  manualTitleWrap.className = "weather-settings-manual-titlewrap";

  const manualEyebrow = document.createElement("span");
  manualEyebrow.className = "weather-settings-section-title";
  manualEyebrow.textContent = "Manual scene";

  const manualTitle = document.createElement("strong");
  manualTitle.textContent = "Lock the current chat to a custom weather scene";

  manualTitleWrap.appendChild(manualEyebrow);
  manualTitleWrap.appendChild(manualTitle);

  const manualModePill = document.createElement("span");
  manualModePill.className = "weather-settings-status-pill";

  manualHeader.appendChild(manualTitleWrap);
  manualHeader.appendChild(manualModePill);

  const manualHint = document.createElement("p");
  manualHint.className = "weather-settings-manual-hint";
  manualHint.textContent = "Quick presets apply immediately. The full editor below lets you refine the current scene and keep it locked until you resume story sync.";

  const manualError = document.createElement("p");
  manualError.className = "weather-settings-error";
  manualError.setAttribute("role", "alert");
  manualError.hidden = true;

  const manualToggle = document.createElement("input");
  manualToggle.type = "checkbox";
  manualToggle.className = "weather-settings-checkbox";
  const manualToggleLabel = createLabeledInput("Manual override", manualToggle);

  const presetGrid = document.createElement("div");
  presetGrid.className = "weather-settings-preset-grid";
  const presetButtons = new Map<string, HTMLButtonElement>();

  const conditionSelect = document.createElement("select");
  conditionSelect.className = "weather-settings-select";
  conditionSelect.innerHTML = CONDITIONS.map((condition) => `<option value="${condition}">${condition}</option>`).join("");

  const paletteSelect = document.createElement("select");
  paletteSelect.className = "weather-settings-select";
  paletteSelect.innerHTML = PALETTES.map((palette) => `<option value="${palette}">${palette}</option>`).join("");

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "weather-settings-input";

  const locationInput = document.createElement("input");
  locationInput.type = "text";
  locationInput.className = "weather-settings-input";
  locationInput.placeholder = "Example Location";

  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "weather-settings-input";
  timeInput.placeholder = "3:00 PM";

  const temperatureInput = document.createElement("input");
  temperatureInput.type = "text";
  temperatureInput.className = "weather-settings-input";
  temperatureInput.placeholder = "61F or 16C";

  const windInput = document.createElement("input");
  windInput.type = "text";
  windInput.className = "weather-settings-input";
  windInput.placeholder = "breezy";

  const windDirectionSelect = document.createElement("select");
  windDirectionSelect.className = "weather-settings-select";
  windDirectionSelect.innerHTML = WEATHER_WIND_DIRECTIONS.map((direction) =>
    `<option value="${direction}">${direction.charAt(0).toUpperCase()}${direction.slice(1)}</option>`,
  ).join("");

  const windControls = document.createElement("div");
  windControls.className = "weather-settings-wind-controls";
  windControls.appendChild(windInput);
  windControls.appendChild(windDirectionSelect);

  const summaryInput = document.createElement("input");
  summaryInput.type = "text";
  summaryInput.className = "weather-settings-input";
  summaryInput.placeholder = "Steady afternoon rain";

  const sceneIntensityRow = document.createElement("div");
  sceneIntensityRow.className = "weather-settings-row";
  const sceneIntensity = document.createElement("input");
  sceneIntensity.type = "range";
  sceneIntensity.className = "weather-settings-range";
  sceneIntensity.min = "0.00";
  sceneIntensity.max = "1.00";
  sceneIntensity.step = "0.05";
  const sceneIntensityValue = document.createElement("span");
  sceneIntensityValue.className = "weather-settings-value";
  sceneIntensity.addEventListener("input", () => {
    manualDraftDirty = true;
    manualError.hidden = true;
    sceneIntensityValue.textContent = `${Math.round(Number.parseFloat(sceneIntensity.value) * 100)}%`;
  });
  sceneIntensityRow.appendChild(sceneIntensity);
  sceneIntensityRow.appendChild(sceneIntensityValue);

  const fields = {
    conditionSelect,
    paletteSelect,
    locationInput,
    dateInput,
    timeInput,
    temperatureInput,
    windInput,
    windDirectionSelect,
    summaryInput,
    sceneIntensity,
    sceneIntensityValue,
  };

  let currentState: WeatherState | null = null;
  let manualDraftDirty = false;
  let intensitySaveTimer: number | null = null;

  const markManualDraftDirty = () => {
    manualDraftDirty = true;
    manualError.hidden = true;
  };

  for (const field of [conditionSelect, paletteSelect, dateInput, locationInput, timeInput, temperatureInput, windInput, windDirectionSelect, summaryInput]) {
    field.addEventListener("input", markManualDraftDirty);
    field.addEventListener("change", markManualDraftDirty);
  }

  const buildManualState = (): Partial<WeatherState> => ({
    location: locationInput.value.trim() || currentState?.location,
    date: dateInput.value || currentState?.date,
    time: timeInput.value.trim() || currentState?.time,
    condition: conditionSelect.value as WeatherCondition,
    summary: summaryInput.value.trim() || currentState?.summary,
    temperature: temperatureInput.value.trim() || currentState?.temperature,
    wind: windInput.value.trim() || currentState?.wind,
    windDirection: windDirectionSelect.value as WeatherWindDirection,
    palette: paletteSelect.value as WeatherPalette,
    intensity: Number.parseFloat(sceneIntensity.value),
    source: "manual",
  });

  const updatePresetSelection = (state: WeatherState | null) => {
    const activePresetId = matchWeatherScenePreset(state);
    for (const [presetId, button] of presetButtons) {
      button.classList.toggle("weather-settings-preset-active", presetId === activePresetId);
    }
  };

  const applyManualState = (state?: Partial<WeatherState>) => {
    const nextState = state ?? buildManualState();
    const hasDate = typeof nextState.date === "string" && nextState.date.trim();
    const hasTime = typeof nextState.time === "string" && nextState.time.trim();
    if ((hasDate && !hasTime) || (!hasDate && hasTime) || (hasDate && hasTime && parseStoryDateTime(nextState.date!, nextState.time!) === null)) {
      manualError.textContent = "Use a valid story date and time, such as 2026-01-15 and 3:00 PM.";
      manualError.hidden = false;
      return;
    }
    if (typeof nextState.temperature === "string" && nextState.temperature.trim() && !/^-?\d+(?:\.\d+)?\s*°?\s*(?:F|C|fahrenheit|celsius)$/i.test(nextState.temperature.trim())) {
      manualError.textContent = "Temperature must include a numeric value and F or C, such as 61F or 16C.";
      manualError.hidden = false;
      return;
    }
    manualDraftDirty = false;
    manualError.hidden = true;
    sendToBackend({ type: "set_manual_state", state: nextState });
  };

  for (const preset of WEATHER_SCENE_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weather-settings-preset";
    button.innerHTML = `
      <span class="weather-settings-preset-label">${preset.label}</span>
      <span class="weather-settings-preset-copy">${preset.description}</span>
    `;
    button.addEventListener("click", () => {
      const nextState = buildPresetWeatherState(preset.id, currentState);
      if (!nextState) return;
      manualToggle.checked = true;
      applyStateToInputs(nextState, fields);
      manualDraftDirty = false;
      applyManualState(nextState);
    });
    presetButtons.set(preset.id, button);
    presetGrid.appendChild(button);
  }

  manualToggle.addEventListener("change", () => {
    if (manualToggle.checked) {
      applyManualState();
    } else {
      manualDraftDirty = false;
      sendToBackend({ type: "clear_manual_override" });
    }
  });

  const manualGrid = document.createElement("div");
  manualGrid.className = "weather-settings-manual-grid";
  manualGrid.appendChild(createLabeledInput("Condition", conditionSelect));
  manualGrid.appendChild(createLabeledInput("Palette", paletteSelect));
  manualGrid.appendChild(createLabeledInput("Location", locationInput));
  manualGrid.appendChild(createLabeledInput("Story date", dateInput));
  manualGrid.appendChild(createLabeledInput("Story time", timeInput));
  manualGrid.appendChild(createLabeledInput("Temperature", temperatureInput));
  manualGrid.appendChild(createLabeledInput("Wind", windControls));
  manualGrid.appendChild(createLabeledInput("Summary", summaryInput));

  const sceneIntensityLabel = createLabeledInput("Scene intensity", sceneIntensityRow);

  const manualActions = document.createElement("div");
  manualActions.className = "weather-settings-actions";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "weather-settings-button weather-settings-button-primary";
  applyButton.textContent = "Apply manual weather";
  applyButton.addEventListener("click", () => {
    manualToggle.checked = true;
    applyManualState();
  });

  const resumeButton = document.createElement("button");
  resumeButton.type = "button";
  resumeButton.className = "weather-settings-button";
  resumeButton.textContent = "Resume story sync";
  resumeButton.addEventListener("click", () => {
    manualToggle.checked = false;
    manualDraftDirty = false;
    sendToBackend({ type: "clear_manual_override" });
  });

  manualActions.appendChild(applyButton);
  manualActions.appendChild(resumeButton);

  manualCard.appendChild(manualHeader);
  manualCard.appendChild(manualHint);
  manualCard.appendChild(manualError);
  manualCard.appendChild(manualToggleLabel);
  manualCard.appendChild(presetGrid);
  manualCard.appendChild(manualGrid);
  manualCard.appendChild(sceneIntensityLabel);
  manualCard.appendChild(manualActions);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "weather-settings-button";
  resetButton.textContent = "Reset HUD position";
  resetButton.addEventListener("click", () => {
    sendToBackend({ type: "reset_widget_position" });
  });

  const controlDeck = document.createElement("div");
  controlDeck.className = "weather-settings-control-deck";
  controlDeck.appendChild(effectsSection.section);
  controlDeck.appendChild(placementSection.section);
  controlDeck.appendChild(motionSection.section);

  body.appendChild(preview);
  body.appendChild(promptSection.section);
  body.appendChild(controlDeck);
  body.appendChild(manualCard);
  body.appendChild(resetButton);

  root.appendChild(header);
  root.appendChild(body);

  return {
    root,
    sync(prefs, state, statusOverride) {
      currentState = state;
      effectsToggle.checked = prefs.effectsEnabled;
      lightningToggle.checked = prefs.lightningFlashEnabled;
      layerSelect.value = prefs.layerMode;
      temperatureUnitSelect.value = prefs.temperatureUnit;
      intensitySlider.value = String(prefs.intensity.toFixed(2));
      intensityValue.textContent = `${Math.round(prefs.intensity * 100)}%`;
      motionSelect.value = prefs.reducedMotion;
      pauseToggle.checked = prefs.pauseEffects;

      const chatAvailable = statusOverride !== "No active chat";
      manualToggle.disabled = !chatAvailable;
      applyButton.disabled = !chatAvailable;
      resumeButton.disabled = !chatAvailable || !state || state.source === "story";
      for (const button of presetButtons.values()) button.disabled = !chatAvailable;

      const displayTemperature = state ? formatTemperatureForUnit(state.temperature, prefs.temperatureUnit) : "";

      const stateMode = statusOverride ? "notice" : state?.source ?? "waiting";
      status.dataset.mode = stateMode;
      preview.dataset.mode = stateMode;
      preview.dataset.condition = state?.condition ?? "waiting";

      status.textContent = statusOverride ?? (state
        ? `${state.source === "manual" ? "manual" : "story"} / ${state.condition} ${displayTemperature} · synced ${formatRelativeTime(state.updatedAt)}`
        : "Waiting for LumiWeather");

      previewValue.textContent = state
        ? `${state.location} | ${state.date} at ${state.time} | ${displayTemperature} | ${state.summary} | ${state.wind}${state.windDirection === "none" ? "" : ` from ${state.windDirection}`} | placement ${prefs.layerMode}`
        : "Add {{weather_tracker}} to the active prompt, then the HUD will wake up as soon as the model emits its first weather-state tag.";

      manualModePill.textContent = state?.source === "manual" ? "Manual lock" : "Story sync";
      manualModePill.dataset.mode = state?.source === "manual" ? "manual" : "story";
      manualToggle.checked = state?.source === "manual";

      if (state && !manualDraftDirty) {
        applyStateToInputs(state, fields);
      } else if (!state && !manualDraftDirty) {
        conditionSelect.value = "clear";
        paletteSelect.value = "day";
        locationInput.value = "";
        dateInput.value = "";
        timeInput.value = "";
        temperatureInput.value = "";
        windInput.value = "";
        windDirectionSelect.value = "none";
        summaryInput.value = "";
        sceneIntensity.value = "0.30";
        sceneIntensityValue.textContent = "30%";
      }

      updatePresetSelection(state);
    },
    destroy() {
      if (intensitySaveTimer !== null) window.clearTimeout(intensitySaveTimer);
      root.remove();
    },
  };
}
