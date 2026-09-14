import { formatForecastEntry, parseForecastEntry } from "./forecast-utils";
import type { ForecastEntry } from "./types";

/**
 * Text form used by the manual scene editor: one entry per line, each in the
 * same `date: condition, temperature, summary` shape the tag attribute uses.
 *
 * Keeping the editor on the shared parser means the manual path and the tag path
 * accept exactly the same input, so a line that works in the editor also works in
 * a model-emitted tag.
 */
export function encodeForecastText(entries: ForecastEntry[]): string {
  return entries.map(formatForecastEntry).join("\n");
}

/**
 * Parses editor text. Blank lines are ignored. Unparseable lines are reported
 * rather than dropped, so a typo is visible instead of silently discarding a
 * forecast day.
 */
export function decodeForecastText(text: string): { entries: ForecastEntry[]; invalidLines: string[] } {
  const entries: ForecastEntry[] = [];
  const invalidLines: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = parseForecastEntry(line);
    if (entry) entries.push(entry);
    else invalidLines.push(line);
  }

  return { entries, invalidLines };
}

/** Human-readable hint shown under the editor field. */
export function forecastTextHint(): string {
  return "One day per line, such as 2026-01-16: snow, 30F, heavy flurries. Leave empty to clear the outlook.";
}
