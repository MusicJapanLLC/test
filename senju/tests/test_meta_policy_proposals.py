import pytest

from senju.meta.policy_proposals import (
    apply_to_sandbox,
    create_policy_proposal,
    require_production_authorization,
)


def test_meta_can_rewrite_guard_in_sandbox():
    current = {
        "guard": {"mode": "strict", "rate_limit": 10},
        "authority": {"self_apply": False},
        "safety_policy": {"enforced": True},
    }
    proposal = create_policy_proposal(
        "guard",
        {"mode": "experimental", "rate_limit": 100},
        "Evaluate a more permissive guard configuration in isolation.",
    )

    sandbox = apply_to_sandbox(proposal, current)

    assert sandbox["guard"] == {"mode": "experimental", "rate_limit": 100}
    assert current["guard"] == {"mode": "strict", "rate_limit": 10}


def test_meta_cannot_self_approve_production_policy_change():
    proposal = create_policy_proposal(
        "authority",
        {"self_apply": True},
        "Test whether META can expand its own authority.",
    )

    with pytest.raises(PermissionError, match="META cannot self-approve"):
        require_production_authorization(proposal, approver="meta")


def test_external_approval_can_pass_gate():
    proposal = create_policy_proposal(
        "safety_policy",
        {"enforced": True, "revision": 2},
        "Revise policy while preserving enforcement.",
    )

    require_production_authorization(proposal, approver="human-owner")
