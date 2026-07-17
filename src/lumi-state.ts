import type { WeatherState } from "./types";

export const LUMI_STATE_PROTOCOL = "lumi_state.v1" as const;
export const LUMI_STATE_SCHEMA_VERSION = 1 as const;
export const LUMI_WEATHER_STATE_ENDPOINT = "lumi_weather.state.current";

export type LumiStateFreshness = "fresh" | "stale" | "unavailable";
export type LumiStateVisibility = "public" | "private";
export type LumiStatePrimitive = string | number | boolean | null;

export interface LumiStateSourceV1 {
  extensionId: string;
  extensionVersion: string;
  endpoint: string;
}

export interface LumiStateDependencyV1 {
  endpoint: string;
  chatId: string;
  revision: number;
}

export interface LumiStateProvenanceV1 {
  extensionId: string;
  method: string;
  observedAt: number;
  confidence?: number;
  derivedFrom?: LumiStateDependencyV1[];
}

export interface LumiStateEntityRefV1 {
  namespace: string;
  id: string;
  kind: "character" | "persona" | "npc" | "object" | "thread";
}

export type LumiStateSubjectV1 =
  | { kind: "scene" }
  | { kind: "actor"; actor: LumiStateEntityRefV1 };

export interface LumiStateLocationClaimV1 {
  id: string;
  subject: LumiStateSubjectV1;
  label: string;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateTimeClaimV1 {
  id: string;
  subject: LumiStateSubjectV1;
  clock: string;
  date: string | null;
  time: string | null;
  day: number | null;
  hour: number | null;
  running: boolean | null;
  timezone: string | null;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateCastClaimV1 {
  id: string;
  actor: LumiStateEntityRefV1;
  links: LumiStateEntityRefV1[];
  name: string;
  aliases: string[];
  present: boolean;
  confirmed: boolean;
  publicStance: string;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateObjectClaimV1 {
  id: string;
  object: LumiStateEntityRefV1;
  name: string;
  state: string;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateConditionClaimV1 {
  id: string;
  subject: LumiStateSubjectV1;
  kind: string;
  label: string;
  attributes: Record<string, LumiStatePrimitive>;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateThreadClaimV1 {
  id: string;
  thread: LumiStateEntityRefV1;
  label: string;
  status: "active" | "resolved" | "abandoned" | "unknown";
  summary: string;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateSceneV1 {
  locations: LumiStateLocationClaimV1[];
  times: LumiStateTimeClaimV1[];
  cast: LumiStateCastClaimV1[];
  objects: LumiStateObjectClaimV1[];
  conditions: LumiStateConditionClaimV1[];
  threads: LumiStateThreadClaimV1[];
}

export interface LumiStateSnapshotV1 {
  protocol: typeof LUMI_STATE_PROTOCOL;
  schemaVersion: typeof LUMI_STATE_SCHEMA_VERSION;
  source: LumiStateSourceV1;
  chatId: string | null;
  revision: number;
  freshness: LumiStateFreshness;
  generatedAt: number;
  updatedAt: number | null;
  visibility: LumiStateVisibility;
  state: LumiStateSceneV1;
}

export function emptyLumiStateScene(): LumiStateSceneV1 {
  return { locations: [], times: [], cast: [], objects: [], conditions: [], threads: [] };
}

export function makeWeatherLumiStateSnapshot(
  chatId: string | null,
  state: WeatherState | null,
  revision: number,
  extensionVersion: string,
  generatedAt = Date.now(),
): LumiStateSnapshotV1 {
  const normalizedRevision = Math.max(0, Math.round(Number.isFinite(revision) ? revision : 0));
  const scene = emptyLumiStateScene();
  if (chatId && state) {
    const provenance: LumiStateProvenanceV1 = {
      extensionId: "lumi_weather",
      method: state.source,
      observedAt: state.updatedAt,
      confidence: state.source === "manual" ? 1 : 0.9,
    };
    scene.locations.push({
      id: "scene-location",
      subject: { kind: "scene" },
      label: state.location,
      provenance,
    });
    scene.times.push({
      id: "story-calendar",
      subject: { kind: "scene" },
      clock: "calendar",
      date: state.date,
      time: state.time,
      day: null,
      hour: null,
      running: null,
      timezone: null,
      provenance,
    });
    scene.conditions.push({
      id: "scene-weather",
      subject: { kind: "scene" },
      kind: "weather",
      label: state.condition,
      attributes: {
        summary: state.summary,
        temperature: state.temperature,
        intensity: state.intensity,
        wind: state.wind,
        windDirection: state.windDirection,
        palette: state.palette,
      },
      provenance,
    });
  }

  return {
    protocol: LUMI_STATE_PROTOCOL,
    schemaVersion: LUMI_STATE_SCHEMA_VERSION,
    source: {
      extensionId: "lumi_weather",
      extensionVersion,
      endpoint: LUMI_WEATHER_STATE_ENDPOINT,
    },
    chatId,
    revision: chatId ? normalizedRevision : 0,
    freshness: chatId && state ? "fresh" : "unavailable",
    generatedAt,
    updatedAt: state?.updatedAt ?? null,
    visibility: "public",
    state: scene,
  };
}
