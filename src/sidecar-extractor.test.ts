import { describe, expect, test } from "bun:test";

import { normalizeWeatherTag } from "./shared";
import {
  buildSidecarExtractionMessages,
  extractJsonObject,
  extractTextFromGenerationResult,
  parseSidecarExtractionResponse,
} from "./sidecar-extractor";
import {
  buildMessageWeatherMetadata,
  extractMessageWeatherMetadata,
  rebuildStoryWeatherState,
} from "./story-history";

describe("sidecar weather extractor", () => {
  test("builds concise extraction messages and strips legacy weather tags from excerpts", () => {
    const previous = normalizeWeatherTag({
      location: "Lilycove Harbor",
      date: "2026-11-25",
      time: "8:41 PM",
      condition: "rain",
      temperature: "61F",
      exposure: "outdoor",
    });

    const msgs = buildSidecarExtractionMessages(previous, [
      { role: "user", name: "Alex", content: "We duck into the warm café to dry off." },
      {
        role: "assistant",
        name: "Narrator",
        content: 'Rain patters against the front window.\n<weather-state condition="storm"></weather-state>',
      },
    ]);

    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
    expect(String(msgs[1].content)).toContain("Lilycove Harbor");
    expect(String(msgs[1].content)).toContain("Rain patters against the front window.");
    expect(String(msgs[1].content)).not.toContain("<weather-state");
  });

  test("extracts text across common Spindle generation response envelopes", () => {
    expect(extractTextFromGenerationResult('{"condition":"rain"}')).toBe('{"condition":"rain"}');
    expect(extractTextFromGenerationResult({ content: '{"condition":"snow"}' })).toBe('{"condition":"snow"}');
    expect(extractTextFromGenerationResult({ text: '{"condition":"fog"}' })).toBe('{"condition":"fog"}');
    expect(extractTextFromGenerationResult({ message: { content: '{"condition":"clear"}' } })).toBe('{"condition":"clear"}');
    expect(
      extractTextFromGenerationResult({ choices: [{ message: { content: '{"condition":"storm"}' } }] }),
    ).toBe('{"condition":"storm"}');
    expect(extractTextFromGenerationResult({ content: [{ type: "text", text: '{"unchanged":true}' }] })).toBe(
      '{"unchanged":true}',
    );
  });

  test("parses JSON inside think blocks, markdown fences, or surrounding text", () => {
    const wrapped = `<think>Checking weather...</think>\n\`\`\`json\n{"exposure": "indoor", "summary": "Cozy tavern warmth"}\n\`\`\``;
    expect(extractJsonObject(wrapped)).toEqual({
      exposure: "indoor",
      summary: "Cozy tavern warmth",
    });

    const noisy = `Here is the update: {"location": "Pine Ridge", "condition": "snow"} Hope that helps!`;
    expect(extractJsonObject(noisy)).toEqual({
      location: "Pine Ridge",
      condition: "snow",
    });
  });

  test("supports unchanged shortcut and partial delta merges onto previous state", () => {
    const previous = normalizeWeatherTag({
      location: "Slateport Harbor",
      date: "2026-07-15",
      time: "4:10 PM",
      condition: "clear",
      summary: "Bright sea breeze",
      temperature: "78F",
      exposure: "outdoor",
      forecast: "2026-07-16: cloudy, 75F, coastal clouds | 2026-07-17: rain, 72F, afternoon showers",
    });

    const unchanged = parseSidecarExtractionResponse({ content: '{"unchanged": true}' }, previous, 1_700_000_000_000);
    expect(unchanged).not.toBeNull();
    expect(unchanged!.location).toBe("Slateport Harbor");
    expect(unchanged!.forecast).toHaveLength(2);
    expect(unchanged!.updatedAt).toBe(1_700_000_000_000);

    const delta = parseSidecarExtractionResponse(
      { content: '{"exposure": "indoor", "time": "4:25 PM", "season": "summer"}' },
      previous,
      1_700_000_500_000,
    );
    expect(delta).not.toBeNull();
    expect(delta!.location).toBe("Slateport Harbor");
    expect(delta!.exposure).toBe("indoor");
    expect(delta!.time).toBe("4:25 PM");
    expect(delta!.forecast).toHaveLength(2);
    // Calendar-derived season echoed by sidecar does not lock seasonOverride.
    expect(delta!.seasonOverride).toBeNull();
  });

  test("parses structured forecast arrays and rejects unparseable replies safely", () => {
    const parsed = parseSidecarExtractionResponse(
      {
        content: JSON.stringify({
          location: "Frostpeak Pass",
          date: "2026-12-20",
          time: "6:30 PM",
          condition: "snow",
          summary: "Crisp alpine flurries",
          temperature: "26F",
          intensity: 0.7,
          wind: "brisk",
          windDirection: "northwest",
          palette: "snow",
          exposure: "outdoor",
          phenomenon: "aurora",
          forecast: [
            { date: "2026-12-21", condition: "clear", temperature: "24F", summary: "Glittering frost" },
            { date: "2026-12-22", condition: "cloudy", temperature: "28F", summary: "High mountain clouds" },
          ],
        }),
      },
      null,
      1_700_000_123_000,
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.location).toBe("Frostpeak Pass");
    expect(parsed!.phenomenon).toBe("aurora");
    expect(parsed!.forecast.map((entry) => entry.date)).toEqual(["2026-12-21", "2026-12-22"]);
    expect(parseSidecarExtractionResponse({ content: "Not JSON at all" }, null)).toBeNull();
  });

  test("stores and rebuilds per-message swipe-aware metadata without clobbering sibling keys", () => {
    const sceneA = normalizeWeatherTag({
      location: "Moon Harbor",
      date: "2026-05-01",
      time: "9:00 AM",
      condition: "clear",
    });
    const sceneB = normalizeWeatherTag({
      location: "Moon Harbor",
      date: "2026-05-01",
      time: "9:15 AM",
      condition: "rain",
      exposure: "indoor",
    });

    const meta0 = buildMessageWeatherMetadata({ other_ext: { kept: true } }, 0, sceneA);
    const meta1 = buildMessageWeatherMetadata(meta0, 1, sceneB);
    expect((meta1 as Record<string, unknown>).other_ext).toEqual({ kept: true });

    const msgSwipe0 = {
      content: "Sunny morning.",
      index_in_chat: 0,
      is_user: false,
      swipe_id: 0,
      send_date: 1_700_000_000,
      metadata: meta1,
    };
    const msgSwipe1 = { ...msgSwipe0, content: "Rain starts.", swipe_id: 1 };

    expect(extractMessageWeatherMetadata(msgSwipe0)?.condition).toBe("clear");
    expect(extractMessageWeatherMetadata(msgSwipe1)?.condition).toBe("rain");
    expect(extractMessageWeatherMetadata(msgSwipe1)?.exposure).toBe("indoor");

    const rebuiltSwipe0 = rebuildStoryWeatherState([msgSwipe0]);
    const rebuiltSwipe1 = rebuildStoryWeatherState([msgSwipe1]);
    expect(rebuiltSwipe0?.condition).toBe("clear");
    expect(rebuiltSwipe1?.condition).toBe("rain");
  });
});
