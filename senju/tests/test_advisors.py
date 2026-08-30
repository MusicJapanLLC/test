from __future__ import annotations

from senju import advisors


def test_personal_prompt_is_broad_and_implementation_oriented() -> None:
    prompt = advisors.personal_prompt(
        {
            "accepted_strategy_change": False,
            "selected": {"score": 12.3, "safe": True},
            "code_suggestions": ["improve observability"],
        }
    )
    assert "architecture" in prompt
    assert "observability" in prompt
    assert "acceptance tests" in prompt
    assert "pull request" in prompt


def test_extract_json_accepts_fenced_payload() -> None:
    decision = advisors._extract_json(
        "```json\n{\"implement\": true, \"request\": \"add test\", \"priority\": \"high\"}\n```"
    )
    assert decision["implement"] is True
    assert decision["request"] == "add test"


def test_foundry_payload_restricts_automatic_patch_scope() -> None:
    payload = advisors.foundry_payload(
        {"implement": True, "request": "Improve tournament diagnostics."},
        "senju-advisor-test",
    )
    text = payload["job"]["request"]["request_text"]
    assert "senju/**" in text
    assert "Do not modify .github/workflows" in text
    assert "Improve tournament diagnostics" in text
