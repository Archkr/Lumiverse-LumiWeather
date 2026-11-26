import type { LlmMessageDTO } from "lumiverse-spindle-types";

import { formatForecastEntry } from "./forecast-utils";
import {
  WEATHER_CONDITIONS,
  WEATHER_EXPOSURES,
  WEATHER_PALETTES,
  WEATHER_PHENOMENA,
  WEATHER_SEASONS,
  WEATHER_WIND_DIRECTIONS,
  normalizeWeatherState,
} from "./shared";
import { stripWeatherStateTags } from "./tag-utils";
import { seasonFromStoryDate } from "./time-utils";
import type { WeatherState } from "./types";

export interface SidecarTurn {
  role: "user" | "assistant";
  name?: string;
  content: string;
}

const MAX_TURN_CHARS = 2400;

function truncateTurnText(text: string, maxChars = MAX_TURN_CHARS): string {
  const cleaned = stripWeatherStateTags(text).trim();
  if (cleaned.length <= maxChars) return cleaned;
  // Keep both opening context and ending prose (where scene transitions often land).
  const head = Math.floor(maxChars * 0.4);
  const tail = maxChars - head - 5;
  return `${cleaned.slice(0, head).trimEnd()}\n...\n${cleaned.slice(-tail).trimStart()}`;
}

export function buildSidecarSystemPrompt(): string {
  return [
    "You are a silent story-scene tracker for a weather and time HUD.",
    "Given the previous scene state and the latest story messages, output ONLY a single raw JSON object with the updated scene state.",
    "Do not wrap the JSON in markdown fences, explanations, or commentary.",
    "",
    "Rules:",
    "- Copy every previous field unchanged unless the latest story text clearly changes it.",
    "- If a previous state already exists with a non-empty forecast and nothing changed in the latest messages (including time), you may return {\"unchanged\": true}.",
    "- Treat date and time as story continuity, NOT real-world wall-clock time. Brief dialogue or quick actions keep the exact same time; only advance time for narrated waits, travel, sleep, or explicit time skips.",
    "- When no previous state exists, establish a plausible initial scene (location, date, time, condition, summary, temperature, intensity, wind, windDirection, palette, season, exposure, phenomenon, forecast) grounded in the narrative.",
    "- Always maintain a 3-day fictional forecast (up to 5 days) with real YYYY-MM-DD dates strictly after the current date, keeping existing future forecast entries unchanged unless the story alters them and rolling past days off when the date advances.",
    "- Track exposure carefully: outdoor (open air), sheltered (porch/canopy/awning/veranda), indoor (inside a building/room/vehicle), underground (cave/dungeon/cellar/tunnel).",
    "",
    "JSON schema (omit unchanged fields if returning a delta, or include all fields):",
    "{",
    '  "location": "short place name",',
    '  "date": "YYYY-MM-DD",',
    '  "time": "h:mm AM/PM",',
    `  "condition": "${WEATHER_CONDITIONS.join(" | ")}",`,
    '  "summary": "brief atmospheric phrase (max 80 chars)",',
    '  "temperature": "integer + F or C (e.g. 64F or 18C)",',
    '  "intensity": 0.0 to 1.0,',
    '  "wind": "short wind description (e.g. still, light breeze, strong gusts)",',
    `  "windDirection": "${WEATHER_WIND_DIRECTIONS.join(" | ")}",`,
    `  "palette": "${WEATHER_PALETTES.join(" | ")}",`,
    `  "season": "${WEATHER_SEASONS.join(" | ")}",`,
    `  "exposure": "${WEATHER_EXPOSURES.join(" | ")}",`,
    `  "phenomenon": "${WEATHER_PHENOMENA.join(" | ")}",`,
    '  "forecast": [{ "date": "YYYY-MM-DD", "condition": "rain", "temperature": "60F", "summary": "brief outlook" }]',
    "}",
  ].join("\n");
}

