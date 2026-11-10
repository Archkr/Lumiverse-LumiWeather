import {
  WEATHER_CONDITIONS,
  WEATHER_EXPOSURES,
  WEATHER_PALETTES,
  WEATHER_PHENOMENA,
  WEATHER_SEASONS,
} from "./shared";
import { formatForecastEntry } from "./forecast-utils";
import { resolveLunarPhase } from "./time-utils";
import type { WeatherState } from "./types";

export function buildWeatherTagExample(): string {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm" season="winter" exposure="outdoor" phenomenon="none" forecast="2026-01-16: rain, 58F, lingering showers | 2026-01-17: cloudy, 56F, cool overcast skies | 2026-01-18: clear, 57F, mild winter sunshine"></weather-state>';
}

export function summarizeWeatherState(state: WeatherState | null): string {
  if (!state) return "No saved weather state yet.";
  const lunar = resolveLunarPhase(state.date, state.time);
  const lines = [
    `Location: ${state.location}`,
    `Date: ${state.date}`,
    `Time: ${state.time}`,
    `Condition: ${state.condition}`,
    `Summary: ${state.summary}`,
    `Temperature: ${state.temperature}`,
    `Intensity: ${state.intensity.toFixed(2)}`,
    `Wind: ${state.wind}`,
    `Wind direction: ${state.windDirection}`,
    `Palette: ${state.palette}`,
    `Season: ${state.season}`,
    `Exposure: ${state.exposure ?? "outdoor"}`,
    `Phenomenon: ${state.phenomenon ?? "none"}`,
    `Lunar phase: ${lunar.label} (${Math.round(lunar.illumination * 100)}% illuminated)`,
  ];
  const forecast = state.forecast.length > 0
    ? state.forecast.map(formatForecastEntry).join(" | ")
    : "Not set yet; create a near-term outlook in the next tag.";
  lines.push(`Forecast: ${forecast}`);
  return lines.join(" | ");
}

export function buildTrackerMacro(): string {
  return [
    "IMPORTANT OUTPUT FORMAT:",
    "Write the visible reply first, then append exactly one final XML weather-state tag.",
    "Never omit the weather-state tag, even when the scene state stays unchanged.",
    "Treat date and time as story-continuity state, not as a timestamp for this reply.",
    "Copy the current date and time exactly unless the visible narrative explicitly establishes that time passed.",
    "Do not advance time merely because another message was sent, because dialogue occurred, or because real-world time passed.",
    "Brief dialogue and quick actions normally keep the exact same time; only advance it for narrated waits, travel, sleep, time skips, or other clear elapsed time.",
    "When time does advance, make the amount match the elapsed time established by the narrative.",
    "Preserve every other current scene field unless the visible narrative changes it; maintain the forecast as instructed below.",
    "Do not wrap the tag in markdown fences.",
    "Do not explain the tag or mention it in visible prose.",
    "Never place visible prose after the tag.",
    "Emit the tag as the very last text in the assistant message.",
    `Allowed conditions: ${WEATHER_CONDITIONS.join(", ")}`,
    `Allowed palettes: ${WEATHER_PALETTES.join(", ")}`,
    `Allowed seasons: ${WEATHER_SEASONS.join(", ")}`,
    `Allowed exposures: ${WEATHER_EXPOSURES.join(", ")}`,
    `Allowed phenomena: ${WEATHER_PHENOMENA.join(", ")}`,
    "Use location, date, time, condition, summary, temperature, intensity, wind, windDirection, palette, and forecast.",
    "windDirection is where the wind comes from and must be one of: none, north, northeast, east, southeast, south, southwest, west, northwest.",
    "season is optional and, when present, is one of: spring, summer, autumn, winter.",
    "exposure is optional (outdoor, sheltered, indoor, underground) and tracks whether the active scene is in open air, under cover/porch/canopy, inside a building looking through windows, or underground.",
    "phenomenon is optional (none, aurora, blossoms, embers, ashfall, fireflies, sandstorm) for special atmospheric effects.",
    "Include a non-empty forecast attribute in every weather-state tag, even when the visible narrative does not discuss future weather.",
    "Project the next three story calendar days by default, with at most five future days total. Use real YYYY-MM-DD calendar dates strictly after the date in this tag, in chronological order with no duplicate days.",
    "Separate forecast entries with a pipe and format each as date: condition, temperature, summary. Include a supported condition, a temperature with an F or C suffix, and a brief summary for each day; keep the scene's temperature unit.",
    "Use future weather established by the story when available. Otherwise create a plausible near-term outlook from the scene's location, season, current weather, and temperature; this is a projection of fictional story weather, not live forecast data.",
    "Copy existing future forecast entries unchanged unless the narrative establishes a weather change. Fill missing days in the default three-day horizon plausibly rather than leaving the forecast empty; preserve later saved days within the five-entry limit.",
    "When the story date advances, remove entries on or before that date, keep the remaining future outlook, and add missing days to restore the default three-day horizon. Base all forecast dates on the story date in this tag, never on the device date or the example date below.",
    "Stable weather is a valid projection; do not force changes or narrate future events merely to populate the forecast.",
    'Use forecast="" only when the user explicitly asks to clear the outlook.',
    "Exact wrapper example:",
    buildWeatherTagExample(),
  ].join("\n");
}

export function buildStaticStateMacro(): string {
  return "Use the most recent assistant weather-state tag in chat history as the current scene reference.";
}

export function buildPromptInstruction(): string {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    "Use the most recent assistant weather-state tag in chat history as the current scene reference.",
    "If a [LumiWeather Current Scene] reference is supplied after history, use it instead; it restores missing state or a manual override.",
    "If neither exists, establish the initial scene from the narrative.",
  ].join("\n");
}

/** Changing scene data belongs after history so it cannot invalidate the instruction prefix. */
export function buildSceneInstruction(state: WeatherState | null): string {
  return [
    "[LumiWeather Current Scene]",
    `Current scene: ${summarizeWeatherState(state)}`,
  ].join("\n");
}
