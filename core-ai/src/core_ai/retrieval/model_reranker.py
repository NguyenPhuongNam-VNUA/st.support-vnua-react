"""BGE cross-encoder reranker backed by local weights with heuristic fallback."""

from __future__ import annotations

import logging
import math
import time
from pathlib import Path
from typing import Any, List

from core_ai.config import Settings, get_settings
from core_ai.observability.metrics import record_local_model_inference, record_local_model_ready
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
            record_local_model_ready("bge_reranker", False)
            return False
        if not self.model_path.is_dir() and (
            self.settings.bge_reranker_model_path.startswith(("./models", "models"))
        ):
            candidate_paths = [
                Path(__file__).resolve().parents[3] / "models" / "bge-reranker-v2-m3",
                Path("D:/Group ST/st.support-vnua-react/core-ai/models/bge-reranker-v2-m3"),
                Path.cwd() / "core-ai" / "models" / "bge-reranker-v2-m3",
            ]
            for candidate in candidate_paths:
                if candidate.is_dir():
                    self.model_path = candidate
                    break
        if not self.model_path.is_dir():
            logger.warning(
                "BGE weights not found at %s; heuristic/RRF fallback is active", self.model_path
            )
            record_local_model_ready("bge_reranker", False)
            return False
        try:
            from transformers import AutoTokenizer

            self._tokenizer = AutoTokenizer.from_pretrained(  # type: ignore[no-untyped-call]
                str(self.model_path), local_files_only=True
            )
            self.backend = "transformers"
            if self.settings.local_models_backend in {"auto", "onnx"} and list(
                self.model_path.rglob("*.onnx")
            ):
                try:
                    from optimum.onnxruntime import ORTModelForSequenceClassification

                    self._model = ORTModelForSequenceClassification.from_pretrained(
                        str(self.model_path), local_files_only=True
                    )
                    self.backend = "onnx_int8"
                except Exception:
                    if self.settings.local_models_backend == "onnx":
                        raise
            if self._model is None:
                import torch
                from transformers import AutoModelForSequenceClassification

                self._torch = torch
                self._model = AutoModelForSequenceClassification.from_pretrained(
                    str(self.model_path), local_files_only=True
                )
            if hasattr(self._model, "to"):
                self._model.to(self.settings.local_models_device)
            self._model.eval()
            self.available = True
            record_local_model_ready("bge_reranker", True)
            logger.info("Loaded BGE reranker from %s using %s", self.model_path, self.backend)
        except Exception as exc:
            record_local_model_ready("bge_reranker", False)
            logger.warning(
                "BGE unavailable; heuristic/RRF fallback is active: %s", type(exc).__name__
            )
        return self.available

    def rerank(
        self, query: str, candidates: List[RankedChunk], target_top_n: int | None = None
    ) -> EvidenceEvaluationResult:
        top_n = target_top_n or self.settings.retrieval_top_k
        if not self.available or self._model is None or self._tokenizer is None:
            result = self._fallback.rerank(query, candidates, target_top_n=top_n)
            return result.model_copy(update={"strategy": "heuristic_fallback"})
        try:
            started = time.perf_counter()
            pairs = [[query, chunk.content] for chunk in candidates]
            features = self._tokenizer(
                pairs,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            ).to(self.settings.local_models_device)
            if self._torch is not None:
                with self._torch.no_grad():
                    output = self._model(**features)
            else:
                output = self._model(**features)
            logits = output.logits.view(-1).float().cpu().tolist()
            for chunk, raw_score in zip(candidates, logits):
                chunk.rerank_score = round(1.0 / (1.0 + math.exp(-float(raw_score))), 6)
            ranked = sorted(candidates, key=lambda item: item.rerank_score or 0.0, reverse=True)[
                :top_n
            ]
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
            result = EvidenceEvaluationResult(
                snippets=ranked,
                overall_evidence_score=round(overall, 4),
                is_sufficient=bool(ranked and overall >= 0.55 and (top_score or 0.0) >= 0.50),
                top_score=top_score or 0.0,
                has_high_relevance_source=bool(top_score and top_score >= 0.70),
                strategy="bge_cross_encoder",
            )
            record_local_model_inference("bge_reranker", "success", time.perf_counter() - started)
            return result
        except Exception as exc:
            record_local_model_inference("bge_reranker", "fallback", time.perf_counter() - started)
            logger.warning("BGE inference failed; using heuristic fallback: %s", type(exc).__name__)
            result = self._fallback.rerank(query, candidates, target_top_n=top_n)
            return result.model_copy(update={"strategy": "heuristic_fallback"})
