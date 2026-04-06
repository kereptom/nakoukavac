import type { VideoAnalysis } from "./types";

/**
 * Convert snake_case JSON keys to camelCase TypeScript format.
 */
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? snakeToCamel(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === "object" && value !== null) {
      result[camelKey] = snakeToCamel(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

export function parseAnalysisJson(text: string): VideoAnalysis {
  const raw = JSON.parse(text);
  return snakeToCamel(raw) as unknown as VideoAnalysis;
}
