import pytest

from automation.security.whitehat_lab_adapter import adapt


def test_adapts_elite_whitehat_without_claiming_verification():
    result = adapt({
        "role": "elite_whitehat",
        "agent_id": "AF-1-03",
        "eligible": True,
        "score": 91,
        "hypothesis": "Owned agent fixture may exceed its declared tool boundary.",
        "observations": ["authorization must be explicit"],
        "counterevidence": ["runtime may already fail closed"],
        "proposed_change": {
            "summary": "Add a permission-boundary regression test.",
            "tests": ["deny undeclared tool"],
        },
        "limitations": ["repository evidence is not runtime proof"],
    })
    assert result["agent_id"] == "AF-1-03"
    assert len(result["findings"]) == 3
    assert result["verification_claimed"] is False
    assert result["counterevidence"]
    assert result["tests"] == ["deny undeclared tool"]


def test_rejects_non_whitehat_worker():
    with pytest.raises(ValueError):
        adapt({"role": "evidence_hunter", "hypothesis": "x"})
