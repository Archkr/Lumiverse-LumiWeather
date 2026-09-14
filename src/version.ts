/**
 * Release metadata shared by the backend runtime and the version guard test.
 *
 * This lived only in `backend.ts`, so it silently drifted two releases behind the
 * manifest version and shipped a stale `extensionVersion` to every LumiState
 * consumer. Keeping it in a side-effect-free module lets the guard test read it
 * without booting the backend, which calls `spindle.*` at import time.
 */
export const EXTENSION_VERSION = "1.4.0";
export const EXTENSION_ID = "lumi_weather";
export const LUMI_STATE_CONTRACT_CHANNEL = "contract.v1";
export const LUMI_STATE_ENDPOINT_CHANNEL = "state.current";

/** Capabilities this release advertises on `lumi_weather.contract.v1`. */
export const LUMI_STATE_CAPABILITIES = [
  "scene_location",
  "calendar_time",
  "weather_conditions",
  "manual_override",
  "forecast",
  "solar_time",
] as const;
