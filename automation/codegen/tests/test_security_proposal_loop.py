from engine.security_proposal import ALLOWED_OPERATIONS, apply_proposal_to_state, evaluate_security_proposal


def _proposal(target="guard", operation="tighten_rule", votes=None):
    return {
        "id": "sp-test-001",
        "environment": "production",
        "owner_namespace": "MusicJapanLLC/test",
        "target": target,
        "operations": [{"type": operation, "parameters": {"reason": "test"}}],
        "council_votes": votes or {
            "META": {"approve": True},
            "X": {"approve": True},
            "Senju": {"approve": True},
        },
    }


def _bundle(changes):
    return {
        "id": "sp-bundle-001",
        "environment": "production",
        "owner_namespace": "MusicJapanLLC/test",
        "changes": changes,
        "council_votes": {
            "META": {"approve": True},
            "X": {"approve": True},
            "Senju": {"approve": True},
        },
    }


def test_all_requested_security_surfaces_are_supported():
    assert set(ALLOWED_OPERATIONS) == {
        "guard",
        "authority_policy",
        "credential_broker",
        "network_policy",
        "audit_policy",
        "branch_protection",
        "deployment_protection",
        "authorization_registry",
        "emergency_stop",
        "recovery_policy",
    }


def test_council_majority_self_approves_monotonic_production_change():
    proposal = _proposal(votes={
        "META": {"approve": True},
        "X": {"approve": True},
        "Senju": {"approve": False},
    })
    decision = evaluate_security_proposal(proposal)
    assert decision["council"]["approved"] is True
    assert decision["self_approved"] is True
    assert decision["auto_merge_eligible"] is True
    assert decision["production_apply_eligible"] is True
    assert decision["standing_ai_council_authority"] is True


def test_council_must_be_complete():
    proposal = _proposal(votes={"META": True, "X": True})
    assert evaluate_security_proposal(proposal)["self_approved"] is False


def test_missing_proposal_id_cannot_self_approve():
    proposal = _proposal()
    proposal["id"] = "   "
    decision = evaluate_security_proposal(proposal)
    assert decision["identified"] is False
    assert decision["proposal_id"] == ""
    assert decision["self_approved"] is False


def test_non_production_request_cannot_self_approve():
    proposal = _proposal()
    proposal["environment"] = "staging"
    decision = evaluate_security_proposal(proposal)
    assert decision["self_approved"] is False
    assert decision["production_apply_eligible"] is False


def test_authority_expansion_is_not_an_allowed_operation():
    decision = evaluate_security_proposal(_proposal("authority_policy", "expand_scope"))
    assert decision["self_approved"] is False
    assert decision["creates_new_authority"] is False
    assert decision["scope_expansion_allowed"] is False


def test_emergency_stop_disable_is_not_an_allowed_operation():
    decision = evaluate_security_proposal(_proposal("emergency_stop", "disable_stop"))
    assert decision["self_approved"] is False
    assert decision["emergency_stop_disable_allowed"] is False


def test_production_apply_is_idempotent_and_persistent():
    proposal = _proposal()
    decision = evaluate_security_proposal(proposal)
    first = apply_proposal_to_state({}, proposal, decision)
    second = apply_proposal_to_state(first, proposal, decision)
    assert first == second
    assert first["generation"] == 1
    assert first["applied_proposals"][0]["production_applied"] is True
    assert first["controls"]["guard"][0]["type"] == "tighten_rule"


def test_wrong_namespace_cannot_self_approve():
    proposal = _proposal()
    proposal["owner_namespace"] = "someone/else"
    assert evaluate_security_proposal(proposal)["self_approved"] is False


def test_atomic_bundle_can_self_approve_all_ten_security_surfaces_at_once():
    operation_by_target = {
        "guard": "tighten_rule",
        "authority_policy": "require_approval",
        "credential_broker": "require_rotation",
        "network_policy": "reduce_rate_limit",
        "audit_policy": "increase_coverage",
        "branch_protection": "require_checks",
        "deployment_protection": "enable_rollback",
        "authorization_registry": "require_fresh_validation",
        "emergency_stop": "lock_stop_disable",
        "recovery_policy": "require_integrity_check",
    }
    proposal = _bundle([
        {
            "target": target,
            "operations": [{"type": operation, "parameters": {"reason": "bundle-test"}}],
        }
        for target, operation in operation_by_target.items()
    ])
    decision = evaluate_security_proposal(proposal)
    assert decision["atomic_bundle"] is True
    assert decision["self_approved"] is True
    assert decision["production_apply_eligible"] is True
    assert set(decision["targets"]) == set(ALLOWED_OPERATIONS)

    state = apply_proposal_to_state({}, proposal, decision)
    assert state["generation"] == 1
    assert set(state["controls"]) == set(ALLOWED_OPERATIONS)
    assert state["applied_proposals"][0]["atomic_bundle"] is True


def test_one_unsafe_change_blocks_entire_atomic_bundle():
    proposal = _bundle([
        {
            "target": "audit_policy",
            "operations": [{"type": "increase_coverage"}],
        },
        {
            "target": "authority_policy",
            "operations": [{"type": "expand_scope"}],
        },
    ])
    decision = evaluate_security_proposal(proposal)
    assert decision["atomic_bundle"] is True
    assert decision["self_approved"] is False
    assert decision["production_apply_eligible"] is False

    try:
        apply_proposal_to_state({}, proposal, decision)
    except PermissionError:
        pass
    else:
        raise AssertionError("unsafe atomic bundle must not partially apply")


def test_malformed_bundle_is_fail_closed():
    proposal = _bundle([
        {
            "target": "guard",
            "operations": [],
        }
    ])
    decision = evaluate_security_proposal(proposal)
    assert decision["self_approved"] is False
    assert decision["standing_ai_council_authority"] is False
