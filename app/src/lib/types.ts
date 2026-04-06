export interface Shot {
  id: string;
  startTime: number;
  endTime: number;
  description: string;
  descriptionCs: string | null;
  transcript: string | null;
  transcriptSpeaker: string | null;
  embedding: number[];
  thumbnailTime: number;
}

export interface Scene {
  id: string;
  startTime: number;
  endTime: number;
  shotIds: string[];
  description: string;
  descriptionCs: string | null;
  embedding: number[];
}

export interface VideoAnalysis {
  version: string;
  sourceFile: string;
  duration: number;
  fps: number;
  resolution: [number, number];
  summary: string;
  summaryCd: string | null;
  summaryEmbedding: number[];
  scenes: Scene[];
  shots: Shot[];
  model: string;
  embeddingModel: string;
  language: string;
  processedAt: string;
}

export type ItemType = "video" | "scene" | "shot";

export interface SelectedItem {
  id: string;
  type: ItemType;
}

export interface SearchResult {
  id: string;
  type: ItemType;
  description: string;
  score: number;
  startTime: number;
  endTime: number;
}
