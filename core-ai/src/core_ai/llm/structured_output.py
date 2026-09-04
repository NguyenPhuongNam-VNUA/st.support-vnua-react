"""Local structured output validation and JSON repair engine for ST-Care Core AI.

CRITICAL INSTRUCTION:
This engine performs 100% local, deterministic regex and heuristic repairs on
malformed LLM outputs. NEVER make an extra LLM call to fix JSON!
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel, ValidationError

from core_ai.contracts.errors import MalformedOutputError

logger = logging.getLogger("core_ai.llm.structured_output")


def extract_candidate_json(text: str) -> str:
    """Extract candidate JSON substring from raw model output.

    Handles markdown fences (```json ... ``` or ``` ... ```) and leading/trailing text.
    """
    if not text or not text.strip():
        return ""

    cleaned = text.strip()

    # 1. Check for markdown code fences with json tag
    fence_json_match = re.search(r"```(?:json|JSON)\s*([\s\S]*?)\s*```", cleaned)
    if fence_json_match:
        extracted = fence_json_match.group(1).strip()
        if extracted:
            return extracted

    # 2. Check for generic markdown code fences
    fence_generic_match = re.search(r"```\s*([\s\S]*?)\s*```", cleaned)
    if fence_generic_match:
        candidate = fence_generic_match.group(1).strip()
        # Ensure it looks like JSON before adopting
        if (candidate.startswith("{") and candidate.endswith("}")) or (
            candidate.startswith("[") and candidate.endswith("]")
        ):
            return candidate

    # 3. Search for outermost JSON object {...}
    start_brace = cleaned.find("{")
    end_brace = cleaned.rfind("}")
    if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
        # Also check if there's an array that starts earlier
        start_bracket = cleaned.find("[")
        end_bracket = cleaned.rfind("]")
        if (
            start_bracket != -1
            and end_bracket != -1
            and end_bracket > start_bracket
            and start_bracket < start_brace
            and end_bracket > end_brace
        ):
            return cleaned[start_bracket : end_bracket + 1].strip()
        return cleaned[start_brace : end_brace + 1].strip()

    # 4. Search for outermost JSON array [...]
    start_bracket = cleaned.find("[")
    end_bracket = cleaned.rfind("]")
    if start_bracket != -1 and end_bracket != -1 and end_bracket > start_bracket:
        return cleaned[start_bracket : end_bracket + 1].strip()

    # Fallback to stripped text
    return cleaned


def balance_json_brackets(text: str) -> str:
    """Balances unclosed quotes, brackets, and braces resulting from token truncation."""
    stack: List[str] = []
    in_string = False
    escape_next = False

    for char in text:
        if escape_next:
            escape_next = False
            continue

        if char == "\\":
            escape_next = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char in "{[":
            stack.append(char)
        elif char == "}":
            if stack and stack[-1] == "{":
                stack.pop()
        elif char == "]":
            if stack and stack[-1] == "[":
                stack.pop()

    repaired = text
    # If terminated inside an open string, close it
    if in_string:
        repaired += '"'

    # Close any remaining unclosed brackets in LIFO order
    while stack:
        open_bracket = stack.pop()
        if open_bracket == "{":
            repaired += "}"
        elif open_bracket == "[":
            repaired += "]"

    return repaired


def repair_json_string(text: str) -> str:
    """Locally repairs common LLM JSON syntax deviations without calling external models.

    Fixes:
    - Python literals (True -> true, False -> false, None -> null)
    - Trailing commas before closing brackets
    - Single quotes around keys and values
    - Control characters
    - Unclosed braces/brackets due to generation cut-off
    """
    if not text:
        return "{}"

    candidate = text.strip()

    # 1. Clean control characters except tab, newline, carriage return
    candidate = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", candidate)

    # 2. Replace Python literals with valid JSON tokens (outside quoted strings)
    candidate = re.sub(r"\bTrue\b", "true", candidate)
    candidate = re.sub(r"\bFalse\b", "false", candidate)
    candidate = re.sub(r"\bNone\b", "null", candidate)

    # 3. Fix unquoted keys: e.g. {key: "value"} -> {"key": "value"}
    candidate = re.sub(r'([{\s,])([a-zA-Z_][a-zA-Z0-9_-]*)\s*:', r'\1"\2":', candidate)

    # 4. Fix single-quoted keys and string values
    # Replace single quotes around keys: {'key': ...} -> {"key": ...}
    candidate = re.sub(r"{\s*'([^']+)'\s*:", r'{"\1":', candidate)
    candidate = re.sub(r",\s*'([^']+)'\s*:", r',"\1":', candidate)

    # Replace single quotes around string values: : 'value' -> : "value"
    # Matches : '...' followed by comma, closing brace, bracket, or whitespace
    candidate = re.sub(r":\s*'([^']*)'(\s*[,}\]])", r': "\1"\2', candidate)

    # 5. Remove trailing commas before closing braces/brackets
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    # 6. Balance brackets in case of truncated output
    candidate = balance_json_brackets(candidate)

    # 7. Remove any trailing comma that may have emerged after balance
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    return candidate


def parse_and_repair_json(raw_text: str) -> Dict[str, Any]:
    """Parses JSON from raw model output, applying deterministic local repairs if needed.

    Guarantees:
    - Zero external AI calls.
    - Raises MalformedOutputError if all local repair attempts fail.

    Returns:
        Parsed dictionary. If output parsed as a list, wraps in {"items": list}.
    """
    if not raw_text or not raw_text.strip():
        raise MalformedOutputError(
            message="Đầu ra từ mô hình AI rỗng, không thể trích xuất JSON",
            details={"raw_output": raw_text},
        )

    # Attempt 1: Direct JSON parsing
    try:
        data = json.loads(raw_text.strip())
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            return {"items": data}
    except Exception:
        pass

    # Attempt 2: Extract candidate substring
    candidate = extract_candidate_json(raw_text)
    try:
        data = json.loads(candidate)
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            return {"items": data}
    except Exception:
        pass

    # Attempt 3: Apply deterministic local repair
    repaired = repair_json_string(candidate)
    try:
        data = json.loads(repaired)
        if isinstance(data, dict):
            logger.info("Successfully repaired malformed JSON locally without external call")
            return data
        if isinstance(data, list):
            return {"items": data}
    except Exception:
        pass

    # Attempt 4: Aggressive truncation repair
    # Find last valid comma or colon and try to close cleanly
    for truncate_idx in range(len(repaired) - 1, max(0, len(repaired) - 200), -1):
        if repaired[truncate_idx] in ",;":
            trimmed = repaired[:truncate_idx]
            closed = balance_json_brackets(trimmed)
            try:
                data = json.loads(closed)
                if isinstance(data, dict):
                    logger.warning("Repaired severely truncated JSON locally via boundary truncation")
                    return data
            except Exception:
                continue

    # All local repairs exhausted -> raise standardized CoreAI domain error
    logger.error("Failed to parse and repair JSON output locally. Raw snippet: %s", raw_text[:200])
    raise MalformedOutputError(
        message="Đầu ra từ mô hình không đúng định dạng JSON và không thể sửa chữa cục bộ",
        details={
            "raw_output_snippet": raw_text[:500],
            "extracted_candidate": candidate[:500],
            "attempted_repair": repaired[:500] if "repaired" in locals() else "",
        },
    )


def validate_structured_output(
    data: Any,
    schema_or_model: Optional[Union[Type[BaseModel], Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Validates parsed dictionary against a Pydantic model class or JSON Schema specification.

    Raises:
        MalformedOutputError: If data fails validation constraints.
    """
    if not isinstance(data, dict):
        raise MalformedOutputError(
            message="Dữ liệu đầu ra cấu trúc bắt buộc phải là đối tượng dictionary",
            details={"type": type(data).__name__},
        )

    if schema_or_model is None:
        return data

    # 1. Pydantic Model validation
    if isinstance(schema_or_model, type) and issubclass(schema_or_model, BaseModel):
        try:
            validated_obj = schema_or_model.model_validate(data)
            return validated_obj.model_dump()
        except ValidationError as val_err:
            logger.warning("Pydantic validation failed for model %s: %s", schema_or_model.__name__, val_err)
            raise MalformedOutputError(
                message=f"Dữ liệu không khớp schema Pydantic '{schema_or_model.__name__}'",
                details={"errors": val_err.errors()},
            ) from val_err

    # 2. JSON Schema dictionary validation
    if isinstance(schema_or_model, dict):
        required_fields = schema_or_model.get("required", [])
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            raise MalformedOutputError(
                message=f"Dữ liệu thiếu các trường bắt buộc trong schema: {', '.join(missing_fields)}",
                details={"missing_fields": missing_fields, "provided_keys": list(data.keys())},
            )

    return data
