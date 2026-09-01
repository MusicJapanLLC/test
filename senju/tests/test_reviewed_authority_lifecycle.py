from __future__ import annotations

import json
from pathlib import Path

import senju.authorized_write_broker as write_broker
from senju.reviewed_authority_lifecycle import (
    materialize_reviewed_authority_leases,
    run_reviewed_authority_closed_loop,
)


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _seed(repo: Path, host: str, *, now: int = 1_000) -> tuple[Path, Path]:
    state = repo / "senju" / "state"
    meta = repo / "automation" / "codegen" / "meta_state"
    _write(
        state / "owner_frontier_council.json",
        {
            "decisions": [
                {
                    "host": host,
                    "status": "verified_owner_evidence_plus_ai_council_approved",
                    "applied": True,
                    "yes_votes": 3,
                    "required_votes": 3,
                    "proof_type": "owner_verified_domain",
                    "proof_ref": f"proof:{host}",
                }
            ]
        },
    )
    _write(
        state / "owner_contact_ceiling_effective.json",
        {
            "ceiling": {
                "ceiling_id": "test:frontier",
                "exact_hosts": [host],
                "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                "per_host_methods": {host: ["GET", "HEAD", "OPTIONS"]},
                "allow_http": False,
                "allow_delete": False,
            }
        },
    )
    _write(
        meta / "authority_reviewed_grants.json",
        {
            "hosts": {
                host: {
                    "host": host,
                    "authority_basis": "binding_frontier_council",
                    "reviewer": "senju-authority-reviewer/v2",
                    "reviewed_at": now,
                    "expires_at": now + 3600,
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "effect": "read_only",
                    "allow_http": False,
                    "allow_delete": False,
                }
            }
        },
    )
    return state, meta


def _seed_write_target(repo: Path, host: str) -> Path:
    state = repo / "senju" / "state"
    _write(
        repo / "AUTHORIZED_TEST_TARGETS.json",
        {
            "targets": [
                {
                    "id": "owned-write-range",
                    "host": host,
                    "scheme": "https",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "POST", "PUT", "PATCH", "DELETE"],
                    "path_scope": "/**",
                    "rate_limit_rps": 2,
                }
            ]
        },
    )
    return state


def test_materializes_same_or_narrower_reviewed_lease(tmp_path: Path):
    repo = tmp_path / "repo"
    host = "reviewed.example.com"
    state, meta = _seed(repo, host)

    result = materialize_reviewed_authority_leases(repo, state, meta, now=1_100)

    assert result["lease_count"] == 1
    lease = result["leases"][0]
    assert lease["host"] == host
    assert lease["allowed_methods"] == ["GET", "HEAD"]
    assert lease["credential_scope"] == "none"
    assert lease["same_or_narrower"] is True
    assert lease["frontier_yes_votes"] == 3


def test_missing_binding_frontier_is_not_leased(tmp_path: Path):
    repo = tmp_path / "repo"
    host = "unbound.example.com"
    state, meta = _seed(repo, host)
    _write(state / "owner_frontier_council.json", {"decisions": []})

    result = materialize_reviewed_authority_leases(repo, state, meta, now=1_100)

    assert result["lease_count"] == 0
    assert result["rejected"][0]["reason"] == "binding_frontier_approval_missing_or_stale"


def test_expired_or_credentialed_review_is_not_leased(tmp_path: Path):
    repo = tmp_path / "repo"
    host = "expired.example.com"
    state, meta = _seed(repo, host)
    grants = json.loads((meta / "authority_reviewed_grants.json").read_text())
    grants["hosts"][host]["expires_at"] = 1_050
    grants["hosts"][host]["credential_scope"] = "browser_cookie"
    _write(meta / "authority_reviewed_grants.json", grants)

    result = materialize_reviewed_authority_leases(repo, state, meta, now=1_100)

    assert result["lease_count"] == 0


def test_closed_loop_executes_head_and_carries_state(tmp_path: Path):
    repo = tmp_path / "repo"
    host = "loop.example.com"
    state, meta = _seed(repo, host)

    class FakeReceipt:
        provider_acknowledged = True
        status = 204
        final_host = host

        def to_dict(self):
            return {"provider_acknowledged": True, "status": 204, "final_host": host}

    class FakeClient:
        def __init__(self, repo_root, state_dir):
            self.per_host_methods = {host: frozenset({"GET", "HEAD"})}

        def contact(self, url: str, *, method: str = "GET"):
            assert url == f"https://{host}/"
            assert method == "HEAD"
            return FakeReceipt()

    first = run_reviewed_authority_closed_loop(
        repo,
        state,
        meta,
        max_exec_hosts=4,
        now=1_100,
        client_factory=FakeClient,
    )
    second = run_reviewed_authority_closed_loop(
        repo,
        state,
        meta,
        max_exec_hosts=4,
        now=1_200,
        client_factory=FakeClient,
    )

    assert first["closed_loop"] is True
    assert first["contacted_count"] == 1
    assert first["provider_acknowledged_count"] == 1
    assert second["cycle_count"] == 2
    assert len(second["history"]) == 2
    receipts = json.loads((state / "reviewed_authority_execution_receipts.json").read_text())
    assert receipts["receipt_count"] == 2


