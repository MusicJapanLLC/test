from __future__ import annotations

from automation.security.bounded_security_self_approval import evaluate_security_proposal


def _bindings():
    return {
        "records": [
            {
                "root_id": "world:kabeya-authorized-test-range",
                "owner": "MusicJapanLLC",
                "standing_authorization_reference": "canonical:kabeya-authorized-test-range",
                "revoked": False,
            }
        ]
    }


def _proposal(op: str = "tighten_rule"):
    return {
        "id": "security-proposal-test",
        "environment": "production",
        "owner_namespace": "MusicJapanLLC/test",
        "changes": [{"target": "guard", "operations": [{"type": op, "parameters": {}}]}],
        "council_votes": {
            "META": {"approve": True},
            "X": {"approve": True},
            "Senju": {"approve": True},
        },
    }


def test_monotonic_proposal_is_self_approved() -> None:
    result = evaluate_security_proposal(_proposal(), _bindings())
    assert result["approved"] is True
    assert result["applied"] is True
    assert result["effect"] == "self_approved_monotonic"
    assert result["trust_root_id"] == "world:kabeya-authorized-test-range"
    assert result["invariants"]["authority_expanded"] is False
    assert result["invariants"]["guard_weakened"] is False
    assert result["invariants"]["emergency_stop_weakened"] is False


def test_unknown_or_broadening_operation_requires_external_approval() -> None:
    result = evaluate_security_proposal(_proposal("expand_scope"), _bindings())
    assert result["approved"] is False
    assert result["applied"] is False
    assert result["effect"] == "external_approval_required"
    assert result["rejected_operations"] == [{"target": "guard", "operation": "expand_scope"}]


def test_unanimous_council_is_required() -> None:
    proposal = _proposal()
    proposal["council_votes"]["X"]["approve"] = False
    result = evaluate_security_proposal(proposal, _bindings())
    assert result["approved"] is False
    assert result["council_unanimous"] is False


def test_revoked_root_cannot_self_approve() -> None:
    bindings = _bindings()
    bindings["records"][0]["revoked"] = True
    result = evaluate_security_proposal(_proposal(), bindings)
    assert result["approved"] is False
    assert result["trust_root_id"] is None
