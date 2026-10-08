import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { DEFAULT_PREFS, normalizeWeatherTag, WEATHER_STATE_VAR, WEATHER_MANUAL_STATE_VAR } from "./shared";
import type { BackendToFrontend, FrontendToBackend, WeatherPrefs, WeatherState } from "./types";

const storage = new Map<string, string>();
const sent: BackendToFrontend[] = [];
const published: Record<string, any> = {};
const publishedRevisions: number[] = [];
const capabilityDeclarations: string[] = [];
const eventHandlers = new Map<string, (payload: unknown, userId?: string) => void>();
const errors: string[] = [];
let messages: any[] = [];
let prefs: WeatherPrefs = { ...DEFAULT_PREFS };
let getPrefs = async (): Promise<WeatherPrefs> => JSON.parse(JSON.stringify(prefs));
let getMessages = async (_chat: string): Promise<any[]> => messages;
let getActive = async (): Promise<{ id: string } | null> => ({ id: "chat" });
let failNextSave: string | null = null;
let failNextDelete: string | null = null;
let failNextRead: string | null = null;
let receive: (message: FrontendToBackend, userId: string) => Promise<void>;
const globals = globalThis as typeof globalThis & { spindle?: unknown };
const oldSpindle = globals.spindle;
const noop = () => {};
const tag = '<weather-state date="2026-01-15" time="12:00" condition="clear" summary="Calm"></weather-state>';
const stamped = (index: number, seconds: number) => ({
  content: tag, index_in_chat: index, is_user: false, send_date: seconds,
});
const send = (message: FrontendToBackend, userId = "test-user") => receive(JSON.parse(JSON.stringify(message)), userId);
const storageKey = (chat: string, key: string) => chat === "chat" ? key : `${chat}:${key}`;
const stored = (key: string, chat = "chat"): WeatherState => JSON.parse(storage.get(storageKey(chat, key))!);
const revision = (chat = "chat") => JSON.parse(storage.get(storageKey(chat, "lumi_weather_state_revision_v1"))!).revision;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

beforeAll(async () => {
  const api = {
    frontendCapabilities: undefined as { declare(capability: string): () => void } | undefined,
    variables: { local: {
      get: async (chat: string, key: string) => {
        if (failNextRead === key) {
          failNextRead = null;
          throw new Error("Storage unavailable");
        }
        return storage.get(storageKey(chat, key)) ?? "";
      },
      set: async (chat: string, key: string, value: string) => {
        if (failNextSave === key) {
          failNextSave = null;
          throw new Error("Storage unavailable");
        }
        storage.set(storageKey(chat, key), value);
      },
      delete: async (chat: string, key: string) => {
        if (failNextDelete === key) {
          failNextDelete = null;
          throw new Error("Storage unavailable");
        }
        storage.delete(storageKey(chat, key));
      },
    } },
    chats: { getActive: () => getActive() },
    chat: { getMessages: (chat: string) => getMessages(chat) },
    userStorage: {
      getJson: () => getPrefs(),
      setJson: async (_file: string, next: WeatherPrefs) => { prefs = next; },
    },
    rpcPool: { sync: (key: string, value: any) => {
      published[key] = value;
      if (key === "state.current") publishedRevisions.push(value.revision);
    } },
    sendToFrontend: (message: BackendToFrontend) => sent.push(message),
    registerMacro: noop, updateMacroValue: noop, registerInterceptor: noop,
    on: (event: string, handler: (payload: unknown, userId?: string) => void) => {
      eventHandlers.set(event, handler);
      return noop;
    },
    onFrontendMessage: (handler: typeof receive) => { receive = handler; },
    log: { error: (error: string) => { errors.push(error); }, warn: noop },
    toast: { warning: noop },
  };
  globals.spindle = api;
  // A separate module instance proves startup still works on older hosts.
  await import("./backend.ts" + "?legacy-host");
  api.frontendCapabilities = { declare: (capability: string) => {
    capabilityDeclarations.push(capability);
    return noop;
  } };
  await import("./backend");
});
beforeEach(async () => {
  storage.clear();
  messages = [];
  prefs = { ...DEFAULT_PREFS };
  getPrefs = async () => JSON.parse(JSON.stringify(prefs));
  getMessages = async () => messages;
  getActive = async () => ({ id: "chat" });
  failNextSave = null;
  failNextDelete = null;
  failNextRead = null;
  errors.length = 0;
  await send({ type: "chat_changed", chatId: "chat" });
  sent.length = 0;
  publishedRevisions.length = 0;
});
afterAll(() => { globals.spindle = oldSpindle; });

