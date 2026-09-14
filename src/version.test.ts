import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXTENSION_ID, EXTENSION_VERSION, LUMI_STATE_CAPABILITIES } from "./version";

const repositoryRoot = join(import.meta.dir, "..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repositoryRoot, relativePath), "utf8")) as Record<string, unknown>;
}

describe("release metadata", () => {
  test("keeps every declared version in lockstep", () => {
    // Regression: `EXTENSION_VERSION` stayed at 1.3.2 while the manifests moved to
    // 1.3.3, so the version published through `lumi_weather.contract.v1` and every
    // LumiState snapshot was wrong for two releases.
    const packageJson = readJson("package.json");
    const spindleJson = readJson("spindle.json");

    expect(packageJson.version).toBe(EXTENSION_VERSION);
    expect(spindleJson.version).toBe(EXTENSION_VERSION);
    expect(EXTENSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("keeps the extension identity aligned with the manifest", () => {
    const spindleJson = readJson("spindle.json");
    expect(spindleJson.identifier).toBe(EXTENSION_ID);
    expect(typeof spindleJson.minimum_lumiverse_version).toBe("string");
  });

  test("declares the projected and solar capabilities this release ships", () => {
    expect(LUMI_STATE_CAPABILITIES).toContain("forecast");
    expect(LUMI_STATE_CAPABILITIES).toContain("solar_time");
    // The original v1 capabilities must not be dropped from the contract.
    expect(LUMI_STATE_CAPABILITIES).toContain("scene_location");
    expect(LUMI_STATE_CAPABILITIES).toContain("calendar_time");
    expect(LUMI_STATE_CAPABILITIES).toContain("weather_conditions");
    expect(LUMI_STATE_CAPABILITIES).toContain("manual_override");
  });
});
