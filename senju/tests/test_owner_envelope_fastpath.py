from __future__ import annotations

import json
import urllib.parse
from pathlib import Path

from senju.adversary_external_action_loop import run_adversary_external_action
from senju.adversary_transport import AdversaryNetworkTransport, load_transport_leases
from senju.external import ContactReceipt, ContactResult
from senju.owner_envelope_fastpath import ensure_owner_fastpath_lease


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class FakeClient:
    def __init__(self, policy) -> None:  # noqa: ANN001
        self.policy = policy

    def contact_with_body(self, url: str, *, method: str, headers=None) -> ContactResult:  # noqa: ANN001
        host = urllib.parse.urlsplit(url).hostname or ""
        body = b"ok"
        receipt = ContactReceipt(
            schema="senju-external-contact/v3",
            contacted_at_utc="2026-08-31T00:00:00+00:00",
            method=method,
            requested_url=url,
            final_url=url,
            host=host,
            final_host=host,
            contacted_hosts=(host,),
            resolved_ips=("203.0.113.10",),
            status=200,
            provider_acknowledged=True,
            response_bytes=len(body),
            response_sha256="fake",
            content_type="text/plain",
            etag=None,
            last_modified=None,
            retry_after=None,
            attempt_count=1,
            redirect_count=0,
        )
        return ContactResult(receipt=receipt, body=body)


def test_owner_root_descendant_gets_immediate_transport_lease(tmp_path: Path) -> None:
    _write(
        tmp_path / "discovery_policy.json",
        {
            "schema": "meta-discovery-policy/v5",
            "trusted_roots": ["example.test"],
            "company_domains": [],
        },
    )

    lease = ensure_owner_fastpath_lease(
        tmp_path,
        "https://api.example.test/status",
        now=1000,
    )

    assert lease is not None
    assert lease["target"] == "api.example.test"
    assert lease["authorization_basis"] == "owner_declared_network_root"
    assert lease["authorization_reference"] == "owner-envelope-root:example.test"
    assert set(lease["capabilities"]) == {"scan", "probe"}
    assert set(lease["allowed_methods"]) == {"GET", "HEAD"}
    assert lease["credential_scope"] == "none"
    assert lease["owner_envelope_fastpath"] is True
    assert lease["expires_at"] == 1000 + 6 * 60 * 60

    loaded = load_transport_leases(tmp_path)
    assert any(row["lease_id"] == lease["lease_id"] for row in loaded)


def test_unrelated_host_does_not_create_fastpath_authority(tmp_path: Path) -> None:
    _write(
        tmp_path / "discovery_policy.json",
        {"trusted_roots": ["example.test"], "company_domains": []},
    )

    lease = ensure_owner_fastpath_lease(tmp_path, "https://unrelated.invalid/", now=1000)

    assert lease is None
    assert not (tmp_path / "adversary_owner_fastpath_leases.json").exists()


def test_owner_supplied_exact_link_is_fastpath_eligible(tmp_path: Path) -> None:
    _write(tmp_path / "discovery_policy.json", {"trusted_roots": [], "company_domains": []})
    _write(
        tmp_path / "human_intent_signals.json",
        {"supplied_links": ["https://owner-link.example/path"]},
    )

    lease = ensure_owner_fastpath_lease(
        tmp_path,
        "https://owner-link.example/other",
        now=1000,
    )

    assert lease is not None
    assert lease["authorization_basis"] == "owner_supplied_exact_host"
    assert lease["authorization_reference"] == "owner-supplied:owner-link.example"


def test_revoked_standing_exact_host_is_not_reactivated(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    state = tmp_path / "state"
    _write(state / "discovery_policy.json", {"trusted_roots": [], "company_domains": []})
    _write(
        repo_root / "senju" / "state" / "standing_authorizations.json",
        {
            "schema": "senju-standing-authorization/v1",
            "records": [
                {
                    "authorization_reference": "standing:revoked",
                    "owner": "owner",
                    "issuer_kind": "owner_explicit",
                    "exact_hosts": ["revoked.example"],
                    "allowed_methods": ["GET", "HEAD"],
                    "created_at_utc": "2026-08-31T00:00:00+00:00",
                    "revoked": True,
                    "revocation_reason": "owner revoked",
                    "credential_scope": "none",
                    "destructive": False,
                    "private_cidrs": [],
                    "private_dns_names": [],
                }
            ],
        },
    )

    lease = ensure_owner_fastpath_lease(
        state,
        "https://revoked.example/",
        repo_root=repo_root,
        now=1000,
    )

    assert lease is None


def test_external_action_executes_immediately_inside_owner_root(tmp_path: Path) -> None:
    _write(
        tmp_path / "discovery_policy.json",
        {"trusted_roots": ["example.test"], "company_domains": []},
    )
    policies = []

    def factory(policy):  # noqa: ANN001
        policies.append(policy)
        return FakeClient(policy)

    result = run_adversary_external_action(
        tmp_path,
        url="https://scan.example.test/health",
        source_actor="ADVERSARY",
        reason="validate finding",
        method="GET",
        now=1000,
        client_factory=factory,
    )

    assert result.status == "executed"
    assert result.request_id is None
    assert result.lease_id is not None and result.lease_id.startswith("owner-fastpath:")
    assert result.transport_status == 200
    assert "owner-envelope fast path" in result.reason
    assert len(policies) == 1
    assert policies[0].allow_hosts == frozenset({"scan.example.test"})


def test_external_action_outside_owner_root_requests_authority(tmp_path: Path) -> None:
    _write(
        tmp_path / "discovery_policy.json",
        {"trusted_roots": ["example.test"], "company_domains": []},
    )
    called = []

    def factory(policy):  # noqa: ANN001
        called.append(policy)
        return FakeClient(policy)

    result = run_adversary_external_action(
        tmp_path,
        url="https://outside.invalid/",
        source_actor="ADVERSARY",
        reason="validate finding",
        method="GET",
        now=1000,
        client_factory=factory,
    )

    assert result.status == "authority_requested"
    assert result.request_id is not None
    assert called == []


def test_redirect_policy_can_include_related_exact_hosts_same_authority(tmp_path: Path) -> None:
    leases = (
        {
            "lease_id": "a",
            "target": "a.example.test",
            "authorization_reference": "owner-envelope-root:example.test",
            "authorization_basis": "owner_declared_network_root",
            "capabilities": ["scan", "probe"],
            "allowed_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "expires_at": 5000,
            "status": "active",
        },
        {
            "lease_id": "b",
            "target": "b.example.test",
            "authorization_reference": "owner-envelope-root:example.test",
            "authorization_basis": "owner_declared_network_root",
            "capabilities": ["scan", "probe"],
            "allowed_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "expires_at": 5000,
            "status": "active",
        },
    )
    policies = []

    def factory(policy):  # noqa: ANN001
        policies.append(policy)
        return FakeClient(policy)

    transport = AdversaryNetworkTransport(tmp_path, client_factory=factory)
    result = transport.execute(
        "https://a.example.test/start",
        method="GET",
        leases=leases,
        now=1000,
    )

    assert result.receipt.status == 200
    assert policies[0].allow_hosts == frozenset({"a.example.test", "b.example.test"})
