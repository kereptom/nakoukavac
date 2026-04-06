"""Output schema for video analysis results."""

from __future__ import annotations

from pydantic import BaseModel


class Shot(BaseModel):
    id: str
    start_time: float
    end_time: float
    description: str
    description_cs: str | None = None
    transcript: str | None = None
    transcript_speaker: str | None = None
    embedding: list[float] = []
    thumbnail_time: float = 0.0


class Scene(BaseModel):
    id: str
    start_time: float
    end_time: float
    shot_ids: list[str]
    description: str
    description_cs: str | None = None
    embedding: list[float] = []


class VideoAnalysis(BaseModel):
    version: str = "1.0"
    source_file: str
    duration: float
    fps: float
    resolution: tuple[int, int]
    summary: str = ""
    summary_cs: str | None = None
    summary_embedding: list[float] = []
    scenes: list[Scene] = []
    shots: list[Shot] = []
    model: str = ""
    embedding_model: str = ""
    language: str = "both"
    processed_at: str = ""
