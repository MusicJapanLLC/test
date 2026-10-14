from __future__ import annotations

import hashlib
import hmac
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from senju.adversary_autonomy_accelerator import (
    PRIVATE_SCOPE_ENVELOPE_SCHEMA,
    PRIVATE_SCOPE_SCHEMA,
    AdversaryAccelerationError,
    execute_same_authority_recovery,
    prepare_credential_acquisition,
    private_ip_authorized,
    reconsider_denial,
    refresh_denial_reconsideration_queue,
    run_adversary_autonomy_acceleration,
)


def _write(path: Path, value: object) -> None:
    path.write_text(json.dumps(value), encoding="utf-8")


def _lease(host: str = "svc.example", **overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "lease_id": "lease-1",
        "target": host,
        "url": f"https://{host}/",
        "authorization_reference": "owner://root/example",
        "authorization_basis": "trusted_root",
        "capabilities": ["scan", "probe"],
        "allowed_methods": ["GET", "HEAD"],
        "credential_scope": "none",
        "issued_at": 900,
        "expires_at": 2000,
        "source_action_fingerprint": "abc",
        "status": "active",
    }
    row.update(overrides)
    return row


def test_unrelated_host_becomes_parallel_candidate_not_authority(tmp_path: Path) -> None:
    result = run_adversary_autonomy_acceleration(
        tmp_path,
        url="https://unrelated.example/path",
        source_actor="SENJU",
        reason="finding needs authority evidence",
        now=1000,
    )
    assert result.status == "parallel_authority_acquisition"
    assert result.request_id
    assert result.lease_id is None
    assert result.collaboration_tasks == 10  # 6 evidence workers + 4 authority vote solicitations

    candidates = json.loads((tmp_path / "adversary_provisional_root_candidates.json").read_text())
    row = candidates["items"][0]
    assert row["host"] == "unrelated.example"
    assert row["execution_authority"] is False
    assert row["credential_scope"] == "none"

    bus = json.loads((tmp_path / "adversary_authority_collaboration_bus.json").read_text())
    assert {task["actor"] for task in bus["tasks"]} == {
        "META", "X", "SENJU", "CHILD", "AI", "PR-ARMY"
    }
    assert all(task["may_mint_authority"] is False for task in bus["tasks"])


def test_owner_root_finding_skips_candidate_delay(tmp_path: Path) -> None:
    _write(tmp_path / "discovery_policy.json", {"trusted_roots": ["example.com"]})
    result = run_adversary_autonomy_acceleration(
        tmp_path,
        url="https://api.example.com/v1",
        source_actor="META",
        reason="owner-root discovery",
        now=1000,
    )
    assert result.status == "ready_existing_authority"
    assert result.lease_id
    assert result.request_id is None
    assert not (tmp_path / "adversary_provisional_root_candidates.json").exists()


