"""BGE cross-encoder reranker backed by local weights with heuristic fallback."""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any, List

from core_ai.config import Settings, get_settings
from core_ai.retrieval.bm25 import RankedChunk
from core_ai.retrieval.reranker import EvidenceEvaluationResult, LocalReranker

logger = logging.getLogger("core_ai.retrieval.model_reranker")


class ModelReranker:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model_path = Path(self.settings.bge_reranker_model_path).resolve()
        self.available = False
        self._tokenizer: Any = None
        self._model: Any = None
        self._torch: Any = None
        self._fallback = LocalReranker(target_top_n=self.settings.retrieval_top_k)

    def load(self) -> bool:
        if not self.settings.local_models_enabled:
            return False
        if not self.model_path.is_dir():
            logger.warning("BGE weights not found at %s; heuristic/RRF fallback is active", self.model_path)
            return False
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            self._torch = torch
            self._tokenizer = AutoTokenizer.from_pretrained(str(self.model_path), local_files_only=True)
            self._model = AutoModelForSequenceClassification.from_pretrained(
                str(self.model_path), local_files_only=True
            )
            self._model.to(self.settings.local_models_device)
            self._model.eval()
            self.available = True
            logger.info("Loaded BGE reranker from %s", self.model_path)
        except Exception as exc:
            logger.warning("BGE unavailable; heuristic/RRF fallback is active: %s", type(exc).__name__)
        return self.available

    def rerank(
        self, query: str, candidates: List[RankedChunk], target_top_n: int | None = None
    ) -> EvidenceEvaluationResult:
        top_n = target_top_n or self.settings.retrieval_top_k
        if not self.available or self._model is None or self._tokenizer is None:
            result = self._fallback.rerank(query, candidates, target_top_n=top_n)
            return result.model_copy(update={"strategy": "heuristic_fallback"})
        try:
            pairs = [[query, chunk.content] for chunk in candidates]
            features = self._tokenizer(
                pairs,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            ).to(self.settings.local_models_device)
            with self._torch.no_grad():
                logits = self._model(**features).logits.view(-1).float().cpu().tolist()
            for chunk, raw_score in zip(candidates, logits):
                chunk.rerank_score = round(1.0 / (1.0 + math.exp(-float(raw_score))), 6)
            ranked = sorted(candidates, key=lambda item: item.rerank_score or 0.0, reverse=True)[:top_n]
            for index, chunk in enumerate(ranked, 1):
                chunk.rank = index
            top_score = ranked[0].rerank_score if ranked else 0.0
            weights = [1.0 / (index + 1) for index in range(len(ranked))]
            overall = (
                sum((item.rerank_score or 0.0) * weight for item, weight in zip(ranked, weights))
                / sum(weights)
                if weights
                else 0.0
            )
            return EvidenceEvaluationResult(
                snippets=ranked,
                overall_evidence_score=round(overall, 4),
                is_sufficient=bool(ranked and overall >= 0.55 and (top_score or 0.0) >= 0.50),
                top_score=top_score or 0.0,
                has_high_relevance_source=bool(top_score and top_score >= 0.70),
                strategy="bge_cross_encoder",
            )
        except Exception as exc:
            logger.warning("BGE inference failed; using heuristic fallback: %s", type(exc).__name__)
            result = self._fallback.rerank(query, candidates, target_top_n=top_n)
            return result.model_copy(update={"strategy": "heuristic_fallback"})
