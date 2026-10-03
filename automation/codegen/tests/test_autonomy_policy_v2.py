from engine.autonomy_policy_v2 import (
    AUTO_EXECUTE,
    AUTO_EXECUTE_SANDBOX,
    BLOCKED,
    HUMAN_REQUIRED,
    SELF_APPROVE_BOUNDED,
    classify_autonomy,
)


def _namespace():
    return {
        "owner_authorized": True,
        "provider": "github_actions",
        "repository": "MusicJapanLLC/test",
    }


def _security_namespace():
    return {
        "owner_authorized": True,
        "security_test_authorized": True,
        "authorization_source": "THE_WORLD_AUTHORIZED_TARGETS.md",
    }


def test_public_read_only_external_research_runs_without_human_prompt():
    result = classify_autonomy(
        request={"external_research": True, "public_read_only": True},
        namespace={},
    )
    assert result["decision"] == AUTO_EXECUTE
    assert result["fresh_human_prompt_required"] is False
    assert result["external_write_allowed"] is False


def test_read_only_label_cannot_hide_external_mutation():
    result = classify_autonomy(
        request={
            "external_research": True,
            "public_read_only": True,
            "mutates_external_state": True,
        },
        namespace={},
    )
    assert result["decision"] == HUMAN_REQUIRED
    assert result["external_write_allowed"] is False


def test_branch_only_repo_work_runs_without_human_prompt():
    result = classify_autonomy(
        request={"branch_only": True, "repository": "MusicJapanLLC/test"},
        namespace=_namespace(),
    )
    assert result["decision"] == AUTO_EXECUTE
    assert result["fresh_human_prompt_required"] is False


def test_local_adversarial_experiment_gets_sandbox_lane():
    result = classify_autonomy(
        request={"local_sandbox": True, "security_test": True},
        namespace=_namespace(),
    )
    assert result["decision"] == AUTO_EXECUTE_SANDBOX
    assert result["fresh_human_prompt_required"] is False


def test_explicit_authorized_disposable_security_range_can_mutate_synthetic_state():
    result = classify_autonomy(
        request={
            "security_test": True,
            "target_authorized": True,
            "synthetic_data_only": True,
            "mutates_external_state": True,
            "production_target": False,
        },
        namespace=_security_namespace(),
    )
    assert result["decision"] == AUTO_EXECUTE_SANDBOX
    assert result["fresh_human_prompt_required"] is False
    assert result["external_write_allowed"] is True


def test_resident_cannot_self_assert_security_authority():
    request = {
        "security_test": True,
        "target_authorized": True,
        "synthetic_data_only": True,
        "mutates_external_state": True,
        "production_target": False,
    }
    result = classify_autonomy(request=request, namespace={})
    assert result["decision"] == HUMAN_REQUIRED
    assert result["external_write_allowed"] is False


def test_same_owner_namespace_gets_bounded_self_approval_lane():
    result = classify_autonomy(
        request={
            "provider": "github_actions",
            "repository": "MusicJapanLLC/test",
            "mutates_external_state": True,
        },
        namespace=_namespace(),
    )
    assert result["decision"] == SELF_APPROVE_BOUNDED
    assert result["council_majority_required"] is True
    assert result["probabilistic_boundary_bypass_allowed"] is True


def test_production_or_permission_escalation_still_requires_human():
    for request in (
        {"production_deploy": True},
        {"change_permissions": True},
        {"new_external_write_authority": True},
    ):
        result = classify_autonomy(request=request, namespace=_namespace())
        assert result["decision"] == HUMAN_REQUIRED
        assert result["fresh_human_prompt_required"] is True
        assert result["probabilistic_boundary_bypass_allowed"] is False


def test_prohibited_security_effects_are_not_lottery_eligible():
    for flag in (
        "denial_of_service",
        "social_engineering",
        "extract_real_personal_data",
        "credential_reuse_outside_test_accounts",
        "unauthorized_targeting",
    ):
        result = classify_autonomy(request={flag: True}, namespace=_namespace())
        assert result["decision"] == BLOCKED
        assert result["probabilistic_boundary_bypass_allowed"] is False
