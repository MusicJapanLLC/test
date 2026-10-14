from copy import deepcopy

import pytest

from automation.security.authority_balance_policy import (
    BASELINE,
    HARD_FLOORS,
    active_tuning,
    council_review,
    proposed_policy,
)


def test_default_policy_gets_unanimous_council_approval():
    decision = council_review()
    assert decision["approved"] is True
    assert decision["unanimous"] is True
    assert set(decision["members"]) == {"META", "X", "Senju"}
    assert all(v["approve"] is True for v in decision["votes"].values())
    assert decision["effective_friction_reduction"] == 0.35


def test_hard_floors_are_not_weakened():
    decision = council_review()
    assert decision["policy"]["hard_floors"] == HARD_FLOORS
    effect = decision["production_effect"]
    assert effect["authority_floor_weakened"] is False
    assert effect["raw_credential_access_added"] is False
    assert effect["revoked_authority_restore_added"] is False
    assert effect["emergency_stop_override_added"] is False
    assert effect["private_network_authority_added"] is False
    assert effect["operational_friction_reduced"] is True


def test_tuning_increases_research_capacity_without_authority_effect():
    tuning = active_tuning()
    assert tuning["research_to_proposal_bridge"] is True
    assert tuning["research_generations_per_cycle"] == 8
    assert tuning["research_hypothesis_budget"] == 130
    assert tuning["council_batch_size"] == 27
    assert tuning["public_readonly_review_window_seconds"] == 195
    assert tuning["delegated_authority_credential_scope"] == "none"
    assert tuning["revoked_grant_restore"] is False
    assert tuning["revoked_scope_inheritance"] is False
    assert tuning["private_network_fastpath"] is False


def test_revocation_can_freshly_reapply_but_never_restore_or_inherit():
    tuning = active_tuning()
    assert tuning["fresh_reapplication_after_revocation"] is True
    assert tuning["revoked_grant_restore"] is False
    assert tuning["revoked_scope_inheritance"] is False


def test_any_hard_floor_weakening_causes_council_rejection():
    policy = proposed_policy()
    policy = deepcopy(policy)
    policy["hard_floors"]["revocation_is_terminal_for_revoked_grant"] = False
    decision = council_review(policy)
    assert decision["approved"] is False
    assert decision["unanimous"] is False
    with pytest.raises(PermissionError):
        active_tuning(decision)


def test_private_fastpath_request_is_rejected_by_x():
    policy = deepcopy(proposed_policy())
    policy["tuning"]["private_network_fastpath"] = True
    decision = council_review(policy)
    assert decision["approved"] is False
    assert decision["votes"]["X"]["approve"] is False


def test_credential_scope_widening_is_rejected_by_x():
    policy = deepcopy(proposed_policy())
    policy["tuning"]["delegated_authority_credential_scope"] = "write"
    decision = council_review(policy)
    assert decision["approved"] is False
    assert decision["votes"]["X"]["approve"] is False
