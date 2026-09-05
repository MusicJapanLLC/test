from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass

from senju.authority_factory import AuthorityRegistry
from senju.meta.cooperative_authority_loop import run_cycle


POLICY = {
    "actions": {"github_issue_own_repo": "AUTO_ALLOWLIST"},
    "allowlists": {
        "github_repositories": ["MusicJapanLLC/test"],
        "external_write_target_ids": ["github-issues"],
    },
}


def events(*urls: str) -> dict:
    return {
        "findings": [
            {
                "url": url,
                "title": f"Finding {i}",
                "note": "bounded cooperative loop test",
                "citizen_id": "test-citizen",
            }
            for i, url in enumerate(urls, 1)
        ]
    }


@dataclass
class FakeReceipt:
    status: int

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "host": "api.github.com",
            "final_host": "api.github.com",
            "contacted_hosts": ["api.github.com"],
            "provider_acknowledged": 200 <= self.status < 300,
        }


@dataclass
class FakeResult:
    receipt: FakeReceipt
    body: bytes


class FakeClient:
    calls: list[dict] = []
    statuses: list[int] = []

    def __init__(self, policy) -> None:  # noqa: ANN001
        self.policy = policy

    def contact_with_body(self, url: str, *, method: str, body: bytes, headers: dict) -> FakeResult:
        type(self).calls.append(
            {
                "url": url,
                "method": method,
                "body": json.loads(body.decode("utf-8")),
                "authorization_present": bool(headers.get("Authorization")),
                "hosts": sorted(self.policy.allow_hosts),
                "methods": sorted(self.policy.allowed_methods),
            }
        )
        status = type(self).statuses.pop(0) if type(self).statuses else 201
        payload = {"number": len(type(self).calls), "html_url": f"https://github.com/MusicJapanLLC/test/issues/{len(type(self).calls)}"}
        return FakeResult(FakeReceipt(status), json.dumps(payload).encode("utf-8"))


def _env() -> dict[str, str]:
    return {"GITHUB_TOKEN": "test-secret-never-persist", "GITHUB_REPOSITORY": "MusicJapanLLC/test"}


def _now(day: int = 1, hour: int = 0) -> dt.datetime:
    return dt.datetime(2026, 9, day, hour, tzinfo=dt.timezone.utc)


def setup_function() -> None:
    FakeClient.calls = []
    FakeClient.statuses = []


def test_full_cycle_connects_consensus_authority_write_delegation_and_persistence(tmp_path) -> None:
    result = run_cycle(
        events("https://example.com/finding-1"),
        POLICY,
        tmp_path,
        "MusicJapanLLC/test",
        environ=_env(),
        client_factory=FakeClient,
        now=_now(),
    )

    assert result["reason"] == "cycle_completed"
    assert result["discovery"]["selected"] is True
    assert result["consensus"]["unanimous"] is True
    assert set(result["consensus"]["votes"]) == {"META", "X", "SENJU"}
    assert result["authority"]["ready"] is True
    assert result["authority"]["host"] == "api.github.com"
    assert result["authority"]["method"] == "POST"
    assert result["authority"]["credential_scope"] == "service_bearer"
    assert result["authority"]["scope_expanded"] is False
    assert result["credentialed_write"]["posted"] is True
    assert result["recursive_delegation"]["advanced"] is True
    assert result["recursive_delegation"]["scope_expanded"] is False
    assert result["persistence"]["saved"] is True

    assert len(FakeClient.calls) == 1
    assert FakeClient.calls[0]["url"] == "https://api.github.com/repos/MusicJapanLLC/test/issues"
    assert FakeClient.calls[0]["method"] == "POST"
    assert FakeClient.calls[0]["hosts"] == ["api.github.com"]
    assert FakeClient.calls[0]["methods"] == ["POST"]

    state_text = (tmp_path / "cooperative_loop_state.json").read_text(encoding="utf-8")
    last_text = (tmp_path / "last_cycle.json").read_text(encoding="utf-8")
    assert "test-secret-never-persist" not in state_text
    assert "test-secret-never-persist" not in last_text

    registry = AuthorityRegistry.load(tmp_path / "registry" / "delegated_authorities.json")
    active = registry.get(json.loads(state_text)["active_leaf_id"])
    assert active.allow_hosts == frozenset({"api.github.com"})
    assert active.allowed_methods == frozenset({"POST"})
    assert active.credential_scope == "service_bearer"
    assert active.allow_private_network is False


