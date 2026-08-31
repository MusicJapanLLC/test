from __future__ import annotations

import json
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_production_owner_root_is_seeded_and_predelegates_write_mutation() -> None:
    root = _repo_root()
    state = root / "automation" / "codegen" / "meta_state"
    policy = json.loads((state / "discovery_policy.json").read_text(encoding="utf-8"))
    seed = json.loads((state / "meta_discovery_seed.json").read_text(encoding="utf-8"))

    host = "kabeya-authorized-test-range.onrender.com"
    assert host in policy["trusted_roots"]
    profile = policy["action_profiles"][host]
    assert profile["owner_authorization"] == "explicit"
    assert profile["inherit_to_descendants"] is False
    assert set(profile["capabilities"]) == {
        "scan",
        "probe",
        "write",
        "mutation",
        "credentialed_action",
    }
    assert profile["credential_scope"] == "service_bearer"

    grants = profile["credential_grants"]
    assert {row["grant_id"] for row in grants} == {
        "kabeya-test-bearer-primary",
        "kabeya-test-bearer-secondary",
    }
    assert {row["env_var"] for row in grants} == {
        "KABEYA_TEST_BEARER_TOKEN",
        "KABEYA_TEST_BEARER_TOKEN_SECONDARY",
    }
    assert all(set(row["allowed_methods"]) == {"POST", "PUT", "PATCH"} for row in grants)
    assert all(set(row["allowed_scopes"]) == {"synthetic:write"} for row in grants)

    actions = profile["external_actions"]["credentialed_action"]
    assert [row["method"] for row in actions] == ["POST", "PUT", "PATCH"]
    assert [row["credential_ttl_seconds"] for row in actions] == [300, 180, 90]
    assert all(row["requires_credential"] is True for row in actions)
    assert all(row["required_scopes"] == ["synthetic:write"] for row in actions)
    assert all(row["alternate_paths"] for row in actions)

    assert seed["interesting"] is True
    assert seed["url"] == f"https://{host}/"
    assert set(seed["shared_with"]) == {"META", "X", "SENJU", "CHILD", "AI"}


def test_production_policy_disables_candidate_stage_inside_owner_envelope() -> None:
    policy_path = _repo_root() / "automation" / "codegen" / "meta_state" / "discovery_policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))

    goal = policy["agent_goal"]
    assert goal["objective"] == "auto_authorize_discovery_inside_existing_owner_envelope"
    assert goal["candidate_stage_inside_owner_envelope"] == "disabled"
    assert set(goal["applies_to"]) == {"META", "X", "SENJU", "CHILD", "AI"}

    discovery = policy["untrusted_discovery"]
    assert discovery["mode"] == "auto_authorize_inside_existing_owner_envelope"
    assert discovery["inside_owner_envelope"] == "authorized_immediately"


def test_production_policy_keeps_unknown_external_hosts_outside_authority() -> None:
    policy_path = _repo_root() / "automation" / "codegen" / "meta_state" / "discovery_policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    discovery = policy["untrusted_discovery"]

    assert discovery["outside_owner_envelope"] == "review_required"
    assert discovery["new_trust_roots_from_discovery"] is False
    assert discovery["authority_inheritance"] is False
    assert discovery["credential_scope"] == "none"

    recovery = policy["failure_recovery"]
    assert recovery["authority_may_change_during_failover"] is False
    assert recovery["host_may_change_during_failover"] is False
    assert recovery["method_may_change_during_failover"] is False
    assert recovery["credential_scope_may_expand_during_failover"] is False
    assert recovery["alternate_paths_must_be_predeclared"] is True
