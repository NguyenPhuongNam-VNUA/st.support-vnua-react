"""Optional local Prompt Guard classifier with fail-open heuristic fallback."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
import time
from typing import Any

from core_ai.config import Settings, get_settings
from core_ai.observability.metrics import record_local_model_inference, record_local_model_ready

logger = logging.getLogger("core_ai.guardrails.prompt_guard_model")


@dataclass(frozen=True)
class PromptGuardDecision:
    is_safe: bool
    score: float
    category: str
    detector: str = "llama_prompt_guard_2"


class PromptGuardModel:
    """Loads local weights only; missing optional dependencies never break chat."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model_path = Path(self.settings.prompt_guard_model_path).resolve()
        self.available = False
        self._pipeline: Any = None

    def load(self) -> bool:
        if not self.settings.local_models_enabled:
            record_local_model_ready("prompt_guard", False)
            return False
        if not self.model_path.is_dir():
            logger.warning("Prompt Guard weights not found at %s; regex fallback is active", self.model_path)
            record_local_model_ready("prompt_guard", False)
            return False
        try:
            from transformers import AutoTokenizer, pipeline

            device = -1 if self.settings.local_models_device.lower() == "cpu" else 0
            model: Any = str(self.model_path)
            backend = "transformers"
            if self.settings.local_models_backend in {"auto", "onnx"} and list(self.model_path.rglob("*.onnx")):
                try:
                    from optimum.onnxruntime import ORTModelForSequenceClassification

                    model = ORTModelForSequenceClassification.from_pretrained(
                        str(self.model_path), local_files_only=True
                    )
                    backend = "onnx_int8"
                    device = -1
                except Exception:
                    if self.settings.local_models_backend == "onnx":
                        raise
            self._pipeline = pipeline(
                "text-classification",
                model=model,
                tokenizer=AutoTokenizer.from_pretrained(str(self.model_path), local_files_only=True),
                device=device,
                local_files_only=True,
            )
            self.available = True
            self.backend = backend
            record_local_model_ready("prompt_guard", True)
            logger.info("Loaded Prompt Guard from %s using %s", self.model_path, backend)
        except Exception as exc:
            record_local_model_ready("prompt_guard", False)
            logger.warning("Prompt Guard unavailable; regex fallback is active: %s", type(exc).__name__)
        return self.available

    def classify(self, text: str) -> PromptGuardDecision:
        if not self.available or self._pipeline is None:
            return PromptGuardDecision(True, 0.0, "unavailable", "regex_fallback")
        started = time.perf_counter()
        # Scan overlapping segments so an attack near the end of a long prompt is not truncated away.
        segment_size = 1400
        overlap = 200
        segments = [
            text[start : start + segment_size]
            for start in range(0, len(text), segment_size - overlap)
        ] or [text]
        raw = self._pipeline(segments, truncation=True, max_length=512, top_k=None)
        malicious_score = 0.0
        category = "benign"
        for group in raw or []:
            rows = group if isinstance(group, list) else [group]
            for row in rows:
                label = str(row.get("label", "")).lower()
                score = float(row.get("score", 0.0))
                is_benign = "benign" in label or "safe" in label or label in {"label_0", "0"}
                if not is_benign and score > malicious_score:
                    malicious_score = score
                    category = label or "prompt_attack"
        decision = PromptGuardDecision(
            is_safe=malicious_score < self.settings.prompt_guard_threshold,
            score=malicious_score,
            category=category,
        )
        record_local_model_inference(
            "prompt_guard", "safe" if decision.is_safe else "blocked", time.perf_counter() - started
        )
        return decision
