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

.weather-settings-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--lumiverse-danger, #ef4444) 28%, transparent);
  background: color-mix(in srgb, var(--lumiverse-danger, #ef4444) 10%, transparent);
  color: var(--lumiverse-danger, #ef4444);
  font-size: 11px;
  line-height: 1.4;
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

.weather-settings-button:disabled,
.weather-settings-checkbox:disabled,
.weather-settings-select:disabled,
.weather-settings-input:disabled,
.weather-settings-range:disabled,
.weather-hud-control:disabled,
.weather-hud-chip:disabled,
.weather-hud-preset:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
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

.weather-settings-wind-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(104px, 0.5fr);
  gap: 8px;
  min-width: 0;
}

.weather-settings-actions {
  display: flex;
  gap: 8px;
}

.weather-settings-actions .weather-settings-button {
  flex: 1 1 0;
}

/* LumiWeather Studio: layered glass control surface. */
.weather-settings-card {
  --lumi-glass-fill: color-mix(in srgb, var(--lumiverse-fill, #101827) 72%, rgba(25, 50, 87, 0.64));
  --lumi-glass-soft: color-mix(in srgb, var(--lumiverse-fill-subtle, #172338) 68%, rgba(116, 168, 255, 0.1));
  --lumi-glass-line: color-mix(in srgb, var(--lumiverse-border, #33425a) 68%, rgba(183, 220, 255, 0.32));
  position: relative;
  isolation: isolate;
  border: 1px solid var(--lumi-glass-line);
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 88% -12%, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 35%, transparent), transparent 46%),
    radial-gradient(ellipse at 6% 102%, rgba(99, 213, 255, 0.15), transparent 44%),
    linear-gradient(150deg, color-mix(in srgb, var(--lumi-glass-fill) 94%, #162842) 0%, var(--lumi-glass-fill) 52%, color-mix(in srgb, var(--lumi-glass-fill) 88%, #0c1422) 100%);
  box-shadow:
    0 28px 72px rgba(4, 12, 28, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(4, 10, 22, 0.18);
  backdrop-filter: blur(24px) saturate(145%);
}

.weather-settings-card::before,
.weather-settings-card::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

.weather-settings-card::before {
  inset: 0;
  opacity: 0.72;
  background:
    linear-gradient(112deg, rgba(255, 255, 255, 0.09), transparent 28%, transparent 72%, rgba(177, 214, 255, 0.08)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 4px);
  mix-blend-mode: screen;
}

.weather-settings-card::after {
  width: 260px;
  height: 260px;
  right: -130px;
  top: 88px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 30%, transparent), transparent 68%);
  filter: blur(10px);
}

.weather-settings-card-header {
  position: relative;
  z-index: 1;
  min-height: 60px;
  padding: 17px 18px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.018));
}

.weather-settings-header-glow {
  position: absolute;
  inset: -32px auto auto -26px;
  width: 176px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(132, 191, 255, 0.24), transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}

.weather-settings-titlewrap,
.weather-settings-status {
  position: relative;
  z-index: 1;
}

.weather-settings-titlewrap {
  display: grid;
  gap: 5px;
}

.weather-settings-eyebrow {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 78%, var(--lumiverse-text-muted));
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.weather-settings-card-header h3 {
  font-size: 18px;
  font-weight: 720;
  letter-spacing: -0.025em;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
}

.weather-settings-status {
  max-width: min(48%, 228px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--lumiverse-fill, #111c2c) 52%, rgba(255, 255, 255, 0.11));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  font-size: 10px;
  line-height: 1.25;
  text-align: right;
  text-transform: none;
}

.weather-settings-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 6px 1px 0;
  border-radius: 50%;
  background: #86d7ff;
  box-shadow: 0 0 12px rgba(134, 215, 255, 0.82);
}

.weather-settings-status[data-mode="manual"]::before {
  background: #f3c989;
  box-shadow: 0 0 12px rgba(243, 201, 137, 0.8);
}

.weather-settings-status[data-mode="notice"]::before,
.weather-settings-status[data-mode="waiting"]::before {
  background: #aab7c9;
  box-shadow: none;
}

.weather-settings-card-body {
  position: relative;
  z-index: 1;
  gap: 14px;
  padding: 15px;
}

.weather-settings-scene-hero {
  position: relative;
  display: grid;
  align-content: start;
  min-height: 102px;
  gap: 7px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 84%, transparent);
  border-radius: 19px;
  background:
    radial-gradient(circle at 86% 18%, var(--lumi-scene-glow, rgba(139, 200, 255, 0.32)), transparent 26%),
    linear-gradient(128deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.025) 48%, rgba(5, 16, 33, 0.16));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 14px 34px rgba(5, 14, 28, 0.12);
}

.weather-settings-preview-glow {
  position: absolute;
  width: 150px;
  height: 150px;
  right: -44px;
  bottom: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lumi-scene-glow, rgba(121, 185, 255, 0.38)), transparent 70%);
  filter: blur(4px);
}

.weather-settings-preview-label,
.weather-settings-preview-value,
.weather-settings-preview-hint {
  position: relative;
  z-index: 1;
}

.weather-settings-preview-label {
  color: var(--lumiverse-text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.weather-settings-preview-value {
  max-width: 76ch;
  color: color-mix(in srgb, var(--lumiverse-text) 96%, white 4%);
  font-size: 12px;
  font-weight: 590;
  line-height: 1.48;
}

.weather-settings-preview-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 94%, white 6%);
  font-size: 10px;
}

.weather-settings-scene-hero[data-condition="rain"],
.weather-settings-scene-hero[data-condition="storm"] {
  --lumi-scene-glow: rgba(127, 167, 255, 0.34);
}

.weather-settings-scene-hero[data-condition="snow"] {
  --lumi-scene-glow: rgba(222, 240, 255, 0.4);
}

.weather-settings-scene-hero[data-condition="fog"] {
  --lumi-scene-glow: rgba(208, 225, 233, 0.3);
}

.weather-settings-glass-panel {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 82%, transparent);
  border-radius: 18px;
  background:
    linear-gradient(144deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 44%, rgba(0, 0, 0, 0.04)),
    var(--lumi-glass-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 12px 26px rgba(4, 13, 27, 0.1);
  backdrop-filter: blur(16px) saturate(135%);
}

.weather-settings-section,
.weather-settings-manual-card {
  gap: 12px;
  padding: 14px;
}

.weather-settings-section-header {
  gap: 7px;
}

.weather-settings-section-title {
  color: color-mix(in srgb, var(--lumiverse-primary, #9dc0ff) 68%, var(--lumiverse-text-muted));
  font-weight: 720;
  letter-spacing: 0.15em;
}

.weather-settings-section-copy,
.weather-settings-manual-hint {
  color: color-mix(in srgb, var(--lumiverse-text-muted) 92%, white 8%);
}

.weather-settings-control-deck {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.weather-settings-control-deck .weather-settings-section {
  min-width: 0;
}

.weather-settings-control-deck .weather-settings-section:nth-child(3) {
  grid-column: span 2;
}

.weather-settings-section-body,
.weather-settings-copy-group {
  gap: 9px;
}

.weather-settings-copy-group {
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 62%, transparent);
  border-radius: 13px;
  background: rgba(4, 14, 29, 0.1);
}

.weather-settings-copy-title {
  color: color-mix(in srgb, var(--lumiverse-text) 95%, white 5%);
}

.weather-settings-code {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 78%, transparent);
  border-radius: 12px;
  background: rgba(3, 12, 27, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.weather-settings-label {
  gap: 8px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 58%, transparent);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: color-mix(in srgb, var(--lumiverse-text-muted) 90%, white 10%);
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.weather-settings-label:focus-within {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 52%, var(--lumi-glass-line));
  background: rgba(117, 170, 255, 0.08);
  transform: translateY(-1px);
}

.weather-settings-select,
.weather-settings-input,
.weather-settings-button {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  background: color-mix(in srgb, var(--lumiverse-fill, #101827) 58%, rgba(255, 255, 255, 0.12));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
}

.weather-settings-select,
.weather-settings-input {
  min-height: 35px;
}

.weather-settings-button {
  min-height: 37px;
  border-radius: 12px;
  font-weight: 620;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 18px rgba(4, 13, 28, 0.09);
}

.weather-settings-button-primary {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 56%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 42%, rgba(255, 255, 255, 0.12)), color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 20%, rgba(9, 23, 46, 0.5)));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.19), 0 10px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 17%, transparent);
}

