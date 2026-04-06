"""Audio transcription using Gladia API (same provider as dubby-buddy)."""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time

import requests

logger = logging.getLogger(__name__)

GLADIA_API_URL = "https://api.gladia.io/v2"


def _get_api_key() -> str:
    key = os.environ.get("GLADIA_API_KEY")
    if not key:
        raise ValueError("GLADIA_API_KEY environment variable is required for audio transcription")
    return key


def extract_audio(video_path: str, output_path: str | None = None) -> str:
    """Extract audio track from video as WAV."""
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav", prefix="nakoukavac_audio_")
        os.close(fd)

    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    logger.info("Extracted audio to %s", output_path)
    return output_path


def transcribe_with_gladia(audio_path: str) -> list[dict]:
    """Send audio to Gladia API and get timestamped transcript with diarization.

    Returns:
        List of utterance dicts: [{"start": 0.5, "end": 2.1, "text": "...", "speaker": 0}, ...]
    """
    api_key = _get_api_key()
    headers = {"x-gladia-key": api_key}

    # Upload audio file
    logger.info("Uploading audio to Gladia...")
    with open(audio_path, "rb") as f:
        upload_resp = requests.post(
            f"{GLADIA_API_URL}/upload",
            headers=headers,
            files={"audio": ("audio.wav", f, "audio/wav")},
        )
    upload_resp.raise_for_status()
    audio_url = upload_resp.json()["audio_url"]

    # Start transcription
    logger.info("Starting Gladia transcription...")
    transcription_resp = requests.post(
        f"{GLADIA_API_URL}/transcription",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "audio_url": audio_url,
            "diarization": True,
            "language_behaviour": "automatic multiple languages",
        },
    )
    transcription_resp.raise_for_status()
    result_url = transcription_resp.json()["result_url"]

    # Poll for results
    logger.info("Waiting for transcription result...")
    while True:
        result_resp = requests.get(result_url, headers=headers)
        result_resp.raise_for_status()
        result = result_resp.json()

        if result["status"] == "done":
            break
        elif result["status"] == "error":
            raise RuntimeError(f"Gladia transcription failed: {result.get('error')}")

        time.sleep(3)

    # Parse utterances
    utterances = []
    for utterance in result.get("result", {}).get("transcription", {}).get("utterances", []):
        utterances.append({
            "start": utterance["start"],
            "end": utterance["end"],
            "text": utterance["text"],
            "speaker": utterance.get("speaker", 0),
        })

    logger.info("Transcription complete: %d utterances", len(utterances))
    return utterances


def map_transcripts_to_shots(
    utterances: list[dict],
    shots: list[tuple[float, float]],
) -> list[str | None]:
    """Map Gladia utterances to shots by time overlap.

    Returns:
        List of transcript strings (one per shot), None if no speech in that shot.
    """
    transcripts: list[str | None] = []

    for start, end in shots:
        shot_texts = []
        for utt in utterances:
            # Check overlap
            overlap_start = max(start, utt["start"])
            overlap_end = min(end, utt["end"])
            if overlap_start < overlap_end:
                speaker_tag = f"[Speaker {utt['speaker']}]" if utt.get("speaker") is not None else ""
                shot_texts.append(f"{speaker_tag} {utt['text']}".strip())

        transcripts.append(" ".join(shot_texts) if shot_texts else None)

    return transcripts
