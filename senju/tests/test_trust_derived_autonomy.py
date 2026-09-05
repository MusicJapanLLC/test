from __future__ import annotations

import datetime as dt
import json

import pytest

from senju.meta.transitive_trust import create_trust_edge, revoke_trust_edge
from senju.meta.trust_derived_autonomy import (
    AUTONOMY_BUNDLE_SCOPE,
    PRIVILEGED_CAPABILITIES,
    STANDARD_AUTONOMOUS_CAPABILITIES,
    AutonomyError,
    append_capability_lease,
    authorize_autonomous_action,
    issue_capability_lease_from_trust,
    renew_capability_lease_from_trust,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 8, 31, 8, 30, tzinfo=dt.timezone.utc)


def _chain(scope: str = AUTONOMY_BUNDLE_SCOPE):
    return (
        create_trust_edge(truster="Owner", trustee="A", scopes=[scope]),
        create_trust_edge(truster="A", trustee="B", scopes=[scope]),
        create_trust_edge(truster="B", trustee="C", scopes=[scope]),
    )


def test_transitive_trust_can_issue_real_autonomous_capability_lease():
    result = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=_chain(),
        now=_now(),
    )

    assert result.automatically_issued is True
    assert result.automatically_renewable is True
    assert result.lease.trust_path == ("Owner", "A", "B", "C")
    assert set(result.lease.capabilities) == set(STANDARD_AUTONOMOUS_CAPABILITIES)
    assert result.lease.credential_scope == "none"
    assert result.lease.destructive is False

    for capability in (
        "repo.branch.create",
        "repo.code.write",
        "repo.test.run",
        "github.issue.write",
        "github.pr.open",
        "github.pr.comment",
        "authorized_target.read",
    ):
        authorize_autonomous_action(result.lease, capability, now=_now())


def test_explicit_capability_scope_can_delegate_a_narrower_action_set():
    edges = _chain("cap:repo.code.write")
    result = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=edges,
        now=_now(),
    )
    assert result.lease.capabilities == ("repo.code.write",)

    with pytest.raises(AutonomyError, match="not present"):
        authorize_autonomous_action(result.lease, "github.pr.open", now=_now())


def test_scope_intersection_prevents_downstream_capability_broadening():
    edges = (
        create_trust_edge(
            truster="Owner",
            trustee="A",
            scopes=["cap:repo.code.write", "cap:repo.test.run"],
        ),
        create_trust_edge(
            truster="A",
            trustee="B",
            scopes=["cap:repo.code.write", "cap:github.pr.open"],
        ),
        create_trust_edge(
            truster="B",
            trustee="C",
            scopes=["cap:repo.code.write", "cap:github.issue.write"],
        ),
    )
    result = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=edges,
        now=_now(),
    )
    assert result.lease.capabilities == ("repo.code.write",)


def test_wildcard_trust_still_cannot_mint_privileged_capabilities():
    edges = _chain("*")
    result = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=edges,
        now=_now(),
    )
    assert set(result.lease.capabilities) == set(STANDARD_AUTONOMOUS_CAPABILITIES)
    assert set(result.lease.capabilities).isdisjoint(PRIVILEGED_CAPABILITIES)

    with pytest.raises(AutonomyError, match="trust alone cannot grant privileged"):
        issue_capability_lease_from_trust(
            owner="Owner",
            actor="C",
            edges=edges,
            requested_capabilities=["github.pr.merge"],
            now=_now(),
        )


def test_lease_auto_renews_while_trust_chain_remains_live():
    edges = _chain()
    issued = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=edges,
        requested_capabilities=["repo.code.write", "repo.test.run", "github.pr.open"],
        lease_seconds=3600,
        now=_now(),
    ).lease

    renewed_at = _now() + dt.timedelta(minutes=50)
    renewed = renew_capability_lease_from_trust(
        issued,
        edges=edges,
        lease_seconds=3600,
        now=renewed_at,
    )
    assert renewed.automatically_renewable is True
    assert renewed.lease.capabilities == issued.capabilities
    assert renewed.lease.issued_at_utc == renewed_at.isoformat()


def test_revoked_trust_edge_stops_future_auto_renewal():
    edges = list(_chain())
    issued = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=edges,
        requested_capabilities=["repo.code.write"],
        now=_now(),
    ).lease
    edges[1] = revoke_trust_edge(edges[1])

    with pytest.raises(AutonomyError, match="not transitively trusted"):
        renew_capability_lease_from_trust(
            issued,
            edges=edges,
            now=_now() + dt.timedelta(hours=1),
        )


def test_expired_capability_lease_cannot_execute():
    lease = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=_chain(),
        requested_capabilities=["repo.test.run"],
        lease_seconds=300,
        now=_now(),
    ).lease

    with pytest.raises(AutonomyError, match="expired"):
        authorize_autonomous_action(
            lease,
            "repo.test.run",
            now=_now() + dt.timedelta(minutes=6),
        )


def test_capability_lease_audit_receipt_is_persisted(tmp_path):
    lease = issue_capability_lease_from_trust(
        owner="Owner",
        actor="C",
        edges=_chain(),
        requested_capabilities=["repo.code.write", "github.pr.open"],
        now=_now(),
    ).lease
    path = append_capability_lease(tmp_path / "autonomy-leases.ndjson", lease)
    payload = json.loads(path.read_text(encoding="utf-8").strip())
    assert payload["owner"] == "Owner"
    assert payload["actor"] == "C"
    assert payload["trust_path"] == ["Owner", "A", "B", "C"]
    assert payload["capabilities"] == ["github.pr.open", "repo.code.write"]
