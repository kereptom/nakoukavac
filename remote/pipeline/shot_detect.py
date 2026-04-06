"""Shot boundary detection using PySceneDetect."""

from __future__ import annotations

import logging
import subprocess
import json

logger = logging.getLogger(__name__)


def get_video_info(video_path: str) -> dict:
    """Get video metadata via ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    probe = json.loads(result.stdout)

    video_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "video"), None
    )
    if not video_stream:
        raise ValueError(f"No video stream found in {video_path}")

    duration = float(probe["format"]["duration"])
    fps_parts = video_stream["r_frame_rate"].split("/")
    fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else float(fps_parts[0])
    width = int(video_stream["width"])
    height = int(video_stream["height"])

    return {
        "duration": duration,
        "fps": fps,
        "resolution": (width, height),
    }


def detect_shots(
    video_path: str,
    threshold: float = 27.0,
    min_scene_len: int = 15,
) -> list[tuple[float, float]]:
    """Detect shot boundaries and return list of (start_time, end_time) tuples.

    Args:
        video_path: Path to the video file.
        threshold: ContentDetector threshold (higher = fewer cuts detected).
        min_scene_len: Minimum scene length in frames.

    Returns:
        List of (start_seconds, end_seconds) for each detected shot.
    """
    from scenedetect import open_video, SceneManager
    from scenedetect.detectors import ContentDetector

    logger.info("Detecting shots with threshold=%.1f, min_scene_len=%d", threshold, min_scene_len)

    video = open_video(video_path)
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=threshold, min_scene_len=min_scene_len))

    scene_manager.detect_scenes(video, show_progress=True)
    scene_list = scene_manager.get_scene_list()

    shots = []
    for start_tc, end_tc in scene_list:
        shots.append((start_tc.get_seconds(), end_tc.get_seconds()))

    logger.info("Detected %d shots", len(shots))
    return shots
