import { describe, expect, test } from "bun:test";
import { makeWeatherLumiStateSnapshot } from "./lumi-state";
import type { WeatherState } from "./types";
import { EXTENSION_VERSION } from "./version";

const weather: WeatherState = {
  location: "North Gate",
  date: "2026-07-17",
  time: "9:30 PM",
  condition: "storm",
  summary: "Heavy rain and distant thunder",
  temperature: "61F",
  intensity: 0.8,
  wind: "strong",
  windDirection: "west",
  palette: "storm",
  season: "summer",
  forecast: [
    { date: "2026-07-18", condition: "rain", summary: "Rain expected", temperature: "58F" },
  ],
  updatedAt: 1234,
  source: "story",
};

describe("LumiState weather publisher", () => {
  test("publishes scene-scoped location, calendar time, and conditions", () => {
    const snapshot = makeWeatherLumiStateSnapshot("chat-1", weather, 7, EXTENSION_VERSION, 2000);

    expect(snapshot).toMatchObject({
      protocol: "lumi_state.v1",
      schemaVersion: 1,
      chatId: "chat-1",
      revision: 7,
      freshness: "fresh",
      generatedAt: 2000,
      updatedAt: 1234,
      visibility: "public",
    });
    expect(snapshot.state.locations[0]).toMatchObject({ label: "North Gate", subject: { kind: "scene" } });
    expect(snapshot.state.times[0]).toMatchObject({ clock: "calendar", date: "2026-07-17", time: "9:30 PM" });
    expect(snapshot.state.conditions[0]).toMatchObject({
      kind: "weather",
      label: "storm",
      attributes: { intensity: 0.8, windDirection: "west" },
    });
    expect(snapshot.state.cast).toEqual([]);
  });

  test("publishes season and a serialized forecast without changing the schema version", () => {
    const snapshot = makeWeatherLumiStateSnapshot("chat-1", weather, 7, EXTENSION_VERSION, 2000);
    const attributes = snapshot.state.conditions[0]?.attributes ?? {};

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source.extensionVersion).toBe(EXTENSION_VERSION);
    expect(attributes.season).toBe("summer");
    expect(attributes.forecast).toBe("2026-07-18: rain, 58F, Rain expected");
  });

  test("publishes a null forecast when nothing is projected", () => {
    const snapshot = makeWeatherLumiStateSnapshot(
      "chat-1",
      { ...weather, forecast: [] },
      8,
      EXTENSION_VERSION,
      2000,
    );
    expect(snapshot.state.conditions[0]?.attributes.forecast).toBeNull();
  });

  test("publishes an unavailable empty snapshot without an active chat", () => {
    const snapshot = makeWeatherLumiStateSnapshot(null, null, 99, EXTENSION_VERSION, 2000);
    expect(snapshot.chatId).toBeNull();
    expect(snapshot.revision).toBe(0);
    expect(snapshot.freshness).toBe("unavailable");
    expect(snapshot.state.locations).toEqual([]);
    expect(snapshot.state.conditions).toEqual([]);
  });
});