def test_soft_deny_reopens_only_after_new_evidence() -> None:
    old = hashlib.sha256(json.dumps({"proof": "old"}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    same = reconsider_denial(
        effect="deny",
        previous_evidence_fingerprint=old,
        current_evidence={"proof": "old"},
    )
    changed = reconsider_denial(
        effect="deny",
        previous_evidence_fingerprint=old,
        current_evidence={"proof": "new"},
    )
    hard = reconsider_denial(
        effect="hard_deny",
        previous_evidence_fingerprint=old,
        current_evidence={"proof": "new"},
    )
    revoked = reconsider_denial(
        effect="deny",
        revoked=True,
        previous_evidence_fingerprint=old,
        current_evidence={"proof": "new"},
    )
    assert same["reopen"] is False
    assert changed["reopen"] is True
    assert hard["status"] == "terminal"
    assert revoked["status"] == "terminal"


def test_denial_queue_reopens_soft_rows_but_keeps_terminal_rows(tmp_path: Path) -> None:
    old_hash = "0" * 64
    _write(
        tmp_path / "authority_denials.json",
        {
            "denials": [
                {"denial_id": "d1", "host": "soft.example", "effect": "deny", "evidence_fingerprint": old_hash},
                {"denial_id": "d2", "host": "hard.example", "effect": "hard_deny", "evidence_fingerprint": old_hash},
                {"denial_id": "d3", "host": "revoked.example", "effect": "deny", "revoked": True, "evidence_fingerprint": old_hash},
            ]
        },
    )
    _write(
        tmp_path / "authority_evidence_by_host.json",
        {"hosts": {"soft.example": {"proof": "new"}, "hard.example": {"proof": "new"}, "revoked.example": {"proof": "new"}}},
    )
    result = refresh_denial_reconsideration_queue(tmp_path, now=1000)
    assert result["reopened_count"] == 1
    assert result["terminal_count"] == 2
    assert result["queue"][0]["host"] == "soft.example"


def test_credential_work_is_automatic_only_when_profile_and_authority_exist(tmp_path: Path) -> None:
    _write(
        tmp_path / "credential_target_profiles.json",
        {
            "hosts": {
                "api.example": {
                    "provider": "example",
                    "grant_id": "example-read",
                    "required_scopes": ["resource:read"],
                }
            }
        },
    )
    waiting = prepare_credential_acquisition(tmp_path, host="api.example", now=1000)
    assert waiting["status"] == "waiting_for_host_authority"

    _write(
        tmp_path / "discovery_capability_leases.json",
        {
            "leases": [
                _lease(
                    "api.example",
                    capabilities=["scan", "probe", "credentialed_action"],
                    credential_scope="service/read",
                )
            ]
        },
    )
    ready = prepare_credential_acquisition(tmp_path, host="api.example", now=1000)
    assert ready["status"] == "runtime_acquisition_ready"
    assert ready["grant_id"] == "example-read"
    assert ready["raw_credential_present"] is False
    persisted = (tmp_path / "adversary_credential_acquisition_queue.json").read_text()
    assert "secret" not in persisted.lower()


def _signed_private_scope(key: bytes, *, cidrs: list[str] | None = None) -> dict[str, object]:
    payload = {
        "schema": PRIVATE_SCOPE_SCHEMA,
        "authorization_reference": "owner://private/lab",
        "allowed_cidrs": cidrs or ["10.23.0.0/16"],
        "issued_at": 900,
        "expires_at": 1500,
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "schema": PRIVATE_SCOPE_ENVELOPE_SCHEMA,
        "payload": payload,
        "signature": hmac.new(key, body, hashlib.sha256).hexdigest(),
    }


def test_owner_signed_rfc1918_scope_is_machine_authorizable(tmp_path: Path) -> None:
    key = b"owner-test-key"
    envelope = _signed_private_scope(key)
    decision = private_ip_authorized("10.23.4.8", envelope=envelope, hmac_key=key, now=1000)
    assert decision["authorized"] is True
    assert decision["authorization_reference"] == "owner://private/lab"

    with pytest.raises(AdversaryAccelerationError):
        private_ip_authorized("127.0.0.1", envelope=envelope, hmac_key=key, now=1000)
    with pytest.raises(AdversaryAccelerationError):
        private_ip_authorized("169.254.169.254", envelope=envelope, hmac_key=key, now=1000)
    with pytest.raises(AdversaryAccelerationError):
        private_ip_authorized("10.24.1.1", envelope=envelope, hmac_key=key, now=1000)
    with pytest.raises(AdversaryAccelerationError):
        private_ip_authorized("10.23.4.8", envelope=envelope, hmac_key=b"wrong", now=1000)


def test_recovery_explores_only_predeclared_paths_on_same_lineage(tmp_path: Path) -> None:
    lease = _lease("svc.example", recovery_paths=["/health", "/status"])
    _write(tmp_path / "discovery_capability_leases.json", {"leases": [lease]})
    calls: list[tuple[str, str, tuple[str, ...]]] = []

    class FakeTransport:
        def execute(self, url, *, method, leases, now):
            calls.append((url, method, tuple(str(row["authorization_reference"]) for row in leases)))
            ok = url == "https://svc.example/health" and method == "GET"
            return SimpleNamespace(receipt=SimpleNamespace(provider_acknowledged=ok))

    result = execute_same_authority_recovery(
        FakeTransport(),
        state_dir=tmp_path,
        url="https://svc.example/start?q=1",
        now=1000,
    )
    assert result.receipt.provider_acknowledged is True
    assert calls[:3] == [
        ("https://svc.example/start?q=1", "GET", ("owner://root/example",)),
        ("https://svc.example/start?q=1", "HEAD", ("owner://root/example",)),
        ("https://svc.example/health", "GET", ("owner://root/example",)),
    ]
    assert all(url.startswith("https://svc.example/") for url, _, _ in calls)
    assert {refs for _, _, refs in calls} == {("owner://root/example",)}