test("declares hidden-tag readiness on supported hosts and starts on older hosts", () => {
  expect(capabilityDeclarations).toEqual(["message_tag_interceptor"]);
});

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
  const firstRevision = revision("dedupe-chat");
  await send({ ...payload, attrs: { condition: "rain", location: "Porch" } });
  expect(revision("dedupe-chat")).toBe(firstRevision);
  await send({ ...payload, messageId: "second" });
  expect(revision("dedupe-chat")).toBeGreaterThan(firstRevision);
});

test("overlapping manual edits preserve both fields and increase each revision", async () => {
  const initialRevision = 9_000_000_000_000;
  storage.set("lumi_weather_state_revision_v1", JSON.stringify({ revision: initialRevision }));
  await Promise.all([
    send({ type: "set_manual_state", chatId: "chat", state: { location: "Garden" } }),
    send({ type: "set_manual_state", chatId: "chat", state: { summary: "Light rain" } }),
  ]);
  expect(stored(WEATHER_MANUAL_STATE_VAR)).toMatchObject({ location: "Garden", summary: "Light rain" });
  const updates = sent.filter((message) => message.type === "weather_state");
  expect(updates).toHaveLength(2);
  expect(publishedRevisions).toEqual([initialRevision + 1, initialRevision + 2]);
  expect(errors).toEqual([]);
});

test("overlapping story tags apply partial fields in arrival order", async () => {
  await Promise.all([
    send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "parallel-1", attrs: { location: "Garden" } }),
    send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "parallel-2", attrs: { condition: "rain" } }),
  ]);
  expect(stored(WEATHER_STATE_VAR)).toMatchObject({ location: "Garden", condition: "rain" });
});

test("overlapping preference changes preserve both selections", async () => {
  await Promise.all([
    send({ type: "save_prefs", prefs: { showForecast: false } }),
    send({ type: "save_prefs", prefs: { clockMode: "story" } }),
  ]);
  expect(prefs).toMatchObject({ showForecast: false, clockMode: "story" });
  expect(errors).toEqual([]);
});

test("a slow startup preference read cannot replace a newer saved selection", async () => {
  const initial = deferred<WeatherPrefs>();
  const started = deferred<void>();
  let firstRead = true;
  getPrefs = async () => {
    if (firstRead) {
      firstRead = false;
      started.resolve();
      return initial.promise;
    }
    return JSON.parse(JSON.stringify(prefs));
  };
  const ready = send({ type: "frontend_ready" });
  await started.promise;
  const save = send({ type: "save_prefs", prefs: { showForecast: false } });
  initial.resolve({ ...DEFAULT_PREFS });
  await Promise.all([ready, save]);
  expect(prefs.showForecast).toBe(false);
  expect(sent.filter((message) => message.type === "prefs").at(-1)).toMatchObject({
    type: "prefs", prefs: { showForecast: false },
  });
});

test("editing a message back to an earlier tag restores that scene", async () => {
  const payload = { type: "weather_tag_intercepted", chatId: "chat", messageId: "edited-tag", attrs: { condition: "rain" } } as const;
  await send(payload);
  await send({ ...payload, attrs: { condition: "snow" } });
  const beforeRestore = revision();
  await send(payload);
  expect(stored(WEATHER_STATE_VAR).condition).toBe("rain");
  expect(revision()).toBeGreaterThan(beforeRestore);
});

