export const MOBILE_HUD_BREAKPOINT = 600;

export const MOBILE_HUD_LAUNCHER_SIZE = { width: 40, height: 40 } as const;
export const DESKTOP_HUD_COLLAPSED_SIZE = { width: 320, height: 148 } as const;
export const DESKTOP_HUD_EXPANDED_SIZE = { width: 360, height: 360 } as const;

export type HudPresentation = {
  kind: "desktop" | "mobile-launcher" | "mobile-panel";
  width: number;
  height: number;
  fullscreen: boolean;
};

export function isMobileHudLayout(viewportWidth: number, coarsePointer: boolean): boolean {
  return coarsePointer || viewportWidth <= MOBILE_HUD_BREAKPOINT;
}

export function resolveHudPresentation(mobile: boolean, expanded: boolean): HudPresentation {
  if (mobile) {
    return {
      kind: expanded ? "mobile-panel" : "mobile-launcher",
      ...MOBILE_HUD_LAUNCHER_SIZE,
      fullscreen: expanded,
    };
  }

  return {
    kind: "desktop",
    ...(expanded ? DESKTOP_HUD_EXPANDED_SIZE : DESKTOP_HUD_COLLAPSED_SIZE),
    fullscreen: false,
  };
}

export function clampMobileHudPosition(
  position: { x: number; y: number },
  viewport: { width: number; height: number },
  padding = 12,
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(position.x, viewport.width - MOBILE_HUD_LAUNCHER_SIZE.width - padding)),
    y: Math.max(padding, Math.min(position.y, viewport.height - MOBILE_HUD_LAUNCHER_SIZE.height - padding)),
  };
}