.weather-settings-checkbox {
  width: 19px;
  height: 19px;
  accent-color: var(--lumiverse-primary, #82a8ff);
  filter: drop-shadow(0 2px 5px rgba(2, 12, 26, 0.28));
}

.weather-settings-range {
  accent-color: var(--lumiverse-primary, #82a8ff);
}

.weather-settings-row {
  gap: 8px;
}

.weather-settings-value {
  min-width: 42px;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--lumi-glass-line) 66%, transparent);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: color-mix(in srgb, var(--lumiverse-text) 92%, white 8%);
}

.weather-settings-status-pill {
  border-color: color-mix(in srgb, var(--lumi-glass-line) 80%, transparent);
  background: rgba(255, 255, 255, 0.075);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset-grid {
  gap: 9px;
}

.weather-settings-preset {
  min-height: 72px;
  border-color: color-mix(in srgb, var(--lumi-glass-line) 72%, transparent);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.weather-settings-preset:hover,
.weather-settings-preset-active {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 58%, var(--lumi-glass-line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 21%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.045));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 20px color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 13%, transparent);
}

.weather-settings-manual-card {
  border-color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 25%, var(--lumi-glass-line));
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

.weather-hud-widget[data-empty="true"] .weather-hud-summary {
  color: var(--weather-hud-text-muted);
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
.weather-hud-gear svg {
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

.weather-settings-select:focus-visible,
.weather-settings-input:focus-visible,
.weather-settings-button:focus-visible,
.weather-settings-checkbox:focus-visible,
.weather-settings-range:focus-visible,
.weather-hud-control:focus-visible,
.weather-hud-gear:focus-visible,
.weather-hud-chip:focus-visible,
.weather-hud-preset:focus-visible,
.weather-hud-select:focus-visible,
.weather-hud-range:focus-visible {
  outline: 2px solid var(--lumiverse-primary, var(--weather-hud-accent, #9dc0ff));
  outline-offset: 2px;
}

.weather-hud-gear svg,
.weather-hud-control-icon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.weather-hud-body {
  display: grid;
  grid-template-columns: minmax(132px, 1fr) minmax(78px, 96px);
  gap: 10px;
  align-items: end;
}

.weather-hud-primary {
  display: grid;
  min-width: 0;
  gap: 4px;
  transform: translateY(-7px);
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
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 0.94;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--weather-hud-icon-color) 24%, rgba(255, 255, 255, 0.1));
  background:
    radial-gradient(circle at 32% 22%, color-mix(in srgb, var(--weather-hud-icon-color) 14%, transparent), transparent 48%),
    linear-gradient(155deg, color-mix(in srgb, var(--weather-hud-icon-bg) 76%, white 16%), color-mix(in srgb, var(--weather-hud-icon-bg) 88%, rgba(6, 15, 30, 0.34)));
  color: var(--weather-hud-icon-color);
  box-shadow:
    0 10px 24px rgba(3, 10, 23, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -10px 18px rgba(4, 12, 24, 0.12);
}

.weather-hud-icon svg {
  width: 27px;
  height: 27px;
  display: block;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 3px rgba(1, 8, 18, 0.48));
}

.weather-hud-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-temp {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 0.94;
}

.weather-hud-summary-viewport {
  position: relative;
  width: 96px;
  max-width: 100%;
  min-height: 15px;
  overflow: hidden;
  isolation: isolate;
}

.weather-hud-summary-viewport::before,
.weather-hud-summary-viewport::after {
  content: "";
  position: absolute;
  z-index: 1;
  inset-block: -2px;
  width: 11px;
  pointer-events: none;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.weather-hud-summary-viewport::before {
  left: 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--weather-hud-shell-bottom) 48%, transparent), transparent);
}

