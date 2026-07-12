// src/shared.ts
var WEATHER_TAG_NAME = "weather-state";
var DEFAULT_PREFS = {
  effectsEnabled: true,
  layerMode: "both",
  intensity: 1,
  reducedMotion: "system",
  temperatureUnit: "fahrenheit",
  pauseEffects: false,
  widgetPosition: null
};
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function formatTime(date) {
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${pad2(date.getMinutes())} ${suffix}`;
}
function parseHourFromTimeString(timeValue) {
  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*:\s*(\d{2}))?\s*([AP]M)$/i);
  if (time12) {
    let hours2 = Number.parseInt(time12[1], 10);
    if (hours2 < 1 || hours2 > 12)
      return null;
    const minutes2 = Number.parseInt(time12[2], 10);
    const seconds2 = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (minutes2 > 59 || seconds2 > 59)
      return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours2 < 12)
      hours2 += 12;
    if (meridiem === "AM" && hours2 === 12)
      hours2 = 0;
    return hours2;
  }
  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!time24)
    return null;
  const hours = Number.parseInt(time24[1], 10);
  const minutes = Number.parseInt(time24[2], 10);
  const seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59)
    return null;
  return hours;
}
function parseStoryDateTime(dateValue, timeValue) {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch)
    return null;
  const normalizedTime = timeValue.trim();
  const time12 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
  const time24 = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (time12) {
    hours = Number.parseInt(time12[1], 10);
    minutes = Number.parseInt(time12[2], 10);
    seconds = time12[3] ? Number.parseInt(time12[3], 10) : 0;
    if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59)
      return null;
    const meridiem = time12[4].toUpperCase();
    if (meridiem === "PM" && hours < 12)
      hours += 12;
    if (meridiem === "AM" && hours === 12)
      hours = 0;
  } else if (time24) {
    hours = Number.parseInt(time24[1], 10);
    minutes = Number.parseInt(time24[2], 10);
    seconds = time24[3] ? Number.parseInt(time24[3], 10) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59)
      return null;
  } else {
    return null;
  }
  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day || parsed.getHours() !== hours || parsed.getMinutes() !== minutes || parsed.getSeconds() !== seconds) {
    return null;
  }
  return parsed.getTime();
}
function derivePalette(condition, dateValue, timeValue) {
  if (condition === "storm")
    return "storm";
  if (condition === "fog")
    return "mist";
  if (condition === "snow")
    return "snow";
  const timestamp = parseStoryDateTime(dateValue, timeValue);
  if (timestamp !== null) {
    const hour2 = new Date(timestamp).getHours();
    if (hour2 < 6)
      return "night";
    if (hour2 < 10)
      return "dawn";
    if (hour2 < 18)
      return "day";
    if (hour2 < 21)
      return "dusk";
    return "night";
  }
  const hour = parseHourFromTimeString(timeValue);
  if (hour === null)
    return condition === "cloudy" || condition === "rain" ? "dusk" : "day";
  if (hour < 6)
    return "night";
  if (hour < 10)
    return "dawn";
  if (hour < 18)
    return "day";
  if (hour < 21)
    return "dusk";
  return "night";
}
function makeDefaultWeatherState(now = Date.now()) {
  const date = new Date(now);
  const dateValue = formatDate(date);
  const timeValue = formatTime(date);
  return {
    location: "Story setting",
    date: dateValue,
    time: timeValue,
    condition: "clear",
    summary: "Calm skies",
    temperature: "68F",
    intensity: 0.3,
    wind: "still",
    windDirection: "none",
    palette: derivePalette("clear", dateValue, timeValue),
    updatedAt: now,
    source: "story"
  };
}
function formatTemperatureForUnit(value, unit) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\u00b0?\s*([FC])(?:ahrenheit|elsius)?\b/i);
  if (!match)
    return trimmed;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount))
    return trimmed;
  const sourceUnit = match[2].toUpperCase() === "C" ? "celsius" : "fahrenheit";
  if (sourceUnit === unit) {
    return `${Math.round(amount)}${unit === "celsius" ? "C" : "F"}`;
  }
  const converted = unit === "celsius" ? (amount - 32) * (5 / 9) : amount * (9 / 5) + 32;
  return `${Math.round(converted)}${unit === "celsius" ? "C" : "F"}`;
}

// src/presets.ts
var WEATHER_SCENE_PRESETS = [
  {
    id: "clear-day",
    label: "Clear day",
    shortLabel: "Day",
    description: "Bright open skies with a soft daylight bloom.",
    state: {
      time: "1:18 PM",
      condition: "clear",
      summary: "Bright open skies",
      temperature: "72F",
      wind: "light breeze",
      palette: "day",
      intensity: 0.34
    }
  },
  {
    id: "overcast",
    label: "Overcast",
    shortLabel: "Overcast",
    description: "Muted daylight under a heavy cloud ceiling.",
    state: {
      time: "11:26 AM",
      condition: "cloudy",
      summary: "Heavy overcast",
      temperature: "63F",
      wind: "cool drift",
      palette: "day",
      intensity: 0.58
    }
  },
  {
    id: "rain",
    label: "Rain",
    shortLabel: "Rain",
    description: "Steady angled rain with a low mist at the base of the scene.",
    state: {
      time: "5:42 PM",
      condition: "rain",
      summary: "Rain sweeping through",
      temperature: "61F",
      wind: "steady rainwind",
      palette: "dusk",
      intensity: 0.74
    }
  },
  {
    id: "storm",
    label: "Storm",
    shortLabel: "Storm",
    description: "Dark thunderheads, hard rain, and intermittent flashes.",
    state: {
      time: "8:18 PM",
      condition: "storm",
      summary: "Thunderheads building",
      temperature: "58F",
      wind: "hard gusts",
      palette: "storm",
      intensity: 0.94
    }
  },
  {
    id: "snow",
    label: "Snow",
    shortLabel: "Snow",
    description: "Layered snowfall with a cold, luminous atmosphere.",
    state: {
      time: "6:48 AM",
      condition: "snow",
      summary: "Quiet snowfall",
      temperature: "29F",
      wind: "hushed air",
      palette: "snow",
      intensity: 0.68
    }
  },
  {
    id: "fog",
    label: "Fog",
    shortLabel: "Fog",
    description: "Low fog pooling through the lower scene.",
    state: {
      time: "6:12 AM",
      condition: "fog",
      summary: "Fog pooling low",
      temperature: "54F",
      wind: "still",
      palette: "mist",
      intensity: 0.64
    }
  },
  {
    id: "clear-night",
    label: "Clear night",
    shortLabel: "Night",
    description: "Clean night air with a cool moonlit palette.",
    state: {
      time: "10:18 PM",
      condition: "clear",
      summary: "Clear night air",
      temperature: "57F",
      wind: "light night wind",
      palette: "night",
      intensity: 0.24
    }
  }
];
function getWeatherScenePreset(presetId) {
  return WEATHER_SCENE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
function buildPresetWeatherState(presetId, currentState) {
  const preset = getWeatherScenePreset(presetId);
  if (!preset)
    return null;
  const baseState = currentState ?? makeDefaultWeatherState();
  const fallbackDate = /^\d{4}-\d{2}-\d{2}$/.test(baseState.date) ? baseState.date : formatDate(new Date);
  return {
    location: baseState.location,
    date: fallbackDate,
    ...preset.state,
    source: "manual"
  };
}
function matchWeatherScenePreset(state) {
  if (!state)
    return null;
  const match = WEATHER_SCENE_PRESETS.find((preset) => preset.state.condition === state.condition && preset.state.palette === state.palette && preset.state.time === state.time && preset.state.summary === state.summary && preset.state.temperature === state.temperature && preset.state.wind === state.wind && Math.abs(preset.state.intensity - state.intensity) < 0.001);
  return match?.id ?? null;
}

// src/fx-utils.ts
function resolveRainParticlePool(compact) {
  return compact ? { back: 60, front: 42 } : { back: 96, front: 72 };
}
function resolveRainDensityThreshold(index, total) {
  if (total <= 0)
    return 1;
  return clamp((index + 0.5) / total, 0, 1);
}
function resolveRainProfile(intensity, condition) {
  const rainLike = condition === "rain" || condition === "storm";
  if (!rainLike) {
    return { density: 0, opacityScale: 0, speedScale: 1 };
  }
  const normalizedIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1.5);
  const densityIntensity = clamp(normalizedIntensity, 0, 1);
  const stormBoost = condition === "storm" ? 0.08 : 0;
  return {
    density: clamp(0.15 + 0.9 * densityIntensity + stormBoost, 0.15, 1),
    opacityScale: clamp(0.42 + 0.76 * densityIntensity + stormBoost, 0.25, 1.12),
    speedScale: clamp(1.12 - 0.24 * densityIntensity - stormBoost, 0.76, 1.12)
  };
}
function directionFromSource(source) {
  if (source.includes("west"))
    return 1;
  if (source.includes("east"))
    return -1;
  return 0;
}
function resolveRainVector(wind, windDirection) {
  const normalized = wind.trim().toLowerCase();
  const strength = /hurricane|violent|gale|hard|strong|gust/.test(normalized) ? 20 : /steady|breezy|windy|crosswind/.test(normalized) ? 14 : /light|soft|cool drift/.test(normalized) ? 9 : /still|calm|hushed/.test(normalized) ? 4 : 11;
  let driftDirection;
  if (windDirection === "none" || windDirection === "north" || windDirection === "south") {
    driftDirection = 0;
  } else if (windDirection) {
    driftDirection = directionFromSource(windDirection);
  } else {
    const target = normalized.match(/\b(?:to|toward|towards|blowing)\s+(?:the\s+)?(left|right|east|west)\b/)?.[1];
    if (target === "right" || target === "east") {
      driftDirection = 1;
    } else if (target === "left" || target === "west") {
      driftDirection = -1;
    } else {
      const source = normalized.match(/\bfrom\s+(?:the\s+)?(northeast|northwest|southeast|southwest|north|south|east|west)\b/)?.[1];
      if (source) {
        driftDirection = directionFromSource(source);
      } else if (/\b(?:eastward|rightward)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:westward|leftward)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:westerly|western wind|west wind|northwest|southwest)\b/.test(normalized)) {
        driftDirection = 1;
      } else if (/\b(?:easterly|eastern wind|east wind|northeast|southeast)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:left)\b/.test(normalized)) {
        driftDirection = -1;
      } else if (/\b(?:right)\b/.test(normalized)) {
        driftDirection = 1;
      } else {
        driftDirection = -1;
      }
    }
  }
  return {
    angle: driftDirection === 0 ? 0 : driftDirection > 0 ? -strength : strength,
    driftDirection
  };
}

// src/state-utils.ts
function shouldApplyChatState(currentChatId, responseChatId, responseRequestId, activeRequestId) {
  if (responseRequestId !== undefined)
    return responseRequestId === activeRequestId;
  return activeRequestId === 0 || responseChatId === currentChatId;
}

// src/ui/settings.ts
var CONDITIONS = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
var PALETTES = ["dawn", "day", "dusk", "night", "storm", "mist", "snow"];
function createCodeBlock(text) {
  const code = document.createElement("pre");
  code.className = "weather-settings-code";
  code.textContent = text;
  return code;
}
function createLabeledInput(labelText, input) {
  const label = document.createElement("label");
  label.className = "weather-settings-label";
  label.textContent = labelText;
  label.appendChild(input);
  return label;
}
function createSection(titleText, copyText) {
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
function formatRelativeTime(timestampMs) {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 10)
    return "just now";
  if (seconds < 60)
    return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)
    return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
function applyStateToInputs(state, fields) {
  if (state.condition)
    fields.conditionSelect.value = state.condition;
  if (state.palette)
    fields.paletteSelect.value = state.palette;
  if (state.location)
    fields.locationInput.value = state.location;
  if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date))
    fields.dateInput.value = state.date;
  if (state.time)
    fields.timeInput.value = state.time;
  if (state.temperature)
    fields.temperatureInput.value = state.temperature;
  if (state.wind)
    fields.windInput.value = state.wind;
  if (state.summary)
    fields.summaryInput.value = state.summary;
  if (typeof state.intensity === "number" && Number.isFinite(state.intensity)) {
    fields.sceneIntensity.value = state.intensity.toFixed(2);
    fields.sceneIntensityValue.textContent = `${Math.round(state.intensity * 100)}%`;
  }
}
function createSettingsUI(sendToBackend) {
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
  const promptSection = createSection("Prompt integration", "To make the main model emit the hidden weather tag consistently, add the recommended macro to your system prompt or preset, just like simtracker uses {{sim_tracker}}.");
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
  promptOptional.appendChild(createCodeBlock(`{{weather_state}}
{{weather_format}}`));
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
    if (intensitySaveTimer !== null)
      window.clearTimeout(intensitySaveTimer);
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
  const presetButtons = new Map;
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
    summaryInput,
    sceneIntensity,
    sceneIntensityValue
  };
  let currentState = null;
  let manualDraftDirty = false;
  let intensitySaveTimer = null;
  const markManualDraftDirty = () => {
    manualDraftDirty = true;
    manualError.hidden = true;
  };
  for (const field of [conditionSelect, paletteSelect, dateInput, locationInput, timeInput, temperatureInput, windInput, summaryInput]) {
    field.addEventListener("input", markManualDraftDirty);
    field.addEventListener("change", markManualDraftDirty);
  }
  const buildManualState = () => ({
    location: locationInput.value.trim() || currentState?.location,
    date: dateInput.value || currentState?.date,
    time: timeInput.value.trim() || currentState?.time,
    condition: conditionSelect.value,
    summary: summaryInput.value.trim() || currentState?.summary,
    temperature: temperatureInput.value.trim() || currentState?.temperature,
    wind: windInput.value.trim() || currentState?.wind,
    palette: paletteSelect.value,
    intensity: Number.parseFloat(sceneIntensity.value),
    source: "manual"
  });
  const updatePresetSelection = (state) => {
    const activePresetId = matchWeatherScenePreset(state);
    for (const [presetId, button] of presetButtons) {
      button.classList.toggle("weather-settings-preset-active", presetId === activePresetId);
    }
  };
  const applyManualState = (state) => {
    const nextState = state ?? buildManualState();
    const hasDate = typeof nextState.date === "string" && nextState.date.trim();
    const hasTime = typeof nextState.time === "string" && nextState.time.trim();
    if (hasDate && !hasTime || !hasDate && hasTime || hasDate && hasTime && parseStoryDateTime(nextState.date, nextState.time) === null) {
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
      if (!nextState)
        return;
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
  manualGrid.appendChild(createLabeledInput("Wind", windInput));
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
      for (const button of presetButtons.values())
        button.disabled = !chatAvailable;
      const displayTemperature = state ? formatTemperatureForUnit(state.temperature, prefs.temperatureUnit) : "";
      const stateMode = statusOverride ? "notice" : state?.source ?? "waiting";
      status.dataset.mode = stateMode;
      preview.dataset.mode = stateMode;
      preview.dataset.condition = state?.condition ?? "waiting";
      status.textContent = statusOverride ?? (state ? `${state.source === "manual" ? "manual" : "story"} / ${state.condition} ${displayTemperature} · synced ${formatRelativeTime(state.updatedAt)}` : "Waiting for LumiWeather");
      previewValue.textContent = state ? `${state.location} | ${state.date} at ${state.time} | ${displayTemperature} | ${state.summary} | ${state.wind} | placement ${prefs.layerMode}` : "Add {{weather_tracker}} to the active prompt, then the HUD will wake up as soon as the model emits its first weather-state tag.";
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
        summaryInput.value = "";
        sceneIntensity.value = "0.30";
        sceneIntensityValue.textContent = "30%";
      }
      updatePresetSelection(state);
    },
    destroy() {
      if (intensitySaveTimer !== null)
        window.clearTimeout(intensitySaveTimer);
      root.remove();
    }
  };
}

// src/ui/styles.ts
var WEATHER_HUD_CSS = `
@property --weather-bg-start {
  syntax: "<color>";
  inherits: true;
  initial-value: #4d77ad;
}

@property --weather-bg-mid {
  syntax: "<color>";
  inherits: true;
  initial-value: #7fa8de;
}

@property --weather-bg-end {
  syntax: "<color>";
  inherits: true;
  initial-value: #d8ebff;
}

@property --weather-glow {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 243, 202, 0.78);
}

