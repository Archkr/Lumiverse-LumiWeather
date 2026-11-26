export const WEATHER_HUD_CSS = `
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
.weather-settings-preset:disabled,
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

/* The outlook editor spans both columns and sits outside the grid, so it always
   gets the full panel width regardless of the grid's column count. */
.weather-settings-manual-field-wide {
  grid-column: 1 / -1;
}

.weather-settings-textarea {
  min-height: 68px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.45;
  white-space: pre;
  overflow-x: auto;
}

.weather-settings-forecast-field {
  display: grid;
  gap: 6px;
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
  width: 280px;
  height: 280px;
  right: -136px;
  top: 78px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 24%, transparent), transparent 72%);
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
  inset: -36px auto auto -30px;
  width: 192px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(132, 191, 255, 0.2), transparent 72%);
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
  width: 164px;
  height: 164px;
  right: -48px;
  bottom: -94px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lumi-scene-glow, rgba(121, 185, 255, 0.34)), transparent 72%);
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

.weather-settings-scene-hero[data-phenomenon="aurora"] {
  --lumi-scene-glow: rgba(94, 242, 198, 0.42);
  border-color: color-mix(in srgb, rgba(114, 245, 206, 0.55) 60%, var(--lumi-glass-line));
}

.weather-settings-scene-hero[data-phenomenon="blossoms"] {
  --lumi-scene-glow: rgba(255, 178, 214, 0.42);
  border-color: color-mix(in srgb, rgba(255, 184, 218, 0.55) 60%, var(--lumi-glass-line));
}

.weather-settings-scene-hero[data-phenomenon="embers"] {
  --lumi-scene-glow: rgba(255, 132, 64, 0.44);
  border-color: color-mix(in srgb, rgba(255, 148, 82, 0.58) 60%, var(--lumi-glass-line));
}

.weather-settings-scene-hero[data-phenomenon="ashfall"] {
  --lumi-scene-glow: rgba(196, 202, 214, 0.34);
  border-color: color-mix(in srgb, rgba(208, 214, 226, 0.48) 60%, var(--lumi-glass-line));
}

.weather-settings-scene-hero[data-phenomenon="fireflies"] {
  --lumi-scene-glow: rgba(206, 248, 112, 0.4);
  border-color: color-mix(in srgb, rgba(212, 252, 124, 0.52) 60%, var(--lumi-glass-line));
}

.weather-settings-scene-hero[data-phenomenon="sandstorm"] {
  --lumi-scene-glow: rgba(238, 188, 118, 0.44);
  border-color: color-mix(in srgb, rgba(238, 192, 126, 0.56) 60%, var(--lumi-glass-line));
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

.weather-settings-control-deck .weather-settings-section:nth-child(odd):last-child {
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
    var(--weather-hud-phenomenon-overlay, linear-gradient(transparent, transparent)),
    radial-gradient(circle at 84% 16%, var(--weather-hud-aura-primary), transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, var(--weather-hud-shell-top) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border: 1px solid var(--weather-hud-line);
  box-shadow:
    0 22px 46px var(--weather-hud-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.weather-hud-widget[data-presentation="mobile-launcher"] {
  width: 40px;
  height: 40px;
  display: block;
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
}

.weather-hud-widget[data-presentation="mobile-launcher"] > .weather-hud-header,
.weather-hud-widget[data-presentation="mobile-launcher"] > .weather-hud-body {
  display: none;
}

.weather-hud-launcher {
  appearance: none;
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--weather-hud-icon-color);
  cursor: grab;
  touch-action: none;
}

.weather-hud-launcher:active {
  cursor: grabbing;
}

.weather-hud-launcher:focus-visible {
  outline: 2px solid var(--lumiverse-primary, var(--weather-hud-accent));
  outline-offset: -3px;
}

.weather-hud-launcher-icon,
.weather-hud-launcher-icon svg {
  width: 24px;
  height: 24px;
  display: block;
}

.weather-hud-launcher-icon svg {
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 3px rgba(1, 8, 18, 0.48));
}

.weather-hud-launcher-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-widget[data-presentation="mobile-panel"] {
  width: 100%;
  height: 100%;
  min-height: 0;
  align-content: start;
  gap: 14px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-right: max(14px, env(safe-area-inset-right));
  padding-bottom: calc(16px + max(env(safe-area-inset-bottom), var(--weather-keyboard-inset-bottom, 0px)));
  padding-left: max(14px, env(safe-area-inset-left));
  border-radius: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  user-select: auto;
}

.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-header,
.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-body,
.weather-hud-widget[data-presentation="mobile-panel"] > .weather-hud-drawer {
  width: min(100%, 560px);
  margin-inline: auto;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-control,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-chip,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-preset,
.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-select {
  min-height: 44px;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-gear {
  width: 44px;
  height: 44px;
}

.weather-hud-widget[data-presentation="mobile-panel"] .weather-hud-range {
  min-height: 44px;
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
  inset: auto -18% -44% 18%;
  height: 78%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--weather-hud-aura-secondary) 78%, transparent) 0%,
    color-mix(in srgb, var(--weather-hud-aura-secondary) 32%, transparent) 38%,
    transparent 74%
  );
  /* Sun altitude (-90 midnight to +90 noon) softens the aura toward night. */
  opacity: calc((0.35 + 0.55 * (var(--weather-sun-altitude, 0) + 90) / 180) * var(--weather-hud-scene-intensity));
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
    var(--weather-hud-phenomenon-overlay, linear-gradient(transparent, transparent)),
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--weather-hud-aura-primary) 90%, rgba(198, 226, 255, 0.26)) 0%, transparent 30%),
    radial-gradient(circle at 18% 112%, var(--weather-hud-aura-secondary), transparent 44%),
    linear-gradient(162deg, color-mix(in srgb, var(--weather-hud-shell-top) 90%, rgba(24, 49, 87, 0.7)) 0%, var(--weather-hud-shell-mid) 48%, var(--weather-hud-shell-bottom) 100%);
  border-color: color-mix(in srgb, var(--weather-hud-accent) 34%, rgba(255, 255, 255, 0.16));
}

/* Phenomenon-specific UI themes and ambient overlays on the HUD card. */
.weather-hud-widget[data-phenomenon="aurora"] {
  --weather-hud-shell-top: color-mix(in srgb, #122d38 62%, #142238);
  --weather-hud-shell-mid: color-mix(in srgb, #1b434b 58%, #28244d);
  --weather-hud-shell-bottom: #0d1a2c;
  --weather-hud-aura-primary: rgba(96, 247, 198, 0.34);
  --weather-hud-aura-secondary: rgba(176, 124, 255, 0.3);
  --weather-hud-aura-soft: rgba(142, 255, 222, 0.13);
  --weather-hud-accent: #7df5d0;
  --weather-hud-icon-bg: rgba(125, 245, 208, 0.16);
  --weather-hud-icon-color: #c8ffee;
  --weather-hud-line: rgba(132, 245, 212, 0.24);
  --weather-hud-phenomenon-overlay:
    linear-gradient(122deg, transparent 12%, rgba(92, 245, 196, 0.16) 36%, rgba(168, 122, 255, 0.15) 64%, transparent 88%),
    radial-gradient(ellipse at 26% 0%, rgba(102, 250, 205, 0.22), transparent 52%);
}

.weather-hud-widget[data-phenomenon="blossoms"] {
  --weather-hud-shell-top: #34243c;
  --weather-hud-shell-mid: #4b314c;
  --weather-hud-shell-bottom: #1f192c;
  --weather-hud-aura-primary: rgba(255, 178, 214, 0.36);
  --weather-hud-aura-secondary: rgba(255, 212, 232, 0.24);
  --weather-hud-aura-soft: rgba(255, 224, 238, 0.14);
  --weather-hud-accent: #ffb5d6;
  --weather-hud-icon-bg: rgba(255, 192, 220, 0.17);
  --weather-hud-icon-color: #ffe3f0;
  --weather-hud-line: rgba(255, 196, 224, 0.24);
  --weather-hud-phenomenon-overlay:
    radial-gradient(ellipse 6px 4px at 18% 24%, rgba(255, 210, 230, 0.42) 0 60%, transparent 100%),
    radial-gradient(ellipse 7px 4px at 74% 18%, rgba(255, 184, 216, 0.38) 0 60%, transparent 100%),
    radial-gradient(ellipse 5px 3px at 62% 76%, rgba(255, 218, 235, 0.34) 0 60%, transparent 100%),
    radial-gradient(ellipse 6px 3.5px at 88% 64%, rgba(255, 176, 212, 0.32) 0 60%, transparent 100%),
    radial-gradient(circle at 82% 14%, rgba(255, 182, 216, 0.24), transparent 44%);
}

.weather-hud-widget[data-phenomenon="embers"] {
  --weather-hud-shell-top: #341d1c;
  --weather-hud-shell-mid: #4b261f;
  --weather-hud-shell-bottom: #1e1112;
  --weather-hud-aura-primary: rgba(255, 134, 62, 0.38);
  --weather-hud-aura-secondary: rgba(255, 82, 36, 0.28);
  --weather-hud-aura-soft: rgba(255, 196, 132, 0.13);
  --weather-hud-accent: #ff9d66;
  --weather-hud-icon-bg: rgba(255, 146, 78, 0.17);
  --weather-hud-icon-color: #ffd9b8;
  --weather-hud-line: rgba(255, 152, 92, 0.24);
  --weather-hud-phenomenon-overlay:
    radial-gradient(circle 2.2px at 22% 78%, rgba(255, 214, 142, 0.62) 0 55%, transparent 100%),
    radial-gradient(circle 1.8px at 68% 84%, rgba(255, 148, 72, 0.56) 0 55%, transparent 100%),
    radial-gradient(circle 2px at 84% 58%, rgba(255, 196, 118, 0.48) 0 55%, transparent 100%),
    radial-gradient(ellipse at 50% 108%, rgba(255, 106, 38, 0.32), transparent 56%);
}

.weather-hud-widget[data-phenomenon="ashfall"] {
  --weather-hud-shell-top: #262930;
  --weather-hud-shell-mid: #343842;
  --weather-hud-shell-bottom: #181a20;
  --weather-hud-aura-primary: rgba(204, 210, 222, 0.22);
  --weather-hud-aura-secondary: rgba(144, 152, 168, 0.2);
  --weather-hud-aura-soft: rgba(228, 232, 240, 0.09);
  --weather-hud-accent: #cbd2e0;
  --weather-hud-icon-bg: rgba(210, 216, 226, 0.13);
  --weather-hud-icon-color: #eef1f6;
  --weather-hud-line: rgba(206, 212, 224, 0.2);
  --weather-hud-phenomenon-overlay:
    radial-gradient(circle 1.8px at 28% 30%, rgba(226, 230, 238, 0.36) 0 60%, transparent 100%),
    radial-gradient(circle 1.5px at 72% 42%, rgba(204, 210, 220, 0.32) 0 60%, transparent 100%),
    radial-gradient(circle 1.8px at 54% 78%, rgba(218, 222, 232, 0.28) 0 60%, transparent 100%),
    linear-gradient(180deg, rgba(210, 215, 224, 0.1), transparent 46%);
}

.weather-hud-widget[data-phenomenon="fireflies"] {
  --weather-hud-shell-top: #172a28;
  --weather-hud-shell-mid: #203b32;
  --weather-hud-shell-bottom: #0f1c1b;
  --weather-hud-aura-primary: rgba(208, 250, 110, 0.32);
  --weather-hud-aura-secondary: rgba(108, 222, 148, 0.24);
  --weather-hud-aura-soft: rgba(232, 255, 164, 0.12);
  --weather-hud-accent: #d4fb7c;
  --weather-hud-icon-bg: rgba(210, 250, 118, 0.16);
  --weather-hud-icon-color: #efffbf;
  --weather-hud-line: rgba(208, 248, 122, 0.23);
  --weather-hud-phenomenon-overlay:
    radial-gradient(circle 9px at 20% 32%, rgba(226, 255, 138, 0.34), transparent 70%),
    radial-gradient(circle 11px at 76% 68%, rgba(196, 252, 112, 0.32), transparent 72%),
    radial-gradient(circle 8px at 62% 22%, rgba(234, 255, 156, 0.28), transparent 70%);
}

.weather-hud-widget[data-phenomenon="sandstorm"] {
  --weather-hud-shell-top: #3b2c1d;
  --weather-hud-shell-mid: #563e27;
  --weather-hud-shell-bottom: #261b12;
  --weather-hud-aura-primary: rgba(242, 192, 120, 0.36);
  --weather-hud-aura-secondary: rgba(206, 144, 78, 0.28);
  --weather-hud-aura-soft: rgba(252, 218, 164, 0.13);
  --weather-hud-accent: #f3c482;
  --weather-hud-icon-bg: rgba(242, 196, 128, 0.17);
  --weather-hud-icon-color: #ffebc8;
  --weather-hud-line: rgba(240, 194, 128, 0.24);
  --weather-hud-phenomenon-overlay:
    repeating-linear-gradient(-14deg, transparent 0 14px, rgba(242, 196, 128, 0.055) 14px 18px, transparent 18px 34px),
    linear-gradient(108deg, rgba(238, 184, 110, 0.2), transparent 52%, rgba(214, 154, 84, 0.16) 100%);
}

.weather-hud-header,
.weather-hud-body,
.weather-hud-botw-forecast,
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

.weather-hud-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.weather-hud-eyebrow {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
}

.weather-hud-source,
.weather-hud-phenomenon-badge {
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

.weather-hud-phenomenon-badge[hidden] {
  display: none;
}

.weather-hud-phenomenon-badge {
  gap: 5px;
  border-color: color-mix(in srgb, var(--weather-hud-accent) 44%, var(--weather-hud-line));
  background: color-mix(in srgb, var(--weather-hud-accent) 18%, var(--weather-hud-surface));
  color: var(--weather-hud-icon-color);
}

.weather-hud-phenomenon-badge::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--weather-hud-accent);
  box-shadow: 0 0 8px var(--weather-hud-accent);
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
  grid-template-columns: minmax(0, 1fr) 112px;
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
  width: 100%;
  min-width: 0;
  align-content: start;
  justify-items: end;
  gap: 6px;
  text-align: right;
  transform: translateY(-9px);
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
  width: 100%;
  max-width: 100%;
  min-height: 15px;
  overflow: hidden;
}

.weather-hud-summary-viewport[data-overflow="true"] {
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}

.weather-hud-summary {
  --weather-hud-summary-gap: 28px;
  display: block;
  width: auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.35;
  color: var(--weather-hud-text-soft);
  white-space: nowrap;
}

.weather-hud-summary-text {
  display: inline;
}

.weather-hud-summary::after {
  content: none;
}

.weather-hud-widget:not([data-paused="true"]):not([data-effects="false"]):not([data-reduced-motion="true"])
  .weather-hud-summary-viewport[data-overflow="true"]
  .weather-hud-summary {
  display: flex;
  width: max-content;
  min-width: max-content;
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  align-items: center;
  gap: var(--weather-hud-summary-gap);
  animation: weather-hud-summary-ticker var(--weather-hud-summary-duration, 12s) linear infinite;
}

.weather-hud-widget:not([data-paused="true"]):not([data-effects="false"]):not([data-reduced-motion="true"])
  .weather-hud-summary-viewport[data-overflow="true"]
  .weather-hud-summary-text {
  flex: 0 0 auto;
}

.weather-hud-widget:not([data-paused="true"]):not([data-effects="false"]):not([data-reduced-motion="true"])
  .weather-hud-summary-viewport[data-overflow="true"]
  .weather-hud-summary::after {
  content: attr(data-ticker-text);
  flex: 0 0 auto;
}

.weather-hud-summary-viewport:hover .weather-hud-summary {
  animation-play-state: paused;
}

.weather-hud-widget[data-presentation="desktop"] {
  padding: 12px 13px 11px;
  gap: 9px;
  grid-template-rows: minmax(0, 1fr) auto;
  align-content: stretch;
}

.weather-hud-widget[data-presentation="desktop"][data-has-forecast-bar="false"] {
  grid-template-rows: 1fr;
  align-content: center;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-body {
  grid-template-columns: minmax(0, 1fr) 104px;
  align-items: center;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-primary {
  gap: 3px;
  transform: none;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-weather {
  gap: 4px;
  transform: none;
  align-content: center;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-icon svg {
  width: 22px;
  height: 22px;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-time {
  font-size: 29px;
  line-height: 0.96;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-temp {
  font-size: 25px;
  line-height: 0.96;
}

.weather-hud-widget[data-presentation="desktop"] .weather-hud-wind {
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weather-hud-location-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.weather-hud-location-row .weather-hud-location {
  flex: 1 1 auto;
  min-width: 0;
  max-width: none;
}

.weather-hud-location-row .weather-hud-phenomenon-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 8px;
  letter-spacing: 0.1em;
}

/* Breath of the Wild-inspired horizontal weather forecast strip (desktop HUD). */
.weather-hud-botw-forecast {
  min-width: 0;
}

.weather-hud-botw-forecast[hidden] {
  display: none;
}

.weather-hud-botw-track {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 54px;
  padding: 5px 6px 4px;
  box-sizing: border-box;
  border-radius: 13px;
  border: 1px solid color-mix(in srgb, var(--weather-hud-line) 76%, transparent);
  background:
    linear-gradient(180deg, rgba(5, 12, 24, 0.34) 0%, rgba(4, 9, 19, 0.22) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
}

.weather-hud-botw-slot {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  padding: 2px 2px;
  border-radius: 9px;
  border: 1px solid transparent;
  transition: background 140ms ease, opacity 140ms ease, border-color 140ms ease;
}

.weather-hud-botw-slot[data-step="1"] {
  opacity: 0.94;
}

.weather-hud-botw-slot[data-step="2"] {
  opacity: 0.84;
}

.weather-hud-botw-slot[data-step="3"] {
  opacity: 0.74;
}

.weather-hud-botw-slot[data-step="4"] {
  opacity: 0.64;
}

.weather-hud-botw-slot:not(.weather-hud-botw-slot-now):hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.07);
  border-color: color-mix(in srgb, var(--weather-hud-line) 65%, transparent);
}

.weather-hud-botw-slot-now {
  flex: 0 0 54px;
  border-color: color-mix(in srgb, var(--weather-hud-accent) 52%, rgba(255, 255, 255, 0.2));
  background:
    radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--weather-hud-accent) 26%, transparent), transparent 72%),
    rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--weather-hud-accent) 20%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.weather-hud-botw-marker {
  position: absolute;
  top: -3px;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 1px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--weather-hud-accent);
  box-shadow: 0 0 6px var(--weather-hud-accent);
  pointer-events: none;
}

.weather-hud-botw-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--weather-hud-icon-color);
}

.weather-hud-botw-icon svg {
  width: 17px;
  height: 17px;
  display: block;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 2px rgba(2, 8, 18, 0.55));
}

.weather-hud-botw-slot-now .weather-hud-botw-icon svg {
  width: 19px;
  height: 19px;
}

.weather-hud-botw-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-botw-slot[data-condition="clear"] .weather-hud-botw-icon {
  color: #ffe99c;
}

.weather-hud-botw-slot[data-condition="cloudy"] .weather-hud-botw-icon {
  color: #e4eeff;
}

.weather-hud-botw-slot[data-condition="rain"] .weather-hud-botw-icon {
  color: #a6ceff;
}

.weather-hud-botw-slot[data-condition="storm"] .weather-hud-botw-icon {
  color: #c8c4ff;
}

.weather-hud-botw-slot[data-condition="snow"] .weather-hud-botw-icon {
  color: #ffffff;
}

.weather-hud-botw-slot[data-condition="fog"] .weather-hud-botw-icon {
  color: #cfdbe8;
}

.weather-hud-botw-meta {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 2.5px;
  max-width: 100%;
  line-height: 1;
}

.weather-hud-botw-label {
  font-size: 8.5px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--weather-hud-text-soft);
  line-height: 1;
}

.weather-hud-botw-slot-now .weather-hud-botw-label {
  color: var(--weather-hud-accent);
  letter-spacing: 0.1em;
}

.weather-hud-botw-temp {
  font-size: 8.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(245, 248, 255, 0.88);
  line-height: 1;
}

.weather-hud-botw-chevron {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: color-mix(in srgb, var(--weather-hud-accent) 44%, rgba(255, 255, 255, 0.32));
  user-select: none;
  pointer-events: none;
}

.weather-hud-botw-empty {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
}

.weather-hud-botw-empty-rail {
  flex: 1 1 auto;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, var(--weather-hud-accent) 32%, rgba(255, 255, 255, 0.18)) 0 4px,
    transparent 4px 8px
  );
  opacity: 0.7;
}

.weather-hud-botw-empty-text {
  flex: 0 0 auto;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--weather-hud-text-muted);
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

.weather-hud-drawer-section[hidden] {
  display: none;
}

.weather-hud-forecast {
  display: grid;
  gap: 4px;
}

/* A missing interceptor permission is surfaced on the HUD badge, not only in settings. */
.weather-hud-widget[data-permission="limited"] .weather-hud-source,
.weather-hud-widget[data-error="true"] .weather-hud-source {
  border-color: color-mix(in srgb, #ffb45e 55%, transparent);
  color: rgba(255, 214, 160, 0.96);
  background: color-mix(in srgb, #ffb45e 14%, var(--weather-hud-surface));
}

.weather-hud-forecast-row {
  display: grid;
  grid-template-columns: 34px 16px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--weather-hud-line) 26%, transparent);
  font-size: 11px;
  color: var(--weather-hud-text-soft);
}

.weather-hud-forecast-day {
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(245, 248, 255, 0.78);
}

.weather-hud-forecast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--weather-hud-accent);
}

.weather-hud-forecast-icon svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.weather-hud-forecast-icon .weather-hud-icon-solid {
  fill: currentColor;
  stroke: none;
}

.weather-hud-forecast-copy {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: capitalize;
}

.weather-hud-control-grid {
  display: grid;
  gap: 10px;
}

.weather-hud-volume-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 10px;
}

.weather-hud-field-wide {
  grid-column: 1 / -1;
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

/* Keep every control reachable inside the compact desktop frame. */
.weather-hud-widget[data-presentation="desktop"][data-expanded="true"] {
  grid-template-rows: auto auto minmax(0, 1fr);
}

.weather-hud-widget[data-presentation="desktop"][data-expanded="true"] .weather-hud-drawer {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--weather-hud-line) transparent;
  padding-right: 4px;
  scroll-padding-block: 10px;
}

.weather-hud-forecast-summary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  line-height: 1.5;
  color: var(--weather-hud-text-muted);
  text-transform: none;
}

.weather-hud-widget[data-paused="true"]::after {
  opacity: calc(0.55 * var(--weather-hud-scene-intensity));
}

.weather-hud-widget[data-paused="true"] .weather-hud-summary {
  animation: none;
}

@keyframes weather-hud-summary-ticker {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(calc(-50% - 14px), 0, 0);
  }
}

.weather-fx-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  isolation: isolate;
  contain: strict;
  transition: opacity 320ms ease;
}

.weather-fx-root.weather-visible {
  opacity: 1;
}

.weather-fx-root[data-kind="back"] {
  z-index: 1;
}

.weather-fx-root[data-kind="front"] {
  z-index: 24;
}

.weather-fx-root.weather-hidden {
  display: none;
}

.weather-fx-shader-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  z-index: 1;
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

/* Side-panel drawer layout & sidecar model selector */
.weather-settings-drawer-host {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 10px 28px;
  box-sizing: border-box;
}

.weather-settings-card.weather-settings-card--drawer {
  overflow: visible;
  overflow-x: clip;
  border-radius: calc(var(--lumiverse-radius, 12px) + 2px);
}

.weather-settings-card--drawer .weather-settings-card-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 14px 12px;
}

.weather-settings-card--drawer .weather-settings-status {
  max-width: 100%;
}

.weather-settings-card--drawer .weather-settings-card-body {
  padding: 12px;
  gap: 12px;
}

.weather-settings-card--drawer .weather-settings-control-deck {
  grid-template-columns: 1fr;
}

.weather-settings-card--drawer .weather-settings-control-deck .weather-settings-section:nth-child(odd):last-child {
  grid-column: auto;
}

.weather-settings-card--drawer .weather-settings-manual-grid {
  grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
}

.weather-settings-card--drawer .weather-settings-preset-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weather-settings-model-field {
  display: grid;
  gap: 6px;
}

.weather-settings-model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.weather-settings-model-slot {
  width: 100%;
  min-width: 0;
}

.weather-settings-link-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--lumiverse-primary, #82a8ff) 88%, white 12%);
  cursor: pointer;
}

.weather-settings-link-btn:hover {
  text-decoration: underline;
}
`;
