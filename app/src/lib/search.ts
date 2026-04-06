import type { VideoAnalysis, SearchResult } from "./types";

/**
 * Text-based search across all descriptions and transcripts.
 * Scores by keyword overlap + substring matching.
 */
export function searchAnalysis(
  analysis: VideoAnalysis,
  query: string,
): SearchResult[] {
  if (!query.trim()) return [];

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  // Score a text against the query
  function scoreText(text: string | null | undefined): number {
    if (!text) return 0;
    const textLower = text.toLowerCase();
    let score = 0;

    // Substring match (strongest signal)
    if (textLower.includes(queryLower)) {
      score += 10;
    }

    // Word overlap
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        score += 2;
      }
    }

    return score;
  }

  // Search shots
  for (const shot of analysis.shots) {
    const s =
      scoreText(shot.description) +
      scoreText(shot.descriptionCs) +
      scoreText(shot.transcript);
    if (s > 0) {
      results.push({
        id: shot.id,
        type: "shot",
        description: shot.description || shot.descriptionCs || "",
        score: s,
        startTime: shot.startTime,
        endTime: shot.endTime,
      });
    }
  }

  // Search scenes
  for (const scene of analysis.scenes) {
    const s = scoreText(scene.description) + scoreText(scene.descriptionCs);
    if (s > 0) {
      results.push({
        id: scene.id,
        type: "scene",
        description: scene.description || scene.descriptionCs || "",
        score: s,
        startTime: scene.startTime,
        endTime: scene.endTime,
      });
    }
  }

  // Search video summary
  const vs = scoreText(analysis.summary) + scoreText(analysis.summaryCd);
  if (vs > 0) {
    results.push({
      id: "video",
      type: "video",
      description: analysis.summary || "",
      score: vs,
      startTime: 0,
      endTime: analysis.duration,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}
