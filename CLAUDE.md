# AI Nakoukavac

AI-powered video analysis and browsing tool using Google Gemma 4.

## Architecture

Two independent parts:

### `remote/` — GPU Processing Pipeline (Python)

Runs on a remote server with an NVIDIA A100 GPU. Analyzes video using Gemma 4 31B-it and produces a `.nakoukavac.json` analysis file.

**Pipeline steps:**
1. **Shot detection** — PySceneDetect `ContentDetector` finds cut boundaries
2. **Frame extraction** — ffmpeg extracts representative JPEG frames per shot (adaptive fps based on shot duration)
3. **Gemma 4 vision** — Each shot's frames are fed to `google/gemma-4-31B-it` for 2-3 sentence descriptions (EN + CS)
4. **Scene grouping** — Gemma groups sequential shots into logical scenes with scene-level summaries
5. **Video summary** — Full video summary generated from all scene descriptions
6. **Audio transcription** (optional) — Gladia API for timestamped transcript with speaker diarization
7. **Embeddings** — `Alibaba-NLP/gte-multilingual-base` generates 768-dim vectors for all descriptions

**Entry point:** `remote/analyze.py`  
**Output:** Single `.nakoukavac.json` file containing all shots, scenes, summaries, transcripts, and embeddings.

### `app/` — Local Web Viewer (Next.js)

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 client-side application. No server-side API routes needed — everything runs in the browser.

**Layout:** Three-panel resizable layout:
- **Left:** Hierarchy panel (collapsible Video > Scenes > Shots tree) + search panel
- **Center:** Video player (HTML5 `<video>`) + dual-track timeline (scenes + shots)
- **Right:** Detail panel (description, transcript, metadata, play segment button)

**Key components:**
- `src/components/browser/browser-layout.tsx` — Main state orchestrator
- `src/components/browser/video-player.tsx` — HTML5 video with custom controls
- `src/components/browser/timeline.tsx` — Read-only zoomable dual-track timeline
- `src/components/browser/hierarchy-panel.tsx` — Tree browser for scenes/shots
- `src/components/browser/detail-panel.tsx` — Selected item details
- `src/components/browser/search-panel.tsx` — Text search across descriptions/transcripts
- `src/lib/search.ts` — Search scoring engine (keyword overlap + substring matching)
- `src/lib/load-analysis.ts` — JSON parser with snake_case → camelCase conversion
- `src/lib/types.ts` — TypeScript types mirroring the Python schema

**UI primitives** in `src/components/ui/` are adapted from the dubby-buddy project (Radix UI + Tailwind).

## Data Flow

```
[Remote A100]                          [Local Machine]
video.mp4 ──SCP──> analyze.py          app/ (Next.js)
                   │                    │
                   ├─ shot detection    ├─ Load local video.mp4
                   ├─ frame extraction  ├─ Load .nakoukavac.json
                   ├─ Gemma 4 31B-it   ├─ Browse hierarchy
                   ├─ Gladia (audio)    ├─ Play segments
                   ├─ embeddings        ├─ Search descriptions
                   └─> .nakoukavac.json └──> display
                       ──SCP──>
```

## Key Decisions

- **Gemma 4 31B-it** chosen as the largest model that fits A100 80GB in FP16. No audio support on 31B — audio handled separately via Gladia API.
- **Qwen3-Embedding-0.6B** for embeddings by default — open source, strong multilingual support, 2048 dimensions (Matryoshka-capable, truncatable via `--embedding-dim`). Switchable via `--embedding-model`.
- **Client-side search** — embeddings are small enough to search instantly in browser. Text search for MVP, vector similarity ready for upgrade.
- **No server API** — the viewer is purely client-side. Video stays local (loaded via `URL.createObjectURL`), only the JSON analysis file moves between machines.
- **Bilingual output** — all descriptions in both English and Czech (configurable via `--language` flag).

## Conventions

- UI patterns follow the dubby-buddy project: ResizablePanelGroup layout, HTML5 video with custom controls, timeline segments with absolute positioning.
- Python uses Pydantic for schema validation, snake_case naming. TypeScript uses camelCase. The `load-analysis.ts` module handles the conversion.
- Color coding: cyan for scenes, emerald/green for shots, primary color for video-level items.