@property --weather-beam-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 244, 212, 0.44);
}

@property --weather-horizon-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(185, 212, 244, 0.28);
}

@property --weather-cloud-core {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(237, 244, 255, 0.34);
}

@property --weather-cloud-edge {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 255, 255, 0.12);
}

@property --weather-fog-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(236, 241, 255, 0.18);
}

@property --weather-mist-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(228, 238, 248, 0.24);
}

@property --weather-sky-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.05;
}

@property --weather-glow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.1;
}

@property --weather-beam-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.12;
}

@property --weather-cloud-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.06;
}

@property --weather-horizon-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-mist-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.03;
}

@property --weather-fog-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-rain-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-snow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-mote-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-flash-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.26;
}

.weather-settings-card {
  width: 100%;
  border: 1px solid var(--lumiverse-border);
  border-radius: calc(var(--lumiverse-radius) + 2px);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
  color: var(--lumiverse-text);
  overflow: hidden;
}

.weather-settings-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--lumiverse-border);
}

.weather-settings-card-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.weather-settings-status {
  font-size: 11px;
  color: var(--lumiverse-text-muted);
  text-transform: capitalize;
}

.weather-settings-card-body {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.weather-settings-preview {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 84%, transparent);
  font-size: 11px;
  line-height: 1.5;
  color: var(--lumiverse-text);
}

.weather-settings-section,
.weather-settings-manual-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
}

.weather-settings-section-header {
  display: grid;
  gap: 6px;
}

.weather-settings-section-body {
  display: grid;
  gap: 10px;
}

.weather-settings-section-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--lumiverse-text-muted);
}

.weather-settings-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-danger, #ef4444) 28%, transparent);
  background: color-mix(in srgb, var(--lumiverse-danger, #ef4444) 10%, transparent);
  color: var(--lumiverse-danger, #ef4444);
  font-size: 11px;
  line-height: 1.4;
}

.weather-settings-copy-group {
  display: grid;
  gap: 6px;
}

.weather-settings-copy-title {
  font-size: 11px;
  color: color-mix(in srgb, var(--lumiverse-text) 92%, transparent);
}

.weather-settings-code {
  margin: 0;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 90%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 96%, transparent);
  color: color-mix(in srgb, var(--lumiverse-text) 94%, transparent);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

.weather-settings-label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--lumiverse-text-muted);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button,
.weather-hud-select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 92%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  font-size: 12px;
}

.weather-settings-button {
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-button:hover {
  border-color: var(--lumiverse-border-hover);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 90%, transparent);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 26%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 12%, var(--lumiverse-fill));
  color: var(--lumiverse-text);
}

.weather-settings-button-primary:hover {
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 18%, var(--lumiverse-fill-subtle));
}

.weather-settings-button:disabled,
.weather-settings-checkbox:disabled,
.weather-settings-select:disabled,
.weather-settings-input:disabled,
.weather-settings-range:disabled,
.weather-hud-control:disabled,
.weather-hud-chip:disabled,
.weather-hud-preset:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.weather-settings-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
}

.weather-settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.weather-settings-range,
.weather-hud-range {
  width: 100%;
}

.weather-settings-value {
  min-width: 44px;
  text-align: right;
  font-size: 11px;
  color: var(--lumiverse-text);
}

.weather-settings-manual-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 10px;
}

.weather-settings-manual-titlewrap {
  display: grid;
  gap: 4px;
}

.weather-settings-manual-titlewrap strong {
  font-size: 13px;
}

.weather-settings-status-pill {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
}

.weather-settings-status-pill[data-mode="manual"] {
  color: var(--lumiverse-text);
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 22%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill));
}

.weather-settings-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.weather-settings-preset {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 24%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill-subtle));
}

.weather-settings-preset-label {
  font-size: 11px;
  font-weight: 600;
}

.weather-settings-preset-copy {
  font-size: 10px;
  line-height: 1.35;
  color: var(--lumiverse-text-muted);
}

.weather-settings-manual-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-settings-actions {
  display: flex;
  gap: 8px;
}

.weather-settings-actions .weather-settings-button {
  flex: 1 1 0;
}

/* LumiWeather Studio: layered glass control surface. */
.weather-settings-card {
  --lumi-glass-fill: color-mix(in srgb, var(--lumiverse-fill, #101827) 72%, rgba(25, 50, 87, 0.64));
  --lumi-glass-soft: color-mix(in srgb, var(--lumiverse-fill-subtle, #172338) 68%, rgba(116, 168, 255, 0.1));
  --lumi-glass-line: color-mix(in srgb, var(--lumiverse-border, #33425a) 68%, rgba(183, 220, 255, 0.32));
  position: relative;
  isolation: isolate;
  border: 1px solid var(--lumi-glass-line);
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 88% -12%, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 35%, transparent), transparent 46%),
    radial-gradient(ellipse at 6% 102%, rgba(99, 213, 255, 0.15), transparent 44%),
    linear-gradient(150deg, color-mix(in srgb, var(--lumi-glass-fill) 94%, #162842) 0%, var(--lumi-glass-fill) 52%, color-mix(in srgb, var(--lumi-glass-fill) 88%, #0c1422) 100%);
  box-shadow:
    0 28px 72px rgba(4, 12, 28, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(4, 10, 22, 0.18);
  backdrop-filter: blur(24px) saturate(145%);
}

.weather-settings-card::before,
.weather-settings-card::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

.weather-settings-card::before {
  inset: 0;
  opacity: 0.72;
  background:
    linear-gradient(112deg, rgba(255, 255, 255, 0.09), transparent 28%, transparent 72%, rgba(177, 214, 255, 0.08)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 4px);
  mix-blend-mode: screen;
}

.weather-settings-card::after {
  width: 260px;
  height: 260px;
  right: -130px;
  top: 88px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 30%, transparent), transparent 68%);
  filter: blur(10px);
}

.weather-settings-card-header {
  position: relative;
  z-index: 1;
  min-height: 60px;
  padding: 17px 18px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.018));
}

.weather-settings-header-glow {
  position: absolute;
  inset: -32px auto auto -26px;
  width: 176px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(132, 191, 255, 0.24), transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}

.weather-settings-titlewrap,
.weather-settings-status {
  position: relative;
  z-index: 1;
}

.weather-settings-titlewrap {
  display: grid;
  gap: 5px;
}

.weather-settings-eyebrow {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 78%, var(--lumiverse-text-muted));
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.weather-settings-card-header h3 {
  font-size: 18px;
  font-weight: 720;
  letter-spacing: -0.025em;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
}

.weather-settings-status {
  max-width: min(48%, 228px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--lumiverse-fill, #111c2c) 52%, rgba(255, 255, 255, 0.11));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  font-size: 10px;
  line-height: 1.25;
  text-align: right;
  text-transform: none;
}

.weather-settings-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 6px 1px 0;
  border-radius: 50%;
  background: #86d7ff;
  box-shadow: 0 0 12px rgba(134, 215, 255, 0.82);
}

.weather-settings-status[data-mode="manual"]::before {
  background: #f3c989;
  box-shadow: 0 0 12px rgba(243, 201, 137, 0.8);
}

.weather-settings-status[data-mode="notice"]::before,
.weather-settings-status[data-mode="waiting"]::before {
  background: #aab7c9;
  box-shadow: none;
}

.weather-settings-card-body {
  position: relative;
  z-index: 1;
  gap: 14px;
  padding: 15px;
}

.weather-settings-scene-hero {
  position: relative;
  display: grid;
  align-content: start;
  min-height: 102px;
  gap: 7px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 84%, transparent);
  border-radius: 19px;
  background:
    radial-gradient(circle at 86% 18%, var(--lumi-scene-glow, rgba(139, 200, 255, 0.32)), transparent 26%),
    linear-gradient(128deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.025) 48%, rgba(5, 16, 33, 0.16));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 14px 34px rgba(5, 14, 28, 0.12);
}

.weather-settings-preview-glow {
  position: absolute;
  width: 150px;
  height: 150px;
  right: -44px;
  bottom: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lumi-scene-glow, rgba(121, 185, 255, 0.38)), transparent 70%);
  filter: blur(4px);
}

