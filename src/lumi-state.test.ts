import { describe, expect, test } from "bun:test";
import { makeWeatherLumiStateSnapshot } from "./lumi-state";
import type { WeatherState } from "./types";

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
  updatedAt: 1234,
  source: "story",
};

describe("LumiState weather publisher", () => {
  test("publishes scene-scoped location, calendar time, and conditions", () => {
    const snapshot = makeWeatherLumiStateSnapshot("chat-1", weather, 7, "1.3.1", 2000);

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

  test("publishes an unavailable empty snapshot without an active chat", () => {
    const snapshot = makeWeatherLumiStateSnapshot(null, null, 99, "1.3.1", 2000);
    expect(snapshot.chatId).toBeNull();
    expect(snapshot.revision).toBe(0);
    expect(snapshot.freshness).toBe("unavailable");
    expect(snapshot.state.locations).toEqual([]);
    expect(snapshot.state.conditions).toEqual([]);
  });
});
