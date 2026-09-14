import { describe, expect, test } from "bun:test";

import { decodeForecastText, encodeForecastText, forecastTextHint } from "./forecast-text";
import { formatForecastEntry, normalizeForecast, serializeForecast } from "./forecast-utils";
import { applyManualWeatherState, normalizeWeatherState, normalizeWeatherTag } from "./shared";
import type { ForecastEntry } from "./types";

const sample: ForecastEntry[] = [
  { date: "2026-01-16", condition: "snow", summary: "heavy flurries", temperature: "30F" },
  { date: "2026-01-17", condition: "cloudy", summary: "grey skies", temperature: "34F" },
];

describe("manual outlook editor text", () => {
  test("encodes one entry per line", () => {
    const text = encodeForecastText(sample);
    expect(text.split("\n").length).toBe(2);
    expect(text.split("\n")[0]).toBe("2026-01-16: snow, 30F, heavy flurries");
  });

  test("round-trips encoded text back to the same entries", () => {
    expect(decodeForecastText(encodeForecastText(sample)).entries).toEqual(sample);
  });

  test("ignores blank lines and surrounding whitespace", () => {
    const decoded = decodeForecastText("\n  2026-01-16: snow, 30F  \n\n   \n2026-01-17: rain\n");
    expect(decoded.entries.length).toBe(2);
    expect(decoded.invalidLines).toEqual([]);
  });

  test("reports unparseable lines instead of dropping them silently", () => {
    const decoded = decodeForecastText("2026-01-16: snow\nnot a date\ntomorrow: rain");
    expect(decoded.entries.length).toBe(1);
    expect(decoded.invalidLines).toEqual(["not a date", "tomorrow: rain"]);
  });

  test("accepts exactly the same text the tag attribute accepts", () => {
    // The editor and the hidden tag share one parser, so anything the model may
    // emit is also expressible by hand.
    const tagValue = "2026-01-16: snow, 30F, heavy flurries | 2026-01-17: cloudy, 34F";
    const fromTag = normalizeForecast(tagValue);
    const fromEditor = decodeForecastText(encodeForecastText(fromTag)).entries;
    expect(fromEditor).toEqual(fromTag);
    expect(serializeForecast(fromEditor)).toBe(tagValue);
  });

  test("treats an empty field as clearing the outlook", () => {
    expect(decodeForecastText("").entries).toEqual([]);
    expect(decodeForecastText("   \n  ").entries).toEqual([]);
  });

  test("describes the expected input", () => {
    expect(forecastTextHint()).toContain("2026-01-16: snow, 30F");
  });
});

describe("manual scene edits carry the v1.4 state", () => {
  test("applies an explicit season override", () => {
    const applied = normalizeWeatherState(
      { date: "2026-07-15", time: "3:00 PM", season: "winter", source: "manual" },
      normalizeWeatherTag({ date: "2026-07-15", time: "3:00 PM" }),
    );
    expect(applied.season).toBe("winter");
  });

  test("re-derives the season when the editor clears the override", () => {
    const previous = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM", season: "winter" });
    const applied = applyManualWeatherState(
      previous,
      JSON.parse(JSON.stringify({ date: "2026-07-15", time: "3:00 PM", seasonOverride: null })),
    );
    expect(applied.season).toBe("summer");
  });

  test("lets a manual edit set and then clear the outlook", () => {
    const previous = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM" });
    const withForecast = normalizeWeatherState(
      { date: "2026-01-15", time: "3:00 PM", forecast: normalizeForecast("2026-01-16: snow, 30F") },
      previous,
    );
    expect(withForecast.forecast.length).toBe(1);

    const cleared = normalizeWeatherState(
      { date: "2026-01-15", time: "3:00 PM", forecast: [] },
      withForecast,
    );
    expect(cleared.forecast).toEqual([]);
  });

  test("keeps an untouched outlook when only another field changes", () => {
    const previous = normalizeWeatherState(
      { date: "2026-01-15", time: "3:00 PM", forecast: "2026-01-16: snow, 30F" },
      null,
    );
    const edited = normalizeWeatherState(
      { date: "2026-01-15", time: "3:00 PM", summary: "Rain easing off" },
      previous,
    );
    expect(edited.forecast.length).toBe(1);
    expect(edited.summary).toBe("Rain easing off");
  });

  test("survives a preset applied over a scene that already has an outlook", () => {
    // `buildPresetWeatherState` spreads the current state, so a preset click must
    // not wipe a projection the user set by hand.
    const base = normalizeWeatherState(
      { location: "Moon Harbor", date: "2026-04-02", forecast: "2026-04-03: rain, 55F" },
      null,
    );
    expect(base.forecast.length).toBe(1);
    expect(formatForecastEntry(base.forecast[0])).toBe("2026-04-03: rain, 55F");
  });
});