function serializePreviousState(state: WeatherState | null): string {
  if (!state) return "None (establish the initial scene from the story excerpt below).";
  return JSON.stringify({
    location: state.location,
    date: state.date,
    time: state.time,
    condition: state.condition,
    summary: state.summary,
    temperature: state.temperature,
    intensity: Number(state.intensity.toFixed(2)),
    wind: state.wind,
    windDirection: state.windDirection,
    palette: state.palette,
    season: state.season,
    exposure: state.exposure ?? "outdoor",
    phenomenon: state.phenomenon ?? "none",
    forecast: state.forecast.map((entry) => formatForecastEntry(entry)),
  });
}

export function buildSidecarExtractionMessages(
  previousState: WeatherState | null,
  recentTurns: SidecarTurn[],
): LlmMessageDTO[] {
  const formattedTurns = recentTurns
    .map((turn) => {
      const text = truncateTurnText(turn.content);
      if (!text) return null;
      const speaker = turn.name?.trim() || (turn.role === "user" ? "User" : "Assistant");
      return `[${speaker} (${turn.role})]\n${text}`;
    })
    .filter((entry): entry is string => entry !== null);

  const userContent = [
    `Previous scene state:\n${serializePreviousState(previousState)}`,
    "",
    "Latest story excerpt:",
    formattedTurns.length > 0 ? formattedTurns.join("\n\n") : "(empty)",
    "",
    "Return ONLY the JSON object.",
  ].join("\n");

  return [
    { role: "system", content: buildSidecarSystemPrompt() },
    { role: "user", content: userContent },
  ];
}

function flattenContent(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/** Handles all common response envelopes returned by `spindle.generate.quiet` / `raw`. */
export function extractTextFromGenerationResult(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const direct = flattenContent(record.content) ?? flattenContent(record.text) ?? flattenContent(record.output);
  if (direct !== null) return direct;

  if (record.message && typeof record.message === "object") {
    const msgContent = flattenContent((record.message as Record<string, unknown>).content);
    if (msgContent !== null) return msgContent;
  }

  if (Array.isArray(record.choices) && record.choices.length > 0) {
    const first = record.choices[0] as Record<string, unknown> | undefined;
    if (first && typeof first === "object") {
      const choiceText =
        flattenContent(first.text) ??
        (first.message && typeof first.message === "object"
          ? flattenContent((first.message as Record<string, unknown>).content)
          : null);
      if (choiceText !== null) return choiceText;
    }
  }

  if (record.result !== undefined) {
    return extractTextFromGenerationResult(record.result);
  }

  return null;
}

/** Extracts the first balanced JSON object from a model reply, tolerating think tags & code fences. */
export function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const withoutThinking = rawText.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "").trim();
  const unfenced = withoutThinking
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(unfenced);
  if (direct) return direct;

  // Scan for balanced `{ ... }` blocks in case prose precedes or follows the JSON.
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < unfenced.length; i += 1) {
    const ch = unfenced[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const parsed = tryParse(unfenced.slice(start, i + 1));
        if (parsed) return parsed;
        start = -1;
      }
    }
  }
  return null;
}

export function parseSidecarExtractionResponse(
  rawResponse: unknown,
  previousState: WeatherState | null,
  updatedAt = Date.now(),
): WeatherState | null {
  const text = extractTextFromGenerationResult(rawResponse);
  if (!text) return null;
  const parsed = extractJsonObject(text);
  if (!parsed) return null;

  if (parsed.unchanged === true && previousState) {
    return {
      ...previousState,
      updatedAt,
      source: "story",
    };
  }

  // Filter out explicit null/undefined optional fields so omitted/null delta keys
  // inherit cleanly from `previousState` instead of wiping values.
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "unchanged" || value === null || value === undefined) continue;
    cleaned[key] = value;
  }

  if (Object.keys(cleaned).length === 0) {
    return previousState ? { ...previousState, updatedAt, source: "story" } : null;
  }

  const normalized = normalizeWeatherState(
    { ...cleaned, updatedAt, source: "story" },
    previousState,
  );

  // If the sidecar echoed the calendar-derived season without intending a fantasy
  // override, keep `seasonOverride: null` so future date jumps roll seasons naturally.
  const derived = seasonFromStoryDate(normalized.date, normalized.time);
  if (normalized.seasonOverride && normalized.seasonOverride === derived && !previousState?.seasonOverride) {
    normalized.seasonOverride = null;
  }

  return normalized;
}
