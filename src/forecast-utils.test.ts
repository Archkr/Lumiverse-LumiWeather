import { describe, expect, test } from "bun:test";
import {
  MAX_FORECAST_DAYS,
  formatForecastEntry,
  isRealCalendarDate,
  normalizeForecast,
  parseForecastEntry,
  serializeForecast,
  splitForecastEntries,
} from "./forecast-utils";
import { makeDefaultWeatherState, normalizeWeatherState, normalizeWeatherTag } from "./shared";

describe("weather forecast parsing", () => {
  test("rejects dates that are not real calendar values", () => {
    expect(isRealCalendarDate("2026-01-15")).toBe(true);
    expect(isRealCalendarDate("2026-02-30")).toBe(false);
    expect(isRealCalendarDate("2026-13-01")).toBe(false);
    expect(isRealCalendarDate("2024-02-29")).toBe(true);
    expect(isRealCalendarDate("15-01-2026")).toBe(false);
    expect(isRealCalendarDate("")).toBe(false);
  });

  test("accepts pipes, semicolons, and newlines as entry separators", () => {
    expect(splitForecastEntries("a | b").length).toBe(2);
    expect(splitForecastEntries("a; b").length).toBe(2);
    expect(splitForecastEntries("a\nb").length).toBe(2);
    expect(splitForecastEntries("  |  ").length).toBe(0);
  });

  test("parses condition, temperature, and summary positionally", () => {
    expect(parseForecastEntry("2026-01-16: snow, 30F, heavy flurries")).toEqual({
      date: "2026-01-16",
      condition: "snow",
      summary: "heavy flurries",
      temperature: "30F",
    });

    // Temperature before condition still resolves both.
    expect(parseForecastEntry("2026-01-16: 30F, rain, light showers")).toMatchObject({
      condition: "rain",
      temperature: "30F",
      summary: "light showers",
    });

    // Condition aliases normalize onto the six supported values.
    expect(parseForecastEntry("2026-01-16: thunderstorm")).toMatchObject({ condition: "storm" });
    expect(parseForecastEntry("2026-01-16: overcast, 40F")).toMatchObject({ condition: "cloudy" });
  });

  test("keeps multi-word summaries intact", () => {
    expect(parseForecastEntry("2026-01-16: rain, 50F, steady rain, easing by dusk")?.summary).toBe(
      "steady rain, easing by dusk",
    );
  });

  test("fills a default summary when only a condition is given", () => {
    expect(parseForecastEntry("2026-01-16: rain")?.summary).toBe("Rain expected");
    expect(parseForecastEntry("2026-01-16")?.summary).toBe("Clear skies");
    expect(parseForecastEntry("2026-01-16")?.condition).toBe("clear");
  });

  test("drops malformed entries without failing the whole projection", () => {
    const forecast = normalizeForecast("garbage | 2026-02-30: rain | 2026-01-17: clear, 70F");
    expect(forecast.length).toBe(1);
    expect(forecast[0].date).toBe("2026-01-17");

    expect(parseForecastEntry("2026-01-16 rain")).toBeNull();
    expect(parseForecastEntry("")).toBeNull();
    expect(normalizeForecast(undefined)).toEqual([]);
    expect(normalizeForecast(42)).toEqual([]);
  });

  test("sorts by date and caps the projection length", () => {
    const forecast = normalizeForecast(
      "2026-01-20: rain | 2026-01-18: clear | 2026-01-19: snow | 2026-01-21: fog | 2026-01-22: clear | 2026-01-23: rain",
    );
    expect(forecast.map((entry) => entry.date)).toEqual([
      "2026-01-18",
      "2026-01-19",
      "2026-01-20",
      "2026-01-21",
      "2026-01-22",
    ]);
    expect(forecast.length).toBe(MAX_FORECAST_DAYS);
  });

  test("lets a later duplicate date win", () => {
    const forecast = normalizeForecast("2026-01-16: rain | 2026-01-16: snow, 20F");
    expect(forecast.length).toBe(1);
    expect(forecast[0]).toMatchObject({ condition: "snow", temperature: "20F" });
  });

  test("accepts entry objects, including a partial one", () => {
    const forecast = normalizeForecast([
      { date: "2026-01-18", condition: "rain", temperature: "55F", summary: "Showers" },
      { date: "2026-01-19" },
    ]);
    expect(forecast.map((entry) => entry.date)).toEqual(["2026-01-18", "2026-01-19"]);
    expect(forecast[0].summary).toBe("Showers");
    expect(forecast[1]).toMatchObject({ condition: "clear", summary: "Clear skies" });

    // A summary with no condition or temperature must survive a round trip.
    const summaryOnly = normalizeForecast([{ date: "2026-01-20", summary: "Hazy heat" }]);
    expect(summaryOnly[0].summary).toBe("Hazy heat");
  });

  test("round-trips through the serialized tag form", () => {
    const source = "2026-01-16: snow, 30F, heavy flurries | 2026-01-17: cloudy, 34F, grey skies";
    const entries = normalizeForecast(source);
    const serialized = serializeForecast(entries);

    // Canonical form keeps the date/field colon so the output parses back to the same model.
    expect(serialized).toBe(source);
    expect(normalizeForecast(serialized)).toEqual(entries);
    expect(formatForecastEntry(entries[0])).toBe("2026-01-16: snow, 30F, heavy flurries");
  });
});

