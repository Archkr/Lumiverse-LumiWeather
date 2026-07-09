import { describe, expect, test } from "bun:test";
import { extractLastWeatherTag, shouldProcessWeatherTag, stripWeatherStateTags } from "./tag-utils";

describe("weather tag parsing", () => {
  test("extracts the final tag and quoted attributes", () => {
    const result = extractLastWeatherTag(
      'old <weather-state condition="clear" /> then <weather-state condition="rain" summary="Cold rain"></weather-state>',
    );
    expect(result?.attrs).toEqual({ condition: "rain", summary: "Cold rain" });
  });

  test("strips all tags without collapsing normal spacing", () => {
    expect(stripWeatherStateTags("Hello\n\n<weather-state condition=\"rain\"></weather-state>\n\nWorld")).toBe("Hello\n\nWorld");
  });

  test("returns null when no tag exists", () => {
    expect(extractLastWeatherTag("No weather metadata here.")).toBeNull();
  });

  test("accepts only completed assistant tags", () => {
    expect(shouldProcessWeatherTag({ isStreaming: false, isUser: false })).toBe(true);
    expect(shouldProcessWeatherTag({ isStreaming: true, isUser: false })).toBe(false);
    expect(shouldProcessWeatherTag({ isStreaming: false, isUser: true })).toBe(false);
  });
});