.weather-settings-preview-label,
.weather-settings-preview-value,
.weather-settings-preview-hint {
  position: relative;
  z-index: 1;
}

.weather-settings-preview-label {
  color: var(--lumiverse-text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.weather-settings-preview-value {
  max-width: 76ch;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
  font-size: 12px;
  font-weight: 590;
  line-height: 1.48;
}

.weather-settings-preview-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 94%, white 6%);
  font-size: 10px;
}

.weather-settings-scene-hero[data-condition="rain"],
.weather-settings-scene-hero[data-condition="storm"] {
  --lumi-scene-glow: rgba(127, 167, 255, 0.34);
}

.weather-settings-scene-hero[data-condition="snow"] {
  --lumi-scene-glow: rgba(222, 240, 255, 0.4);
}

.weather-settings-scene-hero[data-condition="fog"] {
  --lumi-scene-glow: rgba(208, 225, 233, 0.3);
}

.weather-settings-glass-panel {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 82%, transparent);
  border-radius: 18px;
  background:
    linear-gradient(144deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 44%, rgba(0, 0, 0, 0.04)),
    var(--lumi-glass-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 12px 26px rgba(4, 13, 27, 0.1);
  backdrop-filter: blur(16px) saturate(135%);
}

.weather-settings-section,
.weather-settings-manual-card {
  gap: 12px;
  padding: 14px;
}

.weather-settings-section-header {
  gap: 7px;
}

.weather-settings-section-title {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 68%, var(--lumiverse-text-muted));
  font-weight: 720;
  letter-spacing: 0.15em;
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 92%, white 8%);
}

.weather-settings-control-deck {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.weather-settings-control-deck .weather-settings-section {
  min-width: 0;
}

.weather-settings-control-deck .weather-settings-section:nth-child(3) {
  grid-column: span 2;
}

.weather-settings-section-body,
.weather-settings-copy-group {
  gap: 9px;
}

.weather-settings-copy-group {
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 62%, transparent);
  border-radius: 13px;
  background: rgba(4, 14, 29, 0.1);
}

.weather-settings-copy-title {
  color: color-mix(in srgb, var(--lumiverse-text) 95%, white 5%);
}

.weather-settings-code {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 78%, transparent);
  border-radius: 12px;
  background: rgba(3, 12, 27, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.weather-settings-label {
  gap: 8px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 58%, transparent);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: color-mix(in srgb, var(--lumiverse-text-muted) 90%, white 10%);
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.weather-settings-label:focus-within {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 52%, var(--lumi-glass-line));
  background: rgba(117, 170, 255, 0.08);
  transform: translateY(-1px);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill, #101827) 58%, rgba(255, 255, 255, 0.12));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
}

.weather-settings-select,
.weather-settings-input {
  min-height: 35px;
}

.weather-settings-button {
  min-height: 37px;
  border-radius: 12px;
  font-weight: 620;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 18px rgba(4, 13, 28, 0.09);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 56%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 42%, rgba(255, 255, 255, 0.12)), color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 20%, rgba(9, 23, 46, 0.5)));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.19), 0 10px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 17%, transparent);
}

.weather-settings-checkbox {
  width: 19px;
  height: 19px;
  accent-color: var(--lumiverse-primary, #82a8ff);
  filter: drop-shadow(0 2px 5px rgba(2, 12, 26, 0.28));
}

.weather-settings-range {
  accent-color: var(--lumiverse-primary, #82a8ff);
}

.weather-settings-row {
  gap: 8px;
}

.weather-settings-value {
  min-width: 42px;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 66%, transparent);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: color-mix(in srgb, var(--lumiverse-text) 92%, white 8%);
}

.weather-settings-status-pill {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset-grid {
  gap: 9px;
}

.weather-settings-preset {
  min-height: 72px;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 58%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 21%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.045));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 13%, transparent);
}

.weather-settings-manual-card {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 25%, var(--lumi-glass-line));
}

.weather-hud-widget {
  --weather-hud-shell-top: #16273d;
  --weather-hud-shell-mid: #17314f;
  --weather-hud-shell-bottom: #101d31;
  --weather-hud-aura-primary: rgba(255, 218, 162, 0.22);
  --weather-hud-aura-secondary: rgba(116, 164, 255, 0.18);
  --weather-hud-aura-soft: rgba(255, 255, 255, 0.07);
  --weather-hud-line: rgba(255, 255, 255, 0.14);
  --weather-hud-surface: rgba(255, 255, 255, 0.08);
  --weather-hud-surface-strong: rgba(255, 255, 255, 0.12);
  --weather-hud-surface-active: rgba(103, 145, 220, 0.3);
  --weather-hud-shadow: rgba(3, 10, 23, 0.38);
  --weather-hud-text-soft: rgba(234, 241, 255, 0.76);
  --weather-hud-text-muted: rgba(222, 231, 247, 0.62);
  --weather-hud-accent: #9dc0ff;
  --weather-hud-icon-bg: rgba(255, 255, 255, 0.11);
  --weather-hud-icon-color: #fff1c7;
  --weather-hud-scene-intensity: 1;
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 13px 13px 15px;
  box-sizing: border-box;
  border-radius: 20px;
  color: #f5f8ff;
  overflow: hidden;
  backdrop-filter: blur(18px) saturate(132%);
  background:
    radial-gradient(circle at 84% 16%, var(--weather-hud-aura-primary), transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, var(--weather-hud-shell-top) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border: 1px solid var(--weather-hud-line);
  box-shadow:
    0 22px 46px var(--weather-hud-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-widget::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 34%),
    radial-gradient(circle at 18% 20%, var(--weather-hud-aura-soft), transparent 26%),
    linear-gradient(120deg, transparent 28%, rgba(255, 255, 255, 0.05) 45%, transparent 60%);
  pointer-events: none;
}

.weather-hud-widget::after {
  content: "";
  position: absolute;
  inset: auto -10% -36% 26%;
  height: 66%;
  background: radial-gradient(circle at center, color-mix(in srgb, var(--weather-hud-aura-secondary) 90%, transparent) 0%, transparent 68%);
  opacity: calc(0.9 * var(--weather-hud-scene-intensity));
  filter: blur(30px);
  transform: translate3d(0, 0, 0);
  animation: weather-hud-drift 12s ease-in-out infinite alternate;
  pointer-events: none;
}

.weather-hud-widget[data-time-phase="dawn"] {
  --weather-hud-shell-top: #30324f;
  --weather-hud-shell-mid: #6b536d;
  --weather-hud-shell-bottom: #26394c;
  --weather-hud-aura-primary: rgba(255, 196, 139, 0.34);
  --weather-hud-aura-secondary: rgba(121, 187, 255, 0.24);
  --weather-hud-aura-soft: rgba(255, 221, 176, 0.1);
  --weather-hud-accent: #ffcf9d;
}

.weather-hud-widget[data-time-phase="day"] {
  --weather-hud-shell-top: #1d3550;
  --weather-hud-shell-mid: #295075;
  --weather-hud-shell-bottom: #17283f;
  --weather-hud-aura-primary: rgba(255, 228, 162, 0.28);
  --weather-hud-aura-secondary: rgba(120, 193, 255, 0.26);
  --weather-hud-aura-soft: rgba(207, 227, 255, 0.1);
  --weather-hud-accent: #9ed0ff;
}

.weather-hud-widget[data-time-phase="dusk"] {
  --weather-hud-shell-top: #382c4c;
  --weather-hud-shell-mid: #674967;
  --weather-hud-shell-bottom: #202641;
  --weather-hud-aura-primary: rgba(255, 176, 123, 0.28);
  --weather-hud-aura-secondary: rgba(139, 142, 255, 0.22);
  --weather-hud-aura-soft: rgba(255, 207, 161, 0.09);
  --weather-hud-accent: #ffb88d;
}

.weather-hud-widget[data-time-phase="night"] {
  --weather-hud-shell-top: #131d31;
  --weather-hud-shell-mid: #18253f;
  --weather-hud-shell-bottom: #0d1524;
  --weather-hud-aura-primary: rgba(138, 167, 255, 0.16);
  --weather-hud-aura-secondary: rgba(84, 123, 206, 0.18);
  --weather-hud-aura-soft: rgba(192, 214, 255, 0.06);
  --weather-hud-accent: #97b8ff;
}

.weather-hud-widget[data-condition="clear"] {
  --weather-hud-icon-bg: rgba(255, 248, 222, 0.12);
  --weather-hud-icon-color: #fff1b2;
}

.weather-hud-widget[data-condition="cloudy"] {
  --weather-hud-aura-primary: rgba(206, 221, 255, 0.16);
  --weather-hud-aura-secondary: rgba(102, 139, 190, 0.16);
  --weather-hud-icon-bg: rgba(228, 237, 255, 0.11);
  --weather-hud-icon-color: #eef4ff;
}

.weather-hud-widget[data-condition="rain"] {
  --weather-hud-shell-top: #17283d;
  --weather-hud-shell-mid: #20344d;
  --weather-hud-shell-bottom: #0e1624;
  --weather-hud-aura-primary: rgba(118, 155, 220, 0.16);
  --weather-hud-aura-secondary: rgba(88, 126, 174, 0.16);
  --weather-hud-aura-soft: rgba(188, 215, 255, 0.05);
  --weather-hud-accent: #8db9ff;
  --weather-hud-icon-bg: rgba(194, 220, 255, 0.12);
  --weather-hud-icon-color: #dfeeff;
}

.weather-hud-widget[data-condition="storm"] {
  --weather-hud-shell-top: #141b2d;
  --weather-hud-shell-mid: #1b2841;
  --weather-hud-shell-bottom: #0b111c;
  --weather-hud-aura-primary: rgba(123, 146, 255, 0.18);
  --weather-hud-aura-secondary: rgba(82, 108, 182, 0.2);
  --weather-hud-aura-soft: rgba(220, 230, 255, 0.05);
  --weather-hud-accent: #a7b9ff;
  --weather-hud-icon-bg: rgba(205, 215, 255, 0.1);
  --weather-hud-icon-color: #eef2ff;
}

.weather-hud-widget[data-condition="snow"] {
  --weather-hud-shell-top: #233244;
  --weather-hud-shell-mid: #324860;
  --weather-hud-shell-bottom: #182230;
  --weather-hud-aura-primary: rgba(225, 236, 255, 0.22);
  --weather-hud-aura-secondary: rgba(162, 203, 255, 0.18);
  --weather-hud-aura-soft: rgba(240, 246, 255, 0.09);
  --weather-hud-accent: #d9e9ff;
  --weather-hud-icon-bg: rgba(235, 243, 255, 0.14);
  --weather-hud-icon-color: #ffffff;
}

.weather-hud-widget[data-condition="fog"] {
  --weather-hud-shell-top: #23303e;
  --weather-hud-shell-mid: #314153;
  --weather-hud-shell-bottom: #1a2430;
  --weather-hud-aura-primary: rgba(214, 222, 232, 0.18);
  --weather-hud-aura-secondary: rgba(168, 184, 208, 0.15);
  --weather-hud-aura-soft: rgba(244, 246, 250, 0.06);
  --weather-hud-accent: #d5deeb;
  --weather-hud-icon-bg: rgba(232, 238, 245, 0.12);
  --weather-hud-icon-color: #f6f8fb;
}

.weather-hud-widget[data-source="manual"] {
  background:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--weather-hud-aura-primary) 90%, rgba(198, 226, 255, 0.26)) 0%, transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, color-mix(in srgb, var(--weather-hud-shell-top) 90%, rgba(24, 49, 87, 0.7)) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.16));
}

