"""Gemma 4 vision analysis: describe shots, group scenes, summarize video."""

from __future__ import annotations

import logging
import json
import re
from PIL import Image

logger = logging.getLogger(__name__)

_model = None
_processor = None


def load_model(model_name: str = "google/gemma-4-31B-it"):
    """Load Gemma 4 model and processor (cached)."""
    global _model, _processor

    if _model is not None:
        return _model, _processor

    import torch
    from transformers import AutoProcessor, AutoModelForImageTextToText

    logger.info("Loading model %s ...", model_name)

    _processor = AutoProcessor.from_pretrained(model_name)
    _model = AutoModelForImageTextToText.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )

    logger.info("Model loaded successfully")
    return _model, _processor


def _generate(messages: list[dict], max_new_tokens: int = 512) -> str:
    """Run a single generation with the loaded model."""
    model, processor = _model, _processor

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    import torch
    with torch.inference_mode():
        output_ids = model.generate(**inputs, max_new_tokens=max_new_tokens)

    # Decode only the new tokens
    new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
    return processor.decode(new_tokens, skip_special_tokens=True).strip()


def describe_shot(
    frame_paths: list[str],
    language: str = "both",
    shot_index: int = 0,
) -> dict[str, str]:
    """Describe a single shot from its frames.

    Returns:
        {"en": "...", "cs": "..."} depending on language setting.
    """
    images = [Image.open(p).convert("RGB") for p in frame_paths]

    content = []
    for img in images:
        content.append({"type": "image", "image": img})

    if language == "en":
        content.append({
            "type": "text",
            "text": (
                "Describe what is happening in this video shot in 2-3 sentences. "
                "Include: visual setting, people/objects present, camera movement, mood/lighting."
            ),
        })
    elif language == "cs":
        content.append({
            "type": "text",
            "text": (
                "Popiš, co se děje v tomto záběru videa ve 2-3 větách česky. "
                "Zahrň: vizuální prostředí, přítomné osoby/objekty, pohyb kamery, náladu/osvětlení."
            ),
        })
    else:  # both
        content.append({
            "type": "text",
            "text": (
                "Describe this video shot. Respond in the following JSON format exactly:\n"
                '{"en": "2-3 sentence description in English including setting, people/objects, camera, mood", '
                '"cs": "2-3 věty česky popisující prostředí, osoby/objekty, kameru, náladu"}'
            ),
        })

    messages = [{"role": "user", "content": content}]
    response = _generate(messages, max_new_tokens=400)

    if language == "both":
        try:
            # Try to parse JSON response
            json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return {"en": parsed.get("en", response), "cs": parsed.get("cs", "")}
        except (json.JSONDecodeError, KeyError):
            pass
        # Fallback: treat whole response as English
        return {"en": response, "cs": ""}
    elif language == "cs":
        return {"en": "", "cs": response}
    else:
        return {"en": response, "cs": ""}


def group_into_scenes(
    shot_descriptions: list[dict],
    language: str = "both",
) -> list[dict]:
    """Group shots into logical scenes using Gemma (text-only pass).

    Args:
        shot_descriptions: List of {"id": "shot-001", "start_time": ..., "end_time": ..., "description": ...}

    Returns:
        List of scene dicts: {"shot_ids": [...], "description": "...", "description_cs": "..."}
    """
    # Build a numbered list of shot descriptions
    lines = []
    for s in shot_descriptions:
        lines.append(f"{s['id']} ({s['start_time']:.1f}s-{s['end_time']:.1f}s): {s['description']}")

    shot_list_text = "\n".join(lines)

    prompt = (
        "Below is a list of sequential video shots with timestamps and descriptions.\n"
        "Group them into logical scenes (continuous action, location, or topic).\n"
        "Respond as a JSON array where each element has:\n"
        '- "shot_ids": array of shot IDs in this scene\n'
        '- "description": 1-2 sentence English summary of the scene\n'
        '- "description_cs": 1-2 sentence Czech summary\n\n'
        f"Shots:\n{shot_list_text}\n\n"
        "Respond with ONLY the JSON array, no other text."
    )

    messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
    response = _generate(messages, max_new_tokens=2000)

    try:
        # Extract JSON array from response
        array_match = re.search(r'\[.*\]', response, re.DOTALL)
        if array_match:
            scenes = json.loads(array_match.group())
            return scenes
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning("Failed to parse scene grouping response: %s", e)

    # Fallback: group every 5 shots into a scene
    logger.warning("Using fallback scene grouping (every 5 shots)")
    scenes = []
    for i in range(0, len(shot_descriptions), 5):
        chunk = shot_descriptions[i:i + 5]
        scenes.append({
            "shot_ids": [s["id"] for s in chunk],
            "description": f"Scene containing shots {chunk[0]['id']} to {chunk[-1]['id']}",
            "description_cs": f"Scéna obsahující záběry {chunk[0]['id']} až {chunk[-1]['id']}",
        })
    return scenes


def summarize_video(
    scene_descriptions: list[str],
    language: str = "both",
) -> dict[str, str]:
    """Generate a full video summary from scene descriptions.

    Returns:
        {"en": "...", "cs": "..."} depending on language setting.
    """
    scenes_text = "\n".join(f"- {desc}" for desc in scene_descriptions)

    if language == "both":
        prompt = (
            "Based on these scene descriptions from a video, write a comprehensive summary "
            "of the entire video (5-8 sentences). Respond in JSON format:\n"
            '{"en": "English summary", "cs": "Czech summary"}\n\n'
            f"Scenes:\n{scenes_text}"
        )
    elif language == "cs":
        prompt = (
            "Na základě těchto popisů scén z videa napiš souhrnný popis celého videa (5-8 vět česky).\n\n"
            f"Scény:\n{scenes_text}"
        )
    else:
        prompt = (
            "Based on these scene descriptions from a video, write a comprehensive summary "
            "of the entire video (5-8 sentences).\n\n"
            f"Scenes:\n{scenes_text}"
        )

    messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
    response = _generate(messages, max_new_tokens=600)

    if language == "both":
        try:
            json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return {"en": parsed.get("en", response), "cs": parsed.get("cs", "")}
        except (json.JSONDecodeError, KeyError):
            pass
        return {"en": response, "cs": ""}
    elif language == "cs":
        return {"en": "", "cs": response}
    else:
        return {"en": response, "cs": ""}