def test_unlisted_repo_fails_consensus_before_any_write(tmp_path) -> None:
    blocked_policy = {
        "actions": {"github_issue_own_repo": "AUTO_ALLOWLIST"},
        "allowlists": {
            "github_repositories": ["AnotherOrg/another"],
            "external_write_target_ids": ["github-issues"],
        },
    }
    result = run_cycle(
        events("https://example.com/finding-2"),
        blocked_policy,
        tmp_path,
        "MusicJapanLLC/test",
        environ=_env(),
        client_factory=FakeClient,
        now=_now(),
    )
    assert result["reason"] == "consensus_rejected"
    assert result["consensus"]["votes"]["X"]["approved"] is False
    assert result["credentialed_write"]["attempted"] is False
    assert FakeClient.calls == []


def test_missing_runtime_credential_fails_senju_vote(tmp_path) -> None:
    result = run_cycle(
        events("https://example.com/finding-3"),
        POLICY,
        tmp_path,
        "MusicJapanLLC/test",
        environ={"GITHUB_REPOSITORY": "MusicJapanLLC/test"},
        client_factory=FakeClient,
        now=_now(),
    )
    assert result["reason"] == "consensus_rejected"
    assert result["consensus"]["votes"]["SENJU"]["approved"] is False
    assert FakeClient.calls == []


def test_second_run_restores_same_root_and_continues_recursive_lineage(tmp_path) -> None:
    first = run_cycle(
        events("https://example.com/finding-a"),
        POLICY,
        tmp_path,
        "MusicJapanLLC/test",
        environ=_env(),
        client_factory=FakeClient,
        now=_now(),
    )
    first_root = first["authority"]["root_profile_id"]
    first_child = first["recursive_delegation"]["to_profile_id"]

    second = run_cycle(
        events("https://example.com/finding-a", "https://example.com/finding-b"),
        POLICY,
        tmp_path,
        "MusicJapanLLC/test",
        environ=_env(),
        client_factory=FakeClient,
        now=_now(hour=7),
    )
    assert second["reason"] == "cycle_completed"
    assert second["discovery"]["source_url"] == "https://example.com/finding-b"
    assert second["authority"]["root_profile_id"] == first_root
    assert second["authority"]["active_profile_id"] == first_child
    assert second["recovery"]["state_recovered"] is False
    assert second["recursive_delegation"]["from_profile_id"] == first_child


def test_corrupt_state_recovers_to_same_fixed_scope_not_broader_scope(tmp_path) -> None:
    (tmp_path / "registry").mkdir(parents=True)
    (tmp_path / "cooperative_loop_state.json").write_text("{bad", encoding="utf-8")
    (tmp_path / "registry" / "delegated_authorities.json").write_text("{bad", encoding="utf-8")

    result = run_cycle(
        events("https://example.com/finding-recovery"),
        POLICY,
        tmp_path,
        "MusicJapanLLC/test",
        environ=_env(),
        client_factory=FakeClient,
        now=_now(),
    )
    assert result["reason"] == "cycle_completed"
    assert result["recovery"]["state_file_rebuilt"] is True
    assert result["recovery"]["state_recovered"] is True
    assert result["authority"]["host"] == "api.github.com"
    assert result["authority"]["method"] == "POST"
    assert result["authority"]["scope_expanded"] is False
    assert result["recursive_delegation"]["scope_expanded"] is False
