import { WEATHER_CONDITIONS, WEATHER_PALETTES, WEATHER_SEASONS } from "./shared";
import { formatForecastEntry } from "./forecast-utils";
import type { WeatherState } from "./types";

export function buildWeatherTagExample(): string {
  return '<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm" season="winter" forecast="2026-01-16: snow, 30F, heavy flurries | 2026-01-17: cloudy, 34F"></weather-state>';
}

export function summarizeWeatherState(state: WeatherState | null): string {
  if (!state) return "No saved weather state yet.";
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
  ];
  if (state.forecast.length > 0) {
    lines.push(`Forecast: ${state.forecast.map(formatForecastEntry).join(" | ")}`);
  }
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
    "Preserve every other current scene field unless the visible narrative changes it.",
    "Do not wrap the tag in markdown fences.",
    "Do not explain the tag or mention it in visible prose.",
    "Never place visible prose after the tag.",
    "Emit the tag as the very last text in the assistant message.",
    `Allowed conditions: ${WEATHER_CONDITIONS.join(", ")}`,
    `Allowed palettes: ${WEATHER_PALETTES.join(", ")}`,
    `Allowed seasons: ${WEATHER_SEASONS.join(", ")}`,
    "Use location, date, time, condition, summary, temperature, intensity, wind, windDirection, and palette.",
    "windDirection is where the wind comes from and must be one of: none, north, northeast, east, southeast, south, southwest, west, northwest.",
    "season is optional and, when present, is one of: spring, summer, autumn, winter.",
    "forecast is optional and projects at most five later days. Separate entries with a pipe and format each as date: condition, temperature, summary.",
    "Only include forecast entries the narrative meaningfully establishes; do not invent a daily outlook merely to fill the field.",
    "When forecast is omitted, the previous projection stays in place.",
    "Exact wrapper example:",
    buildWeatherTagExample(),
  ].join("\n");
}

export function buildStaticStateMacro(): string {
  return "The current LumiWeather scene state is injected for the active chat during generation.";
}

export function buildPromptInstruction(state: WeatherState | null): string {
  return [
    "[LumiWeather HUD]",
    "Keep the visible reply natural and in-character.",
    buildTrackerMacro(),
    `Current scene: ${summarizeWeatherState(state)}`,
  ].join("\n");
}