.weather-hud-summary-viewport::after {
  right: 0;
  background: linear-gradient(270deg, color-mix(in srgb, var(--weather-hud-shell-bottom) 48%, transparent), transparent);
}

.weather-hud-summary {
  --weather-hud-summary-gap: 28px;
  display: flex;
  width: max-content;
  min-width: max-content;
  align-items: center;
  gap: var(--weather-hud-summary-gap);
  font-size: 11px;
  line-height: 1.35;
  color: var(--weather-hud-text-soft);
  white-space: nowrap;
  will-change: transform;
  animation: weather-hud-summary-ticker 12s linear infinite;
}

.weather-hud-summary::after {
  content: attr(data-ticker-text);
  flex: 0 0 auto;
}

.weather-hud-summary-viewport:hover .weather-hud-summary {
  animation-play-state: paused;
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

.weather-hud-widget[data-expanded="false"] .weather-hud-summary-viewport {
  width: 118px;
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

@keyframes weather-hud-summary-ticker {
  from {
    transform: translate3d(calc(-50% - 14px), 0, 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}

.weather-fx-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  isolation: isolate;
  contain: paint;
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
  z-index: 1;
}

.weather-fx-root[data-kind="front"] {
  z-index: 24;
  mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.55) 46%, #000 78%);
}

.weather-fx-root.weather-hidden {
  display: none;
}

.weather-fx-procedural-fog-layer {
  position: absolute;
  inset: 0;
  opacity: var(--weather-procedural-fog-opacity, 0);
  pointer-events: none;
  transition: opacity 800ms ease;
}

.weather-fx-root[data-kind="front"] .weather-fx-procedural-fog-layer {
  opacity: calc(var(--weather-procedural-fog-opacity, 0) * 0.48);
  mix-blend-mode: screen;
}

.weather-fx-procedural-fog-layer::before {
  content: "";
  position: absolute;
  inset: -8%;
  background:
    radial-gradient(ellipse at 18% 72%, rgba(202, 216, 225, 0.26), transparent 46%),
    radial-gradient(ellipse at 78% 28%, rgba(182, 202, 215, 0.2), transparent 50%);
  filter: blur(30px);
  opacity: 0.8;
  transition: opacity 400ms ease;
}

.weather-fx-root[data-kind="front"] .weather-fx-procedural-fog-layer::before {
  opacity: 0.34;
}

.weather-fx-root.weather-fog-webgl-ready .weather-fx-procedural-fog-layer::before {
  opacity: 0;
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
.weather-fx-procedural-fog-layer,
.weather-fx-procedural-fog,
.weather-fx-motes,
.weather-fx-rain,
.weather-fx-snow,
.weather-fx-wind-gusts,
.weather-fx-rain-splashes,
.weather-fx-rain-ripples,
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
.weather-fx-wind-gust,
.weather-fx-rain-splash,
.weather-fx-rain-ripple {
  position: absolute;
}

.weather-fx-cloud,
.weather-fx-fog-band,
.weather-fx-mist-plume,
.weather-fx-mote,
.weather-fx-wind-gust {
  will-change: auto;
}

.weather-fx-root.weather-visible .weather-fx-cloud,
.weather-fx-root.weather-visible .weather-fx-fog-band,
.weather-fx-root.weather-visible .weather-fx-mist-plume,
.weather-fx-root.weather-visible .weather-fx-mote,
.weather-fx-root.weather-visible .weather-fx-wind-gust,
.weather-fx-root.weather-visible .weather-fx-rain-drop,
.weather-fx-root.weather-visible .weather-fx-snow-flake {
  will-change: transform, opacity;
}

.weather-fx-cloud {
  --cloud-base-y: 0vh;
  --cloud-detail-opacity: 0.2;
  width: var(--cloud-width);
  height: var(--cloud-height);
  top: var(--cloud-top);
  left: var(--cloud-left);
  filter: blur(var(--cloud-blur)) drop-shadow(0 10px 18px rgba(7, 15, 28, 0.14));
  opacity: calc(var(--weather-cloud-opacity) * var(--cloud-opacity-scale));
  transform-origin: 50% 58%;
  animation: weather-cloud-drift var(--cloud-duration) linear infinite;
  animation-delay: var(--cloud-delay);
}

.weather-fx-cloud::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--weather-cloud-edge) 72%, var(--weather-cloud-core)) 0%,
    var(--weather-cloud-core) 58%,
    color-mix(in srgb, var(--weather-cloud-core) 78%, rgba(4, 12, 24, 0.3)) 100%
  );
  -webkit-mask: var(--cloud-image) no-repeat center 58% / cover;
  mask: var(--cloud-image) no-repeat center 58% / cover;
  pointer-events: none;
}

