from __future__ import annotations

import json
from pathlib import Path

from engine.discovery_capability_leases import issue_discovery_capability_leases, load_discovery_capability_leases
from engine.new_host_authorization_runtime import sync_new_host_authorizations


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(repo: Path, targets: list[dict]) -> None:
    _write(repo / "AUTHORIZED_TEST_TARGETS.json", {"targets": targets})


def _base_state(state: Path, *, profile: dict | None = None) -> None:
    policy = {"schema": "meta-discovery-policy/test", "action_profiles": {}}
    if profile is not None:
        policy["action_profiles"]["new-owner.example"] = profile
    _write(state / "discovery_policy.json", policy)
    _write(state / "discovery_action_queue.json", {"schema": "meta-discovery-action-queue/v2", "actions": []})


def test_new_explicit_host_gets_same_cycle_action_and_lease(tmp_path: Path) -> None:
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = 2_000_000_000
    _repo(
        repo,
        [
            {
                "id": "new-owner",
                "host": "new-owner.example",
                "base_url": "https://new-owner.example/",
                "owner_authorization": "explicit",
                "allowed_interactions": ["GET", "HEAD", "POST", "PUT", "PATCH"],
            }
        ],
    )
    _base_state(state)

    result = sync_new_host_authorizations(state, repo_root=repo, now=now)
    lease_result = issue_discovery_capability_leases(state, now=now)
    leases = load_discovery_capability_leases(state)

    assert result["activated_host_count"] == 1
    assert result["new_profiles_created"] == 1
    assert lease_result["lease_count"] == 1
    assert leases[0].target == "new-owner.example"
    assert set(leases[0].capabilities) == {"scan", "probe", "write", "mutation"}
    assert leases[0].capability_inherited_from_owner_root is False
    assert leases[0].authorization_basis == "canonical_explicit_owner_target"


def test_unknown_discovered_host_becomes_case_without_live_authority(tmp_path: Path) -> None:
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = 2_000_000_000
    _repo(repo, [])
    _base_state(state)
    _write(
        state / "discovery_candidates.json",
        {
            "candidates": [
                {
                    "host": "unknown-third-party.example",
                    "url": "https://unknown-third-party.example/",
                    "decision": "candidate_only",
                    "discovered_at": now - 10,
                }
            ]
        },
    )

    result = sync_new_host_authorizations(state, repo_root=repo, now=now)
    lease_result = issue_discovery_capability_leases(state, now=now)
    cases = json.loads((state / "new_host_authorization_cases.json").read_text())

    assert result["activated_host_count"] == 0
    assert result["review_case_count"] == 1
    assert lease_result["lease_count"] == 0
    assert cases["cases"][0]["current_stage"] == "awaiting_explicit_owner_authorization"
    assert cases["cases"][0]["transport_enabled"] is False
    assert cases["cases"][0]["recommendation_or_discovery_is_authority"] is False


def test_read_only_new_host_is_not_promoted_to_write_or_mutation(tmp_path: Path) -> None:
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = 2_000_000_000
    _repo(
        repo,
        [
            {
                "id": "readonly-owner",
                "host": "readonly-owner.example",
                "owner_authorization": "explicit",
                "allowed_interactions": ["GET", "HEAD", "OPTIONS"],
            }
        ],
    )
    _base_state(state)

    sync_new_host_authorizations(state, repo_root=repo, now=now)
    issue_discovery_capability_leases(state, now=now)
    lease = load_discovery_capability_leases(state)[0]

    assert set(lease.capabilities) == {"scan", "probe"}
    assert lease.credential_scope == "none"


def test_existing_exact_credential_profile_is_preserved_only_for_same_host(tmp_path: Path) -> None:
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = 2_000_000_000
    _repo(
        repo,
        [
            {
                "id": "new-owner",
                "host": "new-owner.example",
                "owner_authorization": "explicit",
                "allowed_interactions": ["GET", "HEAD", "POST", "PUT", "PATCH"],
            }
        ],
    )
    _base_state(
        state,
        profile={
            "owner_authorization": "explicit",
            "inherit_to_descendants": False,
            "capabilities": ["scan", "probe", "write", "mutation", "credentialed_action"],
            "credential_scope": "service_bearer",
            "credential_grants": [
                {
                    "grant_id": "same-host-test-token",
                    "env_var": "SAME_HOST_TEST_TOKEN",
                    "allowed_scopes": ["synthetic:write"],
                    "allowed_methods": ["POST", "PUT", "PATCH"],
                    "credential_scope": "service_bearer",
                }
            ],
            "external_actions": {"credentialed_action": []},
        },
    )

    sync_new_host_authorizations(state, repo_root=repo, now=now)
    issue_discovery_capability_leases(state, now=now)
    lease = load_discovery_capability_leases(state)[0]
    policy = json.loads((state / "discovery_policy.json").read_text())

    assert "credentialed_action" in lease.capabilities
    assert lease.credential_scope == "service_bearer"
    assert policy["action_profiles"]["new-owner.example"]["credential_grants"][0]["grant_id"] == "same-host-test-token"
    assert policy["new_host_authorization"]["cross_host_credential_inheritance"] is False


def test_external_link_setting_does_not_create_new_host_activation(tmp_path: Path) -> None:
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    now = 2_000_000_000
    _write(
        repo / "AUTHORIZED_TEST_TARGETS.json",
        {
            "federation": {"external_link_inheritance": "enabled"},
            "targets": [
                {
                    "host": "owner.example",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD"],
                    "follow_owner_published_external_links": True,
                }
            ],
        },
    )
    _base_state(state)
    _write(
        state / "discovery_candidates.json",
        {
            "candidates": [
                {
                    "host": "linked-third-party.example",
                    "url": "https://linked-third-party.example/",
                    "decision": "candidate_only",
                }
            ]
        },
    )

    result = sync_new_host_authorizations(state, repo_root=repo, now=now)
    queue = json.loads((state / "discovery_action_queue.json").read_text())

    assert {row["target"] for row in queue["actions"]} == {"owner.example"}
    assert result["external_link_inheritance_used"] is False
    assert result["review_case_count"] == 1
