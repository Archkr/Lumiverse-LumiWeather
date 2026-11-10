import { describe, expect, test } from "bun:test";
import type { LlmMessageDTO } from "lumiverse-spindle-types";
import { WEATHER_BREAKDOWN_NAME, WEATHER_INSTRUCTIONS_BREAKDOWN_NAME, injectWeatherInstruction } from "./prompt-injection";
import { normalizeWeatherTag } from "./shared";
import { buildPromptInstruction } from "./weather-prompt";

const tag = '<weather-state date="2026-01-15" time="12:00" condition="rain"></weather-state>';
const state = normalizeWeatherTag({ date: "2026-01-15", time: "12:00", condition: "rain" });
const history: LlmMessageDTO = {
  role: "assistant", content: `Visible prose\n${tag}`, __isChatHistory: true,
  sourceMessageId: "scene-1", sourceIndexInChat: 0,
};
const inject = (messages: LlmMessageDTO[], scene = state) =>
  injectWeatherInstruction(messages, buildPromptInstruction(), scene);

describe("weather prompt injection", () => {
  test("keeps static instructions early and uses the existing historical tag", () => {
    const system = { role: "system" as const, content: "Base system prompt" };
    const result = inject([system, history, { role: "user", content: "Continue" }]);
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]).toBe(system);
    expect(result.messages[1].content).toBe(buildPromptInstruction());
    expect(result.messages[2]).toBe(history);
    expect(result.breakdown).toEqual([{ messageIndex: 1, name: WEATHER_INSTRUCTIONS_BREAKDOWN_NAME }]);
  });

  test("scene updates append history without changing the previous prompt prefix", () => {
    const messages: LlmMessageDTO[] = [{ role: "system", content: "Base" }, history,
      { role: "user", content: "Continue", __isChatHistory: true, sourceMessageId: "u1", sourceIndexInChat: 1 }];
    const before = inject(messages);
    const nextState = normalizeWeatherTag({ date: "2026-01-15", time: "12:05", condition: "snow" });
    const after = inject([...messages, {
      ...history, sourceMessageId: "scene-2", sourceIndexInChat: 2,
      content: '<weather-state date="2026-01-15" time="12:05" condition="snow"></weather-state>',
    }], nextState);
    expect(after.messages.slice(0, before.messages.length)).toEqual(before.messages);
    expect(after.breakdown).toHaveLength(1);
  });

  test("preserves multipart content, whitespace and history metadata", () => {
    const multipart: LlmMessageDTO = { ...history, content: [
      { type: "text", text: `  Prose\n\n\n${tag}\n` },
    ] };
    const result = inject([multipart]);
    expect(result.messages[1]).toBe(multipart);
    expect(result.messages).toHaveLength(2);
  });

  test("restores state at the end when LumiBooks or clipping removed its tag", () => {
    const result = inject([{ role: "system", content: "Base" },
      { role: "assistant", content: "LumiBooks chapter summary" },
      { role: "user", content: "Continue", __isChatHistory: true }]);
    expect(result.messages.at(-1)?.content).toContain("Time: 12:00");
    expect(result.breakdown?.at(-1)).toEqual({ messageIndex: 4, name: WEATHER_BREAKDOWN_NAME });
  });

  test("an older surviving tag does not suppress the missing latest state", () => {
    const result = inject([history], normalizeWeatherTag({ date: "2026-01-15", time: "13:00", condition: "snow" }));
    expect(result.messages.at(-1)?.content).toContain("Condition: snow");
  });

  test("manual overrides take precedence over history", () => {
    const result = inject([history], { ...state, source: "manual", condition: "clear" });
    expect(result.messages.at(-1)?.content).toContain("Condition: clear");
    expect(result.messages[1]).toBe(history);
  });

  test("system examples and user tags cannot stand in for assistant history", () => {
    const result = inject([{ role: "system", content: tag }, { role: "user", content: tag },
      { role: "assistant", content: tag }]);
    expect(result.messages.at(-1)?.content).toContain("Current scene:");
    expect(result.messages[0].content).toBe(tag);
  });

  test("new chats get stable instructions without fabricated saved state", () => {
    const result = injectWeatherInstruction([], buildPromptInstruction(), null);
    expect(result.messages).toEqual([{ role: "system", content: buildPromptInstruction() }]);
  });
});
