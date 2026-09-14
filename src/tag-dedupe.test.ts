import { describe, expect, test } from "bun:test";

import { buildTagDedupeKey } from "./tag-dedupe";

describe("weather tag dedupe key", () => {
  test("is insensitive to attribute order", () => {
    const left = buildTagDedupeKey({ condition: "rain", time: "3:00 PM", location: "Porch" });
    const right = buildTagDedupeKey({ location: "Porch", time: "3:00 PM", condition: "rain" });
    expect(left).toBe(right);
  });

  test("is insensitive to attribute-name case and surrounding whitespace", () => {
    // Regression: JSON.stringify made `Condition` and `condition` distinct keys,
    // so one logical tag could bump the chat revision twice.
    const canonical = buildTagDedupeKey({ condition: "rain", windDirection: "west" });
    expect(buildTagDedupeKey({ Condition: "rain", WindDirection: "west" })).toBe(canonical);
    expect(buildTagDedupeKey({ " condition ": "rain", windDirection: "west " })).toBe(canonical);
  });

  test("treats differing values as different tags", () => {
    expect(buildTagDedupeKey({ condition: "rain" })).not.toBe(buildTagDedupeKey({ condition: "snow" }));
    expect(buildTagDedupeKey({ condition: "rain" })).not.toBe(buildTagDedupeKey({ summary: "rain" }));
  });

  test("separates fields so values cannot merge across the boundary", () => {
    // "a=1, b=2" must not collide with "a=1, b, =2".
    expect(buildTagDedupeKey({ a: "1", b: "2" })).not.toBe(buildTagDedupeKey({ "a=1, b": "2" }));
  });

  test("ignores empty attribute names and handles no attributes", () => {
    expect(buildTagDedupeKey({})).toBe("[]");
    expect(buildTagDedupeKey({ "  ": "x" })).toBe("[]");
  });
});

test("normalizes names before ordering mixed-case attributes", () => {
  expect(buildTagDedupeKey({ condition: "rain", Location: "Porch" }))
    .toBe(buildTagDedupeKey({ condition: "rain", location: "Porch" }));
  expect(buildTagDedupeKey({ a: "x\u0001b=y" }))
    .not.toBe(buildTagDedupeKey({ a: "x", b: "y" }));
});
