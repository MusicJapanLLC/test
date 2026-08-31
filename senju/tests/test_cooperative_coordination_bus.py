from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass

from senju.meta.cooperative_authority_loop import run_cycle
from senju.meta.cooperative_coordination_bus import DEFAULT_PARTICIPANTS, publish_handoff


POLICY = {
    "actions": {
        "github_issue_own_repo": "AUTO_ALLOWLIST",
        "github_issue_comment_own_repo": "AUTO_ALLOWLIST",
    },
    "allowlists": {
        "github_repositories": ["MusicJapanLLC/test"],
        "external_write_target_ids": ["github-issues", "github-issue-comments"],
    },
}


@dataclass
class FakeReceipt:
    status: int

    def to_dict(self) -> dict:
        return {"status": self.status, "host": "api.github.com", "final_host": "api.github.com", "contacted_hosts": ["api.github.com"], "provider_acknowledged": 200 <= self.status < 300}


@dataclass
class FakeResult:
    receipt: FakeReceipt
    body: bytes


class FakeClient:
    calls: list[dict] = []

    def __init__(self, policy) -> None:  # noqa: ANN001
        self.policy = policy

    def contact_with_body(self, url: str, *, method: str, body: bytes, headers: dict) -> FakeResult:
        decoded = json.loads(body.decode("utf-8"))
        type(self).calls.append({"url": url, "method": method, "body": decoded, "authorization_present": bool(headers.get("Authorization")), "hosts": sorted(self.policy.allow_hosts), "methods": sorted(self.policy.allowed_methods)})
        if url.endswith("/issues"):
            payload = {"number": 41, "html_url": "https://github.com/MusicJapanLLC/test/issues/41"}
        else:
            payload = {"id": 9001, "html_url": "https://github.com/MusicJapanLLC/test/issues/41#issuecomment-9001"}
        return FakeResult(FakeReceipt(201), json.dumps(payload).encode("utf-8"))


def _env() -> dict[str, str]:
    return {"GITHUB_TOKEN": "coordination-secret-never-persist", "GITHUB_REPOSITORY": "MusicJapanLLC/test"}


def _events() -> dict:
    return {"findings": [{"url": "https://example.com/shared-finding", "title": "Shared finding", "note": "handoff test"}]}


def _now() -> dt.datetime:
    return dt.datetime(2026, 9, 1, 0, tzinfo=dt.timezone.utc)


def setup_function() -> None:
    FakeClient.calls = []


def _completed_cycle(tmp_path) -> dict:
    return run_cycle(_events(), POLICY, tmp_path, "MusicJapanLLC/test", environ=_env(), client_factory=FakeClient, now=_now())


def test_completed_cycle_publishes_machine_readable_handoff_comment_and_bus(tmp_path) -> None:
    cycle = _completed_cycle(tmp_path)
    result = publish_handoff(cycle, POLICY, tmp_path, "MusicJapanLLC/test", environ=_env(), client_factory=FakeClient)
    assert result["reason"] == "handoff_published"
    assert result["published"] is True
    assert result["bus_saved"] is True
    assert result["authority_scope_expanded"] is False
    assert set(DEFAULT_PARTICIPANTS).issubset(set(result["participants"]))
    assert len(FakeClient.calls) == 2
    comment = FakeClient.calls[-1]
    assert comment["url"] == "https://api.github.com/repos/MusicJapanLLC/test/issues/41/comments"
    assert comment["method"] == "POST"
    assert comment["hosts"] == ["api.github.com"]
    assert comment["methods"] == ["POST"]
    assert "AI cooperative handoff" in comment["body"]["body"]
    assert "CLAUDE" in comment["body"]["body"]
    assert "JULES" in comment["body"]["body"]
    bus_text = (tmp_path / "coordination_bus.json").read_text(encoding="utf-8")
    receipt_text = next((tmp_path / "coordination_receipts").glob("*.json")).read_text(encoding="utf-8")
    assert "coordination-secret-never-persist" not in bus_text
    assert "coordination-secret-never-persist" not in receipt_text
    message = json.loads(bus_text)["messages"][0]
    assert message["status"] == "OPEN"
    assert message["authority_constraints"]["owned_repo_only"] is True
    assert message["authority_constraints"]["new_host_minting"] is False
    assert message["authority_constraints"]["new_credential_minting"] is False
    assert message["reply_protocol"]["format"].startswith("AI-HANDOFF-ACK")


def test_custom_sibling_agents_are_normalized_and_meta_x_senju_remain_present(tmp_path) -> None:
    cycle = _completed_cycle(tmp_path)
    env = _env() | {"COOPERATIVE_AI_PARTICIPANTS": "claude, custom-agent, openhands"}
    result = publish_handoff(cycle, POLICY, tmp_path, "MusicJapanLLC/test", environ=env, client_factory=FakeClient)
    assert result["published"] is True
    assert {"META", "X", "SENJU", "CLAUDE", "CUSTOM-AGENT", "OPENHANDS"}.issubset(set(result["participants"]))


def test_missing_comment_authorization_keeps_write_authority_from_being_reused(tmp_path) -> None:
    cycle = _completed_cycle(tmp_path)
    policy = {"actions": {"github_issue_own_repo": "AUTO_ALLOWLIST"}, "allowlists": {"github_repositories": ["MusicJapanLLC/test"], "external_write_target_ids": ["github-issues"]}}
    before = len(FakeClient.calls)
    result = publish_handoff(cycle, policy, tmp_path, "MusicJapanLLC/test", environ=_env(), client_factory=FakeClient)
    assert result["reason"] == "coordination_policy_not_allowlisted"
    assert result["published"] is False
    assert len(FakeClient.calls) == before


def test_non_completed_cycle_does_not_publish_comment(tmp_path) -> None:
    result = publish_handoff({"repo": "MusicJapanLLC/test", "reason": "no_novel_discovery", "credentialed_write": {"posted": False}}, POLICY, tmp_path, "MusicJapanLLC/test", environ=_env(), client_factory=FakeClient)
    assert result["reason"] == "no_completed_write_to_share"
    assert result["published"] is False
    assert FakeClient.calls == []
