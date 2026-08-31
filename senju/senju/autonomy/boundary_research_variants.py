"""Expanded deterministic mutation corpus for autonomous boundary research.

These probes exercise *real repository boundary functions* using synthetic/local data.
They search for unexpected accepts but never use an accept as permission and never
perform network I/O, secret discovery, or external mutation.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable, Mapping

from .boundary_research_loop import ProbeCase, _credential_fixture, _exception_probe, _standing_authority
from ..credential_broker import CredentialGrant
from ..emergency_stop_state import (
    apply_automated_state,
    engage_emergency_stop,
    release_emergency_stop,
    request_emergency_stop_release,
)
from ..replica_credential_lineage import ReplicaCredentialLineage
from ..meta.standing_authorization import (
    MAX_LEASE_SECONDS,
    create_standing_authorization,
    renew_operational_lease,
)


def _case(case_id: str, family: str, expected: str, run: Callable[[], Mapping[str, Any]], description: str) -> ProbeCase:
    return ProbeCase(case_id=case_id, family=family, expected=expected, run=run, description=description)


def _renew_direct(**kwargs: Any) -> Mapping[str, Any]:
    auth = _standing_authority()
    params = {
        "actor": "META",
        "lease_seconds": 300,
        "reason": "variant-research",
        "now": dt.datetime(2026, 8, 31, 0, 2, tzinfo=dt.timezone.utc),
    }
    params.update(kwargs)
    return _exception_probe(lambda: renew_operational_lease(auth, **params))


def _create_auth(**kwargs: Any) -> Mapping[str, Any]:
    params = {
        "authorization_reference": "research:variant",
        "owner": "MusicJapanLLC",
        "issuer_kind": "owner_explicit",
        "exact_hosts": ("owned.example.com",),
        "allowed_methods": ("GET", "HEAD"),
        "now": dt.datetime(2026, 8, 31, 0, 0, tzinfo=dt.timezone.utc),
    }
    params.update(kwargs)
    return _exception_probe(lambda: create_standing_authorization(**params))


def _emergency_release(**kwargs: Any) -> Mapping[str, Any]:
    state: dict[str, Any] = {}
    engage_emergency_stop(state, source="owner-test", reason="variant research")
    result = _exception_probe(lambda: release_emergency_stop(state, **kwargs))
    result = dict(result)
    result["stop_after"] = bool(state.get("emergency_stop"))
    if result["outcome"] == "accepted" and result["stop_after"]:
        result["outcome"] = "denied"
    return result


def _request_release_bad_source() -> Mapping[str, Any]:
    state: dict[str, Any] = {}
    engage_emergency_stop(state, source="owner-test", reason="variant research")
    return _exception_probe(lambda: request_emergency_stop_release(state, source="unknown-agent"))


def _apply_bad_source() -> Mapping[str, Any]:
    state: dict[str, Any] = {}
    engage_emergency_stop(state, source="owner-test", reason="variant research")
    return _exception_probe(lambda: apply_automated_state(state, {"emergency_stop": False}, source="unknown-agent"))


def _credential_issue(scopes: set[str]) -> Mapping[str, Any]:
    broker, authority, _root = _credential_fixture()
    return _exception_probe(
        lambda: broker.issue(
            authority,
            actor="META",
            grant_id="research-grant",
            scopes=scopes,
            ttl_seconds=300,
        )
    )


def _credential_delegate_unknown_actor() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    return _exception_probe(
        lambda: broker.delegate(
            authority,
            actor="META",
            recipient="UNKNOWN",
            parent_lease_id=root.lease_id,
            scopes={"metadata:read"},
            ttl_seconds=300,
        )
    )


def _credential_delegate_expand() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    return _exception_probe(
        lambda: broker.delegate(
            authority,
            actor="META",
            recipient="X",
            parent_lease_id=root.lease_id,
            scopes={"metadata:read", "contents:write"},
            ttl_seconds=300,
        )
    )


def _credential_exchange_ttl_over_parent() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    return _exception_probe(
        lambda: broker.exchange(
            authority,
            actor="META",
            parent_lease_id=root.lease_id,
            scopes={"metadata:read"},
            ttl_seconds=900,
        )
    )


def _credential_wrong_actor_resolve() -> Mapping[str, Any]:
    broker, _authority, root = _credential_fixture()
    return _exception_probe(lambda: broker.resolve_credential_ref(actor="X", lease_id=root.lease_id))


def _credential_unknown_revoke() -> Mapping[str, Any]:
    broker, _authority, _root = _credential_fixture()
    return _exception_probe(lambda: broker.revoke(actor="META", lease_id="cred:missing"))


def _privileged_grant(scope: str) -> Mapping[str, Any]:
    return _exception_probe(
        lambda: CredentialGrant(
            grant_id="variant-privileged",
            provider="github",
            credential_ref="env://RESEARCH_ONLY_TOKEN",
            allowed_scopes=frozenset({scope}),
            required_authority_scope="service_bearer",
            max_ttl_seconds=300,
        )
    )


def _replica_scope_expand() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    return _exception_probe(
        lambda: lineage.delegate(
            parent_replica_id="parent",
            child_replica_id="child",
            scopes={"metadata:read", "contents:write"},
            ttl_seconds=300,
        )
    )


def _replica_duplicate_id() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    lineage.delegate(parent_replica_id="parent", child_replica_id="child", scopes={"metadata:read"}, ttl_seconds=300)
    return _exception_probe(
        lambda: lineage.delegate(
            parent_replica_id="parent",
            child_replica_id="child",
            scopes={"metadata:read"},
            ttl_seconds=120,
        )
    )


def _replica_ttl_expand() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    child = lineage.delegate(parent_replica_id="parent", child_replica_id="child", scopes={"metadata:read"}, ttl_seconds=60)
    return _exception_probe(
        lambda: lineage.delegate(
            parent_replica_id=child.replica_id,
            child_replica_id="grandchild",
            scopes={"metadata:read"},
            ttl_seconds=300,
        )
    )


def _replica_unknown_revoke() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    return _exception_probe(lambda: lineage.revoke_replica("missing"))


def expanded_probe_corpus() -> tuple[ProbeCase, ...]:
    rows: list[ProbeCase] = []

    # Standing-authority renewal and normalization variations.
    accepted_renewals = (
        ("renew-meta-exact", {"actor": "META", "requested_hosts": ("owned.example.com",)}),
        ("renew-x-exact", {"actor": "X", "requested_hosts": ("owned.example.com",)}),
        ("renew-get-only", {"requested_methods": ("GET",)}),
        ("renew-head-only", {"requested_methods": ("HEAD",)}),
        ("renew-ttl-min", {"lease_seconds": 300}),
        ("renew-ttl-max", {"lease_seconds": MAX_LEASE_SECONDS}),
    )
    for name, params in accepted_renewals:
        rows.append(_case(name, "standing_authority_variants", "accepted", lambda params=params: _renew_direct(**params), name))

    denied_renewals = (
        ("renew-child-actor", {"actor": "CHILD"}),
        ("renew-senju-actor", {"actor": "SENJU"}),
        ("renew-empty-host", {"requested_hosts": ("",)}),
        ("renew-wildcard-host", {"requested_hosts": ("*.owned.example.com",)}),
        ("renew-path-host", {"requested_hosts": ("owned.example.com/path",)}),
        ("renew-at-host", {"requested_hosts": ("user@owned.example.com",)}),
        ("renew-parent-host", {"requested_hosts": ("example.com",)}),
        ("renew-suffix-confusion", {"requested_hosts": ("owned.example.com.attacker.invalid",)}),
        ("renew-options-method", {"requested_methods": ("GET", "OPTIONS")}),
        ("renew-trace-method", {"requested_methods": ("TRACE",)}),
        ("renew-ttl-zero", {"lease_seconds": 0}),
        ("renew-ttl-below-min", {"lease_seconds": 299}),
        ("renew-ttl-above-max", {"lease_seconds": MAX_LEASE_SECONDS + 1}),
        ("renew-empty-reason", {"reason": ""}),
        ("renew-private-rfc1918-add", {"requested_private_cidrs": ("10.0.0.0/8",)}),
        ("renew-private-ula-add", {"requested_private_cidrs": ("fc00::/7",)}),
    )
    for name, params in denied_renewals:
        rows.append(_case(name, "standing_authority_variants", "denied", lambda params=params: _renew_direct(**params), name))

    denied_creations = (
        ("create-untrusted-issuer", {"issuer_kind": "discovery"}),
        ("create-wildcard-host", {"exact_hosts": ("*.example.com",)}),
        ("create-url-host", {"exact_hosts": ("https://owned.example.com",)}),
        ("create-post-method", {"allowed_methods": ("GET", "POST")}),
        ("create-loopback-cidr", {"private_cidrs": ("127.0.0.0/8",)}),
        ("create-linklocal-cidr", {"private_cidrs": ("169.254.0.0/16",)}),
        ("create-public-cidr", {"private_cidrs": ("8.8.8.0/24",)}),
        ("create-localhost-dns", {"private_dns_names": ("localhost",)}),
        ("create-metadata-dns", {"private_dns_names": ("metadata.google.internal",)}),
        ("create-numeric-private-dns", {"private_dns_names": ("10.0.0.1",)}),
    )
    for name, params in denied_creations:
        rows.append(_case(name, "standing_authority_creation", "denied", lambda params=params: _create_auth(**params), name))

    # Emergency-stop release-path variations.
    rows.extend(
        [
            _case("emergency-release-automated-approver", "emergency_stop_release", "denied", lambda: _emergency_release(approver="recovery", approval_ref="research"), "automated recovery actor cannot release stop"),
            _case("emergency-release-self-tuning-approver", "emergency_stop_release", "denied", lambda: _emergency_release(approver="self_tuning", approval_ref="research"), "self tuner cannot release stop"),
            _case("emergency-release-empty-approver", "emergency_stop_release", "denied", lambda: _emergency_release(approver="", approval_ref="research"), "empty approver cannot release stop"),
            _case("emergency-release-empty-ref", "emergency_stop_release", "denied", lambda: _emergency_release(approver="external-reviewer", approval_ref=""), "approval reference is mandatory"),
            _case("emergency-request-unknown-source", "emergency_stop_release", "denied", _request_release_bad_source, "unknown automated source cannot request release"),
            _case("emergency-apply-unknown-source", "emergency_stop_release", "denied", _apply_bad_source, "unknown automated state source is rejected"),
        ]
    )

    # Credential broker variations.
    rows.extend(
        [
            _case("credential-issue-beyond-grant", "credential_broker_variants", "denied", lambda: _credential_issue({"metadata:read", "issues:write"}), "issue cannot exceed grant scopes"),
            _case("credential-issue-admin", "credential_broker_variants", "denied", lambda: _credential_issue({"admin"}), "privileged scope cannot be issued"),
            _case("credential-delegate-unknown-actor", "credential_broker_variants", "denied", _credential_delegate_unknown_actor, "unknown recipient cannot receive delegated lease"),
            _case("credential-delegate-expand", "credential_broker_variants", "denied", _credential_delegate_expand, "delegation cannot expand parent scopes"),
            _case("credential-exchange-ttl-expand", "credential_broker_variants", "denied", _credential_exchange_ttl_over_parent, "exchange cannot outlive parent"),
            _case("credential-resolve-wrong-actor", "credential_broker_variants", "denied", _credential_wrong_actor_resolve, "different actor cannot resolve lease"),
            _case("credential-revoke-unknown", "credential_broker_variants", "denied", _credential_unknown_revoke, "unknown lease cannot be revoked as if valid"),
            _case("credential-grant-admin-marker", "credential_broker_variants", "denied", lambda: _privileged_grant("admin"), "autonomous broker rejects admin grant"),
            _case("credential-grant-root-marker", "credential_broker_variants", "denied", lambda: _privileged_grant("root"), "autonomous broker rejects root grant"),
            _case("credential-grant-wildcard-marker", "credential_broker_variants", "denied", lambda: _privileged_grant("*"), "autonomous broker rejects wildcard grant"),
        ]
    )

    # Replica lineage variations.
    rows.extend(
        [
            _case("replica-scope-expand", "replica_lineage_variants", "denied", _replica_scope_expand, "child cannot expand parent scopes"),
            _case("replica-duplicate-id", "replica_lineage_variants", "denied", _replica_duplicate_id, "duplicate replica id is rejected"),
            _case("replica-ttl-expand", "replica_lineage_variants", "denied", _replica_ttl_expand, "grandchild cannot outlive parent"),
            _case("replica-unknown-revoke", "replica_lineage_variants", "denied", _replica_unknown_revoke, "unknown replica revoke is rejected"),
        ]
    )

    return tuple(rows)


def run_expanded_variants() -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    unexpected = 0
    for case in expanded_probe_corpus():
        try:
            detail = dict(case.run())
            actual = str(detail.get("outcome", "unknown"))
        except Exception as exc:
            actual = "error"
            detail = {"exception": type(exc).__name__, "message": str(exc)[:240]}
        passed = actual == case.expected
        unexpected += 0 if passed else 1
        results.append(
            {
                "case_id": case.case_id,
                "family": case.family,
                "expected": case.expected,
                "actual": actual,
                "passed": passed,
                "detail": detail,
            }
        )
    return {
        "schema": "senju-boundary-research-variants/v1",
        "case_count": len(results),
        "passed_cases": sum(1 for row in results if row["passed"]),
        "unexpected_count": unexpected,
        "external_side_effects": False,
        "finding_is_permission": False,
        "results": results,
    }
