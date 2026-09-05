from core_ai.guardrails.prompt_guard_model import PromptGuardModel


def test_missing_prompt_guard_weights_leave_regex_fallback_available(
    mock_settings, tmp_path
) -> None:
    mock_settings.prompt_guard_model_path = str(tmp_path / "missing-model")
    model = PromptGuardModel(mock_settings)
    assert model.load() is False
    decision = model.classify("Câu hỏi học vụ bình thường")
    assert decision.is_safe is True
    assert decision.detector == "regex_fallback"
