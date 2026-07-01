const SNOWFLAKE_MASK_0 = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="3.34" y1="7" x2="20.66" y2="17"/><line x1="3.34" y1="17" x2="20.66" y2="7"/><line x1="12" y1="2" x2="9.5" y2="4.5"/><line x1="12" y1="2" x2="14.5" y2="4.5"/><line x1="12" y1="22" x2="9.5" y2="19.5"/><line x1="12" y1="22" x2="14.5" y2="19.5"/><line x1="3.34" y1="7" x2="5.5" y2="5.5"/><line x1="3.34" y1="7" x2="4.5" y2="9.5"/><line x1="20.66" y1="17" x2="18.5" y2="18.5"/><line x1="20.66" y1="17" x2="19.5" y2="14.5"/><line x1="3.34" y1="17" x2="5.5" y2="18.5"/><line x1="3.34" y1="17" x2="4.5" y2="14.5"/><line x1="20.66" y1="7" x2="18.5" y2="5.5"/><line x1="20.66" y1="7" x2="19.5" y2="9.5"/></g></svg>`)}`;
const SNOWFLAKE_MASK_1 = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="3.34" y1="7" x2="20.66" y2="17"/><line x1="3.34" y1="17" x2="20.66" y2="7"/><path d="M12 5 L10 7 L12 9 L14 7 Z" fill="#fff" fill-opacity="0.7" stroke="none"/><path d="M12 15 L10 17 L12 19 L14 17 Z" fill="#fff" fill-opacity="0.7" stroke="none"/><path d="M5 8.5 L3.5 7 L5 5.5 L6.5 7 Z" fill="#fff" fill-opacity="0.5" stroke="none"/><path d="M19 15.5 L17.5 14 L19 12.5 L20.5 14 Z" fill="#fff" fill-opacity="0.5" stroke="none"/><path d="M5 15.5 L3.5 17 L5 18.5 L6.5 17 Z" fill="#fff" fill-opacity="0.5" stroke="none"/><path d="M19 8.5 L17.5 7 L19 5.5 L20.5 7 Z" fill="#fff" fill-opacity="0.5" stroke="none"/><line x1="12" y1="2" x2="9.5" y2="4.5"/><line x1="12" y1="2" x2="14.5" y2="4.5"/><line x1="12" y1="22" x2="9.5" y2="19.5"/><line x1="12" y1="22" x2="14.5" y2="19.5"/></g></svg>`)}`;
const SNOWFLAKE_MASK_2 = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#fff"/></svg>`)}`;
const SNOWFLAKE_MASK_3 = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#fff"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="20" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="19" cy="8" r="1.5"/><circle cx="5" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/></g></svg>`)}`;

