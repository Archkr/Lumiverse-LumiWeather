import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LATITUDE,
  isTimePhasePalette,
  phaseFromHour,
  resolveDayHalfAngle,
  resolveDayOfYear,
  resolveHudTimePhase,
  resolveSeasonFromDayOfYear,
  resolveSolarArc,
  resolveSolarDeclination,
  seasonFromStoryDate,
} from "./time-utils";
import { WEATHER_PALETTES } from "./shared";

describe("weather time model", () => {
  test("recognizes only the palettes that already encode a phase", () => {
    expect(isTimePhasePalette("dawn")).toBe(true);
    expect(isTimePhasePalette("day")).toBe(true);
    expect(isTimePhasePalette("dusk")).toBe(true);
    expect(isTimePhasePalette("night")).toBe(true);
    expect(isTimePhasePalette("storm")).toBe(false);
    expect(isTimePhasePalette("mist")).toBe(false);
    expect(isTimePhasePalette("snow")).toBe(false);
    expect(WEATHER_PALETTES.length).toBe(7);
  });

  test("keeps the coarse hour table stable for dates that cannot be parsed", () => {
    expect(phaseFromHour(null)).toBe("day");
    expect(phaseFromHour(0)).toBe("night");
    expect(phaseFromHour(5)).toBe("night");
    expect(phaseFromHour(6)).toBe("dawn");
    expect(phaseFromHour(9)).toBe("dawn");
    expect(phaseFromHour(10)).toBe("day");
    expect(phaseFromHour(17)).toBe("day");
    expect(phaseFromHour(18)).toBe("dusk");
    expect(phaseFromHour(20)).toBe("dusk");
    expect(phaseFromHour(21)).toBe("night");
    expect(phaseFromHour(23)).toBe("night");
  });

  test("returns day for a story time that is not a real calendar value", () => {
    expect(resolveSolarArc("2026-02-30", "3:00 PM").phase).toBe("day");
    expect(resolveSolarArc("2026-01-15", "25:00").phase).toBe("day");
    expect(resolveSolarArc("not-a-date", "3:00 PM").phase).toBe("day");
    expect(resolveSolarArc("2026-01-15", "3:00 PM").phase).toBe("day");
  });

  test("places a mid-latitude winter day inside the daylight band", () => {
    // January at the default latitude: dawn near 07:00, earlier than the coarse
    // table, which is the whole point of moving palettes onto the solar model.
    expect(resolveSolarArc("2026-01-15", "2:00 AM").phase).toBe("night");
    expect(resolveSolarArc("2026-01-15", "7:00 AM").phase).toBe("dawn");
    expect(resolveSolarArc("2026-01-15", "2:00 PM").phase).toBe("day");
    expect(resolveSolarArc("2026-01-15", "3:00 PM").phase).toBe("day");
    expect(resolveSolarArc("2026-01-15", "8:00 PM").phase).toBe("night");
    expect(resolveSolarArc("2026-01-15", "10:00 PM").phase).toBe("night");
  });

  test("holds the daylight band across all twenty-four hours in midsummer", () => {
    const phases = Array.from({ length: 24 }, (_, hour) =>
      resolveSolarArc("2026-06-21", `${String(hour).padStart(2, "0")}:00`).phase,
    );
    expect(phases.filter((phase) => phase === "day").length).toBeGreaterThanOrEqual(12);
    expect(phases.filter((phase) => phase === "night").length).toBeLessThanOrEqual(8);
  });

  test("keeps solstice day length on the correct side of the equinox", () => {
    const daylight = (date: string) =>
      Array.from({ length: 24 }, (_, hour) =>
        resolveSolarArc(date, `${String(hour).padStart(2, "0")}:00`).phase,
      ).filter((phase) => phase === "day" || phase === "dawn" || phase === "dusk").length;

    expect(daylight("2026-06-21")).toBeGreaterThan(daylight("2026-03-20"));
    expect(daylight("2026-03-20")).toBeGreaterThan(daylight("2026-12-21"));
  });

  test("treats polar night and midnight sun as unambiguous", () => {
    // 80N in midwinter: the sun never rises, so every hour is night.
    const polarNight = Array.from({ length: 24 }, (_, hour) =>
      resolveSolarArc("2026-12-21", `${String(hour).padStart(2, "0")}:00`, 80).phase,
    );
    expect(polarNight.every((phase) => phase === "night")).toBe(true);

    // 80N in midsummer: the sun never sets, so no hour is night.
    const midnightSun = Array.from({ length: 24 }, (_, hour) =>
      resolveSolarArc("2026-06-21", `${String(hour).padStart(2, "0")}:00`, 80).phase,
    );
    expect(midnightSun.includes("night")).toBe(false);
  });

  test("sweeps the sun altitude through the day", () => {
    const midnight = resolveSolarArc("2026-03-20", "12:00 AM").sunAltitude;
    const noon = resolveSolarArc("2026-03-20", "12:00 PM").sunAltitude;
    const evening = resolveSolarArc("2026-03-20", "6:00 PM").sunAltitude;

    expect(noon).toBeGreaterThan(60);
    expect(midnight).toBeLessThan(-60);
    expect(Math.abs(evening)).toBeLessThan(10);
  });

  test("reports declination, day of year, and seasons consistently", () => {
    expect(resolveSolarDeclination(81)).toBeCloseTo(0, 5);
    expect(resolveSolarDeclination(172)).toBeGreaterThan(23);
    expect(resolveSolarDeclination(355)).toBeLessThan(-23);

    const leapDay = Date.UTC(2024, 1, 29);
    expect(resolveDayOfYear(leapDay)).toBe(60);
    expect(resolveDayOfYear(Number.NaN)).toBeNull();

    expect(resolveSeasonFromDayOfYear(15)).toBe("winter");
    expect(resolveSeasonFromDayOfYear(120)).toBe("spring");
    expect(resolveSeasonFromDayOfYear(200)).toBe("summer");
    expect(resolveSeasonFromDayOfYear(300)).toBe("autumn");
  });

  test("returns no hour-angle solution when the sun never crosses the horizon", () => {
    const summerDeclination = resolveSolarDeclination(172);
    expect(resolveDayHalfAngle(80, summerDeclination)).toBeNull();
    expect(resolveDayHalfAngle(DEFAULT_LATITUDE, summerDeclination)).not.toBeNull();
  });

  test("lets an explicit phase palette win over the hour", () => {
    expect(resolveHudTimePhase("night", 14)).toBe("night");
    expect(resolveHudTimePhase("dawn", 12)).toBe("dawn");
    expect(resolveHudTimePhase("dusk", 2)).toBe("dusk");
    expect(resolveHudTimePhase("day", 23)).toBe("day");
  });

  test("exposes a season and sun altitude for non-phase palettes", () => {
    const arc = resolveSolarArc("2026-07-15", "1:00 PM");
    expect(arc.season).toBe("summer");
    expect(arc.sunAltitude).toBeGreaterThan(55);
    expect(seasonFromStoryDate("2026-01-15", "1:00 PM")).toBe("winter");
    expect(seasonFromStoryDate("2026-01-15", "bad time")).toBeNull();
  });
});