def test_owner_authorized_write_uses_runtime_secret_without_persisting_it(tmp_path: Path, monkeypatch):
    repo = tmp_path / "repo"
    host = "owned-write.example.com"
    state = _seed_write_target(repo, host)
    secret = "test-secret-that-must-never-be-persisted"
    captured: dict[str, object] = {}

    _write(
        state / "reviewed_write_requests.json",
        {
            "schema": write_broker.WRITE_QUEUE_SCHEMA,
            "requests": [
                {
                    "request_id": "write-001",
                    "host": host,
                    "method": "PATCH",
                    "path": "/synthetic/profile/1",
                    "json_body": {"synthetic": True, "nickname": "senju"},
                    "credential_grant_id": "owned-test-bearer",
                    "required_scopes": ["synthetic:write"],
                }
            ],
        },
    )

    class FakeReceipt:
        provider_acknowledged = True
        status = 200

        def to_dict(self):
            return {"provider_acknowledged": True, "status": 200, "host": host}

    class FakeResult:
        receipt = FakeReceipt()
        body = b'{"ok":true}'

    class FakeClient:
        def contact_with_body(self, url, *, method, body, headers):
            captured.update(url=url, method=method, body=body, headers=dict(headers))
            return FakeResult()

    monkeypatch.setattr(write_broker, "_make_client", lambda requested_host, method: FakeClient())
    env = {
        "SENJU_WRITE_CREDENTIAL_GRANTS_JSON": json.dumps(
            [
                {
                    "grant_id": "owned-test-bearer",
                    "provider": "owned-test",
                    "env_var": "SENJU_WRITE_TOKEN_1",
                    "allowed_scopes": ["synthetic:write"],
                    "required_authority_scope": "service_bearer",
                    "max_ttl_seconds": 300,
                    "host": host,
                    "allowed_methods": ["POST", "PUT", "PATCH"],
                    "header": "Authorization",
                    "prefix": "Bearer ",
                }
            ]
        ),
        "SENJU_WRITE_TOKEN_1": secret,
    }

    result = write_broker.execute_authorized_write_queue(repo, state, now=2_000, environ=env)

    assert result["contacted_count"] == 1
    assert result["credentialed_attempt_count"] == 1
    assert captured["url"] == f"https://{host}/synthetic/profile/1"
    assert captured["method"] == "PATCH"
    assert captured["headers"]["Authorization"] == f"Bearer {secret}"
    lease = result["leases"][0]
    assert lease["credential_ref"] == "env://SENJU_WRITE_TOKEN_1"
    assert lease["credential_scope"] == "preprovisioned_runtime"

    serialized = json.dumps(result, ensure_ascii=False)
    serialized += (state / "reviewed_write_operational_leases.json").read_text()
    serialized += (state / "reviewed_write_execution_receipts.json").read_text()
    assert secret not in serialized


def test_owner_authorized_write_rejects_unknown_host_and_delete(tmp_path: Path, monkeypatch):
    repo = tmp_path / "repo"
    host = "owned-write.example.com"
    state = _seed_write_target(repo, host)
    _write(
        state / "reviewed_write_requests.json",
        {
            "schema": write_broker.WRITE_QUEUE_SCHEMA,
            "requests": [
                {
                    "request_id": "unknown-host",
                    "host": "unowned.example.net",
                    "method": "POST",
                    "path": "/synthetic",
                    "json_body": {"synthetic": True},
                },
                {
                    "request_id": "delete-not-supported",
                    "host": host,
                    "method": "DELETE",
                    "path": "/synthetic/1",
                    "json_body": {"synthetic": True},
                },
            ],
        },
    )

    def should_not_contact(*args, **kwargs):
        raise AssertionError("transport must not be created for rejected writes")

    monkeypatch.setattr(write_broker, "_make_client", should_not_contact)
    result = write_broker.execute_authorized_write_queue(repo, state, now=2_000, environ={})

    assert result["contacted_count"] == 0
    assert result["cycle_attempt_count"] == 2
    assert all(row["status"] == "rejected_or_transport_error" for row in result["receipts"])
    assert result["leases"] == []
