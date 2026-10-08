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
  >;
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
    Math.abs(preset.state.intensity - state.intensity) < 0.001,
  );

  return match?.id ?? null;
}
