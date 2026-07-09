export type ParsedWeatherTag = {
  attrs: Record<string, string>;
  fullMatch: string;
};

export function shouldProcessWeatherTag(payload: { isStreaming?: boolean; isUser?: boolean }): boolean {
  return !payload.isStreaming && !payload.isUser;
}

export function buildWeatherTagRegex(flags = "ig"): RegExp {
  return new RegExp(String.raw`<weather-state\b[^>]*?(?:\/>|>[\s\S]*?<\/weather-state>)`, flags);
}

export function stripWeatherStateTags(content: string): string {
  return content.replace(buildWeatherTagRegex(), "").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseTagAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attributePattern = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(raw)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

export function extractLastWeatherTag(content: string): ParsedWeatherTag | null {
  let lastMatch: ParsedWeatherTag | null = null;
  for (const match of content.matchAll(buildWeatherTagRegex())) {
    const fullMatch = match[0] ?? "";
    const openingTag = fullMatch.match(/^<weather-state\b([^>]*)/i);
    lastMatch = {
      fullMatch,
      attrs: parseTagAttributes(openingTag?.[1] ?? ""),
    };
  }
  return lastMatch;
}
