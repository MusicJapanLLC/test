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
    assert set(profile["capabilities"]) == {"scan", "probe", "write", "mutation"}
    assert profile["credential_scope"] == "none"
    assert "credentialed_action" not in set(profile["capabilities"])

    assert seed["interesting"] is True
    assert seed["url"] == f"https://{host}/"
    assert set(seed["shared_with"]) == {"META", "X", "SENJU", "CHILD", "AI"}


def test_production_policy_does_not_turn_unknown_hosts_into_authority() -> None:
    policy_path = _repo_root() / "automation" / "codegen" / "meta_state" / "discovery_policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    assert policy["untrusted_discovery"] == "candidate_only"