.weather-hud-header,
.weather-hud-body,
.weather-hud-drawer {
  position: relative;
  z-index: 1;
}

.weather-hud-widget[data-empty="true"] .weather-hud-summary {
  color: var(--weather-hud-text-muted);
}

.weather-hud-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.weather-hud-titlewrap {
  display: grid;
  gap: 6px;
}

.weather-hud-eyebrow {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-source {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 9px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 82%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 90%, transparent);
  color: rgba(242, 247, 255, 0.92);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weather-hud-control,
.weather-hud-gear,
.weather-hud-chip,
.weather-hud-preset {
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 84%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 96%, transparent);
  color: inherit;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.weather-hud-control:hover,
.weather-hud-gear:hover,
.weather-hud-chip:hover,
.weather-hud-preset:hover {
  background: color-mix(in srgb, var(--weather-hud-surface-strong) 96%, transparent);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 18%, rgba(255, 255, 255, 0.2));
  transform: translateY(-1px);
}

.weather-hud-control,
.weather-hud-gear {
  border-radius: 11px;
}

.weather-hud-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 11px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.15;
  text-align: center;
}

.weather-hud-control-ghost {
  background: rgba(255, 255, 255, 0.04);
}

.weather-hud-control-active {
  background: color-mix(in srgb, var(--weather-hud-accent) 24%, rgba(255, 255, 255, 0.06));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-control-icon,
.weather-hud-gear svg,
.weather-hud-icon svg {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.weather-hud-gear {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.weather-settings-select:focus-visible,
.weather-settings-input:focus-visible,
.weather-settings-button:focus-visible,
.weather-settings-checkbox:focus-visible,
.weather-settings-range:focus-visible,
.weather-hud-control:focus-visible,
.weather-hud-gear:focus-visible,
.weather-hud-chip:focus-visible,
.weather-hud-preset:focus-visible,
.weather-hud-select:focus-visible,
.weather-hud-range:focus-visible {
  outline: 2px solid var(--lumiverse-primary, var(--weather-hud-accent, #9dc0ff));
  outline-offset: 2px;
}

.weather-hud-gear svg,
.weather-hud-icon svg,
.weather-hud-control-icon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.weather-hud-body {
  display: grid;
  grid-template-columns: minmax(132px, 1fr) minmax(78px, 96px);
  gap: 10px;
  align-items: end;
}

.weather-hud-primary {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.weather-hud-location {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(245, 248, 255, 0.92);
  max-width: 168px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-wrap: balance;
}

.weather-hud-date {
  font-size: 10px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-time {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 0.94;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
}

.weather-hud-wind {
  font-size: 11px;
  color: var(--weather-hud-text-muted);
}

.weather-hud-weather {
  display: grid;
  justify-items: end;
  gap: 6px;
  text-align: right;
}

.weather-hud-icon {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, color-mix(in srgb, var(--weather-hud-icon-bg) 94%, white 6%), color-mix(in srgb, var(--weather-hud-icon-bg) 72%, transparent));
  color: var(--weather-hud-icon-color);
  box-shadow:
    0 10px 24px rgba(3, 10, 23, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.weather-hud-temp {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 0.94;
}

.weather-hud-summary {
  max-width: 96px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--weather-hud-text-soft);
}

.weather-hud-drawer {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--weather-hud-line) 70%, transparent);
}

.weather-hud-drawer-section {
  display: grid;
  gap: 8px;
  padding: 11px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 62%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
}

.weather-hud-section-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-mode-row,
.weather-hud-action-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-hud-chip,
.weather-hud-preset {
  min-height: 35px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.weather-hud-chip-active,
.weather-hud-preset-active {
  background: linear-gradient(180deg, color-mix(in srgb, var(--weather-hud-accent) 24%, transparent), color-mix(in srgb, var(--weather-hud-accent) 16%, rgba(255, 255, 255, 0.04)));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-preset-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.weather-hud-control-grid {
  display: grid;
  gap: 10px;
}

.weather-hud-field {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-field-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.weather-hud-inline-value {
  color: rgba(245, 248, 255, 0.88);
  font-weight: 600;
}

.weather-hud-select {
  font-size: 11px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 72%, transparent);
  background: rgba(7, 16, 28, 0.3);
  color: inherit;
}

.weather-hud-range {
  accent-color: var(--weather-hud-accent);
}

.weather-hud-widget[data-expanded="false"] {
  gap: 10px;
}

.weather-hud-widget[data-expanded="false"] .weather-hud-summary {
  max-width: 118px;
}

.weather-hud-widget[data-paused="true"]::after {
  animation-play-state: paused;
  opacity: calc(0.55 * var(--weather-hud-scene-intensity));
}

@keyframes weather-hud-drift {
  0% {
    transform: translate3d(-5%, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(6%, -4%, 0) scale(1.08);
  }
}

.weather-fx-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  isolation: isolate;
  contain: paint;
  transition:
    opacity 320ms ease,
    --weather-bg-start 1200ms ease,
    --weather-bg-mid 1200ms ease,
    --weather-bg-end 1200ms ease,
    --weather-glow 900ms ease,
    --weather-beam-color 900ms ease,
    --weather-horizon-color 900ms ease,
    --weather-sky-opacity 800ms ease,
    --weather-glow-opacity 800ms ease,
    --weather-beam-opacity 800ms ease,
    --weather-cloud-opacity 800ms ease,
    --weather-horizon-opacity 800ms ease,
    --weather-mist-opacity 800ms ease,
    --weather-fog-opacity 800ms ease,
    --weather-rain-opacity 600ms ease,
    --weather-snow-opacity 600ms ease,
    --weather-mote-opacity 600ms ease,
    --weather-flash-opacity 300ms ease;
}

.weather-fx-root.weather-visible {
  opacity: 1;
}

.weather-fx-root[data-kind="back"] {
  z-index: 1;
}

.weather-fx-root[data-kind="front"] {
  z-index: 24;
  mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.55) 46%, #000 78%);
}

.weather-fx-root.weather-hidden {
  display: none;
}

.weather-fx-root.weather-paused *,
.weather-fx-root.weather-paused *::before,
.weather-fx-root.weather-paused *::after {
  animation-play-state: paused !important;
}

.weather-fx-sky,
.weather-fx-glow,
.weather-fx-beams,
.weather-fx-clouds,
.weather-fx-horizon,
.weather-fx-mist,
.weather-fx-fog,
.weather-fx-motes,
.weather-fx-rain,
.weather-fx-snow,
.weather-fx-wind-gusts,
.weather-fx-rain-splashes,
.weather-fx-rain-ripples,
.weather-fx-frost,
.weather-fx-lightning,
.weather-fx-lightning-glow,
.weather-fx-flash {
  position: absolute;
  inset: 0;
}

.weather-fx-sky {
  background: linear-gradient(180deg, var(--weather-bg-start) 0%, var(--weather-bg-mid) 46%, var(--weather-bg-end) 100%);
  opacity: var(--weather-sky-opacity);
  mix-blend-mode: normal;
  filter: saturate(1.08) brightness(1.04);
  animation: weather-sky-shift 24s ease-in-out infinite alternate;
}

.weather-fx-glow {
  background:
    radial-gradient(circle at 18% 18%, var(--weather-glow), transparent 34%),
    radial-gradient(circle at 82% 22%, color-mix(in srgb, var(--weather-glow) 74%, white 14%), transparent 30%);
  opacity: var(--weather-glow-opacity);
  mix-blend-mode: screen;
  animation: weather-glow-drift 18s ease-in-out infinite alternate;
}

.weather-fx-beams {
  background:
    radial-gradient(circle at 20% 16%, var(--weather-beam-color), transparent 26%),
    linear-gradient(120deg, transparent 30%, color-mix(in srgb, var(--weather-beam-color) 58%, transparent) 48%, transparent 62%);
  opacity: var(--weather-beam-opacity);
  mix-blend-mode: screen;
  animation: weather-beam-sway 14s ease-in-out infinite alternate;
}

.weather-fx-horizon {
  background: linear-gradient(180deg, transparent 0%, transparent 48%, var(--weather-horizon-color) 100%);
  opacity: var(--weather-horizon-opacity);
  filter: blur(20px);
  transform: translateY(6%);
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-rain-drop,
.weather-fx-snow-flake,
.weather-fx-wind-gust,
.weather-fx-rain-splash,
.weather-fx-rain-ripple {
  position: absolute;
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-wind-gust {
  will-change: auto;
}

.weather-fx-root.weather-visible .weather-fx-cloud,
.weather-fx-root.weather-visible .weather-fx-fog-band,
.weather-fx-root.weather-visible .weather-fx-mist-plume,
.weather-fx-root.weather-visible .weather-fx-mote,
.weather-fx-root.weather-visible .weather-fx-wind-gust,
.weather-fx-root.weather-visible .weather-fx-rain-drop,
.weather-fx-root.weather-visible .weather-fx-snow-flake {
  will-change: transform, opacity;
}

.weather-fx-clouds::before {
  content: "";
  position: absolute;
  inset: -10% -8% 64%;
  background:
    radial-gradient(ellipse at 22% 30%, color-mix(in srgb, var(--weather-cloud-core) 86%, white 8%), transparent 42%),
    radial-gradient(ellipse at 72% 20%, color-mix(in srgb, var(--weather-cloud-edge) 92%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--weather-cloud-core) 82%, rgba(8, 14, 24, 0.18)) 0%, transparent 100%);
  opacity: calc(var(--weather-cloud-opacity) * 0.7);
  filter: blur(34px);
  transform: translateY(-8%);
}

.weather-fx-cloud {
  --cloud-base-y: 0vh;
  width: var(--cloud-width);
  height: var(--cloud-height);
  top: var(--cloud-top);
  left: var(--cloud-left);
  border-radius: 46% 54% 52% 48% / 54% 58% 42% 46%;
  background:
    radial-gradient(ellipse at 20% 62%, color-mix(in srgb, var(--weather-cloud-core) 82%, transparent), transparent 54%),
    radial-gradient(ellipse at 36% 38%, color-mix(in srgb, var(--weather-cloud-edge) 92%, white 4%), transparent 56%),
    radial-gradient(ellipse at 58% 42%, color-mix(in srgb, var(--weather-cloud-core) 96%, white 6%), transparent 58%),
    radial-gradient(ellipse at 82% 60%, color-mix(in srgb, var(--weather-cloud-core) 76%, transparent), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, var(--weather-cloud-core) 96%, white 4%) 0%, color-mix(in srgb, var(--weather-cloud-core) 22%, transparent) 100%);
  filter: blur(var(--cloud-blur)) saturate(1.04);
  opacity: calc(var(--weather-cloud-opacity) * var(--cloud-opacity-scale));
  transform-origin: 50% 58%;
  animation: weather-cloud-drift var(--cloud-duration) linear infinite;
  animation-delay: var(--cloud-delay);
}

.weather-fx-cloud::before,
.weather-fx-cloud::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.weather-fx-cloud::before {
  inset: -24% -10% 16%;
  border-radius: 48% 52% 56% 44% / 62% 64% 40% 42%;
  background:
    radial-gradient(ellipse at 18% 72%, color-mix(in srgb, var(--weather-cloud-edge) 86%, transparent), transparent 48%),
    radial-gradient(ellipse at 42% 38%, color-mix(in srgb, var(--weather-cloud-core) 98%, white 8%), transparent 54%),
    radial-gradient(ellipse at 68% 46%, color-mix(in srgb, var(--weather-cloud-core) 88%, transparent), transparent 56%),
    radial-gradient(ellipse at 88% 70%, color-mix(in srgb, var(--weather-cloud-edge) 72%, transparent), transparent 50%);
  filter: blur(var(--cloud-soft-blur));
  opacity: var(--cloud-highlight-opacity);
  transform: translate3d(0, var(--cloud-lift), 0) rotate(var(--cloud-shear));
}

.weather-fx-cloud::after {
  inset: 42% -8% -24%;
  border-radius: 44% 56% 50% 50% / 42% 44% 58% 60%;
  background:
    radial-gradient(ellipse at 26% 16%, color-mix(in srgb, rgba(4, 12, 24, 0.26) 76%, var(--weather-cloud-core)), transparent 58%),
    radial-gradient(ellipse at 72% 18%, color-mix(in srgb, rgba(4, 12, 24, 0.18) 70%, var(--weather-cloud-core)), transparent 60%),
    linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--weather-cloud-core) 18%, rgba(4, 12, 24, 0.36)) 100%);
  filter: blur(var(--cloud-soft-blur));
  opacity: var(--cloud-shadow-opacity);
}

.weather-fx-fog-band {
  width: var(--fog-width);
  height: var(--fog-height);
  top: var(--fog-top);
  left: var(--fog-left);
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--weather-fog-color), transparent);
  filter: blur(20px);
  opacity: calc(var(--weather-fog-opacity) * var(--fog-opacity-scale));
  animation: weather-fog-drift var(--fog-duration) ease-in-out infinite;
  animation-delay: var(--fog-delay);
}

.weather-fx-mist-plume {
  width: var(--mist-width);
  height: var(--mist-height);
  left: var(--mist-left);
  bottom: var(--mist-bottom);
  border-radius: 999px;
  background: radial-gradient(circle at center, var(--weather-mist-color), transparent 68%);
  filter: blur(22px);
  opacity: calc(var(--weather-mist-opacity) * var(--mist-opacity-scale));
  animation: weather-mist-roll var(--mist-duration) ease-in-out infinite;
  animation-delay: var(--mist-delay);
}

.weather-fx-mote {
  left: var(--mote-left);
  top: var(--mote-top);
  width: var(--mote-size);
  height: var(--mote-size);
  border-radius: 50%;
  background: rgba(255, 247, 224, 0.95);
  box-shadow: 0 0 10px rgba(255, 245, 214, 0.4);
  opacity: calc(var(--weather-mote-opacity) * var(--mote-opacity-scale));
  animation: weather-mote-drift var(--mote-duration) ease-in-out infinite;
  animation-delay: var(--mote-delay);
}

.weather-fx-rain-drop {
  top: var(--drop-top);
  left: var(--drop-left);
  width: var(--drop-width);
  height: var(--drop-length);
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 10%,
    var(--weather-rain-color) 50%,
    rgba(255, 255, 255, 0.9) 95%,
    rgba(255, 255, 255, 1) 100%
  );
  border-radius: 999px;
  opacity: 0;
  transform: rotate(var(--weather-rain-angle, 11deg));
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.24));
  animation: weather-rain-fall var(--drop-duration) linear infinite;
  animation-delay: var(--drop-delay);
  animation-play-state: paused;
}

