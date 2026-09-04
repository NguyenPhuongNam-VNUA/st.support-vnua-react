"""Optional local Prompt Guard classifier with fail-open heuristic fallback."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
from typing import Any

from core_ai.config import Settings, get_settings

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
            return False
        if not self.model_path.is_dir():
            logger.warning("Prompt Guard weights not found at %s; regex fallback is active", self.model_path)
            return False
        try:
            from transformers import pipeline

            device = -1 if self.settings.local_models_device.lower() == "cpu" else 0
            self._pipeline = pipeline(
                "text-classification",
                model=str(self.model_path),
                tokenizer=str(self.model_path),
                device=device,
                local_files_only=True,
            )
            self.available = True
            logger.info("Loaded Prompt Guard from %s", self.model_path)
        except Exception as exc:
            logger.warning("Prompt Guard unavailable; regex fallback is active: %s", type(exc).__name__)
        return self.available

    def classify(self, text: str) -> PromptGuardDecision:
        if not self.available or self._pipeline is None:
            return PromptGuardDecision(True, 0.0, "unavailable", "regex_fallback")
        raw = self._pipeline(text, truncation=True, max_length=512, top_k=None)
        rows = raw[0] if raw and isinstance(raw[0], list) else raw
        malicious_score = 0.0
        category = "benign"
        for row in rows or []:
            label = str(row.get("label", "")).lower()
            score = float(row.get("score", 0.0))
            is_benign = "benign" in label or "safe" in label or label in {"label_0", "0"}
            if not is_benign and score > malicious_score:
                malicious_score = score
                category = label or "prompt_attack"
        return PromptGuardDecision(
            is_safe=malicious_score < self.settings.prompt_guard_threshold,
            score=malicious_score,
            category=category,
        )
