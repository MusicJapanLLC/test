from __future__ import annotations

import json
import urllib.error
from pathlib import Path

import pytest

from senju.adversary_transport import (
    AdversaryNetworkTransport,
    AdversaryTransportError,
    load_transport_leases,
)
from senju.external import ContactReceipt, ContactResult, ExternalContactClient, ExternalContactError


def _lease(host: str = "outside.example", **overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "lease_id": "lease-1",
        "target": host,
        "url": f"https://{host}/",
        "authorization_reference": "owner://range/1",
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


class _FakeClient:
    def __init__(self, policy, *, fail_get: bool = False, calls: list | None = None):
        self.policy = policy
        self.fail_get = fail_get
        self.calls = calls if calls is not None else []

    def contact_with_body(self, url, *, method="GET", body=None, headers=None):
        self.calls.append((url, method, dict(headers or {}), self.policy))
        if self.fail_get and method == "GET":
            raise ExternalContactError("synthetic GET failure")
        receipt = ContactReceipt(
            schema="senju-external-contact/v3",
            contacted_at_utc="2026-08-31T00:00:00+00:00",
            method=method,
            requested_url=url,
            final_url=url,
            host="outside.example",
            final_host="outside.example",
            contacted_hosts=("outside.example",),
            resolved_ips=("203.0.113.10",),
            status=200,
            provider_acknowledged=True,
            response_bytes=2,
            response_sha256="okhash",
            content_type="text/plain",
            etag=None,
            last_modified=None,
            retry_after=None,
            attempt_count=1,
            redirect_count=0,
        )
        return ContactResult(receipt=receipt, body=b"ok")


def test_exact_active_lease_executes_real_transport_adapter(tmp_path: Path) -> None:
    calls: list = []
    transport = AdversaryNetworkTransport(
        tmp_path,
        client_factory=lambda policy: _FakeClient(policy, calls=calls),
    )
    result = transport.execute(
        "https://outside.example/a",
        leases=(_lease(),),
        now=1000,
    )
    assert result.receipt.status == 200
    assert result.receipt.lease_id == "lease-1"
    assert calls[0][3].allow_hosts == frozenset({"outside.example"})
    assert calls[0][3].follow_redirects is True


def test_missing_expired_or_wrong_host_authority_is_rejected(tmp_path: Path) -> None:
    transport = AdversaryNetworkTransport(
        tmp_path,
        client_factory=lambda policy: _FakeClient(policy),
    )
    with pytest.raises(AdversaryTransportError):
        transport.execute("https://other.example/", leases=(_lease(),), now=1000)
    with pytest.raises(AdversaryTransportError):
        transport.execute("https://outside.example/", leases=(_lease(expires_at=999),), now=1000)


def test_transport_rejects_http_nondefault_port_and_write_methods(tmp_path: Path) -> None:
    transport = AdversaryNetworkTransport(
        tmp_path,
        client_factory=lambda policy: _FakeClient(policy),
    )
    with pytest.raises(AdversaryTransportError):
        transport.execute("http://outside.example/", leases=(_lease(),), now=1000)
    with pytest.raises(AdversaryTransportError):
        transport.execute("https://outside.example:444/", leases=(_lease(),), now=1000)
    with pytest.raises(AdversaryTransportError):
        transport.execute("https://outside.example/", method="POST", leases=(_lease(),), now=1000)


def test_credentials_require_existing_credentialed_action_and_are_not_persisted(tmp_path: Path) -> None:
    calls: list = []
    provided: list[tuple[str, str]] = []

    def provider(scope: str, host: str):
        provided.append((scope, host))
        return {"Authorization": "Bearer super-secret"}

    transport = AdversaryNetworkTransport(
        tmp_path,
        credential_provider=provider,
        client_factory=lambda policy: _FakeClient(policy, calls=calls),
    )
    credentialed = _lease(
        capabilities=["scan", "probe", "credentialed_action"],
        credential_scope="service/read",
    )
    transport.execute("https://outside.example/", leases=(credentialed,), now=1000)
    assert provided == [("service/read", "outside.example")]
    assert calls[0][2]["Authorization"] == "Bearer super-secret"
    persisted = (tmp_path / "adversary_transport_receipts.ndjson").read_text(encoding="utf-8")
    assert "super-secret" not in persisted
    assert "service/read" in persisted

    bad = _lease(credential_scope="service/read")
    with pytest.raises(AdversaryTransportError):
        transport.execute("https://outside.example/", leases=(bad,), now=1000)


def test_recovery_keeps_same_url_host_and_lease_and_may_fallback_to_head(tmp_path: Path) -> None:
    calls: list = []
    transport = AdversaryNetworkTransport(
        tmp_path,
        client_factory=lambda policy: _FakeClient(policy, fail_get=True, calls=calls),
    )
    result = transport.execute_with_recovery(
        "https://outside.example/path?q=1",
        method="GET",
        leases=(_lease(),),
        now=1000,
    )
    assert result.receipt.method == "HEAD"
    assert [row[1] for row in calls] == ["GET", "HEAD"]
    assert {row[0] for row in calls} == {"https://outside.example/path?q=1"}


def test_private_loopback_resolution_remains_blocked_before_open(tmp_path: Path) -> None:
    opened: list[str] = []

    def factory(policy):
        def opener(req, timeout):
            opened.append(req.full_url)
            raise AssertionError("opener must not be reached for loopback DNS")
        return ExternalContactClient(
            policy,
            resolver=lambda host, port: ("127.0.0.1",),
            opener=opener,
        )

    transport = AdversaryNetworkTransport(tmp_path, client_factory=factory)
    with pytest.raises(AdversaryTransportError, match="non-public address blocked"):
        transport.execute("https://outside.example/", leases=(_lease(),), now=1000)
    assert opened == []


def test_loader_combines_owner_promoted_and_discovery_leases(tmp_path: Path) -> None:
    (tmp_path / "adversary_owner_promoted_leases.json").write_text(
        json.dumps({"leases": [_lease("one.example")]}), encoding="utf-8"
    )
    (tmp_path / "discovery_capability_leases.json").write_text(
        json.dumps({"leases": [_lease("two.example", lease_id="lease-2")]}), encoding="utf-8"
    )
    leases = load_transport_leases(tmp_path)
    assert {row["target"] for row in leases} == {"one.example", "two.example"}
