import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { normalizeWeatherTag, WEATHER_STATE_VAR, WEATHER_MANUAL_STATE_VAR } from "./shared";
import type { BackendToFrontend, FrontendToBackend, WeatherState } from "./types";

const storage = new Map<string, string>();
const sent: BackendToFrontend[] = [];
const published: Record<string, any> = {};
let messages: any[] = [];
let receive: (message: FrontendToBackend, userId: string) => Promise<void>;
const globals = globalThis as typeof globalThis & { spindle?: unknown };
const oldSpindle = globals.spindle;
const noop = () => {};
const tag = '<weather-state date="2026-01-15" time="12:00" condition="clear" summary="Calm"></weather-state>';
const stamped = (index: number, seconds: number) => ({
  content: tag, index_in_chat: index, is_user: false, send_date: seconds,
});
const send = (message: FrontendToBackend) => receive(JSON.parse(JSON.stringify(message)), "test-user");
const stored = (key: string): WeatherState => JSON.parse(storage.get(key)!);
const revision = () => JSON.parse(storage.get("lumi_weather_state_revision_v1")!).revision;

beforeAll(async () => {
  globals.spindle = {
    variables: { local: {
      get: async (_chat: string, key: string) => storage.get(key) ?? "",
      set: async (_chat: string, key: string, value: string) => { storage.set(key, value); },
      delete: async (_chat: string, key: string) => { storage.delete(key); },
    } },
    chats: { getActive: async () => ({ id: "chat" }) },
    chat: { getMessages: async () => messages },
    rpcPool: { sync: (key: string, value: unknown) => { published[key] = value; } },
    sendToFrontend: (message: BackendToFrontend) => sent.push(message),
    registerMacro: noop, updateMacroValue: noop, registerInterceptor: noop,
    on: () => noop,
    onFrontendMessage: (handler: typeof receive) => { receive = handler; },
    log: { error: (error: string) => { throw new Error(error); }, warn: noop },
    toast: { warning: noop },
  };
  await import("./backend");
});
beforeEach(() => { storage.clear(); sent.length = 0; messages = []; });
afterAll(() => { globals.spindle = oldSpindle; });

test("manual season changes survive JSON transport, backend merge, and persisted reload", async () => {
  storage.set(WEATHER_STATE_VAR, JSON.stringify(normalizeWeatherTag({ date: "2026-01-15", time: "12:00" })));
  await send({ type: "set_manual_state", chatId: "chat", state: { date: "2026-07-15", seasonOverride: null } });
  expect(stored(WEATHER_MANUAL_STATE_VAR)).toMatchObject({ season: "summer", seasonOverride: null });
  await send({ type: "set_manual_state", chatId: "chat", state: { seasonOverride: "winter" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR)).toMatchObject({ season: "winter", seasonOverride: "winter" });
  await send({ type: "set_manual_state", chatId: "chat", state: { summary: "Still winter" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR).season).toBe("winter");
  await send({ type: "set_manual_state", chatId: "chat", state: { seasonOverride: null } });
  expect(stored(WEATHER_MANUAL_STATE_VAR)).toMatchObject({ season: "summer", seasonOverride: null });
  // A legacy caller can still explicitly set a season.
  await send({ type: "set_manual_state", chatId: "chat", state: { season: "spring" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR).seasonOverride).toBe("spring");
});

test("legacy stored seasons infer derivation only when they match the date", async () => {
  for (const [season, expected] of [["winter", "summer"], ["autumn", "autumn"]] as const) {
    const legacy = normalizeWeatherTag({ date: "2026-01-15", time: "12:00", season });
    delete legacy.seasonOverride;
    storage.set(WEATHER_MANUAL_STATE_VAR, JSON.stringify(legacy));
    await send({ type: "set_manual_state", chatId: "chat", state: { date: "2026-07-15" } });
    expect(stored(WEATHER_MANUAL_STATE_VAR).season).toBe(expected);
  }
});

test("history corrects timestamps, publishes revisions, and does not churn unchanged replay", async () => {
  messages = [stamped(0, 1_700_000_000), stamped(1, 1_700_000_600)];
  await send({ type: "chat_changed", chatId: "chat" });
  const originalRevision = revision();
  expect(stored(WEATHER_STATE_VAR).updatedAt).toBe(1_700_000_600_000);
  // Deleting the newer identical tag must restore the older observation time.
  messages.pop();
  await send({ type: "chat_changed", chatId: "chat" });
  expect(published["state.current"].updatedAt).toBe(1_700_000_000_000);
  expect(stored(WEATHER_STATE_VAR).updatedAt).toBe(1_700_000_000_000);
  expect(revision()).toBeGreaterThan(originalRevision);
  const correctedRevision = revision();
  await send({ type: "chat_changed", chatId: "chat" });
  expect(revision()).toBe(correctedRevision);
  // Repair a pre-fix state stamped at replay time.
  storage.set(WEATHER_STATE_VAR, JSON.stringify({ ...stored(WEATHER_STATE_VAR), updatedAt: Date.now() }));
  await send({ type: "chat_changed", chatId: "chat" });
  expect(stored(WEATHER_STATE_VAR).updatedAt).toBe(1_700_000_000_000);
  expect(revision()).toBeGreaterThan(correctedRevision);
});

test("mixed-case duplicates do not bump revision but different messages do", async () => {
  const payload = { type: "weather_tag_intercepted", chatId: "dedupe-chat", messageId: "first",
    attrs: { condition: "rain", Location: "Porch" } } as const;
  await send(payload);
  const firstRevision = revision();
  await send({ ...payload, attrs: { condition: "rain", location: "Porch" } });
  expect(revision()).toBe(firstRevision);
  await send({ ...payload, messageId: "second" });
  expect(revision()).toBeGreaterThan(firstRevision);
});
