"""Embedding generation using sentence-transformers."""

from __future__ import annotations

import logging
import numpy as np

logger = logging.getLogger(__name__)

_model = None
_truncate_dim: int | None = None


def load_embedding_model(
    model_name: str = "Qwen/Qwen3-Embedding-0.6B",
    truncate_dim: int | None = None,
):
    """Load the embedding model (cached).

    Args:
        model_name: HuggingFace model identifier.
        truncate_dim: If set, truncate embeddings to this many dimensions
            (Matryoshka-style). Only effective for models that support it.
    """
    global _model, _truncate_dim

    if _model is not None:
        return _model

    from sentence_transformers import SentenceTransformer

    logger.info("Loading embedding model %s ...", model_name)
    kwargs = {}
    if truncate_dim is not None:
        kwargs["truncate_dim"] = truncate_dim
    _model = SentenceTransformer(model_name, **kwargs)
    _truncate_dim = truncate_dim
    dim = truncate_dim or _model.get_sentence_embedding_dimension()
    logger.info("Embedding model loaded (dim=%s)", dim)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate normalized embeddings for a list of texts.

    Returns:
        List of embedding vectors (unit-normalized for cosine similarity via dot product).
    """
    model = _model
    if model is None:
        raise RuntimeError("Embedding model not loaded. Call load_embedding_model() first.")

    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    # Convert to plain lists for JSON serialization
    return [emb.tolist() for emb in embeddings]


def embed_single(text: str) -> list[float]:
    """Embed a single text string."""
    return embed_texts([text])[0]
