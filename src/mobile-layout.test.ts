import { describe, expect, test } from "bun:test";
import {
  DESKTOP_HUD_COLLAPSED_SIZE,
  DESKTOP_HUD_EXPANDED_SIZE,
  clampMobileHudPosition,
  isMobileHudLayout,
  MOBILE_HUD_LAUNCHER_SIZE,
  resolveHudPresentation,
} from "./mobile-layout";

describe("mobile HUD presentation", () => {
  test("uses the mobile layout for narrow visual viewports", () => {
    expect(isMobileHudLayout(390, false)).toBe(true);
    expect(isMobileHudLayout(600, false)).toBe(true);
    expect(isMobileHudLayout(601, false)).toBe(false);
  });

  test("uses the mobile layout for coarse-pointer tablets", () => {
    expect(isMobileHudLayout(1024, true)).toBe(true);
    expect(isMobileHudLayout(1024, false)).toBe(false);
  });

  test("resolves a mobile launcher and fullscreen panel", () => {
    expect(resolveHudPresentation(true, false)).toEqual({
      kind: "mobile-launcher",
      ...MOBILE_HUD_LAUNCHER_SIZE,
      fullscreen: false,
    });
    expect(resolveHudPresentation(true, true)).toEqual({
      kind: "mobile-panel",
      ...MOBILE_HUD_LAUNCHER_SIZE,
      fullscreen: true,
    });
  });

  test("preserves both desktop HUD sizes", () => {
    expect(resolveHudPresentation(false, false)).toEqual({
      kind: "desktop",
      ...DESKTOP_HUD_COLLAPSED_SIZE,
      fullscreen: false,
    });
    expect(resolveHudPresentation(false, true)).toEqual({
      kind: "desktop",
      ...DESKTOP_HUD_EXPANDED_SIZE,
      fullscreen: false,
    });
  });

  test("switches presentation without changing expansion intent", () => {
    expect(resolveHudPresentation(false, true).kind).toBe("desktop");
    expect(resolveHudPresentation(true, true).kind).toBe("mobile-panel");
    expect(resolveHudPresentation(false, false).kind).toBe("desktop");
    expect(resolveHudPresentation(true, false).kind).toBe("mobile-launcher");
  });

  test("keeps the launcher reachable after viewport changes", () => {
    expect(clampMobileHudPosition({ x: 900, y: 700 }, { width: 390, height: 844 })).toEqual({ x: 338, y: 700 });
    expect(clampMobileHudPosition({ x: -20, y: 900 }, { width: 390, height: 844 })).toEqual({ x: 12, y: 792 });
  });
});
