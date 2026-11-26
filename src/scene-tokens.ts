import { clamp } from "./shared";
import { resolveLunarPhase } from "./time-utils";
import type { SceneTokens, WeatherPalette, WeatherState } from "./types";

export function resolveSceneTokens(state: WeatherState, intensity: number): SceneTokens {
  // Guards against a non-finite intensity reaching the token math through a
  // stored state or a malformed preference, which would otherwise propagate NaN
  // into every opacity and blank the scene.
  const baseIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1.5);
  const paletteMap: Record<
    WeatherPalette,
    {
      start: string;
      mid: string;
      end: string;
      glow: string;
      beam: string;
      horizon: string;
    }
  > = {
    dawn: {
      start: "#20385f",
      mid: "#5a77a9",
      end: "#f0a56e",
      glow: "rgba(255, 203, 145, 0.82)",
      beam: "rgba(255, 218, 165, 0.48)",
      horizon: "rgba(255, 182, 125, 0.44)",
    },
    day: {
      start: "#4d77ad",
      mid: "#7fa8de",
      end: "#d8ebff",
      glow: "rgba(255, 243, 202, 0.78)",
      beam: "rgba(255, 244, 212, 0.44)",
      horizon: "rgba(185, 212, 244, 0.28)",
    },
    dusk: {
      start: "#221f4c",
      mid: "#68487a",
      end: "#f09067",
      glow: "rgba(255, 173, 128, 0.72)",
      beam: "rgba(255, 189, 150, 0.38)",
      horizon: "rgba(224, 149, 114, 0.34)",
    },
    night: {
      start: "#040c18",
      mid: "#0a182b",
      end: "#152b44",
      glow: "rgba(128, 166, 240, 0.42)",
      beam: "rgba(116, 150, 222, 0.18)",
      horizon: "rgba(48, 74, 118, 0.22)",
    },
    storm: {
      start: "#030912",
      mid: "#0a1624",
      end: "#162638",
      glow: "rgba(156, 192, 232, 0.22)",
      beam: "rgba(136, 174, 212, 0.12)",
      horizon: "rgba(56, 80, 108, 0.2)",
    },
    mist: {
      start: "#213141",
      mid: "#586c7d",
      end: "#a7bac2",
      glow: "rgba(226, 240, 255, 0.32)",
      beam: "rgba(228, 239, 248, 0.18)",
      horizon: "rgba(206, 220, 228, 0.36)",
    },
    snow: {
      start: "#415b76",
      mid: "#7d93a8",
      end: "#e0e9f1",
      glow: "rgba(255, 252, 244, 0.66)",
      beam: "rgba(242, 245, 255, 0.32)",
      horizon: "rgba(229, 238, 248, 0.4)",
    },
  };

  const basePalette = paletteMap[state.palette];
  const palette =
    state.condition === "storm"
      ? paletteMap.storm
      : state.condition === "rain"
        ? {
            start: state.palette === "night" ? "#050d17" : "#0c1928",
            mid: state.palette === "night" ? "#101f32" : "#21364e",
            end: state.palette === "night" ? "#1e3046" : "#3f556c",
            glow: state.palette === "night" ? "rgba(128, 162, 208, 0.16)" : "rgba(162, 194, 228, 0.2)",
            beam: "rgba(125, 155, 188, 0.1)",
            horizon: state.palette === "night" ? "rgba(54, 76, 104, 0.18)" : "rgba(96, 122, 150, 0.2)",
          }
        : state.condition === "cloudy" && (state.palette === "dawn" || state.palette === "dusk")
          ? {
              ...basePalette,
              end: state.palette === "dawn" ? "#9baec3" : "#7f90a6",
              glow: "rgba(214, 224, 238, 0.24)",
              beam: "rgba(176, 191, 209, 0.12)",
              horizon: "rgba(154, 169, 187, 0.24)",
            }
          : basePalette;
  let cloudCore = "rgba(237, 244, 255, 0.34)";
  let cloudEdge = "rgba(255, 255, 255, 0.12)";
  let fogColor = "rgba(236, 241, 255, 0.18)";
  let mistColor = "rgba(228, 238, 248, 0.24)";

  const values = {
    skyOpacity: 0.08,
    glowOpacity: 0.13,
    beamOpacity: 0.14,
    cloudOpacity: 0.1,
    horizonOpacity: 0.06,
    mistOpacity: 0.03,
    fogOpacity: 0,
    rainOpacity: 0,
    snowOpacity: 0,
    moteOpacity: 0.06,
    starOpacity: 0,
    moonlightOpacity: 0,
    flashOpacity: 0.26,
    auroraOpacity: 0,
    windowDropletOpacity: 0,
    phenomenonOpacity: 0,
  };

  const lunar = resolveLunarPhase(state.date, state.time);
  const exposure = state.exposure ?? "outdoor";
  const phenomenon = state.phenomenon ?? "none";

  switch (state.condition) {
    case "cloudy":
      values.skyOpacity = 0.14;
      values.glowOpacity = 0.09;
      values.beamOpacity = 0.04;
      values.cloudOpacity = 0.5;
      values.horizonOpacity = 0.1;
      values.mistOpacity = 0.06;
      values.moteOpacity = 0.02;
      if (state.palette === "night") {
        // Cloud cover hides the stars but leaves a trace of diffused moonlight.
        values.moonlightOpacity = 0.09;
      }
      cloudCore = state.palette === "night" ? "rgba(88, 104, 128, 0.42)" : "rgba(205, 216, 231, 0.34)";
      cloudEdge = state.palette === "night" ? "rgba(148, 168, 196, 0.14)" : "rgba(238, 244, 255, 0.12)";
      fogColor = state.palette === "night" ? "rgba(44, 58, 78, 0.22)" : "rgba(210, 223, 239, 0.18)";
      mistColor = state.palette === "night" ? "rgba(54, 70, 92, 0.22)" : "rgba(217, 227, 239, 0.2)";
      break;
    case "rain":
      values.skyOpacity = 0.2;
      values.glowOpacity = 0.06;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.7;
      values.horizonOpacity = 0.14;
      values.mistOpacity = 0.18;
      values.fogOpacity = 0.1;
      values.rainOpacity = 0.82;
      values.moteOpacity = 0;
      cloudCore = state.palette === "night" ? "rgba(52, 68, 88, 0.56)" : "rgba(87, 106, 128, 0.48)";
      cloudEdge = state.palette === "night" ? "rgba(112, 134, 162, 0.14)" : "rgba(158, 178, 201, 0.12)";
      fogColor = state.palette === "night" ? "rgba(38, 52, 70, 0.22)" : "rgba(104, 122, 144, 0.2)";
      mistColor = state.palette === "night" ? "rgba(48, 64, 84, 0.22)" : "rgba(118, 136, 156, 0.22)";
      break;
    case "storm":
      values.skyOpacity = 0.24;
      values.glowOpacity = 0.05;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.86;
      values.horizonOpacity = 0.16;
      values.mistOpacity = 0.2;
      values.fogOpacity = 0.14;
      values.rainOpacity = 1.04;
      values.flashOpacity = 0.64;
      values.moteOpacity = 0;
      cloudCore = "rgba(42, 56, 74, 0.66)";
      cloudEdge = "rgba(102, 122, 148, 0.14)";
      fogColor = "rgba(32, 44, 62, 0.26)";
      mistColor = "rgba(44, 58, 78, 0.26)";
      break;
    case "snow":
      values.skyOpacity = 0.15;
      values.glowOpacity = 0.2;
      values.beamOpacity = 0.08;
      values.cloudOpacity = 0.34;
      values.horizonOpacity = 0.2;
      values.mistOpacity = 0.12;
      values.fogOpacity = 0.08;
      values.snowOpacity = 0.84;
      values.moteOpacity = 0.02;
      cloudCore = state.palette === "night" ? "rgba(96, 114, 138, 0.38)" : "rgba(232, 238, 247, 0.34)";
      cloudEdge = state.palette === "night" ? "rgba(164, 184, 210, 0.16)" : "rgba(255, 255, 255, 0.14)";
      fogColor = state.palette === "night" ? "rgba(48, 64, 86, 0.22)" : "rgba(230, 236, 245, 0.22)";
      mistColor = state.palette === "night" ? "rgba(58, 76, 98, 0.22)" : "rgba(225, 233, 242, 0.22)";
      break;
    case "fog":
      values.skyOpacity = 0.12;
      values.glowOpacity = 0.08;
      values.beamOpacity = 0.02;
      values.cloudOpacity = 0.18;
      values.horizonOpacity = 0.22;
      values.mistOpacity = 0.38;
      values.fogOpacity = 0.68;
      values.moteOpacity = 0.01;
      cloudCore = state.palette === "night" ? "rgba(76, 92, 112, 0.34)" : "rgba(186, 198, 207, 0.28)";
      cloudEdge = state.palette === "night" ? "rgba(136, 154, 176, 0.12)" : "rgba(232, 239, 244, 0.1)";
      fogColor = state.palette === "night" ? "rgba(52, 66, 84, 0.28)" : "rgba(223, 230, 236, 0.26)";
      mistColor = state.palette === "night" ? "rgba(62, 76, 94, 0.28)" : "rgba(217, 224, 231, 0.28)";
      break;
    case "clear":
    default:
      if (state.palette === "night") {
        values.skyOpacity = 0.13;
        values.glowOpacity = 0.08;
        values.beamOpacity = 0.03;
        values.cloudOpacity = 0.02;
        values.moteOpacity = 0;
        values.starOpacity = Number((0.72 - lunar.illumination * 0.08).toFixed(3));
        values.moonlightOpacity = Number((0.45 + lunar.illumination * 0.08).toFixed(3));
      }
      break;
  }

  if (phenomenon === "aurora" && exposure !== "underground") {
    values.auroraOpacity = 0.56;
    values.glowOpacity = Math.max(values.glowOpacity, 0.16);
  } else if (phenomenon === "sandstorm") {
    values.fogOpacity = Math.max(values.fogOpacity, 0.46);
    values.mistOpacity = Math.max(values.mistOpacity, 0.34);
    values.phenomenonOpacity = 0.78;
    fogColor = "rgba(214, 168, 112, 0.32)";
    mistColor = "rgba(204, 154, 98, 0.34)";
  } else if (phenomenon !== "none") {
    values.phenomenonOpacity = 0.68;
  }

  if (exposure === "sheltered") {
    values.rainOpacity *= 0.62;
    values.snowOpacity *= 0.65;
    values.skyOpacity *= 0.86;
    values.beamOpacity *= 0.78;
    values.phenomenonOpacity *= 0.8;
  } else if (exposure === "indoor") {
    const rainLike = state.condition === "rain" || state.condition === "storm";
    const frostLike = state.condition === "snow" || state.condition === "fog";
    values.windowDropletOpacity = rainLike ? 0.68 : frostLike ? 0.28 : 0;
    values.rainOpacity *= 0.22;
    values.snowOpacity *= 0.26;
    values.cloudOpacity *= 0.42;
    values.skyOpacity *= 0.52;
    values.fogOpacity *= 0.32;
    values.mistOpacity *= 0.28;
    values.starOpacity *= 0.45;
    values.moonlightOpacity *= 0.62;
    values.flashOpacity *= 0.45;
    values.auroraOpacity *= 0.5;
    values.phenomenonOpacity *= 0.32;
  } else if (exposure === "underground") {
    values.skyOpacity = 0.04;
    values.glowOpacity = 0.04;
    values.beamOpacity = 0;
    values.cloudOpacity = 0;
    values.horizonOpacity = 0.08;
    values.mistOpacity = Math.max(values.mistOpacity * 0.6, 0.16);
    values.fogOpacity = Math.max(values.fogOpacity * 0.45, 0.12);
    values.rainOpacity = 0;
    values.snowOpacity = 0;
    values.moteOpacity = Math.max(values.moteOpacity, 0.12);
    values.starOpacity = 0;
    values.moonlightOpacity = 0;
    values.flashOpacity = 0;
    values.auroraOpacity = 0;
    values.windowDropletOpacity = 0;
    values.phenomenonOpacity = phenomenon === "embers" || phenomenon === "fireflies" || phenomenon === "ashfall"
      ? values.phenomenonOpacity * 0.85
      : 0;
  }

  const detailScale = clamp(0.82 + baseIntensity * 0.28, 0.75, 1.18);
  const atmosphereScale = clamp(0.92 + baseIntensity * 0.24, 0.84, 1.2);

  return {
    bgStart: palette.start,
    bgMid: palette.mid,
    bgEnd: palette.end,
    glow: palette.glow,
    beamColor: palette.beam,
    horizonColor: palette.horizon,
    cloudCore,
    cloudEdge,
    fogColor,
    mistColor,
    skyOpacity: values.skyOpacity * atmosphereScale,
    glowOpacity: values.glowOpacity * atmosphereScale,
    beamOpacity: values.beamOpacity * atmosphereScale,
    cloudOpacity: values.cloudOpacity * detailScale,
    horizonOpacity: values.horizonOpacity * atmosphereScale,
    mistOpacity: values.mistOpacity * detailScale,
    fogOpacity: values.fogOpacity * detailScale,
    rainOpacity: values.rainOpacity * detailScale,
    snowOpacity: values.snowOpacity * detailScale,
    moteOpacity:
      exposure === "underground"
        ? values.moteOpacity * detailScale
        : state.condition === "clear" && baseIntensity > 0.48
          ? values.moteOpacity * detailScale
          : values.moteOpacity * 0.4,
    starOpacity: values.starOpacity * detailScale,
    moonlightOpacity: values.moonlightOpacity * atmosphereScale,
    flashOpacity: values.flashOpacity,
    auroraOpacity: clamp(values.auroraOpacity * atmosphereScale, 0, 1.2),
    windowDropletOpacity: clamp(values.windowDropletOpacity * detailScale, 0, 1.2),
    phenomenonOpacity: clamp(values.phenomenonOpacity * detailScale, 0, 1.2),
  };
}