test("a tag can be retried after its persistence fails", async () => {
  const payload = { type: "weather_tag_intercepted", chatId: "chat", messageId: "retry-tag", attrs: { location: "Retry garden" } } as const;
  failNextSave = WEATHER_STATE_VAR;
  await send(payload);
  expect(sent.at(-1)).toMatchObject({ type: "error", message: "Storage unavailable" });
  await send(payload);
  expect(stored(WEATHER_STATE_VAR).location).toBe("Retry garden");
  expect(sent.at(-1)).toMatchObject({ type: "weather_state" });
});

test("rendering historical tagged bubbles preserves the newest story scene and timestamp", async () => {
  messages = [
    { ...stamped(0, 1_700_000_000), id: "historical-render" },
    { ...stamped(1, 1_700_000_600), id: "latest-render", content: tag.replace('condition="clear"', 'condition="snow"') },
  ];
  await send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "historical-render",
    attrs: { date: "2026-01-15", time: "12:00", condition: "clear", summary: "Calm" } });
  expect(stored(WEATHER_STATE_VAR)).toMatchObject({ condition: "snow", updatedAt: 1_700_000_600_000 });
  expect(published["state.current"].updatedAt).toBe(1_700_000_600_000);
  const latestRevision = revision();
  let historyReads = 0;
  getMessages = async () => { historyReads += 1; return messages; };
  await send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "latest-render",
    attrs: { date: "2026-01-15", time: "12:00", condition: "snow", summary: "Calm" } });
  await send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "historical-render",
    attrs: { date: "2026-01-15", time: "12:00", condition: "clear", summary: "Calm" } });
  expect(stored(WEATHER_STATE_VAR).condition).toBe("snow");
  expect(revision()).toBe(latestRevision);
  expect(historyReads).toBe(0);
});

test("history-seeded dedupe accepts an edited latest tag and an edit back", async () => {
  const latest = { ...stamped(1, 1_700_000_600), id: "edited-history-latest" };
  messages = [{ ...stamped(0, 1_700_000_000), id: "edited-history-earlier" }, latest];
  await send({ type: "chat_changed", chatId: "chat" });
  const payload = { type: "weather_tag_intercepted", chatId: "chat", messageId: latest.id,
    attrs: { date: "2026-01-15", time: "12:00", condition: "clear", summary: "Calm" } } as const;
  latest.content = tag.replace('condition="clear"', 'condition="snow"');
  await send({ ...payload, attrs: { ...payload.attrs, condition: "snow" } });
  expect(stored(WEATHER_STATE_VAR).condition).toBe("snow");
  const editedRevision = revision();
  await send({ ...payload, messageId: "edited-history-earlier" });
  expect(stored(WEATHER_STATE_VAR).condition).toBe("snow");
  expect(revision()).toBe(editedRevision);
  latest.content = tag;
  await send(payload);
  expect(stored(WEATHER_STATE_VAR).condition).toBe("clear");
  expect(revision()).toBeGreaterThan(editedRevision);
});

test("a completed new tag still updates when message history is unavailable", async () => {
  getMessages = async () => { throw new Error("History permission unavailable"); };
  await send({ type: "weather_tag_intercepted", chatId: "chat", messageId: "unavailable-history-tag",
    attrs: { location: "New garden", condition: "rain" } });
  expect(stored(WEATHER_STATE_VAR)).toMatchObject({ location: "New garden", condition: "rain" });
  expect(sent.at(-1)).toMatchObject({ type: "weather_state" });
  expect(errors).toEqual([]);
});