.weather-fx-rain-drop-front {
  filter: drop-shadow(0 0 5px rgba(209, 229, 255, 0.34));
}

.weather-fx-rain-drop.weather-density-hidden {
  opacity: 0 !important;
  animation-play-state: paused !important;
}

.weather-fx-rain-splashes,
.weather-fx-rain-ripples {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splashes,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripples {
  opacity: 1;
}

.weather-fx-rain-splash {
  --splash-color: rgba(205, 231, 255, 0.9);
  --splash-dot-color: rgba(236, 247, 255, 0.98);
  --splash-opacity-scale: 0.94;
  bottom: var(--splash-bottom);
  left: var(--splash-left);
  width: var(--splash-size);
  height: var(--splash-height, var(--splash-size));
  transform-origin: 50% 100%;
  opacity: 0;
  filter: drop-shadow(0 0 3px rgba(194, 225, 255, 0.58));
  animation: weather-splash var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash::before,
.weather-fx-rain-splash::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.weather-fx-rain-splash::before {
  top: auto;
  height: 48%;
  border: 1.8px solid var(--splash-color);
  border-radius: 50%;
  clip-path: inset(0 0 48% 0);
}

.weather-fx-rain-splash::after {
  background:
    radial-gradient(circle at 15% 70%, var(--splash-dot-color) 0 1.1px, transparent 2px),
    radial-gradient(circle at 50% 5%, var(--splash-dot-color) 0 1.3px, transparent 2.2px),
    radial-gradient(circle at 84% 66%, var(--splash-dot-color) 0 1.1px, transparent 2px);
}

.weather-fx-rain-splash-front {
  --splash-color: rgba(226, 242, 255, 0.98);
  --splash-dot-color: rgba(248, 252, 255, 1);
  --splash-opacity-scale: 1;
}

.weather-fx-rain-ripple {
  --ripple-opacity-scale: 0.64;
  bottom: var(--ripple-bottom);
  left: var(--ripple-left);
  width: var(--ripple-size);
  height: calc(var(--ripple-size) * 0.4);
  border: 1.4px solid rgba(205, 231, 255, 0.62);
  border-radius: 50%;
  opacity: 0;
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.42));
  animation: weather-ripple var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash.weather-density-hidden,
.weather-fx-rain-ripple.weather-density-hidden {
  display: none;
}

.weather-fx-wind-gusts {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gusts {
  opacity: 0.65;
}

.weather-fx-root[data-condition="rain"] .weather-fx-wind-gusts {
  opacity: 0.72;
}

.weather-fx-root[data-condition="storm"] .weather-fx-wind-gusts {
  opacity: 1;
}

.weather-fx-wind-gust {
  top: var(--gust-top);
  left: var(--gust-left);
  width: var(--gust-width);
  height: var(--gust-height);
  color: rgba(235, 245, 255, var(--gust-opacity));
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  animation: weather-wind-gust var(--gust-duration) linear infinite;
  animation-delay: var(--gust-delay);
  animation-play-state: paused;
}

.weather-fx-wind-gust svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="rain"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="storm"] .weather-fx-wind-gust {
  animation-play-state: running;
}

.weather-fx-snow-flake {
  top: var(--flake-top);
  left: var(--flake-left);
  width: var(--flake-size);
  height: var(--flake-size);
  border-radius: 50%;
  background-color: var(--weather-snow-color);
  opacity: 0;
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.72);
  animation:
    weather-snow-fall var(--flake-duration) linear infinite,
    weather-snow-shimmer var(--flake-shimmer-duration) ease-in-out infinite;
  animation-delay: var(--flake-delay), var(--flake-delay);
  animation-play-state: paused;
}

.weather-fx-snow-flake-front {
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.82);
}

.weather-fx-frost {
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(ellipse 40% 50% at 0% 0%, rgba(220, 235, 255, 0.25), transparent 60%),
    radial-gradient(ellipse 40% 50% at 100% 0%, rgba(220, 235, 255, 0.2), transparent 60%),
    radial-gradient(ellipse 50% 60% at 0% 100%, rgba(220, 235, 255, 0.3), transparent 55%),
    radial-gradient(ellipse 50% 60% at 100% 100%, rgba(220, 235, 255, 0.25), transparent 55%),
    radial-gradient(ellipse 60% 30% at 50% 0%, rgba(210, 230, 255, 0.12), transparent 50%),
    radial-gradient(ellipse 30% 80% at 0% 50%, rgba(210, 230, 255, 0.1), transparent 50%),
    radial-gradient(ellipse 30% 80% at 100% 50%, rgba(210, 230, 255, 0.1), transparent 50%);
  mix-blend-mode: screen;
  filter: blur(3px);
  transition: opacity 1000ms ease;
}

.weather-fx-root[data-condition="snow"] .weather-fx-frost {
  opacity: 0.6;
}

.weather-fx-lightning {
  overflow: hidden;
  pointer-events: none;
}

.weather-fx-lightning-bolt {
  position: absolute;
  top: 0;
  width: 26%;
  height: 100%;
  opacity: 0;
  filter:
    drop-shadow(0 0 4px rgba(200, 220, 255, 0.9))
    drop-shadow(0 0 14px rgba(160, 190, 255, 0.5))
    drop-shadow(0 0 30px rgba(120, 160, 255, 0.3));
}

.weather-fx-lightning-bolt[data-bolt-index="0"] { left: 10%; }
.weather-fx-lightning-bolt[data-bolt-index="1"] { left: 38%; }
.weather-fx-lightning-bolt[data-bolt-index="2"] { left: 62%; }

.weather-fx-lightning-bolt.weather-lightning-strike {
  animation: weather-lightning-strike 650ms ease-out forwards;
}

.weather-fx-lightning-glow {
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    ellipse 50% 60% at var(--weather-lightning-x, 50%) 15%,
    rgba(210, 230, 255, 0.5) 0%,
    rgba(180, 210, 255, 0.2) 20%,
    transparent 50%
  );
  mix-blend-mode: screen;
}

.weather-fx-root.weather-lightning-glow-flash .weather-fx-lightning-glow {
  animation: weather-lightning-glow-flash 650ms ease-out forwards;
}

.weather-fx-flash {
  background:
    radial-gradient(circle at 34% 22%, rgba(232, 241, 255, 0.9), transparent 32%),
    radial-gradient(circle at 50% 10%, rgba(220, 235, 255, 0.6), transparent 40%),
    rgba(219, 231, 255, 0.48);
  opacity: 0;
  mix-blend-mode: screen;
}

.weather-fx-root.weather-storm-flash .weather-fx-flash {
  animation: weather-flash-sequence 650ms ease-out;
}

