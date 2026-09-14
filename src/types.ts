export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";
export type WeatherLayerMode = "back" | "front" | "both";
export type WeatherPalette = "dawn" | "day" | "dusk" | "night" | "storm" | "mist" | "snow";
export type WeatherWindDirection = "none" | "north" | "northeast" | "east" | "southeast" | "south" | "southwest" | "west" | "northwest";
export type ReducedMotionMode = "system" | "always" | "never";
export type TemperatureUnit = "fahrenheit" | "celsius";
export type WeatherSourceMode = "story" | "manual";
export type WeatherSeason = "spring" | "summer" | "autumn" | "winter";
export type WeatherClockMode = "auto" | "live" | "story";

/** Which scene layer a resolved token set is being computed for. */
export type WeatherLayerKind = "back" | "front";

/**
 * Every value a scene layer paints with, after intensity and layer adjustments.
 * Field names describe the destination CSS custom property; the property mapping
 * itself lives in `frontend.ts`.
 */
export interface SceneTokens {
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  glow: string;
  beamColor: string;
  horizonColor: string;
  cloudCore: string;
  cloudEdge: string;
  fogColor: string;
  mistColor: string;
  skyOpacity: number;
  glowOpacity: number;
  beamOpacity: number;
  cloudOpacity: number;
  horizonOpacity: number;
  mistOpacity: number;
  fogOpacity: number;
  rainOpacity: number;
  snowOpacity: number;
  moteOpacity: number;
  flashOpacity: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

/** One projected day. `date` is always a real `YYYY-MM-DD` calendar value. */
export interface ForecastEntry {
  date: string;
  condition: WeatherCondition;
  summary: string;
  temperature: string;
}

export interface WeatherState {
  location: string;
  date: string;
  time: string;
  condition: WeatherCondition;
  summary: string;
  temperature: string;
  intensity: number;
  wind: string;
  windDirection: WeatherWindDirection;
  palette: WeatherPalette;
  season: WeatherSeason;
  forecast: ForecastEntry[];
  updatedAt: number;
  source: WeatherSourceMode;
}

export interface WeatherPrefs {
  effectsEnabled: boolean;
  lightningFlashEnabled: boolean;
  layerMode: WeatherLayerMode;
  intensity: number;
  reducedMotion: ReducedMotionMode;
  temperatureUnit: TemperatureUnit;
  pauseEffects: boolean;
  widgetPosition: WidgetPosition | null;
  clockMode: WeatherClockMode;
  showForecast: boolean;
  transitionsEnabled: boolean;
}

export type FrontendToBackend =
  | { type: "frontend_ready" }
  | { type: "chat_changed"; chatId: string | null; requestId?: number }
  | {
      type: "weather_tag_intercepted";
      chatId: string | null;
      messageId?: string | null;
      attrs: Record<string, string>;
      isStreaming?: boolean;
    }
  | { type: "set_manual_state"; chatId?: string | null; state: Partial<WeatherState> }
  | { type: "clear_manual_override"; chatId?: string | null }
  | { type: "save_prefs"; prefs: Partial<WeatherPrefs> }
  | { type: "reset_widget_position" };

export type BackendToFrontend =
  | { type: "prefs"; prefs: WeatherPrefs }
  | { type: "active_chat_state"; chatId: string | null; state: WeatherState | null; requestId?: number }
  | { type: "weather_state"; chatId: string | null; state: WeatherState }
  | { type: "error"; message: string };
