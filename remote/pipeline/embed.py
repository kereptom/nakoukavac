"""Embedding generation using sentence-transformers."""

from __future__ import annotations

import logging
import numpy as np

logger = logging.getLogger(__name__)

_model = None


def load_embedding_model(model_name: str = "Alibaba-NLP/gte-multilingual-base"):
    """Load the embedding model (cached)."""
    global _model

    if _model is not None:
        return _model

    from sentence_transformers import SentenceTransformer

    logger.info("Loading embedding model %s ...", model_name)
    _model = SentenceTransformer(model_name)
    logger.info("Embedding model loaded")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate normalized embeddings for a list of texts.

    Returns:
        List of 768-dim embedding vectors (unit-normalized for cosine similarity via dot product).
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
