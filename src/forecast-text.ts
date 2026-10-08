import { formatForecastEntry, MAX_FORECAST_DAYS, parseForecastEntry } from "./forecast-utils";
import type { ForecastEntry } from "./types";

/**
 * Text form used by the manual scene editor: one entry per line, each in the
 * same `date: condition, temperature, summary` shape the tag attribute uses.
 *
 * The shared parser keeps each day's format consistent with model-emitted tags.
 * The editor also reports duplicates and excess days before normalization can
 * replace or discard a user's entries.
 */
export function encodeForecastText(entries: ForecastEntry[]): string {
  return entries.map(formatForecastEntry).join("\n");
}

/**
 * Parses editor text. Blank lines are ignored. Unparseable lines are reported
 * rather than dropped, so a typo is visible instead of silently discarding a
 * forecast day. Duplicate and limit checks keep every parsed entry available
 * until the editor has shown any problems to the user.
 */
export function decodeForecastText(text: string): {
  entries: ForecastEntry[];
  invalidLines: string[];
  duplicateDates: string[];
  exceedsDayLimit: boolean;
} {
  const entries: ForecastEntry[] = [];
  const invalidLines: string[] = [];
  const seenDates = new Set<string>();
  const duplicateDates = new Set<string>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = parseForecastEntry(line);
    if (entry) {
      entries.push(entry);
      if (seenDates.has(entry.date)) duplicateDates.add(entry.date);
      seenDates.add(entry.date);
    } else invalidLines.push(line);
  }

  return {
    entries,
    invalidLines,
    duplicateDates: [...duplicateDates],
    exceedsDayLimit: seenDates.size > MAX_FORECAST_DAYS,
  };
}

/** Human-readable hint shown under the editor field. */
export function forecastTextHint(): string {
  return `Up to ${MAX_FORECAST_DAYS} days, one day per line, such as 2026-01-16: snow, 30F, heavy flurries. Use each date once. Leave empty to clear the outlook.`;
}
