"""Extract representative frames from each shot using ffmpeg."""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def compute_frame_times(start: float, end: float) -> list[float]:
    """Decide which timestamps to extract frames from, given shot boundaries."""
    duration = end - start

    if duration < 0.1:
        return [start]

    if duration < 2.0:
        return [start + duration / 2]

    if duration <= 10.0:
        # 1 fps
        times = []
        t = start + 0.5
        while t < end:
            times.append(t)
            t += 1.0
        return times or [start + duration / 2]

    if duration <= 60.0:
        # 0.5 fps
        times = []
        t = start + 1.0
        while t < end:
            times.append(t)
            t += 2.0
        return times[:30] or [start + duration / 2]

    # > 60s: 0.5fps, capped at 30 frames
    times = []
    t = start + 1.0
    while t < end and len(times) < 30:
        times.append(t)
        t += 2.0
    return times or [start + duration / 2]


def extract_frames(
    video_path: str,
    shots: list[tuple[float, float]],
    output_dir: str | None = None,
) -> list[list[str]]:
    """Extract frames for each shot.

    Returns:
        List of lists — for each shot, a list of JPEG file paths.
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="nakoukavac_frames_")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    all_frames: list[list[str]] = []

    for i, (start, end) in enumerate(shots):
        frame_times = compute_frame_times(start, end)
        shot_frames: list[str] = []

        for j, t in enumerate(frame_times):
            frame_file = out_path / f"shot{i:04d}_frame{j:03d}.jpg"
            cmd = [
                "ffmpeg", "-y", "-ss", f"{t:.3f}",
                "-i", video_path,
                "-frames:v", "1",
                "-q:v", "2",
                str(frame_file),
            ]
            subprocess.run(cmd, capture_output=True, check=True)
            shot_frames.append(str(frame_file))

        all_frames.append(shot_frames)

        if (i + 1) % 20 == 0 or i == len(shots) - 1:
            logger.info("Extracted frames for %d/%d shots", i + 1, len(shots))

    return all_frames
