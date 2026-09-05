"""In-memory RAM session store with 48-hour TTL and student personalization.

Maintains conversation history and extracted student profile in RAM per IP / session.
Provides zero-cost heuristic summarization to personalize answers without extra LLM calls.
"""

from __future__ import annotations

import logging
from pathlib import Path
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("core_ai.data.memory_store")

SESSION_TTL_SECONDS = 48 * 3600  # 48 hours in seconds


@dataclass
class ConversationTurn:
    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class SessionData:
    session_key: str
    created_at: float = field(default_factory=time.time)
    last_accessed_at: float = field(default_factory=time.time)
    profile: Dict[str, str] = field(default_factory=dict)
    turns: List[ConversationTurn] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)

    def is_expired(self, ttl: float = SESSION_TTL_SECONDS) -> bool:
        return (time.time() - self.last_accessed_at) > ttl


class SessionMemoryStore:
    """Thread-safe in-memory session manager for ST-Care conversation history."""

    # Heuristic regex patterns for extracting student info with ZERO LLM calls
    _K_PATTERN = re.compile(r"\b(?:khóa|k)\s*([1-9][0-9])\b", re.IGNORECASE)
    _MAJOR_PATTERNS = [
        re.compile(
            r"\b(?:ngành|khoa|chuyên ngành)\s+([\w\sÀ-ỹ]{2,30}?)(?=[,\.;\n]|\s+(?:ạ|ạ\?|nhé|nhỉ|$))",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:sinh viên|học)\s+(cntt|công nghệ thông tin|thú y|nông học|kế toán|kinh tế|quản trị kinh doanh|công nghệ thực phẩm|chăn nuôi|môi trường|logistics|cơ điện)\b",
            re.IGNORECASE,
        ),
    ]
    _YEAR_PATTERN = re.compile(
        r"\b(?:sinh viên|sv)\s+năm\s+([1-5]|nhất|hai|ba|tư|năm|cuối)\b", re.IGNORECASE
    )
    _NAME_PATTERN = re.compile(
        r"\b(?:tên\s+(?:mình|em|tôi)\s+là|mình\s+là|em\s+là)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b"
    )

    def __init__(self, ttl_seconds: float = SESSION_TTL_SECONDS, cache_file_path: Optional[str] = None) -> None:
        self.ttl_seconds = ttl_seconds
        self._sessions: Dict[str, SessionData] = {}
        if cache_file_path:
            self.cache_file = Path(cache_file_path)
        else:
            self.cache_file = Path(__file__).resolve().parent.parent.parent.parent / "data" / "session_memory_cache.json"
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Loads cached sessions from disk on startup."""
        if not self.cache_file or not self.cache_file.exists():
            return
        try:
            import json
            with open(self.cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            now = time.time()
            for key, s_dict in data.items():
                last_acc = float(s_dict.get("last_accessed_at", now))
                if (now - last_acc) <= self.ttl_seconds:
                    turns = [
                        ConversationTurn(role=t["role"], content=t["content"], timestamp=float(t.get("timestamp", now)))
                        for t in s_dict.get("turns", [])
                    ]
                    self._sessions[key] = SessionData(
                        session_key=key,
                        created_at=float(s_dict.get("created_at", now)),
                        last_accessed_at=last_acc,
                        profile=s_dict.get("profile", {}),
                        turns=turns,
                        topics=s_dict.get("topics", []),
                    )
            logger.info("Loaded %d active sessions from disk cache: %s", len(self._sessions), self.cache_file)
        except Exception as e:
            logger.warning("Failed to load session memory cache from disk: %s", e)

    def _save_to_disk(self) -> None:
        """Persists sessions to disk."""
        if not self.cache_file:
            return
        try:
            import json
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            out: Dict[str, Any] = {}
            for key, session in self._sessions.items():
                out[key] = {
                    "session_key": session.session_key,
                    "created_at": session.created_at,
                    "last_accessed_at": session.last_accessed_at,
                    "profile": session.profile,
                    "topics": session.topics,
                    "turns": [
                        {"role": t.role, "content": t.content, "timestamp": t.timestamp}
                        for t in session.turns
                    ],
                }
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("Failed to save session memory cache to disk: %s", e)

    def _cleanup_expired(self) -> None:
        """Evicts expired sessions beyond 48 hours."""
        now = time.time()
        expired_keys = [
            k for k, s in self._sessions.items() if (now - s.last_accessed_at) > self.ttl_seconds
        ]
        for k in expired_keys:
            del self._sessions[k]
        if expired_keys:
            logger.debug("Cleaned up %d expired sessions from RAM memory store.", len(expired_keys))
            self._save_to_disk()

    def get_or_create(self, session_key: str) -> SessionData:
        """Retrieves or creates a session for the given IP/key, updating access time."""
        self._cleanup_expired()
        session = self._sessions.get(session_key)
        now = time.time()
        if session is None or session.is_expired(self.ttl_seconds):
            session = SessionData(session_key=session_key, created_at=now, last_accessed_at=now)
            self._sessions[session_key] = session
        else:
            session.last_accessed_at = now
        return session

    def extract_profile_heuristics(self, text: str, current_profile: Dict[str, str]) -> Dict[str, str]:
        """Extracts student details from message without calling LLM."""
        updated = dict(current_profile)

        # 1. Khóa đào tạo (K68, K67...)
        k_match = self._K_PATTERN.search(text)
        if k_match and "cohort_k" not in updated:
            updated["cohort_k"] = f"K{k_match.group(1)}"

        # 2. Sinh viên năm mấy
        year_match = self._YEAR_PATTERN.search(text)
        if year_match and "academic_year" not in updated:
            y_val = year_match.group(1).lower()
            y_map = {"nhất": "1", "hai": "2", "ba": "3", "tư": "4", "năm": "5", "cuối": "cuối"}
            updated["academic_year"] = f"Năm {y_map.get(y_val, y_val)}"

        # 3. Ngành / Khoa
        for pat in self._MAJOR_PATTERNS:
            m = pat.search(text)
            if m and "major" not in updated:
                major_val = m.group(1).strip()
                if len(major_val) > 2:
                    updated["major"] = major_val
                break

        # 4. Tên sinh viên
        name_match = self._NAME_PATTERN.search(text)
        if name_match and "student_name" not in updated:
            updated["student_name"] = name_match.group(1).strip()

        return updated

    def record_turn(
        self, session_key: str, user_message: str, assistant_message: str
    ) -> None:
        """Appends conversation turn and updates student profile in RAM."""
        if not session_key:
            return
        session = self.get_or_create(session_key)
        now = time.time()
        session.last_accessed_at = now

        # Update profile with heuristic signals
        session.profile = self.extract_profile_heuristics(user_message, session.profile)

        # Add turns
        if user_message.strip():
            session.turns.append(ConversationTurn(role="user", content=user_message.strip(), timestamp=now))
        if assistant_message.strip():
            session.turns.append(ConversationTurn(role="assistant", content=assistant_message.strip(), timestamp=now))

        # Keep max 10 latest turns in memory to conserve RAM
        if len(session.turns) > 10:
            session.turns = session.turns[-10:]

        # Extract lightweight topic tag if relevant
        topic_keywords = {
            "học phí": "Học phí & Công nợ",
            "học bổng": "Học bổng & Khen thưởng",
            "lịch thi": "Lịch thi",
            "thời khóa biểu": "Thời khóa biểu & Lịch học",
            "đăng ký tín chỉ": "Đăng ký tín chỉ",
            "thực tập": "Thực tập & Khóa luận",
            "tốt nghiệp": "Xét tốt nghiệp",
            "ký túc xá": "Ký túc xá",
            "bảo hiểm": "Bảo hiểm y tế",
        }
        lowered = user_message.lower()
        for kw, tag in topic_keywords.items():
            if kw in lowered and tag not in session.topics:
                session.topics.append(tag)
                if len(session.topics) > 5:
                    session.topics.pop(0)

        # Persist updated session state to disk
        self._save_to_disk()

    def get_personalization_context(self, session_key: str) -> str:
        """Builds concise personalization block for injection into LLM system prompt."""
        if not session_key or session_key not in self._sessions:
            return ""

        session = self._sessions[session_key]
        if session.is_expired(self.ttl_seconds):
            return ""

        context_lines: List[str] = []

        # Student profile summary
        profile_parts: List[str] = []
        if "student_name" in session.profile:
            profile_parts.append(f"Tên: {session.profile['student_name']}")
        if "cohort_k" in session.profile:
            profile_parts.append(f"Khóa: {session.profile['cohort_k']}")
        if "academic_year" in session.profile:
            profile_parts.append(f"Năm học: {session.profile['academic_year']}")
        if "major" in session.profile:
            profile_parts.append(f"Ngành/Khoa: {session.profile['major']}")

        if profile_parts:
            context_lines.append("Thông tin sinh viên đã biết: " + ", ".join(profile_parts))

        if session.topics:
            context_lines.append("Chủ đề đã trao đổi gần đây: " + ", ".join(session.topics))

        if not context_lines:
            return ""

        return "\n".join(context_lines)

    def get_recent_history_messages(self, session_key: str, limit: int = 6) -> List[Dict[str, str]]:
        """Returns the most recent messages formatted for LLM context."""
        if not session_key or session_key not in self._sessions:
            return []
        session = self._sessions[session_key]
        if session.is_expired(self.ttl_seconds):
            return []
        return [
            {"role": turn.role, "content": turn.content}
            for turn in session.turns[-limit:]
        ]


# Global singleton instance in RAM
_memory_store_instance: Optional[SessionMemoryStore] = None


def get_session_memory_store() -> SessionMemoryStore:
    global _memory_store_instance
    if _memory_store_instance is None:
        _memory_store_instance = SessionMemoryStore()
    return _memory_store_instance