describe("forecast and season on the weather state", () => {
  test("parses forecast and season from a tag", () => {
    const state = normalizeWeatherTag({
      date: "2026-01-15",
      time: "3:00 PM",
      condition: "rain",
      season: "winter",
      forecast: "2026-01-16: snow, 30F, heavy flurries | 2026-01-17: cloudy",
    });

    expect(state.season).toBe("winter");
    expect(state.forecast.length).toBe(2);
    expect(state.forecast[0]).toMatchObject({ date: "2026-01-16", condition: "snow", temperature: "30F" });
  });

  test("keeps a previous projection when a tag omits forecast", () => {
    const previous = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM", forecast: "2026-01-16: snow" });
    const next = normalizeWeatherTag({ condition: "clear", date: "2026-01-15", time: "3:00 PM" }, previous);
    expect(next.forecast.length).toBe(1);
    expect(next.forecast[0].date).toBe("2026-01-16");
  });

  test("derives season from the story date when the tag omits it", () => {
    expect(normalizeWeatherTag({ date: "2026-07-15", time: "1:00 PM" }).season).toBe("summer");
    expect(normalizeWeatherTag({ date: "2026-01-15", time: "1:00 PM" }).season).toBe("winter");
    expect(normalizeWeatherTag({ date: "2026-04-15", time: "1:00 PM" }).season).toBe("spring");
    expect(normalizeWeatherTag({ date: "2026-10-15", time: "1:00 PM" }).season).toBe("autumn");
  });

  test("ignores an unsupported season and falls back to the derived one", () => {
    const state = normalizeWeatherTag({ date: "2026-07-15", time: "1:00 PM", season: "monsoon" });
    expect(state.season).toBe("summer");
  });

  test("still normalizes a v1.3.3-era tag with no forecast or season", () => {
    const state = normalizeWeatherTag({
      location: "Example Location",
      date: "2026-01-15",
      time: "3:00 PM",
      condition: "rain",
      summary: "Steady afternoon rain",
      temperature: "60F",
      intensity: "0.65",
      wind: "breezy",
      windDirection: "west",
      palette: "storm",
    });

    expect(state.forecast).toEqual([]);
    expect(state.season).toBe("winter");
    expect(state.palette).toBe("storm");
    expect(state.summary).toBe("Steady afternoon rain");
  });

  test("gives the default state empty projection metadata", () => {
    const state = makeDefaultWeatherState(0);
    expect(state.forecast).toEqual([]);
    expect(["spring", "summer", "autumn", "winter"]).toContain(state.season);
  });

  test("preserves an explicit empty forecast as an intentional clear", () => {
    const previous = normalizeWeatherTag({ date: "2026-01-15", time: "3:00 PM", forecast: "2026-01-16: snow" });
    const cleared = normalizeWeatherState(
      { date: "2026-01-15", time: "3:00 PM", forecast: "" },
      previous,
    );
    expect(cleared.forecast).toEqual([]);
  });
});
