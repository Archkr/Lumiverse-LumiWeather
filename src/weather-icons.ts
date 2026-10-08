import type { SolarPhase } from "./time-utils";
import type { WeatherCondition } from "./types";

export function conditionIcon(condition: WeatherCondition, phase: SolarPhase = "day"): string {
  switch (condition) {
    case "cloudy":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 18.2h10.7a3.8 3.8 0 00.6-7.55 5.5 5.5 0 00-10.45-1.2 4.4 4.4 0 00-.85 8.75Z"/></svg>`;
    case "rain":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 14.8h10.8a3.7 3.7 0 00.55-7.35A5.45 5.45 0 007.6 6.3a4.3 4.3 0 00-1 8.5Z"/><path d="m8.2 17.4-1 2.3M12.3 17.4l-1 2.3M16.4 17.4l-1 2.3"/></svg>`;
    case "storm":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14.5h10.9a3.7 3.7 0 00.55-7.35A5.45 5.45 0 007.6 6a4.3 4.3 0 00-1.1 8.5Z"/><path class="weather-hud-icon-solid" d="m13.1 12.8-3.25 5h2.45l-.75 3.7 4.6-5.65h-2.7l1.45-3.05Z"/></svg>`;
    case "snow":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8v18.4M4.05 7.4l15.9 9.2M4.05 16.6l15.9-9.2M12 2.8 9.8 5M12 2.8 14.2 5M12 21.2 9.8 19M12 21.2l2.2-2.2M4.05 7.4l3-.8M4.05 7.4l.8 3M19.95 16.6l-3 .8M19.95 16.6l-.8-3"/></svg>`;
    case "fog":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 13.5h11a3.45 3.45 0 00.5-6.85A5.1 5.1 0 008.2 5.6a4 4 0 00-1.8 7.9Z"/><path d="M4 17.1h13M7 20.2h13"/></svg>`;
    case "clear":
    default:
      if (phase === "night") {
        return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.7 8.7 0 019.8 3.5a8.7 8.7 0 1010.7 10.7Z"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.25"/><path d="M12 2.5v2.1M12 19.4v2.1M2.5 12h2.1M19.4 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"/></svg>`;
  }
}

export function conditionIconLabel(condition: WeatherCondition, phase: SolarPhase): string {
  if (condition === "clear" && phase === "night") return "Clear night";
  return `${condition.charAt(0).toUpperCase()}${condition.slice(1)} weather`;
}
