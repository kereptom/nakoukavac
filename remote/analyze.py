#!/usr/bin/env python3
"""AI Nakoukavac — Video analysis pipeline using Gemma 4.

Usage:
    python analyze.py /path/to/video.mp4 --output analysis.nakoukavac.json

Requires: GPU with sufficient VRAM for the chosen model.
Optional: GLADIA_API_KEY env var for audio transcription.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from pipeline.schema import Shot, Scene, VideoAnalysis
from pipeline.shot_detect import detect_shots, get_video_info
from pipeline.frame_extract import extract_frames
from pipeline.gemma_vision import load_model, describe_shot, group_into_scenes, summarize_video
from pipeline.embed import load_embedding_model, embed_texts, embed_single

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nakoukavac")


def main():
    parser = argparse.ArgumentParser(description="AI Nakoukavac video analysis pipeline")
    parser.add_argument("video", help="Path to the input video file")
    parser.add_argument("-o", "--output", help="Output JSON path (default: <video>.nakoukavac.json)")
    parser.add_argument("--model", default="google/gemma-4-31B-it", help="Gemma model to use")
    parser.add_argument("--embedding-model", default="Qwen/Qwen3-Embedding-0.6B")
    parser.add_argument("--embedding-dim", type=int, default=None,
                        help="Truncate embeddings to this dimension (Matryoshka). Default: model's native dim")
    parser.add_argument("--language", choices=["en", "cs", "both"], default="both")
    parser.add_argument("--scene-threshold", type=float, default=27.0, help="Shot detection threshold")
    parser.add_argument("--min-scene-len", type=int, default=15, help="Minimum shot length in frames")
    parser.add_argument("--no-audio", action="store_true", help="Skip audio transcription")
    parser.add_argument("--keep-frames", action="store_true", help="Keep extracted frames after processing")
    parser.add_argument("--gpu", type=int, default=None, help="GPU index to use (e.g. 0 or 1). Default: all visible GPUs")
    args = parser.parse_args()

    if args.gpu is not None:
        os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu)

    video_path = str(Path(args.video).resolve())
    if not Path(video_path).exists():
        logger.error("Video file not found: %s", video_path)
        sys.exit(1)

    output_path = args.output or str(Path(video_path).with_suffix(".nakoukavac.json"))

    # --- Step 0: Video info ---
    logger.info("=== Step 0: Getting video info ===")
    info = get_video_info(video_path)
    logger.info("Duration: %.1fs, FPS: %.2f, Resolution: %s", info["duration"], info["fps"], info["resolution"])

    # --- Step 1: Shot detection ---
    logger.info("=== Step 1: Shot detection ===")
    shots = detect_shots(video_path, threshold=args.scene_threshold, min_scene_len=args.min_scene_len)

    if not shots:
        logger.warning("No shots detected, treating entire video as one shot")
        shots = [(0.0, info["duration"])]

    # --- Step 2: Frame extraction ---
    logger.info("=== Step 2: Frame extraction ===")
    frames_dir = tempfile.mkdtemp(prefix="nakoukavac_frames_")
    try:
        shot_frames = extract_frames(video_path, shots, output_dir=frames_dir)

        # --- Step 3: Load Gemma model ---
        logger.info("=== Step 3: Loading Gemma 4 model ===")
        load_model(args.model)

        # --- Step 4: Describe each shot ---
        logger.info("=== Step 4: Describing %d shots ===", len(shots))
        shot_objects: list[Shot] = []

        for i, ((start, end), frames) in enumerate(zip(shots, shot_frames)):
            logger.info("Shot %d/%d (%.1f-%.1fs, %d frames)", i + 1, len(shots), start, end, len(frames))
            descriptions = describe_shot(frames, language=args.language, shot_index=i)

            shot_obj = Shot(
                id=f"shot-{i + 1:03d}",
                start_time=start,
                end_time=end,
                description=descriptions.get("en", ""),
                description_cs=descriptions.get("cs", "") or None,
                thumbnail_time=start + (end - start) / 2,
            )
            shot_objects.append(shot_obj)

        # --- Step 5: Audio transcription (optional) ---
        if not args.no_audio:
            logger.info("=== Step 5: Audio transcription (Gladia) ===")
            try:
                from pipeline.audio_transcribe import extract_audio, transcribe_with_gladia, map_transcripts_to_shots

                audio_path = extract_audio(video_path)
                utterances = transcribe_with_gladia(audio_path)
                transcripts = map_transcripts_to_shots(utterances, shots)

                for shot_obj, transcript in zip(shot_objects, transcripts):
                    shot_obj.transcript = transcript

                # Clean up audio file
                Path(audio_path).unlink(missing_ok=True)
                logger.info("Audio transcription complete")
            except Exception as e:
                logger.warning("Audio transcription failed (continuing without): %s", e)
        else:
            logger.info("=== Step 5: Audio transcription SKIPPED ===")

        # --- Step 6: Group shots into scenes ---
        logger.info("=== Step 6: Grouping shots into scenes ===")
        shot_desc_list = [
            {"id": s.id, "start_time": s.start_time, "end_time": s.end_time, "description": s.description}
            for s in shot_objects
        ]
        raw_scenes = group_into_scenes(shot_desc_list, language=args.language)

        # Build Scene objects
        shot_map = {s.id: s for s in shot_objects}
        scene_objects: list[Scene] = []

        for j, raw in enumerate(raw_scenes):
            shot_ids = raw.get("shot_ids", [])
            if not shot_ids:
                continue

            # Compute scene time range from its shots
            scene_shots = [shot_map[sid] for sid in shot_ids if sid in shot_map]
            if not scene_shots:
                continue

            scene_obj = Scene(
                id=f"scene-{j + 1:03d}",
                start_time=min(s.start_time for s in scene_shots),
                end_time=max(s.end_time for s in scene_shots),
                shot_ids=shot_ids,
                description=raw.get("description", ""),
                description_cs=raw.get("description_cs", "") or None,
            )
            scene_objects.append(scene_obj)

        logger.info("Created %d scenes from %d shots", len(scene_objects), len(shot_objects))

        # --- Step 7: Video summary ---
        logger.info("=== Step 7: Generating video summary ===")
        scene_descs = [s.description for s in scene_objects if s.description]
        summary = summarize_video(scene_descs, language=args.language)

        # --- Step 8: Embeddings ---
        logger.info("=== Step 8: Generating embeddings ===")
        load_embedding_model(args.embedding_model, truncate_dim=args.embedding_dim)

        # Collect all texts to embed in one batch
        texts_to_embed = []
        text_owners = []  # Track what each embedding belongs to

        for shot_obj in shot_objects:
            text = shot_obj.description
            if shot_obj.transcript:
                text += " " + shot_obj.transcript
            texts_to_embed.append(text)
            text_owners.append(("shot", shot_obj.id))

        for scene_obj in scene_objects:
            texts_to_embed.append(scene_obj.description)
            text_owners.append(("scene", scene_obj.id))

        summary_text = summary.get("en", "") or summary.get("cs", "")
        texts_to_embed.append(summary_text)
        text_owners.append(("summary", ""))

        all_embeddings = embed_texts(texts_to_embed)

        # Assign embeddings back
        idx = 0
        for shot_obj in shot_objects:
            shot_obj.embedding = all_embeddings[idx]
            idx += 1
        for scene_obj in scene_objects:
            scene_obj.embedding = all_embeddings[idx]
            idx += 1
        summary_embedding = all_embeddings[idx]

        # --- Step 9: Assemble and save ---
        logger.info("=== Step 9: Saving output ===")
        analysis = VideoAnalysis(
            source_file=Path(video_path).name,
            duration=info["duration"],
            fps=info["fps"],
            resolution=info["resolution"],
            summary=summary.get("en", ""),
            summary_cs=summary.get("cs", "") or None,
            summary_embedding=summary_embedding,
            scenes=scene_objects,
            shots=shot_objects,
            model=args.model,
            embedding_model=args.embedding_model,
            language=args.language,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(analysis.model_dump_json(indent=2))

        logger.info("Analysis saved to %s", output_path)
        logger.info(
            "Summary: %d shots, %d scenes, %.1f min video",
            len(shot_objects), len(scene_objects), info["duration"] / 60,
        )

    finally:
        if not args.keep_frames:
            shutil.rmtree(frames_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