.weather-fx-cloud img {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 58%;
  opacity: var(--cloud-detail-opacity);
  filter: grayscale(1) contrast(0.9) brightness(0.92);
  user-select: none;
  pointer-events: none;
}

.weather-fx-procedural-fog {
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 1;
  filter: blur(0.45px) saturate(0.92);
  pointer-events: none;
}

.weather-fx-root[data-condition="fog"] .weather-fx-fog,
.weather-fx-root[data-condition="fog"] .weather-fx-mist {
  opacity: 0;
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
  transform: rotate(var(--weather-rain-angle, 11deg));
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.24));
  animation: weather-rain-fall var(--drop-duration) linear infinite;
  animation-delay: var(--drop-delay);
  animation-play-state: paused;
}

.weather-fx-rain-ripple-front {
  --ripple-opacity-scale: 0.78;
  border-color: rgba(226, 242, 255, 0.78);
  filter: drop-shadow(0 0 4px rgba(209, 232, 255, 0.58));
}

.weather-fx-rain-drop-front {
  filter: drop-shadow(0 0 5px rgba(209, 229, 255, 0.34));
}

.weather-fx-rain-drop.weather-density-hidden {
  opacity: 0 !important;
  animation-play-state: paused !important;
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
  --splash-color: rgba(205, 231, 255, 0.9);
  --splash-dot-color: rgba(236, 247, 255, 0.98);
  --splash-opacity-scale: 0.94;
  bottom: var(--splash-bottom);
  left: var(--splash-left);
  width: var(--splash-size);
  height: var(--splash-height, var(--splash-size));
  transform-origin: 50% 100%;
  opacity: 0;
  filter: drop-shadow(0 0 3px rgba(194, 225, 255, 0.58));
  animation: weather-splash var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash::before,
.weather-fx-rain-splash::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.weather-fx-rain-splash::before {
  top: auto;
  height: 48%;
  border: 1.8px solid var(--splash-color);
  border-radius: 50%;
  clip-path: inset(0 0 48% 0);
}

.weather-fx-rain-splash::after {
  background:
    radial-gradient(circle at 15% 70%, var(--splash-dot-color) 0 1.1px, transparent 2px),
    radial-gradient(circle at 50% 5%, var(--splash-dot-color) 0 1.3px, transparent 2.2px),
    radial-gradient(circle at 84% 66%, var(--splash-dot-color) 0 1.1px, transparent 2px);
}

.weather-fx-rain-splash-front {
  --splash-color: rgba(226, 242, 255, 0.98);
  --splash-dot-color: rgba(248, 252, 255, 1);
  --splash-opacity-scale: 1;
}

.weather-fx-rain-ripple {
  --ripple-opacity-scale: 0.64;
  bottom: var(--ripple-bottom);
  left: var(--ripple-left);
  width: var(--ripple-size);
  height: calc(var(--ripple-size) * 0.4);
  border: 1.4px solid rgba(205, 231, 255, 0.62);
  border-radius: 50%;
  opacity: 0;
  filter: drop-shadow(0 0 2px rgba(191, 221, 255, 0.42));
  animation: weather-ripple var(--impact-duration, 0.9s) ease-out infinite;
  animation-delay: var(--impact-delay, 0s);
  animation-play-state: paused;
}

.weather-fx-rain-splash.weather-density-hidden,
.weather-fx-rain-ripple.weather-density-hidden {
  display: none;
}

.weather-fx-wind-gusts {
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gusts {
  opacity: 0.65;
}

.weather-fx-root[data-condition="rain"] .weather-fx-wind-gusts {
  opacity: 0.72;
}

.weather-fx-root[data-condition="storm"] .weather-fx-wind-gusts {
  opacity: 1;
}

.weather-fx-wind-gust {
  top: var(--gust-top);
  left: var(--gust-left);
  width: var(--gust-width);
  height: var(--gust-height);
  color: rgba(235, 245, 255, var(--gust-opacity));
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 35%, #000 68%, transparent);
  animation: weather-wind-gust var(--gust-duration) linear infinite;
  animation-delay: var(--gust-delay);
  animation-play-state: paused;
}

.weather-fx-wind-gust svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="rain"] .weather-fx-wind-gust,
.weather-fx-root[data-condition="storm"] .weather-fx-wind-gust {
  animation-play-state: running;
}

.weather-fx-snow-flake {
  top: var(--flake-top);
  left: var(--flake-left);
  width: var(--flake-size);
  height: var(--flake-size);
  border-radius: 50%;
  background-color: var(--weather-snow-color);
  opacity: 0;
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.72);
  animation:
    weather-snow-fall var(--flake-duration) linear infinite,
    weather-snow-shimmer var(--flake-shimmer-duration) ease-in-out infinite;
  animation-delay: var(--flake-delay), var(--flake-delay);
  animation-play-state: paused;
}

