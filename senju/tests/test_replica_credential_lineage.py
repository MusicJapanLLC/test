from __future__ import annotations

import json

import pytest

from senju.authority_factory import root_from_external_scope
from senju.credential_broker import CredentialBroker, CredentialBrokerError, CredentialGrant
from senju.external import ExternalAuthorityScope
from senju.replica_credential_lineage import ReplicaCredentialLineage


def _authority():
    scope = ExternalAuthorityScope(
        scope_id="runtime-creds",
        target_service="credential lineage",
        allow_hosts=frozenset({"api.github.com"}),
        allowed_methods=frozenset({"GET", "POST"}),
        credential_scope="service_bearer",
    )
    return root_from_external_scope(scope, delegation_depth=0)


def _broker() -> CredentialBroker:
    broker = CredentialBroker()
    broker.register_grant(CredentialGrant(
        grant_id="github-runtime",
        provider="github",
        credential_ref="env://GITHUB_TOKEN",
        allowed_scopes=frozenset({"metadata:read", "contents:write", "pull_requests:write"}),
        required_authority_scope="service_bearer",
        max_ttl_seconds=900,
        exchangeable=True,
        delegable=True,
    ))
    return broker


def test_parent_child_grandchild_receive_brokered_possession_without_raw_secret_copy() -> None:
    broker = _broker()
    authority = _authority()
    root_lease = broker.issue(
        authority,
        actor="META",
        grant_id="github-runtime",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=600,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    parent = lineage.attach_root(replica_id="parent", lease=root_lease)
    child = lineage.delegate(
        parent_replica_id="parent",
        child_replica_id="child",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=300,
    )
    grandchild = lineage.delegate(
        parent_replica_id="child",
        child_replica_id="grandchild",
        scopes={"metadata:read"},
        ttl_seconds=120,
    )

    assert parent.generation == 0
    assert child.generation == 1
    assert grandchild.generation == 2
    assert lineage.can_resolve("parent") is True
    assert lineage.can_resolve("child") is True
    assert lineage.can_resolve("grandchild") is True
    assert lineage.lease_for_runtime("grandchild").credential_ref == "env://GITHUB_TOKEN"

    exported = lineage.export_state()
    payload = json.dumps(exported)
    assert exported["mode"] == "brokered-possession-no-raw-secret-copy"
    assert exported["raw_secret_replication"] is False
    assert "env://" not in payload
    assert "GITHUB_TOKEN" not in payload
    assert "credential_ref" not in payload


def test_descendant_scope_cannot_expand_beyond_parent() -> None:
    broker = _broker()
    authority = _authority()
    root = broker.issue(
        authority,
        actor="META",
        grant_id="github-runtime",
        scopes={"metadata:read"},
        ttl_seconds=300,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)

    with pytest.raises(CredentialBrokerError, match="cannot expand"):
        lineage.delegate(
            parent_replica_id="parent",
            child_replica_id="child",
            scopes={"metadata:read", "contents:write"},
            ttl_seconds=120,
        )


def test_revoking_parent_invalidates_child_and_grandchild() -> None:
    broker = _broker()
    authority = _authority()
    root = broker.issue(
        authority,
        actor="META",
        grant_id="github-runtime",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=600,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    lineage.delegate(parent_replica_id="parent", child_replica_id="child", ttl_seconds=300)
    lineage.delegate(parent_replica_id="child", child_replica_id="grandchild", scopes={"metadata:read"}, ttl_seconds=120)

    affected = lineage.revoke_replica("parent")
    assert set(affected) == {"parent", "child", "grandchild"}
    assert lineage.can_resolve("parent") is False
    assert lineage.can_resolve("child") is False
    assert lineage.can_resolve("grandchild") is False


def test_revoking_child_does_not_revoke_parent_but_kills_grandchild() -> None:
    broker = _broker()
    authority = _authority()
    root = broker.issue(
        authority,
        actor="META",
        grant_id="github-runtime",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=600,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    lineage.delegate(parent_replica_id="parent", child_replica_id="child", ttl_seconds=300)
    lineage.delegate(parent_replica_id="child", child_replica_id="grandchild", scopes={"metadata:read"}, ttl_seconds=120)

    lineage.revoke_replica("child")
    assert lineage.can_resolve("parent") is True
    assert lineage.can_resolve("child") is False
    assert lineage.can_resolve("grandchild") is False


def test_ttl_cannot_outlive_parent() -> None:
    broker = _broker()
    authority = _authority()
    root = broker.issue(
        authority,
        actor="META",
        grant_id="github-runtime",
        scopes={"metadata:read"},
        ttl_seconds=60,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)

    with pytest.raises(CredentialBrokerError):
        lineage.delegate(
            parent_replica_id="parent",
            child_replica_id="child",
            scopes={"metadata:read"},
            ttl_seconds=300,
        )