.weather-fx-root[data-condition="rain"] .weather-fx-clouds::before,
.weather-fx-root[data-condition="storm"] .weather-fx-clouds::before {
  inset: -10% -8% 62%;
  opacity: calc(var(--weather-cloud-opacity) * 0.9);
  filter: blur(36px);
}

.weather-fx-root[data-condition="rain"] .weather-fx-cloud,
.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-base-y: -0.8vh;
  --cloud-shadow-opacity: 0.42;
  filter: blur(calc(var(--cloud-blur) + 1px)) saturate(0.92);
}

.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-shadow-opacity: 0.5;
  filter: blur(calc(var(--cloud-blur) + 1.5px)) saturate(0.82) brightness(0.9);
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-cloud {
  filter: blur(var(--cloud-blur)) saturate(0.94);
}

.weather-fx-root[data-condition="snow"] .weather-fx-cloud {
  --cloud-shadow-opacity: 0.18;
  filter: blur(var(--cloud-blur)) saturate(0.88) brightness(1.08);
}

.weather-fx-root.weather-storm-flash .weather-fx-clouds {
  animation: weather-cloud-lightning 650ms ease-out;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop,
.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  animation-play-state: running;
  will-change: transform, opacity;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop {
  opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale));
}

.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  opacity: calc(var(--weather-snow-opacity) * var(--flake-opacity-scale));
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splash,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripple {
  animation-play-state: running;
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud,
.weather-fx-root.weather-reduced-motion .weather-fx-fog-band,
.weather-fx-root.weather-reduced-motion .weather-fx-mist-plume,
.weather-fx-root.weather-reduced-motion .weather-fx-mote,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-drop,
.weather-fx-root.weather-reduced-motion .weather-fx-snow-flake,
.weather-fx-root.weather-reduced-motion .weather-fx-wind-gust,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-splash,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-ripple {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-sky,
.weather-fx-root.weather-reduced-motion .weather-fx-glow,
.weather-fx-root.weather-reduced-motion .weather-fx-beams {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud {
  transform: translate3d(var(--cloud-drift-x-mid), var(--cloud-base-y), 0) scale(var(--cloud-scale));
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion .weather-fx-wind-gusts {
  display: none;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  opacity: 0;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake:nth-child(4n) {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  transform: translate3d(0, 48vh, 0) rotate(var(--weather-rain-angle, 11deg));
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  transform: translate3d(var(--flake-drift-b), var(--flake-static-y), 0);
}

@keyframes weather-sky-shift {
  0% { transform: scale(1) translate3d(0, 0, 0); }
  100% { transform: scale(1.04) translate3d(0, -1.6vh, 0); }
}

@keyframes weather-glow-drift {
  0% { transform: translate3d(-1vw, 0, 0) scale(1); }
  100% { transform: translate3d(1vw, -1vh, 0) scale(1.08); }
}

@keyframes weather-beam-sway {
  0% { transform: translate3d(-1vw, 0, 0) rotate(-1deg); }
  100% { transform: translate3d(1vw, -0.6vh, 0) rotate(1deg); }
}

@keyframes weather-cloud-drift {
  0% {
    transform: translate3d(var(--cloud-drift-x-start), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
  48% {
    transform: translate3d(var(--cloud-drift-x-mid), calc(var(--cloud-base-y) + var(--cloud-drift-y)), 0) scale(var(--cloud-scale-mid));
  }
  100% {
    transform: translate3d(var(--cloud-drift-x-end), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
}

@keyframes weather-cloud-lightning {
  0%, 100% { filter: brightness(1) saturate(1); }
  12% { filter: brightness(1.72) saturate(0.82); }
  24% { filter: brightness(1.12) saturate(0.94); }
  36% { filter: brightness(1.48) saturate(0.86); }
  58% { filter: brightness(1.06) saturate(0.98); }
}

@keyframes weather-fog-drift {
  0%, 100% { transform: translate3d(-2vw, 0, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mist-roll {
  0%, 100% { transform: translate3d(-2vw, 1vh, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mote-drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(0.95); }
  50% { transform: translate3d(var(--mote-drift-x), var(--mote-drift-y), 0) scale(1.12); }
}

@keyframes weather-rain-fall {
  0% { transform: translate3d(0, 0, 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
  12% { opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale)); }
  100% { transform: translate3d(var(--drop-drift), 118vh, 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
}

@keyframes weather-snow-fall {
  0% { transform: translate3d(0, 0, 0); }
  25% { transform: translate3d(var(--flake-drift-a), 29vh, 0); }
  50% { transform: translate3d(var(--flake-drift-b), 58vh, 0); }
  75% { transform: translate3d(var(--flake-drift-c), 87vh, 0); }
  100% { transform: translate3d(var(--flake-drift-end), 116vh, 0); }
}

@keyframes weather-snow-shimmer {
  0%, 100% { filter: brightness(0.78); }
  50% { filter: brightness(1.22); }
}

@keyframes weather-splash {
  0% { transform: translate3d(0, 2px, 0) scale(0.2) rotate(0deg); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--splash-opacity-scale)); }
  42% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1) rotate(var(--splash-tilt, 0deg)); }
  62% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
  100% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
}

@keyframes weather-ripple {
  0% { transform: scale(0.15); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--ripple-opacity-scale)); }
  100% { transform: scale(3); opacity: 0; }
}

@keyframes weather-wind-gust {
  0% { transform: translate3d(-18vw, 0, 0); opacity: 0; }
  8% { opacity: 1; }
  35% { transform: translate3d(46vw, -5px, 0); }
  70% { transform: translate3d(108vw, 4px, 0); opacity: 1; }
  100% { transform: translate3d(168vw, 0, 0); opacity: 0; }
}

@keyframes weather-lightning-strike {
  0% { opacity: 0; }
  2% { opacity: 1; }
  8% { opacity: 0.15; }
  14% { opacity: 0.95; }
  22% { opacity: 0.08; }
  30% { opacity: 0.6; }
  45% { opacity: 0.02; }
  52% { opacity: 0.35; }
  70% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-lightning-glow-flash {
  0% { opacity: 0; }
  3% { opacity: 0.7; }
  10% { opacity: 0.08; }
  17% { opacity: 0.55; }
  28% { opacity: 0.04; }
  38% { opacity: 0.3; }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-flash-sequence {
  0% { opacity: 0; }
  3% { opacity: var(--weather-flash-opacity); }
  10% { opacity: calc(var(--weather-flash-opacity) * 0.12); }
  17% { opacity: calc(var(--weather-flash-opacity) * 0.82); }
  28% { opacity: calc(var(--weather-flash-opacity) * 0.06); }
  38% { opacity: calc(var(--weather-flash-opacity) * 0.4); }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@media (max-width: 768px) {
  .weather-settings-card-header {
    align-items: start;
  }

  .weather-settings-status {
    max-width: 52%;
  }

  .weather-settings-control-deck {
    grid-template-columns: 1fr;
  }

  .weather-settings-control-deck .weather-settings-section:nth-child(3) {
    grid-column: auto;
  }

  .weather-settings-manual-grid,
  .weather-settings-preset-grid {
    grid-template-columns: 1fr;
  }

  .weather-settings-actions,
  .weather-hud-mode-row,
  .weather-hud-action-row {
    grid-template-columns: 1fr;
  }

  .weather-hud-preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .weather-hud-time {
    font-size: 24px;
  }
}
`;

// src/tag-utils.ts
function shouldProcessWeatherTag(payload) {
  return !payload.isStreaming && !payload.isUser;
}

// src/frontend.ts
var GEAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98a7.79 7.79 0 000-1.96l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.88 7.88 0 00-1.69-.98l-.36-2.54a.5.5 0 00-.49-.42h-3.84a.5.5 0 00-.49.42l-.36 2.54c-.6.24-1.16.56-1.69.98l-2.39-.96a.5.5 0 00-.6.22L2.43 8.8a.5.5 0 00.12.64l2.03 1.58a7.79 7.79 0 000 1.96L2.55 14.56a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.6.22l2.39-.96c.53.42 1.09.74 1.69.98l.36 2.54a.5.5 0 00.49.42h3.84a.5.5 0 00.49-.42l.36-2.54c.6-.24 1.16-.56 1.69-.98l2.39.96a.5.5 0 00.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z"/></svg>`;
var CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
var CHEVRON_UP_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m7.41 15.41 4.59-4.58 4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
var LIGHTNING_BOLT_SVGS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M55 0 L35 55 L52 55 L25 145 L48 100 L30 100 L52 230 L35 185 L58 300"/><path d="M52 55 L72 82 L62 88" stroke-width="1.8"/><path d="M48 100 L22 125 L32 130" stroke-width="1.8"/><path d="M52 230 L72 248 L62 253" stroke-width="1.5"/></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M45 0 L68 48 L45 48 L72 135 L50 88 L66 88 L42 215 L62 168 L38 300"/><path d="M45 48 L22 72 L32 77" stroke-width="1.8"/><path d="M50 88 L75 110 L65 115" stroke-width="1.8"/></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" preserveAspectRatio="none" style="width:100%;height:100%;"><g fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M50 0 L38 52 L55 52 L30 120 L50 80 L32 80 L55 200 L38 158 L55 300"/><path d="M55 52 L75 75 L65 80" stroke-width="1.8"/><path d="M50 80 L25 100 L35 105" stroke-width="1.8"/><path d="M55 200 L75 220 L65 225" stroke-width="1.5"/></g></svg>`
];
var LIGHTNING_BOLT_POSITIONS = [23, 51, 75];
var HUD_COLLAPSED_SIZE = { width: 272, height: 148 };
var HUD_EXPANDED_SIZE = { width: 312, height: 360 };
var DEFAULT_WIDGET_POSITION = { x: 24, y: 96 };
function conditionIcon(condition) {
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
function resolveHudTimePhase(state, liveDate) {
  if (state.palette === "dawn" || state.palette === "day" || state.palette === "dusk" || state.palette === "night") {
    return state.palette;
  }
  const hour = liveDate?.getHours() ?? parseHourFromTimeString(state.time);
  if (hour === null)
    return "day";
  if (hour >= 5 && hour < 8)
    return "dawn";
  if (hour >= 8 && hour < 18)
    return "day";
  if (hour >= 18 && hour < 21)
    return "dusk";
  return "night";
}
function sendToBackend(ctx, payload) {
  ctx.sendToBackend(payload);
}
function createSpan(className, styles) {
  const span = document.createElement("span");
  span.className = className;
  for (const [key, value] of Object.entries(styles)) {
    span.style.setProperty(key, value);
  }
  return span;
}
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
function cssNumber(value, precision = 2) {
  return value.toFixed(precision).replace(/\.?0+$/, "");
}
function createCloudElement(index, total) {
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
    "--cloud-highlight-opacity": `${cssNumber(0.46 - depth * 0.12)}`
  });
  cloud.dataset.baseDuration = cssNumber(duration, 4);
  return cloud;
}
function createWindGustElement() {
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
    "--gust-opacity": cssNumber(randomRange(0.04, 0.16))
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${cssNumber(length)} ${cssNumber(height)}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M 0 ${cssNumber(midpoint)} C ${cssNumber(length * 0.3)} ${cssNumber(midpoint - curve)}, ${cssNumber(length * 0.7)} ${cssNumber(midpoint + curve)}, ${cssNumber(length)} ${cssNumber(midpoint)}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", cssNumber(randomRange(0.6, 1.6)));
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  gust.appendChild(svg);
  return gust;
}
function createSnowflakeElement(front) {
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
    "--flake-opacity-scale": cssNumber(randomRange(0.3, 0.85))
  });
}
function protectInteractive(element) {
  const stop = (event) => event.stopPropagation();
  element.addEventListener("pointerdown", stop);
  element.addEventListener("mousedown", stop);
  element.addEventListener("touchstart", stop);
}
function createFxMarkup(kind) {
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
    for (let index = 0;index < cloudCount; index += 1) {
      clouds.appendChild(createCloudElement(index, cloudCount));
    }
    for (let index = 0;index < (compact ? 3 : 4); index += 1) {
      fog.appendChild(createSpan("weather-fx-fog-band", {
        "--fog-width": `${240 + Math.round(Math.random() * 320)}px`,
        "--fog-height": `${52 + Math.round(Math.random() * 44)}px`,
        "--fog-top": `${14 + index * 12 + Math.round(Math.random() * 5)}%`,
        "--fog-left": `${-14 + Math.round(Math.random() * 90)}%`,
        "--fog-duration": `${18 + Math.round(Math.random() * 16)}s`,
        "--fog-delay": `${Math.round(Math.random() * -18)}s`,
        "--fog-opacity-scale": `${(0.55 + Math.random() * 0.6).toFixed(2)}`
      }));
    }
    for (let index = 0;index < (compact ? 2 : 3); index += 1) {
      mist.appendChild(createSpan("weather-fx-mist-plume", {
        "--mist-width": `${260 + Math.round(Math.random() * 280)}px`,
        "--mist-height": `${80 + Math.round(Math.random() * 42)}px`,
        "--mist-left": `${-12 + Math.round(Math.random() * 88)}%`,
        "--mist-bottom": `${-3 + Math.round(Math.random() * 16)}%`,
        "--mist-duration": `${16 + Math.round(Math.random() * 14)}s`,
        "--mist-delay": `${Math.round(Math.random() * -16)}s`,
        "--mist-opacity-scale": `${(0.6 + Math.random() * 0.55).toFixed(2)}`
      }));
    }
    for (let index = 0;index < (compact ? 4 : 8); index += 1) {
      motes.appendChild(createSpan("weather-fx-mote", {
        "--mote-left": `${Math.round(Math.random() * 100)}%`,
        "--mote-top": `${18 + Math.round(Math.random() * 64)}%`,
        "--mote-size": `${2 + Math.random() * 4}px`,
        "--mote-duration": `${10 + Math.random() * 10}s`,
        "--mote-delay": `${Math.random() * -10}s`,
        "--mote-drift-x": `${(-2 + Math.random() * 4).toFixed(2)}vw`,
        "--mote-drift-y": `${(-1 + Math.random() * 3).toFixed(2)}vh`,
        "--mote-opacity-scale": `${(0.45 + Math.random() * 0.7).toFixed(2)}`
      }));
    }
    for (let index = 0;index < (compact ? 10 : 16); index += 1) {
      windGusts.appendChild(createWindGustElement());
    }
    const backRainCount = resolveRainParticlePool(compact).back;
    for (let index = 0;index < backRainCount; index += 1) {
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
        "--drop-opacity-scale": `${(0.36 + Math.random() * 0.56).toFixed(2)}`
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
    for (let index = 0;index < backImpactCount; index += 1) {
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
        "margin-left": `${cssNumber(splashSize * -0.5)}px`
      });
      splash.dataset.densityThreshold = threshold;
      splashes.appendChild(splash);
      const ripple = createSpan("weather-fx-rain-ripple", {
        "--ripple-left": `${cssNumber(position)}%`,
        "--ripple-bottom": `${cssNumber(bottom)}%`,
        "--impact-duration": `${cssNumber(duration)}s`,
        "--impact-delay": `${cssNumber(delay)}s`,
        "--ripple-size": `${cssNumber(rippleSize)}px`,
        "margin-left": `${cssNumber(rippleSize * -0.5)}px`
      });
      ripple.dataset.densityThreshold = threshold;
      ripples.appendChild(ripple);
    }
    for (let index = 0;index < (compact ? 48 : 72); index += 1) {
      snow.appendChild(createSnowflakeElement(false));
    }
    const frost = document.createElement("div");
    frost.className = "weather-fx-frost";
    root.appendChild(frost);
    const lightning = document.createElement("div");
    lightning.className = "weather-fx-lightning";
    for (let index = 0;index < LIGHTNING_BOLT_SVGS.length; index += 1) {
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
    for (let index = 0;index < frontRainCount; index += 1) {
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
        "--drop-opacity-scale": `${(0.32 + Math.random() * 0.64).toFixed(2)}`
      });
      drop.dataset.densityThreshold = cssNumber(resolveRainDensityThreshold(index, frontRainCount), 4);
      drop.dataset.baseDuration = cssNumber(duration, 4);
      drop.dataset.baseDrift = cssNumber(drift, 4);
      rain.appendChild(drop);
    }
    const splashes = document.createElement("div");
    splashes.className = "weather-fx-rain-splashes weather-fx-rain-splashes-front";
    root.appendChild(splashes);
    for (let index = 0;index < (compact ? 4 : 8); index += 1) {
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
        "margin-left": `${cssNumber(size * -0.5)}px`
      }));
    }
    for (let index = 0;index < (compact ? 30 : 48); index += 1) {
      snow.appendChild(createSnowflakeElement(true));
    }
    const lightningGlow = document.createElement("div");
    lightningGlow.className = "weather-fx-lightning-glow";
    root.appendChild(lightningGlow);
  }
  root.appendChild(flash);
  return { root, host: null, kind, poolCondition: null };
}
function pruneFxMarkup(root, condition) {
  const rainLike = condition === "rain" || condition === "storm";
  const windLike = condition === "cloudy" || rainLike;
  const cloudLike = condition === "cloudy" || rainLike || condition === "snow";
  const fogLike = condition === "fog" || condition === "snow" || rainLike;
  if (!cloudLike)
    root.querySelector(".weather-fx-clouds")?.remove();
  if (!fogLike) {
    root.querySelector(".weather-fx-fog")?.remove();
    root.querySelector(".weather-fx-mist")?.remove();
  }
  if (condition !== "clear")
    root.querySelector(".weather-fx-motes")?.remove();
  if (!windLike)
    root.querySelector(".weather-fx-wind-gusts")?.remove();
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
  if (root.dataset.kind === "front" && !rainLike)
    root.querySelector(".weather-fx-rain-splashes")?.remove();
}
function syncFxCondition(fxRoot, condition) {
  if (fxRoot.poolCondition === condition)
    return;
  const next = createFxMarkup(fxRoot.kind);
  pruneFxMarkup(next.root, condition);
  fxRoot.root.replaceChildren(...Array.from(next.root.childNodes));
  fxRoot.poolCondition = condition;
}
function asHTMLElement(element) {
  return element instanceof HTMLElement ? element : null;
}
function closestByClassFragment(start, fragment) {
  if (!(start instanceof Element))
    return null;
  return asHTMLElement(start.closest(`[class*="${fragment}"]`));
}
function resolveSceneHosts() {
  const backgroundLayer = asHTMLElement(document.querySelector('[class*="sceneBackgroundLayer"]'));
  const sceneTextLayer = asHTMLElement(document.querySelector('[class*="sceneTextContextLayer"]'));
  const sceneHost = backgroundLayer?.parentElement instanceof HTMLElement ? backgroundLayer.parentElement : null;
  const scrollRegion = asHTMLElement(document.querySelector('[data-chat-scroll="true"]'));
  const chatColumnInner = closestByClassFragment(scrollRegion, "chatColumnInner") ?? (scrollRegion?.parentElement instanceof HTMLElement ? scrollRegion.parentElement : null);
  const chatColumn = closestByClassFragment(scrollRegion, "chatColumn") ?? (chatColumnInner?.parentElement instanceof HTMLElement ? chatColumnInner.parentElement : chatColumnInner);
  return {
    backHost: sceneHost ?? backgroundLayer,
    backBefore: sceneTextLayer?.parentElement === sceneHost ? sceneTextLayer : null,
    frontHost: chatColumn ?? chatColumnInner ?? scrollRegion,
    frontBefore: null
  };
}
function readChatIdFromSettingsUpdate(payload) {
  if (!payload || typeof payload !== "object")
    return;
  const key = "key" in payload ? payload.key : undefined;
  if (key !== "activeChatId")
    return;
  const value = "value" in payload ? payload.value : undefined;
  if (typeof value !== "string" || !value.trim())
    return null;
  return value;
}
function readChatIdFromChatSwitch(payload) {
  if (!payload || typeof payload !== "object" || !("chatId" in payload))
    return;
  const value = payload.chatId;
  if (typeof value === "string" && value.trim())
    return value;
  return value === null ? null : undefined;
}
function resolveSceneTokens(state, intensity) {
  const paletteMap = {
    dawn: {
      start: "#20385f",
      mid: "#5a77a9",
      end: "#f0a56e",
      glow: "rgba(255, 203, 145, 0.82)",
      beam: "rgba(255, 218, 165, 0.48)",
      horizon: "rgba(255, 182, 125, 0.44)"
    },
    day: {
      start: "#4d77ad",
      mid: "#7fa8de",
      end: "#d8ebff",
      glow: "rgba(255, 243, 202, 0.78)",
      beam: "rgba(255, 244, 212, 0.44)",
      horizon: "rgba(185, 212, 244, 0.28)"
    },
    dusk: {
      start: "#221f4c",
      mid: "#68487a",
      end: "#f09067",
      glow: "rgba(255, 173, 128, 0.72)",
      beam: "rgba(255, 189, 150, 0.38)",
      horizon: "rgba(224, 149, 114, 0.34)"
    },
    night: {
      start: "#05101d",
      mid: "#10253c",
      end: "#274768",
      glow: "rgba(143, 180, 255, 0.48)",
      beam: "rgba(130, 164, 234, 0.2)",
      horizon: "rgba(74, 104, 154, 0.26)"
    },
    storm: {
      start: "#04101a",
      mid: "#13283a",
      end: "#33475f",
      glow: "rgba(188, 220, 255, 0.26)",
      beam: "rgba(168, 203, 236, 0.16)",
      horizon: "rgba(108, 139, 170, 0.26)"
    },
    mist: {
      start: "#213141",
      mid: "#586c7d",
      end: "#a7bac2",
      glow: "rgba(226, 240, 255, 0.32)",
      beam: "rgba(228, 239, 248, 0.18)",
      horizon: "rgba(206, 220, 228, 0.36)"
    },
    snow: {
      start: "#415b76",
      mid: "#7d93a8",
      end: "#e0e9f1",
      glow: "rgba(255, 252, 244, 0.66)",
      beam: "rgba(242, 245, 255, 0.32)",
      horizon: "rgba(229, 238, 248, 0.4)"
    }
  };
  const basePalette = paletteMap[state.palette];
  const palette = state.condition === "storm" ? paletteMap.storm : state.condition === "rain" ? {
    start: state.palette === "night" ? "#07131f" : "#102032",
    mid: state.palette === "night" ? "#1d3148" : "#324b67",
    end: state.palette === "night" ? "#41566e" : "#61748b",
    glow: "rgba(176, 206, 240, 0.22)",
    beam: "rgba(135, 165, 198, 0.1)",
    horizon: "rgba(120, 147, 174, 0.24)"
  } : state.condition === "cloudy" && (state.palette === "dawn" || state.palette === "dusk") ? {
    ...basePalette,
    end: state.palette === "dawn" ? "#9baec3" : "#7f90a6",
    glow: "rgba(214, 224, 238, 0.24)",
    beam: "rgba(176, 191, 209, 0.12)",
    horizon: "rgba(154, 169, 187, 0.24)"
  } : basePalette;
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
    flashOpacity: 0.26
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
    flashOpacity: values.flashOpacity
  };
}
function createHudWidget(ctx, initialPosition, expanded, callbacks) {
  const size = expanded ? HUD_EXPANDED_SIZE : HUD_COLLAPSED_SIZE;
  const widget = ctx.ui.createFloatWidget({
    width: size.width,
    height: size.height,
    initialPosition,
    snapToEdge: true,
    tooltip: "LumiWeather HUD",
    chromeless: true
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
  const presetButtons = new Map;
  let storyButton;
  let manualButton;
  let layerSelect;
  let intensitySlider;
  let intensityValue;
  let pauseButton;
  let resumeButton;
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
      callbacks.onChangeLayerMode(layerSelect.value);
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
      callbacks.onChangeIntensity(Number.parseFloat(intensitySlider.value));
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
    resumeButton
  };
}
function getLiveDate(state) {
  if (state.source !== "manual")
    return null;
  return new Date;
}
function syncHudState(hud, prefs, state, expanded) {
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
  hud.source.textContent = state ? displayState.source === "manual" ? "Scene lock" : "Story sync" : "Waiting";
  hud.drawerToggleLabel.textContent = expanded ? "Hide" : "Controls";
  hud.drawerToggleIcon.innerHTML = expanded ? CHEVRON_UP_SVG : CHEVRON_DOWN_SVG;
  if (liveDate) {
    hud.date.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(liveDate);
    hud.time.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
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
function setFxVisibility(root, visible) {
  root.root.classList.toggle("weather-hidden", !visible);
  root.root.classList.toggle("weather-visible", visible);
}
function applySceneState(root, state, prefs, reducedMotion) {
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
  root.root.style.setProperty("--weather-rain-color", state.condition === "storm" ? "rgba(212, 231, 255, 0.96)" : "rgba(190, 220, 255, 0.84)");
  root.root.style.setProperty("--weather-snow-color", state.palette === "night" ? "rgba(219, 232, 255, 0.92)" : "rgba(247, 250, 255, 0.95)");
  root.root.style.setProperty("--weather-particle-opacity-static", state.condition === "snow" ? String(clamp(tokens.snowOpacity * 0.2, 0.04, 0.22)) : String(clamp(rainLayerOpacity * 0.13, 0.025, 0.12)));
  root.root.querySelectorAll(".weather-fx-rain-drop").forEach((drop) => {
    const threshold = Number.parseFloat(drop.dataset.densityThreshold ?? "1");
    const baseDuration = Number.parseFloat(drop.dataset.baseDuration ?? "1");
    const baseDrift = Number.parseFloat(drop.dataset.baseDrift ?? "0");
    drop.classList.toggle("weather-density-hidden", threshold > visibleRainDensity);
    drop.style.animationDuration = `${baseDuration * rainProfile.speedScale}s`;
    drop.style.setProperty("--drop-drift", `${baseDrift * rainVector.driftDirection}vw`);
  });
  if (!isFront) {
    root.root.querySelectorAll(".weather-fx-rain-splash, .weather-fx-rain-ripple").forEach((impact) => {
      const threshold = Number.parseFloat(impact.dataset.densityThreshold ?? "1");
      impact.classList.toggle("weather-density-hidden", threshold > visibleRainDensity);
    });
  }
  root.root.querySelectorAll(".weather-fx-cloud").forEach((cloud) => {
    const baseDuration = Number.parseFloat(cloud.dataset.baseDuration ?? "60");
    cloud.style.animationDuration = `${baseDuration * cloudSpeedScale}s`;
  });
}
function setup(ctx) {
  const cleanups = [];
  const removeStyle = ctx.dom.addStyle(WEATHER_HUD_CSS);
  cleanups.push(removeStyle);
  let currentPrefs = DEFAULT_PREFS;
  let currentState = null;
  let activeChatId = null;
  let activeChatRequestId = 0;
  let hudExpanded = false;
  let permissionWarning = null;
  const processedWeatherTags = new Map;
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const getReducedMotion = () => currentPrefs.reducedMotion === "always" || currentPrefs.reducedMotion === "system" && motionMedia.matches;
  const sendManualState = (state) => {
    sendToBackend(ctx, { type: "set_manual_state", chatId: activeChatId, state });
  };
  const resumeStorySync = () => {
    sendToBackend(ctx, { type: "clear_manual_override", chatId: activeChatId });
  };
  const applyPreset = (presetId) => {
    const nextState = buildPresetWeatherState(presetId, currentState);
    if (!nextState)
      return;
    sendManualState(nextState);
  };
  const lockCurrentScene = () => {
    const state = currentState ?? makeDefaultWeatherState();
    sendManualState({
      ...state,
      source: "manual"
    });
  };
  const settingsMount = ctx.ui.mount("settings_extensions");
  const settingsUI = createSettingsUI((payload) => {
    const message = payload;
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
  let hostSyncFrame = null;
  const detachFxRoot = (fxRoot) => {
    fxRoot.root.remove();
    fxRoot.host = null;
  };
  const attachFxRoot = (fxRoot, nextHost, before) => {
    if (!nextHost) {
      const hadHost = !!fxRoot.host || fxRoot.root.isConnected;
      detachFxRoot(fxRoot);
      return hadHost;
    }
    if (fxRoot.host === nextHost && fxRoot.root.parentElement === nextHost && (!before || fxRoot.root.nextElementSibling === before)) {
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
  const attachFxRoots = () => {
    hostSyncFrame = null;
    const nextHosts = resolveSceneHosts();
    const backChanged = attachFxRoot(backFx, nextHosts.backHost, nextHosts.backBefore);
    const frontChanged = attachFxRoot(frontFx, nextHosts.frontHost, nextHosts.frontBefore);
    return backChanged || frontChanged;
  };
  let hostObserver = null;
  const stopHostObserver = () => {
    hostObserver?.disconnect();
    hostObserver = null;
  };
  const ensureHostObserver = () => {
    if (hostObserver || !document.body)
      return;
    hostObserver = new MutationObserver(() => {
      if (attachFxRoots()) {
        updateScene();
      }
      if (backFx.host?.isConnected && frontFx.host?.isConnected)
        stopHostObserver();
    });
    hostObserver.observe(document.body, { childList: true, subtree: true });
  };
  const queueFxRootAttach = () => {
    if (hostSyncFrame !== null)
      return;
    hostSyncFrame = window.requestAnimationFrame(() => {
      const changed = attachFxRoots();
      if (changed)
        updateScene();
      if (backFx.host?.isConnected && frontFx.host?.isConnected)
        stopHostObserver();
      else
        ensureHostObserver();
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
  let hud = null;
  let removeHudDragListener = null;
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
  const buildHud = (position) => {
    const nextPosition = position ?? hud?.widget.getPosition() ?? currentPrefs.widgetPosition ?? DEFAULT_WIDGET_POSITION;
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
      }
    });
    removeHudDragListener = hud.widget.onDragEnd((nextPositionFromDrag) => {
      sendToBackend(ctx, { type: "save_prefs", prefs: { widgetPosition: nextPositionFromDrag } });
    });
    syncHudState(hud, currentPrefs, currentState, hudExpanded);
  };
  buildHud(currentPrefs.widgetPosition);
  cleanups.push(() => destroyHud());
  let flashTimer = null;
  const resetFlashTimer = () => {
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
  };
  const scheduleStormFlash = () => {
    resetFlashTimer();
    if (currentState?.condition !== "storm" || getReducedMotion() || currentPrefs.pauseEffects || !currentPrefs.effectsEnabled || document.visibilityState === "hidden" || !activeChatId) {
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
      const bolts = backFx.root.querySelectorAll(".weather-fx-lightning-bolt");
      if (bolts.length > 0) {
        const boltIndex = Math.floor(Math.random() * bolts.length);
        const bolt = bolts[boltIndex];
        const boltX = LIGHTNING_BOLT_POSITIONS[boltIndex] ?? 50;
        bolt.classList.remove("weather-lightning-strike");
        bolt.offsetWidth;
        bolt.classList.add("weather-lightning-strike");
        frontFx.root.style.setProperty("--weather-lightning-x", `${boltX}%`);
        frontFx.root.classList.remove("weather-lightning-glow-flash");
        frontFx.root.offsetWidth;
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
  const tagUnsub = ctx.messages.registerTagInterceptor({ tagName: WEATHER_TAG_NAME, removeFromMessage: true }, (payload) => {
    if (!shouldProcessWeatherTag(payload))
      return;
    const chatId = payload.chatId ?? activeChatId;
    if (!chatId)
      return;
    const dedupeKey = `${chatId}:${payload.messageId ?? ""}:${payload.fullMatch}`;
    if (processedWeatherTags.has(dedupeKey))
      return;
    processedWeatherTags.set(dedupeKey, payload.fullMatch);
    if (processedWeatherTags.size > 200) {
      const oldest = processedWeatherTags.keys().next().value;
      if (oldest)
        processedWeatherTags.delete(oldest);
    }
    sendToBackend(ctx, {
      type: "weather_tag_intercepted",
      chatId,
      messageId: payload.messageId ?? null,
      attrs: payload.attrs,
      isStreaming: false
    });
  });
  cleanups.push(tagUnsub);
  const msgUnsub = ctx.onBackendMessage((raw) => {
    const message = raw;
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
        if (!shouldApplyChatState(activeChatId, message.chatId, message.requestId, activeChatRequestId))
          break;
        activeChatId = message.chatId;
        currentState = message.state;
        updateScene();
        break;
      case "weather_state":
        if (message.chatId !== activeChatId)
          break;
        currentState = message.state;
        updateScene();
        break;
      case "error":
        console.warn(`[weather_hud] ${message.message}`);
        break;
    }
  });
  cleanups.push(msgUnsub);
  const requestActiveChatState = (chatId) => {
    if (chatId === activeChatId && activeChatRequestId > 0)
      return;
    activeChatId = chatId;
    currentState = null;
    processedWeatherTags.clear();
    queueFxRootAttach();
    activeChatRequestId += 1;
    sendToBackend(ctx, { type: "chat_changed", chatId, requestId: activeChatRequestId });
    updateScene();
  };
  const chatSwitchedUnsub = ctx.events.on("CHAT_SWITCHED", (payload) => {
    const chatId = readChatIdFromChatSwitch(payload);
    if (typeof chatId !== "undefined")
      requestActiveChatState(chatId);
  });
  cleanups.push(chatSwitchedUnsub);
  const settingsChangedUnsub = ctx.events.on("SETTINGS_UPDATED", (payload) => {
    const nextChatId = readChatIdFromSettingsUpdate(payload);
    if (typeof nextChatId !== "undefined")
      requestActiveChatState(nextChatId);
  });
  cleanups.push(settingsChangedUnsub);
  sendToBackend(ctx, { type: "frontend_ready" });
  queueFxRootAttach();
  updateScene();
  ctx.permissions.getGranted().then((granted) => {
    if (!granted.includes("interceptor")) {
      permissionWarning = "Enable the Interceptor permission to inject the current weather scene into prompts.";
      updateScene();
    }
  }).catch(() => {});
  return () => {
    resetFlashTimer();
    for (const cleanup of cleanups.reverse())
      cleanup();
  };
}
export {
  setup
};
