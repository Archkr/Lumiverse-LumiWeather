/**
 * Builds a stable identity for a weather tag so the same tag is never applied
 * twice.
 *
 * `JSON.stringify(attrs)` was order- and case-sensitive, so a model that emitted
 * `Condition="rain"` on one pass and `condition="rain"` on another produced two
 * different keys and bumped the chat revision twice for one logical update.
 * Attribute names are lower-cased, values are trimmed, and keys are sorted.
 */
export function buildTagDedupeKey(attrs: Record<string, string>): string {
  const normalized: [string, string][] = [];
  for (const key of Object.keys(attrs)) {
    const namespacedKey = key.trim().toLowerCase();
    if (!namespacedKey) continue;
    const value = typeof attrs[key] === "string" ? attrs[key].trim() : String(attrs[key] ?? "");
    normalized.push([namespacedKey, value]);
  }
  normalized.sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
  return JSON.stringify(normalized);
}