.weather-fx-snow-flake-front {
  box-shadow: 0 0 var(--flake-glow) rgba(255, 255, 255, 0.82);
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

.weather-fx-root[data-condition="rain"] .weather-fx-cloud,
.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-base-y: -0.8vh;
  --cloud-detail-opacity: 0.16;
  filter: blur(var(--cloud-blur)) drop-shadow(0 12px 20px rgba(3, 10, 20, 0.24));
}

.weather-fx-root[data-condition="storm"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.1;
  filter: blur(var(--cloud-blur)) brightness(0.9) drop-shadow(0 14px 24px rgba(1, 6, 14, 0.34));
}

.weather-fx-root[data-condition="cloudy"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.18;
  filter: blur(var(--cloud-blur)) drop-shadow(0 10px 18px rgba(7, 15, 28, 0.16));
}

.weather-fx-root[data-condition="snow"] .weather-fx-cloud {
  --cloud-detail-opacity: 0.24;
  filter: blur(var(--cloud-blur)) brightness(1.02) drop-shadow(0 10px 18px rgba(70, 92, 122, 0.14));
}

.weather-fx-root.weather-storm-flash .weather-fx-clouds {
  animation: weather-cloud-lightning 650ms ease-out;
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

.weather-fx-root.weather-reduced-motion .weather-fx-cloud,
.weather-fx-root.weather-reduced-motion .weather-fx-fog-band,
.weather-fx-root.weather-reduced-motion .weather-fx-mist-plume,
.weather-fx-root.weather-reduced-motion .weather-fx-mote,
.weather-fx-root.weather-reduced-motion .weather-fx-rain-drop,
.weather-fx-root.weather-reduced-motion .weather-fx-snow-flake,
.weather-fx-root.weather-reduced-motion .weather-fx-wind-gust,
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

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion .weather-fx-wind-gusts {
  display: none;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  opacity: 0;
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake:nth-child(4n) {
  opacity: var(--weather-particle-opacity-static, 0.08);
}

.weather-fx-root.weather-reduced-motion.weather-rain-active .weather-fx-rain-drop {
  transform: translate3d(0, 48vh, 0) rotate(var(--weather-rain-angle, 11deg));
}

.weather-fx-root.weather-reduced-motion.weather-snow-active .weather-fx-snow-flake {
  transform: translate3d(var(--flake-drift-b), var(--flake-static-y), 0);
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

@keyframes weather-cloud-lightning {
  0%, 100% { filter: brightness(1) saturate(1); }
  12% { filter: brightness(1.72) saturate(0.82); }
  24% { filter: brightness(1.12) saturate(0.94); }
  36% { filter: brightness(1.48) saturate(0.86); }
  58% { filter: brightness(1.06) saturate(0.98); }
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
  0% { transform: translate3d(0, 0, 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
  12% { opacity: calc(var(--weather-rain-opacity) * var(--drop-opacity-scale)); }
  100% { transform: translate3d(var(--drop-drift), 118vh, 0) rotate(var(--weather-rain-angle, 11deg)); opacity: 0; }
}

@keyframes weather-snow-fall {
  0% { transform: translate3d(0, 0, 0); }
  25% { transform: translate3d(var(--flake-drift-a), 29vh, 0); }
  50% { transform: translate3d(var(--flake-drift-b), 58vh, 0); }
  75% { transform: translate3d(var(--flake-drift-c), 87vh, 0); }
  100% { transform: translate3d(var(--flake-drift-end), 116vh, 0); }
}

@keyframes weather-snow-shimmer {
  0%, 100% { filter: brightness(0.78); }
  50% { filter: brightness(1.22); }
}

@keyframes weather-splash {
  0% { transform: translate3d(0, 2px, 0) scale(0.2) rotate(0deg); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--splash-opacity-scale)); }
  42% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1) rotate(var(--splash-tilt, 0deg)); }
  62% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
  100% { transform: translate3d(0, var(--splash-lift, -7px), 0) scale(1.35) rotate(var(--splash-tilt, 0deg)); opacity: 0; }
}

@keyframes weather-ripple {
  0% { transform: scale(0.15); opacity: 0; }
  18% { opacity: calc(var(--weather-rain-opacity) * var(--ripple-opacity-scale)); }
  100% { transform: scale(3); opacity: 0; }
}

@keyframes weather-wind-gust {
  0% { transform: translate3d(-18vw, 0, 0); opacity: 0; }
  8% { opacity: 1; }
  35% { transform: translate3d(46vw, -5px, 0); }
  70% { transform: translate3d(108vw, 4px, 0); opacity: 1; }
  100% { transform: translate3d(168vw, 0, 0); opacity: 0; }
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
  .weather-settings-card-header {
    align-items: start;
  }

  .weather-settings-status {
    max-width: 52%;
  }

  .weather-settings-control-deck {
    grid-template-columns: 1fr;
  }

  .weather-settings-control-deck .weather-settings-section:nth-child(3) {
    grid-column: auto;
  }

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

@media (prefers-reduced-motion: reduce) {
  .weather-hud-summary {
    display: block;
    width: auto;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: none;
  }

  .weather-hud-summary::after {
    content: none;
  }
}
`;
