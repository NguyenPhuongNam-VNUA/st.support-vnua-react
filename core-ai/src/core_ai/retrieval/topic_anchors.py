"""Deterministic VNUA topic scoring with optional offline Gemini anchors."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

TOPICS: dict[str, dict[str, Any]] = {
    "tuition": {
        "keywords": ("học phí", "công nợ", "khoản thu", "đóng tiền", "miễn giảm"),
        "slots": ("học kỳ", "năm học", "ngành", "khóa", "tín chỉ"),
        "clarification": "Bạn cần tra cứu học phí của học kỳ/năm học và ngành hoặc khóa nào?",
    },
    "schedule": {
        "keywords": ("lịch học", "thời khóa biểu", "lịch thi", "phòng học", "ca học"),
        "slots": ("học kỳ", "môn", "lớp", "ngày", "tuần"),
        "clarification": "Bạn cần lịch học hay lịch thi của học kỳ, lớp hoặc môn nào?",
    },
    "regulations": {
        "keywords": (
            "quy chế",
            "quy định",
            "đăng ký học",
            "tín chỉ",
            "cảnh báo học tập",
            "tốt nghiệp",
            "bảo lưu",
            "học lại",
            "điểm",
            "phúc khảo",
        ),
        "slots": ("khóa", "năm", "học kỳ", "chương trình", "chính quy", "đại học", "hệ"),
        "clarification": "Bạn muốn hỏi quy định nào và áp dụng cho khóa hoặc chương trình nào?",
    },
    "admissions": {
        "keywords": ("tuyển sinh", "xét tuyển", "điểm chuẩn", "nhập học", "hồ sơ"),
        "slots": ("năm", "ngành", "phương thức"),
        "clarification": "Bạn cần thông tin tuyển sinh của năm, ngành hoặc phương thức nào?",
    },
    "student_support": {
        "keywords": ("hỗ trợ", "khiếu nại", "liên hệ", "xin giấy", "xác nhận"),
        "slots": ("loại", "khoa", "đơn vị"),
        "clarification": "Bạn cần hỗ trợ thủ tục nào hoặc muốn liên hệ đơn vị nào?",
    },
}


def tokenize(text: str) -> list[str]:
    return re.findall(r"[\w]+", text.lower(), flags=re.UNICODE)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    lnorm = math.sqrt(sum(a * a for a in left))
    rnorm = math.sqrt(sum(b * b for b in right))
    return dot / (lnorm * rnorm) if lnorm and rnorm else 0.0


class TopicAnchorStore:
    """Loads optional precomputed anchors; keyword scoring is always available."""

    def __init__(self, path: str | Path = "./data/topic_anchors.json") -> None:
        self.path = Path(path)
        self.anchors: dict[str, list[float]] = {}
        if self.path.is_file():
            try:
                payload = json.loads(self.path.read_text(encoding="utf-8"))
                rows = payload.get("anchors", payload)
                self.anchors = {
                    str(topic): [float(value) for value in vector]
                    for topic, vector in rows.items()
                    if topic in TOPICS and isinstance(vector, list)
                }
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                self.anchors = {}

    def score(self, query: str, embedding: list[float]) -> tuple[str | None, float, float]:
        lowered = query.lower()
        best_topic: str | None = None
        best_score = 0.0
        best_slots = 0.0
        for topic, definition in TOPICS.items():
            keywords = definition["keywords"]
            matched = sum(1 for keyword in keywords if keyword in lowered)
            keyword_score = min(1.0, matched / 2.0) if matched else 0.0
            semantic_score = max(0.0, cosine_similarity(embedding, self.anchors.get(topic, [])))
            topic_score = max(keyword_score, semantic_score)
            slots = definition["slots"]
            slot_coverage = sum(1 for slot in slots if slot in lowered) / max(1, len(slots))
            if topic_score > best_score:
                best_topic, best_score, best_slots = topic, topic_score, slot_coverage
        return best_topic, round(best_score, 4), round(best_slots, 4)