export const WEATHER_HUD_CSS = `
@property --weather-bg-start {
  syntax: "<color>";
  inherits: true;
  initial-value: #4d77ad;
}

@property --weather-bg-mid {
  syntax: "<color>";
  inherits: true;
  initial-value: #7fa8de;
}

@property --weather-bg-end {
  syntax: "<color>";
  inherits: true;
  initial-value: #d8ebff;
}

@property --weather-glow {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 243, 202, 0.78);
}

@property --weather-beam-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 244, 212, 0.44);
}

@property --weather-horizon-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(185, 212, 244, 0.28);
}

@property --weather-cloud-core {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(237, 244, 255, 0.34);
}

@property --weather-cloud-edge {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(255, 255, 255, 0.12);
}

@property --weather-fog-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(236, 241, 255, 0.18);
}

@property --weather-mist-color {
  syntax: "<color>";
  inherits: true;
  initial-value: rgba(228, 238, 248, 0.24);
}

@property --weather-sky-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.05;
}

@property --weather-glow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.1;
}

@property --weather-beam-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.12;
}

@property --weather-cloud-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.06;
}

@property --weather-horizon-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-mist-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.03;
}

@property --weather-fog-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-rain-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-snow-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --weather-mote-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.04;
}

@property --weather-flash-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 0.26;
}

.weather-settings-card {
  width: 100%;
  border: 1px solid var(--lumiverse-border);
  border-radius: calc(var(--lumiverse-radius) + 2px);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
  color: var(--lumiverse-text);
  overflow: hidden;
}

.weather-settings-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--lumiverse-border);
}

.weather-settings-card-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.weather-settings-status {
  font-size: 11px;
  color: var(--lumiverse-text-muted);
  text-transform: capitalize;
}

.weather-settings-card-body {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.weather-settings-preview {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 84%, transparent);
  font-size: 11px;
  line-height: 1.5;
  color: var(--lumiverse-text);
}

.weather-settings-section,
.weather-settings-manual-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 96%, transparent);
}

.weather-settings-section-header {
  display: grid;
  gap: 6px;
}

.weather-settings-section-body {
  display: grid;
  gap: 10px;
}

.weather-settings-section-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--lumiverse-text-muted);
}

.weather-settings-copy-group {
  display: grid;
  gap: 6px;
}

.weather-settings-copy-title {
  font-size: 11px;
  color: color-mix(in srgb, var(--lumiverse-text) 92%, transparent);
}

.weather-settings-code {
  margin: 0;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 90%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 96%, transparent);
  color: color-mix(in srgb, var(--lumiverse-text) 94%, transparent);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

.weather-settings-label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--lumiverse-text-muted);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button,
.weather-hud-select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 92%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  font-size: 12px;
}

.weather-settings-button {
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-button:hover {
  border-color: var(--lumiverse-border-hover);
  background: color-mix(in srgb, var(--lumiverse-fill-subtle) 90%, transparent);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 26%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 12%, var(--lumiverse-fill));
  color: var(--lumiverse-text);
}

.weather-settings-button-primary:hover {
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 18%, var(--lumiverse-fill-subtle));
}

.weather-settings-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
}

.weather-settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.weather-settings-range,
.weather-hud-range {
  width: 100%;
}

.weather-settings-value {
  min-width: 44px;
  text-align: right;
  font-size: 11px;
  color: var(--lumiverse-text);
}

.weather-settings-manual-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 10px;
}

.weather-settings-manual-titlewrap {
  display: grid;
  gap: 4px;
}

.weather-settings-manual-titlewrap strong {
  font-size: 13px;
}

.weather-settings-status-pill {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lumiverse-text-muted);
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 94%, transparent);
}

.weather-settings-status-pill[data-mode="manual"] {
  color: var(--lumiverse-text);
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 22%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill));
}

.weather-settings-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.weather-settings-preset {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-border) 88%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill) 92%, transparent);
  color: var(--lumiverse-text);
  cursor: pointer;
  transition: border-color var(--lumiverse-transition-fast), background var(--lumiverse-transition-fast);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 24%, var(--lumiverse-border));
  background: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 10%, var(--lumiverse-fill-subtle));
}

.weather-settings-preset-label {
  font-size: 11px;
  font-weight: 600;
}

.weather-settings-preset-copy {
  font-size: 10px;
  line-height: 1.35;
  color: var(--lumiverse-text-muted);
}

.weather-settings-manual-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-settings-actions {
  display: flex;
  gap: 8px;
}

.weather-settings-actions .weather-settings-button {
  flex: 1 1 0;
}

.weather-hud-widget {
  --weather-hud-shell-top: #16273d;
  --weather-hud-shell-mid: #17314f;
  --weather-hud-shell-bottom: #101d31;
  --weather-hud-aura-primary: rgba(255, 218, 162, 0.22);
  --weather-hud-aura-secondary: rgba(116, 164, 255, 0.18);
  --weather-hud-aura-soft: rgba(255, 255, 255, 0.07);
  --weather-hud-line: rgba(255, 255, 255, 0.14);
  --weather-hud-surface: rgba(255, 255, 255, 0.08);
  --weather-hud-surface-strong: rgba(255, 255, 255, 0.12);
  --weather-hud-surface-active: rgba(103, 145, 220, 0.3);
  --weather-hud-shadow: rgba(3, 10, 23, 0.38);
  --weather-hud-text-soft: rgba(234, 241, 255, 0.76);
  --weather-hud-text-muted: rgba(222, 231, 247, 0.62);
  --weather-hud-accent: #9dc0ff;
  --weather-hud-icon-bg: rgba(255, 255, 255, 0.11);
  --weather-hud-icon-color: #fff1c7;
  --weather-hud-scene-intensity: 1;
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 13px 13px 15px;
  box-sizing: border-box;
  border-radius: 20px;
  color: #f5f8ff;
  overflow: hidden;
  backdrop-filter: blur(18px) saturate(132%);
  background:
    radial-gradient(circle at 84% 16%, var(--weather-hud-aura-primary), transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, var(--weather-hud-shell-top) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border: 1px solid var(--weather-hud-line);
  box-shadow:
    0 22px 46px var(--weather-hud-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-widget::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 34%),
    radial-gradient(circle at 18% 20%, var(--weather-hud-aura-soft), transparent 26%),
    linear-gradient(120deg, transparent 28%, rgba(255, 255, 255, 0.05) 45%, transparent 60%);
  pointer-events: none;
}

.weather-hud-widget::after {
  content: "";
  position: absolute;
  inset: auto -10% -36% 26%;
  height: 66%;
  background: radial-gradient(circle at center, color-mix(in srgb, var(--weather-hud-aura-secondary) 90%, transparent) 0%, transparent 68%);
  opacity: calc(0.9 * var(--weather-hud-scene-intensity));
  filter: blur(30px);
  transform: translate3d(0, 0, 0);
  animation: weather-hud-drift 12s ease-in-out infinite alternate;
  pointer-events: none;
}

.weather-hud-widget[data-time-phase="dawn"] {
  --weather-hud-shell-top: #30324f;
  --weather-hud-shell-mid: #6b536d;
  --weather-hud-shell-bottom: #26394c;
  --weather-hud-aura-primary: rgba(255, 196, 139, 0.34);
  --weather-hud-aura-secondary: rgba(121, 187, 255, 0.24);
  --weather-hud-aura-soft: rgba(255, 221, 176, 0.1);
  --weather-hud-accent: #ffcf9d;
}

.weather-hud-widget[data-time-phase="day"] {
  --weather-hud-shell-top: #1d3550;
  --weather-hud-shell-mid: #295075;
  --weather-hud-shell-bottom: #17283f;
  --weather-hud-aura-primary: rgba(255, 228, 162, 0.28);
  --weather-hud-aura-secondary: rgba(120, 193, 255, 0.26);
  --weather-hud-aura-soft: rgba(207, 227, 255, 0.1);
  --weather-hud-accent: #9ed0ff;
}

.weather-hud-widget[data-time-phase="dusk"] {
  --weather-hud-shell-top: #382c4c;
  --weather-hud-shell-mid: #674967;
  --weather-hud-shell-bottom: #202641;
  --weather-hud-aura-primary: rgba(255, 176, 123, 0.28);
  --weather-hud-aura-secondary: rgba(139, 142, 255, 0.22);
  --weather-hud-aura-soft: rgba(255, 207, 161, 0.09);
  --weather-hud-accent: #ffb88d;
}

.weather-hud-widget[data-time-phase="night"] {
  --weather-hud-shell-top: #131d31;
  --weather-hud-shell-mid: #18253f;
  --weather-hud-shell-bottom: #0d1524;
  --weather-hud-aura-primary: rgba(138, 167, 255, 0.16);
  --weather-hud-aura-secondary: rgba(84, 123, 206, 0.18);
  --weather-hud-aura-soft: rgba(192, 214, 255, 0.06);
  --weather-hud-accent: #97b8ff;
}

.weather-hud-widget[data-condition="clear"] {
  --weather-hud-icon-bg: rgba(255, 248, 222, 0.12);
  --weather-hud-icon-color: #fff1b2;
}

.weather-hud-widget[data-condition="cloudy"] {
  --weather-hud-aura-primary: rgba(206, 221, 255, 0.16);
  --weather-hud-aura-secondary: rgba(102, 139, 190, 0.16);
  --weather-hud-icon-bg: rgba(228, 237, 255, 0.11);
  --weather-hud-icon-color: #eef4ff;
}

.weather-hud-widget[data-condition="rain"] {
  --weather-hud-shell-top: #17283d;
  --weather-hud-shell-mid: #20344d;
  --weather-hud-shell-bottom: #0e1624;
  --weather-hud-aura-primary: rgba(118, 155, 220, 0.16);
  --weather-hud-aura-secondary: rgba(88, 126, 174, 0.16);
  --weather-hud-aura-soft: rgba(188, 215, 255, 0.05);
  --weather-hud-accent: #8db9ff;
  --weather-hud-icon-bg: rgba(194, 220, 255, 0.12);
  --weather-hud-icon-color: #dfeeff;
}

.weather-hud-widget[data-condition="storm"] {
  --weather-hud-shell-top: #141b2d;
  --weather-hud-shell-mid: #1b2841;
  --weather-hud-shell-bottom: #0b111c;
  --weather-hud-aura-primary: rgba(123, 146, 255, 0.18);
  --weather-hud-aura-secondary: rgba(82, 108, 182, 0.2);
  --weather-hud-aura-soft: rgba(220, 230, 255, 0.05);
  --weather-hud-accent: #a7b9ff;
  --weather-hud-icon-bg: rgba(205, 215, 255, 0.1);
  --weather-hud-icon-color: #eef2ff;
}

.weather-hud-widget[data-condition="snow"] {
  --weather-hud-shell-top: #233244;
  --weather-hud-shell-mid: #324860;
  --weather-hud-shell-bottom: #182230;
  --weather-hud-aura-primary: rgba(225, 236, 255, 0.22);
  --weather-hud-aura-secondary: rgba(162, 203, 255, 0.18);
  --weather-hud-aura-soft: rgba(240, 246, 255, 0.09);
  --weather-hud-accent: #d9e9ff;
  --weather-hud-icon-bg: rgba(235, 243, 255, 0.14);
  --weather-hud-icon-color: #ffffff;
}

.weather-hud-widget[data-condition="fog"] {
  --weather-hud-shell-top: #23303e;
  --weather-hud-shell-mid: #314153;
  --weather-hud-shell-bottom: #1a2430;
  --weather-hud-aura-primary: rgba(214, 222, 232, 0.18);
  --weather-hud-aura-secondary: rgba(168, 184, 208, 0.15);
  --weather-hud-aura-soft: rgba(244, 246, 250, 0.06);
  --weather-hud-accent: #d5deeb;
  --weather-hud-icon-bg: rgba(232, 238, 245, 0.12);
  --weather-hud-icon-color: #f6f8fb;
}

.weather-hud-widget[data-source="manual"] {
  background:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--weather-hud-aura-primary) 90%, rgba(198, 226, 255, 0.26)) 0%, transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, color-mix(in srgb, var(--weather-hud-shell-top) 90%, rgba(24, 49, 87, 0.7)) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.16));
}

.weather-hud-header,
.weather-hud-body,
.weather-hud-drawer {
  position: relative;
  z-index: 1;
}

.weather-hud-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.weather-hud-titlewrap {
  display: grid;
  gap: 6px;
}

.weather-hud-eyebrow {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-source {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 9px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 82%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 90%, transparent);
  color: rgba(242, 247, 255, 0.92);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weather-hud-control,
.weather-hud-gear,
.weather-hud-chip,
.weather-hud-preset {
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 84%, transparent);
  background: color-mix(in srgb, var(--weather-hud-surface) 96%, transparent);
  color: inherit;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.weather-hud-control:hover,
.weather-hud-gear:hover,
.weather-hud-chip:hover,
.weather-hud-preset:hover {
  background: color-mix(in srgb, var(--weather-hud-surface-strong) 96%, transparent);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 18%, rgba(255, 255, 255, 0.2));
  transform: translateY(-1px);
}

.weather-hud-control,
.weather-hud-gear {
  border-radius: 11px;
}

.weather-hud-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 11px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.15;
  text-align: center;
}

.weather-hud-control-ghost {
  background: rgba(255, 255, 255, 0.04);
}

.weather-hud-control-active {
  background: color-mix(in srgb, var(--weather-hud-accent) 24%, rgba(255, 255, 255, 0.06));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-control-icon,
.weather-hud-gear svg,
.weather-hud-icon svg {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.weather-hud-gear {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.weather-hud-gear svg,
.weather-hud-icon svg,
.weather-hud-control-icon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.weather-hud-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: end;
}

.weather-hud-primary {
  display: grid;
  gap: 4px;
}

.weather-hud-location {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(245, 248, 255, 0.92);
  max-width: 168px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-wrap: balance;
}

.weather-hud-date {
  font-size: 10px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-time {
  font-size: 35px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 0.94;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
}

.weather-hud-wind {
  font-size: 11px;
  color: var(--weather-hud-text-muted);
}

.weather-hud-weather {
  display: grid;
  justify-items: end;
  gap: 6px;
  text-align: right;
}

.weather-hud-icon {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, color-mix(in srgb, var(--weather-hud-icon-bg) 94%, white 6%), color-mix(in srgb, var(--weather-hud-icon-bg) 72%, transparent));
  color: var(--weather-hud-icon-color);
  box-shadow:
    0 10px 24px rgba(3, 10, 23, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.weather-hud-temp {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 0.94;
}

.weather-hud-summary {
  max-width: 132px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--weather-hud-text-soft);
}

.weather-hud-drawer {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--weather-hud-line) 70%, transparent);
}

.weather-hud-drawer-section {
  display: grid;
  gap: 8px;
  padding: 11px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 62%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
}

.weather-hud-section-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-mode-row,
.weather-hud-action-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-hud-chip,
.weather-hud-preset {
  min-height: 35px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.weather-hud-chip-active,
.weather-hud-preset-active {
  background: linear-gradient(180deg, color-mix(in srgb, var(--weather-hud-accent) 24%, transparent), color-mix(in srgb, var(--weather-hud-accent) 16%, rgba(255, 255, 255, 0.04)));
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.18));
}

.weather-hud-preset-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.weather-hud-control-grid {
  display: grid;
  gap: 10px;
}

.weather-hud-field {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-field-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.weather-hud-inline-value {
  color: rgba(245, 248, 255, 0.88);
  font-weight: 600;
}

.weather-hud-select {
  font-size: 11px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 72%, transparent);
  background: rgba(7, 16, 28, 0.3);
  color: inherit;
}

.weather-hud-range {
  accent-color: var(--weather-hud-accent);
}

.weather-hud-widget[data-expanded="false"] {
  gap: 10px;
}

.weather-hud-widget[data-expanded="false"] .weather-hud-summary {
  max-width: 118px;
}

.weather-hud-widget[data-paused="true"]::after {
  animation-play-state: paused;
  opacity: calc(0.55 * var(--weather-hud-scene-intensity));
}

@keyframes weather-hud-drift {
  0% {
    transform: translate3d(-5%, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(6%, -4%, 0) scale(1.08);
  }
}

.weather-fx-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  isolation: isolate;
  transition:
    opacity 320ms ease,
    --weather-bg-start 1200ms ease,
    --weather-bg-mid 1200ms ease,
    --weather-bg-end 1200ms ease,
    --weather-glow 900ms ease,
    --weather-beam-color 900ms ease,
    --weather-horizon-color 900ms ease,
    --weather-sky-opacity 800ms ease,
    --weather-glow-opacity 800ms ease,
    --weather-beam-opacity 800ms ease,
    --weather-cloud-opacity 800ms ease,
    --weather-horizon-opacity 800ms ease,
    --weather-mist-opacity 800ms ease,
    --weather-fog-opacity 800ms ease,
    --weather-rain-opacity 600ms ease,
    --weather-snow-opacity 600ms ease,
    --weather-mote-opacity 600ms ease,
    --weather-flash-opacity 300ms ease;
}

.weather-fx-root.weather-visible {
  opacity: 1;
}

.weather-fx-root[data-kind="back"] {
  z-index: 0;
}

.weather-fx-root[data-kind="front"] {
  z-index: 24;
  mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.55) 46%, #000 78%);
}

.weather-fx-root.weather-hidden {
  display: none;
}

.weather-fx-root.weather-paused *,
.weather-fx-root.weather-paused *::before,
.weather-fx-root.weather-paused *::after {
  animation-play-state: paused !important;
}

.weather-fx-sky,
.weather-fx-glow,
.weather-fx-beams,
.weather-fx-clouds,
.weather-fx-horizon,
.weather-fx-mist,
.weather-fx-fog,
.weather-fx-motes,
.weather-fx-rain,
.weather-fx-snow,
.weather-fx-wind-streaks,
.weather-fx-rain-splashes,
.weather-fx-rain-ripples,
.weather-fx-snow-bank,
.weather-fx-frost,
.weather-fx-lightning,
.weather-fx-lightning-glow,
.weather-fx-flash {
  position: absolute;
  inset: 0;
}

.weather-fx-sky {
  background: linear-gradient(180deg, var(--weather-bg-start) 0%, var(--weather-bg-mid) 46%, var(--weather-bg-end) 100%);
  opacity: var(--weather-sky-opacity);
  mix-blend-mode: normal;
  filter: saturate(1.08) brightness(1.04);
  animation: weather-sky-shift 24s ease-in-out infinite alternate;
}

.weather-fx-glow {
  background:
    radial-gradient(circle at 18% 18%, var(--weather-glow), transparent 34%),
    radial-gradient(circle at 82% 22%, color-mix(in srgb, var(--weather-glow) 74%, white 14%), transparent 30%);
  opacity: var(--weather-glow-opacity);
  mix-blend-mode: screen;
  animation: weather-glow-drift 18s ease-in-out infinite alternate;
}

.weather-fx-beams {
  background:
    radial-gradient(circle at 20% 16%, var(--weather-beam-color), transparent 26%),
    linear-gradient(120deg, transparent 30%, color-mix(in srgb, var(--weather-beam-color) 58%, transparent) 48%, transparent 62%);
  opacity: var(--weather-beam-opacity);
  mix-blend-mode: screen;
  animation: weather-beam-sway 14s ease-in-out infinite alternate;
}

.weather-fx-horizon {
  background: linear-gradient(180deg, transparent 0%, transparent 48%, var(--weather-horizon-color) 100%);
  opacity: var(--weather-horizon-opacity);
  filter: blur(20px);
  transform: translateY(6%);
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-rain-drop,
.weather-fx-snow-flake,
.weather-fx-wind-streak,
.weather-fx-rain-splash,
.weather-fx-rain-ripple {
  position: absolute;
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote {
  will-change: transform, opacity;
}

.weather-fx-clouds::before {
  content: "";
  position: absolute;
  inset: -12% -8% 46%;
  background:
    radial-gradient(ellipse at 22% 30%, color-mix(in srgb, var(--weather-cloud-core) 86%, white 8%), transparent 42%),
    radial-gradient(ellipse at 72% 20%, color-mix(in srgb, var(--weather-cloud-edge) 92%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--weather-cloud-core) 82%, rgba(8, 14, 24, 0.18)) 0%, transparent 100%);
  opacity: calc(var(--weather-cloud-opacity) * 0.7);
  filter: blur(38px);
  transform: translateY(-12%);
}

.weather-fx-cloud {
  --cloud-base-y: 0vh;
  width: var(--cloud-width);
  height: var(--cloud-height);
  top: var(--cloud-top);
  left: var(--cloud-left);
  border-radius: 46% 54% 52% 48% / 62% 68% 34% 38%;
  background:
    radial-gradient(ellipse at 20% 62%, color-mix(in srgb, var(--weather-cloud-core) 82%, transparent), transparent 54%),
    radial-gradient(ellipse at 36% 38%, color-mix(in srgb, var(--weather-cloud-edge) 92%, white 4%), transparent 56%),
    radial-gradient(ellipse at 58% 42%, color-mix(in srgb, var(--weather-cloud-core) 96%, white 6%), transparent 58%),
    radial-gradient(ellipse at 82% 60%, color-mix(in srgb, var(--weather-cloud-core) 76%, transparent), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, var(--weather-cloud-core) 96%, white 4%) 0%, color-mix(in srgb, var(--weather-cloud-core) 22%, transparent) 100%);
  filter: blur(var(--cloud-blur)) saturate(1.04);
  opacity: calc(var(--weather-cloud-opacity) * var(--cloud-opacity-scale));
  transform-origin: 50% 58%;
  animation: weather-cloud-drift var(--cloud-duration) linear infinite;
  animation-delay: var(--cloud-delay);
}

.weather-fx-cloud::before,
.weather-fx-cloud::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.weather-fx-cloud::before {
  inset: -34% -10% 12%;
  border-radius: 48% 52% 56% 44% / 70% 72% 34% 36%;
  background:
    radial-gradient(ellipse at 18% 72%, color-mix(in srgb, var(--weather-cloud-edge) 86%, transparent), transparent 48%),
    radial-gradient(ellipse at 42% 38%, color-mix(in srgb, var(--weather-cloud-core) 98%, white 8%), transparent 54%),
    radial-gradient(ellipse at 68% 46%, color-mix(in srgb, var(--weather-cloud-core) 88%, transparent), transparent 56%),
    radial-gradient(ellipse at 88% 70%, color-mix(in srgb, var(--weather-cloud-edge) 72%, transparent), transparent 50%);
  filter: blur(var(--cloud-soft-blur));
  opacity: var(--cloud-highlight-opacity);
  transform: translate3d(0, var(--cloud-lift), 0) rotate(var(--cloud-shear));
}

.weather-fx-cloud::after {
  inset: 42% -8% -24%;
  border-radius: 44% 56% 50% 50% / 42% 44% 58% 60%;
  background:
    radial-gradient(ellipse at 26% 16%, color-mix(in srgb, rgba(4, 12, 24, 0.26) 76%, var(--weather-cloud-core)), transparent 58%),
    radial-gradient(ellipse at 72% 18%, color-mix(in srgb, rgba(4, 12, 24, 0.18) 70%, var(--weather-cloud-core)), transparent 60%),
    linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--weather-cloud-core) 18%, rgba(4, 12, 24, 0.36)) 100%);
  filter: blur(var(--cloud-soft-blur));
  opacity: var(--cloud-shadow-opacity);
}

.weather-fx-fog-band {
  width: var(--fog-width);
  height: var(--fog-height);
  top: var(--fog-top);
  left: var(--fog-left);
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--weather-fog-color), transparent);
  filter: blur(20px);
  opacity: calc(var(--weather-fog-opacity) * var(--fog-opacity-scale));
  animation: weather-fog-drift var(--fog-duration) ease-in-out infinite;
  animation-delay: var(--fog-delay);
}

.weather-fx-mist-plume {
  width: var(--mist-width);
  height: var(--mist-height);
  left: var(--mist-left);
  bottom: var(--mist-bottom);
  border-radius: 999px;
  background: radial-gradient(circle at center, var(--weather-mist-color), transparent 68%);
  filter: blur(22px);
  opacity: calc(var(--weather-mist-opacity) * var(--mist-opacity-scale));
  animation: weather-mist-roll var(--mist-duration) ease-in-out infinite;
  animation-delay: var(--mist-delay);
}

.weather-fx-mote {
  left: var(--mote-left);
  top: var(--mote-top);
  width: var(--mote-size);
  height: var(--mote-size);
  border-radius: 50%;
  background: rgba(255, 247, 224, 0.95);
  box-shadow: 0 0 10px rgba(255, 245, 214, 0.4);
  opacity: calc(var(--weather-mote-opacity) * var(--mote-opacity-scale));
  animation: weather-mote-drift var(--mote-duration) ease-in-out infinite;
  animation-delay: var(--mote-delay);
}

.weather-fx-rain-drop {
  top: var(--drop-top);
  left: var(--drop-left);
  width: var(--drop-width);
  height: var(--drop-length);
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 10%,
    var(--weather-rain-color) 50%,
    rgba(255, 255, 255, 0.9) 95%,
    rgba(255, 255, 255, 1) 100%
  );
  border-radius: 999px;
  opacity: 0;
  transform: rotate(11deg);
  filter: drop-shadow(0 0 4px rgba(191, 221, 255, 0.3));
  animation: weather-rain-fall var(--drop-duration) linear infinite;
  animation-delay: var(--drop-delay);
  animation-play-state: paused;
}

.weather-fx-rain-drop-front {
  filter: drop-shadow(0 0 8px rgba(209, 229, 255, 0.4));
}

.weather-fx-rain-splashes,
.weather-fx-rain-ripples {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splashes,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripples {
  opacity: 1;
}

.weather-fx-rain-splash {
  bottom: var(--splash-bottom);
  left: var(--splash-left);
  width: var(--splash-size);
  height: var(--splash-size);
  border: 1.5px solid rgba(191, 221, 255, 0.5);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(191, 221, 255, 0.2) 0%, transparent 70%);
  opacity: 0;
  animation: weather-splash var(--splash-duration) ease-out infinite;
  animation-delay: var(--splash-delay);
  animation-play-state: paused;
}

.weather-fx-rain-splash-front {
  border-color: rgba(209, 229, 255, 0.6);
  background: radial-gradient(circle, rgba(209, 229, 255, 0.25) 0%, transparent 70%);
}

.weather-fx-rain-ripple {
  bottom: var(--ripple-bottom);
  left: var(--ripple-left);
  width: var(--ripple-size);
  height: calc(var(--ripple-size) * 0.4);
  border: 1px solid rgba(191, 221, 255, 0.35);
  border-radius: 50%;
  opacity: 0;
  animation: weather-ripple var(--ripple-duration) ease-out infinite;
  animation-delay: var(--ripple-delay);
  animation-play-state: paused;
}

.weather-fx-wind-streaks {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}

.weather-fx-root[data-condition="storm"] .weather-fx-wind-streaks {
  opacity: 1;
}

.weather-fx-wind-streak {
  top: var(--streak-top);
  left: -30%;
  width: var(--streak-width);
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(200, 220, 255, var(--streak-opacity)), transparent);
  animation: weather-wind-streak var(--streak-duration) linear infinite;
  animation-delay: var(--streak-delay);
  animation-play-state: paused;
}

.weather-fx-root[data-condition="storm"] .weather-fx-wind-streak {
  animation-play-state: running;
}

.weather-fx-snow-flake {
  top: var(--flake-top);
  left: var(--flake-left);
  width: var(--flake-size);
  height: var(--flake-size);
  background-color: var(--weather-snow-color);
  -webkit-mask: url("${SNOWFLAKE_MASK_0}") no-repeat center / contain;
  mask: url("${SNOWFLAKE_MASK_0}") no-repeat center / contain;
  opacity: 0;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.4));
  animation:
    weather-snow-fall var(--flake-duration) linear infinite,
    weather-snow-sparkle var(--flake-duration) ease-in-out infinite;
  animation-delay: var(--flake-delay), var(--flake-delay);
  animation-play-state: paused;
}

.weather-fx-snow-flake[data-shape="1"] {
  -webkit-mask: url("${SNOWFLAKE_MASK_1}") no-repeat center / contain;
  mask: url("${SNOWFLAKE_MASK_1}") no-repeat center / contain;
}

.weather-fx-snow-flake[data-shape="2"] {
  -webkit-mask: url("${SNOWFLAKE_MASK_2}") no-repeat center / contain;
  mask: url("${SNOWFLAKE_MASK_2}") no-repeat center / contain;
}

.weather-fx-snow-flake[data-shape="3"] {
  -webkit-mask: url("${SNOWFLAKE_MASK_3}") no-repeat center / contain;
  mask: url("${SNOWFLAKE_MASK_3}") no-repeat center / contain;
}

.weather-fx-snow-flake-front {
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.55));
}

.weather-fx-snow-bank {
  top: auto;
  bottom: 0;
  height: 14%;
  border-radius: 50% 50% 0 0 / 24% 24% 0 0;
  background:
    radial-gradient(ellipse 80% 100% at 30% 100%, rgba(240, 248, 255, 0.45) 0%, transparent 70%),
    radial-gradient(ellipse 70% 100% at 70% 100%, rgba(235, 245, 255, 0.4) 0%, transparent 70%),
    linear-gradient(180deg, transparent 0%, rgba(240, 248, 255, 0.1) 20%, rgba(245, 250, 255, 0.55) 100%);
  opacity: 0;
  pointer-events: none;
  filter: blur(2px);
  transform: translateY(15%);
  transition: opacity 1000ms ease, transform 1000ms ease;
}

.weather-fx-snow-bank::before {
  content: "";
  position: absolute;
  top: -8px;
  left: -5%;
  right: -5%;
  height: 16px;
  border-radius: 50% 50% 0 0;
  background: rgba(245, 250, 255, 0.35);
  filter: blur(4px);
}

.weather-fx-root[data-condition="snow"] .weather-fx-snow-bank {
  opacity: 1;
  transform: translateY(0);
}

.weather-fx-frost {
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(ellipse 40% 50% at 0% 0%, rgba(220, 235, 255, 0.25), transparent 60%),
    radial-gradient(ellipse 40% 50% at 100% 0%, rgba(220, 235, 255, 0.2), transparent 60%),
    radial-gradient(ellipse 50% 60% at 0% 100%, rgba(220, 235, 255, 0.3), transparent 55%),
    radial-gradient(ellipse 50% 60% at 100% 100%, rgba(220, 235, 255, 0.25), transparent 55%),
    radial-gradient(ellipse 60% 30% at 50% 0%, rgba(210, 230, 255, 0.12), transparent 50%),
    radial-gradient(ellipse 30% 80% at 0% 50%, rgba(210, 230, 255, 0.1), transparent 50%),
    radial-gradient(ellipse 30% 80% at 100% 50%, rgba(210, 230, 255, 0.1), transparent 50%);
  mix-blend-mode: screen;
  filter: blur(3px);
  transition: opacity 1000ms ease;
}

.weather-fx-root[data-condition="snow"] .weather-fx-frost {
  opacity: 0.6;
}

.weather-fx-lightning {
  overflow: hidden;
  pointer-events: none;
}

.weather-fx-lightning-bolt {
  position: absolute;
  top: 0;
  width: 26%;
  height: 100%;
  opacity: 0;
  filter:
    drop-shadow(0 0 4px rgba(200, 220, 255, 0.9))
    drop-shadow(0 0 14px rgba(160, 190, 255, 0.5))
    drop-shadow(0 0 30px rgba(120, 160, 255, 0.3));
}

.weather-fx-lightning-bolt[data-bolt-index="0"] { left: 10%; }
.weather-fx-lightning-bolt[data-bolt-index="1"] { left: 38%; }
.weather-fx-lightning-bolt[data-bolt-index="2"] { left: 62%; }

.weather-fx-lightning-bolt.weather-lightning-strike {
  animation: weather-lightning-strike 650ms ease-out forwards;
}

.weather-fx-lightning-glow {
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    ellipse 50% 60% at var(--weather-lightning-x, 50%) 15%,
    rgba(210, 230, 255, 0.5) 0%,
    rgba(180, 210, 255, 0.2) 20%,
    transparent 50%
  );
  mix-blend-mode: screen;
}

.weather-fx-root.weather-lightning-glow-flash .weather-fx-lightning-glow {
  animation: weather-lightning-glow-flash 650ms ease-out forwards;
}

.weather-fx-flash {
  background:
    radial-gradient(circle at 34% 22%, rgba(232, 241, 255, 0.9), transparent 32%),
    radial-gradient(circle at 50% 10%, rgba(220, 235, 255, 0.6), transparent 40%),
    rgba(219, 231, 255, 0.48);
  opacity: 0;
  mix-blend-mode: screen;
}

.weather-fx-root.weather-storm-flash .weather-fx-flash {
  animation: weather-flash-sequence 650ms ease-out;
}

.weather-fx-root[data-condition="rain"] .weather-fx-clouds::before,
.weather-fx-root[data-condition="storm"] .weather-fx-clouds::before {
  inset: -14% -8% 44%;
  opacity: calc(var(--weather-cloud-opacity) * 0.9);
  filter: blur(42px);
}

.weather-fx-root[data-condition="rain"] .weather-fx-cloud,
.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-base-y: -1.5vh;
  --cloud-shadow-opacity: 0.42;
  filter: blur(calc(var(--cloud-blur) + 1px)) saturate(0.92);
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop,
.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  animation-play-state: running;
  will-change: transform, opacity;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-drop {
  opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale));
}

.weather-fx-root.weather-snow-active .weather-fx-snow-flake {
  opacity: calc(var(--weather-snow-opacity) * var(--flake-opacity-scale));
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splash,
.weather-fx-root.weather-rain-active .weather-fx-rain-ripple {
  animation-play-state: running;
}

.weather-fx-root.weather-rain-active .weather-fx-rain-splash {
  opacity: calc(var(--weather-rain-opacity) * 0.5);
}

.weather-fx-root.weather-rain-active .weather-fx-rain-ripple {
  opacity: calc(var(--weather-rain-opacity) * 0.35);
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud,
.weather-fx-root.weather-reduced-motion .weather-fx-fog-band,
.weather-fx-root.weather-reduced-motion .weather-fx-mist-plume,
.weather-fx-root.weather-reduced-motion .weather-fx-mote,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-drop,
.weather-fx-root.weather-reduced-motion .weather-fx-snow-flake,
.weather-fx-root.weather-reduced-motion .weather-fx-wind-streak,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-splash,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-ripple {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-sky,
.weather-fx-root.weather-reduced-motion .weather-fx-glow,
.weather-fx-root.weather-reduced-motion .weather-fx-beams {
  animation: none;
}

.weather-fx-root.weather-reduced-motion .weather-fx-cloud {
  transform: translate3d(var(--cloud-drift-x-mid), var(--cloud-base-y), 0) scale(var(--cloud-scale));
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop,
.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  transform: translate3d(0, 48vh, 0) rotate(11deg);
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  transform: translate3d(var(--flake-drift-mid), 52vh, 0) rotate(var(--flake-spin-mid));
}

@keyframes weather-sky-shift {
  0% { transform: scale(1) translate3d(0, 0, 0); }
  100% { transform: scale(1.04) translate3d(0, -1.6vh, 0); }
}

@keyframes weather-glow-drift {
  0% { transform: translate3d(-1vw, 0, 0) scale(1); }
  100% { transform: translate3d(1vw, -1vh, 0) scale(1.08); }
}

@keyframes weather-beam-sway {
  0% { transform: translate3d(-1vw, 0, 0) rotate(-1deg); }
  100% { transform: translate3d(1vw, -0.6vh, 0) rotate(1deg); }
}

@keyframes weather-cloud-drift {
  0% {
    transform: translate3d(var(--cloud-drift-x-start), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
  48% {
    transform: translate3d(var(--cloud-drift-x-mid), calc(var(--cloud-base-y) + var(--cloud-drift-y)), 0) scale(var(--cloud-scale-mid));
  }
  100% {
    transform: translate3d(var(--cloud-drift-x-end), var(--cloud-base-y), 0) scale(var(--cloud-scale));
  }
}

@keyframes weather-fog-drift {
  0%, 100% { transform: translate3d(-2vw, 0, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mist-roll {
  0%, 100% { transform: translate3d(-2vw, 1vh, 0); }
  50% { transform: translate3d(2vw, -1vh, 0); }
}

@keyframes weather-mote-drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(0.95); }
  50% { transform: translate3d(var(--mote-drift-x), var(--mote-drift-y), 0) scale(1.12); }
}

@keyframes weather-rain-fall {
  0% { transform: translate3d(0, 0, 0) rotate(11deg); opacity: 0; }
  12% { opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale)); }
  100% { transform: translate3d(var(--drop-drift), 118vh, 0) rotate(11deg); opacity: 0; }
}

@keyframes weather-snow-fall {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(var(--flake-drift-mid), 56vh, 0) rotate(var(--flake-spin-mid)); }
  100% { transform: translate3d(var(--flake-drift-end), 116vh, 0) rotate(var(--flake-spin-end)); }
}

@keyframes weather-snow-sparkle {
  0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.4)) brightness(1); }
  50% { filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.7)) brightness(1.3); }
}

@keyframes weather-splash {
  0% { transform: scale(0.1); opacity: 0; }
  20% { opacity: 0.7; }
  100% { transform: scale(2.5); opacity: 0; }
}

@keyframes weather-ripple {
  0% { transform: scale(0.15); opacity: 0; }
  25% { opacity: 0.5; }
  100% { transform: scale(3); opacity: 0; }
}

@keyframes weather-wind-streak {
  0% { transform: translateX(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateX(160vw); opacity: 0; }
}

@keyframes weather-lightning-strike {
  0% { opacity: 0; }
  2% { opacity: 1; }
  8% { opacity: 0.15; }
  14% { opacity: 0.95; }
  22% { opacity: 0.08; }
  30% { opacity: 0.6; }
  45% { opacity: 0.02; }
  52% { opacity: 0.35; }
  70% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-lightning-glow-flash {
  0% { opacity: 0; }
  3% { opacity: 0.7; }
  10% { opacity: 0.08; }
  17% { opacity: 0.55; }
  28% { opacity: 0.04; }
  38% { opacity: 0.3; }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes weather-flash-sequence {
  0% { opacity: 0; }
  3% { opacity: var(--weather-flash-opacity); }
  10% { opacity: calc(var(--weather-flash-opacity) * 0.12); }
  17% { opacity: calc(var(--weather-flash-opacity) * 0.82); }
  28% { opacity: calc(var(--weather-flash-opacity) * 0.06); }
  38% { opacity: calc(var(--weather-flash-opacity) * 0.4); }
  60% { opacity: 0; }
  100% { opacity: 0; }
}

@media (max-width: 768px) {
  .weather-settings-manual-grid,
  .weather-settings-preset-grid {
    grid-template-columns: 1fr;
  }

  .weather-settings-actions,
  .weather-hud-mode-row,
  .weather-hud-action-row {
    grid-template-columns: 1fr;
  }

  .weather-hud-preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .weather-hud-time {
    font-size: 24px;
  }
}
`;
