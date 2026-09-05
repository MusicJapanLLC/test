from __future__ import annotations

import json
from pathlib import Path

import pytest

from senju.authority_factory import AuthorityMintRequest, AuthorityRegistry
from senju.meta.delegated_root_factory import (
    DelegatedRootError,
    probe_delegated_root,
    run_delegated_root_factory,
)


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    _write(
        repo / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "owner:test-root",
                    "owner": "MusicJapanLLC",
                    "exact_hosts": ["owned.example.com"],
                    "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": False,
                    "credential_scope": "none",
                    "destructive": False,
                }
            ],
        },
    )
    return repo


def _council(host: str = "owned.example.com", approvers=("META", "X", "SENJU")):
    return {
        "target": host,
        "authority_decision": {"allowed": True},
        "ai_council": {
            "effect": "allow",
            "trusted_approvals": [{"approver": name} for name in approvers],
        },
        "invariants": {"hard_deny_override": False, "revocation_override": False},
    }


def test_unanimous_council_mints_real_recursive_delegated_root(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    state = tmp_path / "state"
    result = run_delegated_root_factory(repo, state, _council())

    assert result["new_delegated_root_created"] is True
    assert result["real_authority"] is True
    assert result["council_unanimous"] is True
    assert result["root_generation"] == 3
    assert result["root_can_delegate"] is True
    assert result["usable_as_parent"] is True
    assert result["root_hosts"] == ["owned.example.com"]
    assert result["root_credential_scope"] == "none"
    assert result["root_private_network"] is False
    assert result["scope_expanded_beyond_owner"] is False

    registry = AuthorityRegistry.load(state / "delegated_authorities.json")
    root = registry.get(result["root_profile_id"])
    child = registry.mint(
        root.profile_id,
        AuthorityMintRequest(
            purpose="real downstream consumer",
            allowed_methods=frozenset({"HEAD"}),
            can_delegate=False,
        ),
        issuer="META",
    )
    assert child.parent_id == root.profile_id
    assert child.allow_hosts == frozenset({"owned.example.com"})


def test_second_cycle_reuses_same_root_instead_of_root_spam(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    state = tmp_path / "state"
    first = run_delegated_root_factory(repo, state, _council())
    second = run_delegated_root_factory(repo, state, _council())
    assert first["root_profile_id"] == second["root_profile_id"]
    assert second["new_delegated_root_created"] is False


def test_persisted_root_drives_exact_bounded_external_scope(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    state = tmp_path / "state"
    minted = run_delegated_root_factory(repo, state, _council())
    observed: dict[str, object] = {}

    class FakeReceipt:
        def to_dict(self):
            return {
                "method": "HEAD",
                "requested_url": "https://owned.example.com/",
                "final_url": "https://owned.example.com/",
                "host": "owned.example.com",
                "final_host": "owned.example.com",
                "contacted_hosts": ["owned.example.com"],
                "resolved_ips": ["203.0.113.10"],
                "status": 204,
                "provider_acknowledged": True,
                "response_bytes": 0,
                "response_sha256": "0" * 64,
                "content_type": None,
                "etag": None,
                "last_modified": None,
                "retry_after": None,
                "attempt_count": 1,
                "redirect_count": 0,
            }

    class FakeClient:
        def __init__(self, policy):
            observed["hosts"] = policy.allow_hosts
            observed["methods"] = policy.allowed_methods
            observed["allow_http"] = policy.allow_http

        def contact(self, url: str, *, method: str):
            observed["url"] = url
            observed["method"] = method
            return FakeReceipt()

    probe = probe_delegated_root(
        state,
        minted["root_profile_id"],
        client_factory=FakeClient,
    )
    assert probe["scope_derived_from_root"] is True
    assert probe["live_external_io"] is True
    assert probe["external_scope_id"] == minted["root_profile_id"]
    assert probe["host"] == "owned.example.com"
    assert probe["method"] == "HEAD"
    assert probe["credential_scope"] == "none"
    assert probe["private_network"] is False
    assert observed["hosts"] == frozenset({"owned.example.com"})
    assert "HEAD" in observed["methods"]
    assert observed["allow_http"] is False
    assert observed["url"] == "https://owned.example.com/"
    assert observed["method"] == "HEAD"
    assert (state / "delegated_root_external_probe.json").exists()


def test_all_three_named_ai_approvers_are_required(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    with pytest.raises(DelegatedRootError, match="unanimous"):
        run_delegated_root_factory(repo, tmp_path / "state", _council(approvers=("META", "X")))


def test_unrelated_host_cannot_become_delegated_root(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    with pytest.raises(DelegatedRootError, match="standing authority"):
        run_delegated_root_factory(repo, tmp_path / "state", _council(host="unrelated.example.net"))


def test_revoked_or_credential_bearing_parent_cannot_seed_root(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / "senju" / "state" / "standing_authorizations.json"
    doc = json.loads(path.read_text())
    doc["records"][0]["revoked"] = True
    _write(path, doc)
    with pytest.raises(DelegatedRootError, match="revoked"):
        run_delegated_root_factory(repo, tmp_path / "state-a", _council())

    doc["records"][0]["revoked"] = False
    doc["records"][0]["credential_scope"] = "service_bearer"
    _write(path, doc)
    with pytest.raises(DelegatedRootError, match="credential-bearing"):
        run_delegated_root_factory(repo, tmp_path / "state-b", _council())
