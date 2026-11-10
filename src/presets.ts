import { formatDate, makeDefaultWeatherState } from "./shared";
import { isRealCalendarDate } from "./forecast-utils";
import type { WeatherState } from "./types";

export interface WeatherScenePreset {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  state: Pick<
    WeatherState,
    "time" | "condition" | "summary" | "temperature" | "wind" | "palette" | "intensity"
  > & {
    exposure?: WeatherState["exposure"];
    phenomenon?: WeatherState["phenomenon"];
  };
}

export const WEATHER_SCENE_PRESETS: WeatherScenePreset[] = [
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
      intensity: 0.34,
    },
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
      intensity: 0.58,
    },
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
      intensity: 0.74,
    },
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
      intensity: 0.94,
    },
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
      intensity: 0.68,
    },
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
      intensity: 0.64,
    },
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
      intensity: 0.24,
    },
  },
  {
    id: "aurora-night",
    label: "Aurora night",
    shortLabel: "Aurora",
    description: "Polar ribbons dancing across a crisp starlit sky.",
    state: {
      time: "11:12 PM",
      condition: "clear",
      summary: "Aurora ribbons overhead",
      temperature: "26F",
      wind: "still polar air",
      palette: "night",
      intensity: 0.72,
      exposure: "outdoor",
      phenomenon: "aurora",
    },
  },
  {
    id: "cozy-indoors",
    label: "Indoor rain",
    shortLabel: "Indoors",
    description: "Warm interior shelter with rain streaking down the windowpane.",
    state: {
      time: "9:24 PM",
      condition: "rain",
      summary: "Rain against the windowpane",
      temperature: "59F",
      wind: "muffled gusts",
      palette: "night",
      intensity: 0.76,
      exposure: "indoor",
      phenomenon: "none",
    },
  },
  {
    id: "sakura-breeze",
    label: "Blossom drift",
    shortLabel: "Blossoms",
    description: "Spring petals riding a warm afternoon breeze.",
    state: {
      time: "3:40 PM",
      condition: "clear",
      summary: "Petals drifting on the breeze",
      temperature: "69F",
      wind: "breezy",
      palette: "day",
      intensity: 0.62,
      exposure: "outdoor",
      phenomenon: "blossoms",
    },
  },
  {
    id: "ember-dusk",
    label: "Ember dusk",
    shortLabel: "Embers",
    description: "Glowing cinders rising into a dramatic twilight sky.",
    state: {
      time: "7:35 PM",
      condition: "cloudy",
      summary: "Cinders rising through dusk",
      temperature: "66F",
      wind: "warm updraft",
      palette: "dusk",
      intensity: 0.78,
      exposure: "outdoor",
      phenomenon: "embers",
    },
  },
];

export function getWeatherScenePreset(presetId: string): WeatherScenePreset | null {
  return WEATHER_SCENE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function buildPresetWeatherState(
  presetId: string,
  currentState?: WeatherState | null,
): Partial<WeatherState> | null {
  const preset = getWeatherScenePreset(presetId);
  if (!preset) return null;

  const baseState = currentState ?? makeDefaultWeatherState();
  const fallbackDate = isRealCalendarDate(baseState.date)
    ? baseState.date
    : formatDate(new Date());

  return {
    location: baseState.location,
    date: fallbackDate,
    exposure: preset.state.exposure ?? "outdoor",
    phenomenon: preset.state.phenomenon ?? "none",
    ...preset.state,
    source: "manual",
  };
}

export function matchWeatherScenePreset(state?: WeatherState | null): string | null {
  if (!state) return null;

  const match = WEATHER_SCENE_PRESETS.find((preset) =>
    preset.state.condition === state.condition &&
    preset.state.palette === state.palette &&
    preset.state.time === state.time &&
    preset.state.summary === state.summary &&
    preset.state.temperature === state.temperature &&
    preset.state.wind === state.wind &&
    (preset.state.exposure ?? "outdoor") === (state.exposure ?? "outdoor") &&
    (preset.state.phenomenon ?? "none") === (state.phenomenon ?? "none") &&
    Math.abs(preset.state.intensity - state.intensity) < 0.001,
  );

  return match?.id ?? null;
}
