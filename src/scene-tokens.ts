import { clamp } from "./shared";
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
      start: "#05101d",
      mid: "#10253c",
      end: "#274768",
      glow: "rgba(143, 180, 255, 0.48)",
      beam: "rgba(130, 164, 234, 0.2)",
      horizon: "rgba(74, 104, 154, 0.26)",
    },
    storm: {
      start: "#04101a",
      mid: "#13283a",
      end: "#33475f",
      glow: "rgba(188, 220, 255, 0.26)",
      beam: "rgba(168, 203, 236, 0.16)",
      horizon: "rgba(108, 139, 170, 0.26)",
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
            start: state.palette === "night" ? "#07131f" : "#102032",
            mid: state.palette === "night" ? "#1d3148" : "#324b67",
            end: state.palette === "night" ? "#41566e" : "#61748b",
            glow: "rgba(176, 206, 240, 0.22)",
            beam: "rgba(135, 165, 198, 0.1)",
            horizon: "rgba(120, 147, 174, 0.24)",
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
    flashOpacity: 0.26,
  };

  switch (state.condition) {
    case "cloudy":
      values.skyOpacity = 0.14;
      values.glowOpacity = 0.09;
      values.beamOpacity = 0.04;
      values.cloudOpacity = 0.5;
      values.horizonOpacity = 0.1;
      values.mistOpacity = 0.06;
      values.moteOpacity = 0.02;
      cloudCore = "rgba(205, 216, 231, 0.34)";
      cloudEdge = "rgba(238, 244, 255, 0.12)";
      fogColor = "rgba(210, 223, 239, 0.18)";
      mistColor = "rgba(217, 227, 239, 0.2)";
      break;
    case "rain":
      values.skyOpacity = 0.2;
      values.glowOpacity = 0.06;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.7;
      values.horizonOpacity = 0.16;
      values.mistOpacity = 0.22;
      values.fogOpacity = 0.12;
      values.rainOpacity = 0.82;
      values.moteOpacity = 0;
      cloudCore = "rgba(87, 106, 128, 0.48)";
      cloudEdge = "rgba(158, 178, 201, 0.12)";
      fogColor = "rgba(162, 180, 198, 0.2)";
      mistColor = "rgba(174, 188, 204, 0.22)";
      break;
    case "storm":
      values.skyOpacity = 0.24;
      values.glowOpacity = 0.05;
      values.beamOpacity = 0;
      values.cloudOpacity = 0.86;
      values.horizonOpacity = 0.24;
      values.mistOpacity = 0.28;
      values.fogOpacity = 0.18;
      values.rainOpacity = 1.04;
      values.flashOpacity = 0.64;
      values.moteOpacity = 0;
      cloudCore = "rgba(56, 73, 93, 0.62)";
      cloudEdge = "rgba(118, 138, 163, 0.12)";
      fogColor = "rgba(130, 149, 171, 0.22)";
      mistColor = "rgba(151, 167, 186, 0.24)";
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
      cloudCore = "rgba(232, 238, 247, 0.34)";
      cloudEdge = "rgba(255, 255, 255, 0.14)";
      fogColor = "rgba(230, 236, 245, 0.22)";
      mistColor = "rgba(225, 233, 242, 0.22)";
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
      cloudCore = "rgba(186, 198, 207, 0.28)";
      cloudEdge = "rgba(232, 239, 244, 0.1)";
      fogColor = "rgba(223, 230, 236, 0.26)";
      mistColor = "rgba(217, 224, 231, 0.28)";
      break;
    case "clear":
    default:
      if (state.palette === "night") {
        values.skyOpacity = 0.06;
        values.glowOpacity = 0.08;
        values.beamOpacity = 0.03;
        values.cloudOpacity = 0.02;
        values.moteOpacity = 0.02;
      }
      break;
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
    moteOpacity: state.condition === "clear" && baseIntensity > 0.48 ? values.moteOpacity * detailScale : values.moteOpacity * 0.4,
    flashOpacity: values.flashOpacity,
  };
}