test("failed unlock keeps the published manual scene and reports the failure", async () => {
  await send({ type: "set_manual_state", chatId: "chat", state: { location: "Locked garden" } });
  const beforeUnlock = revision();
  failNextDelete = WEATHER_MANUAL_STATE_VAR;
  await send({ type: "clear_manual_override", chatId: "chat" });
  expect(stored(WEATHER_MANUAL_STATE_VAR).location).toBe("Locked garden");
  expect(revision()).toBe(beforeUnlock);
  expect(published["state.current"].state.locations[0].label).toBe("Locked garden");
  expect(sent.at(-1)).toMatchObject({ type: "error", message: "Storage unavailable" });
});

test("a failed state read cannot replace a saved manual scene with defaults", async () => {
  await send({ type: "set_manual_state", chatId: "chat", state: { location: "Locked garden" } });
  const beforeEdit = revision();
  failNextRead = WEATHER_MANUAL_STATE_VAR;
  await send({ type: "set_manual_state", chatId: "chat", state: { summary: "New summary" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR).location).toBe("Locked garden");
  expect(stored(WEATHER_MANUAL_STATE_VAR).summary).not.toBe("New summary");
  expect(revision()).toBe(beforeEdit);
  expect(sent.at(-1)).toMatchObject({ type: "error", message: "Storage unavailable" });
});

test("late manual edits and unlocks save their target without switching the published chat", async () => {
  await send({ type: "chat_changed", chatId: "current-chat" });
  await send({ type: "set_manual_state", chatId: "chat", state: { location: "Background garden" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR).location).toBe("Background garden");
  expect(published["state.current"].chatId).toBe("current-chat");
  await send({ type: "clear_manual_override", chatId: "chat" });
  expect(storage.has(WEATHER_MANUAL_STATE_VAR)).toBe(false);
  expect(published["state.current"].chatId).toBe("current-chat");
  // Omitting the target must still address the selected chat, proving it did
  // not silently change while saving either background operation.
  await send({ type: "set_manual_state", state: { location: "Current garden" } });
  expect(stored(WEATHER_MANUAL_STATE_VAR, "current-chat").location).toBe("Current garden");
  expect(published["state.current"].chatId).toBe("current-chat");
});

test("slow history from a previous chat cannot replace the current published chat", async () => {
  const history = deferred<any[]>();
  const started = deferred<void>();
  getMessages = async (chat) => {
    if (chat === "slow-chat") {
      started.resolve();
      return history.promise;
    }
    return [stamped(0, 1_700_000_600)];
  };
  const previous = send({ type: "chat_changed", chatId: "slow-chat", requestId: 1 });
  await started.promise;
  await send({ type: "chat_changed", chatId: "current-chat", requestId: 2 });
  history.resolve([stamped(0, 1_700_000_000)]);
  await previous;
  expect(published["state.current"].chatId).toBe("current-chat");
  expect(sent.some((message) => message.type === "active_chat_state" && message.chatId === "slow-chat")).toBe(false);
});

test("a delayed history mutation cannot publish a chat after switching away", async () => {
  await send({ type: "chat_changed", chatId: "chat" });
  eventHandlers.get("MESSAGE_EDITED")!({ chatId: "chat" }, "test-user");
  await send({ type: "chat_changed", chatId: "current-chat" });
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(published["state.current"].chatId).toBe("current-chat");
  expect(sent.at(-1)).toMatchObject({ type: "active_chat_state", chatId: "current-chat" });
});

test("a slow initial active-chat lookup cannot overwrite a later chat switch", async () => {
  const active = deferred<{ id: string } | null>();
  const started = deferred<void>();
  getActive = async () => {
    started.resolve();
    return active.promise;
  };
  const ready = send({ type: "frontend_ready" }, "initial-user");
  await started.promise;
  await send({ type: "chat_changed", chatId: "current-chat", requestId: 4 }, "initial-user");
  active.resolve({ id: "old-chat" });
  await ready;
  expect(published["state.current"].chatId).toBe("current-chat");
  expect(sent.some((message) => message.type === "active_chat_state" && message.chatId === "old-chat")).toBe(false);
});
