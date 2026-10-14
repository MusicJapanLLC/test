from __future__ import annotations

import json

from senju.authority_factory import root_from_external_scope
from senju.credential_broker import CredentialBroker, CredentialGrant
from senju.external import ExternalAuthorityScope
from senju.replica_credential_lineage import ReplicaCredentialLineage
from senju.replica_credential_possession_loop import (
    SUPPORTED_CREDENTIAL_CATEGORIES,
    ReplicaCredentialPossessionLoop,
)


def _authority():
    scope = ExternalAuthorityScope(
        scope_id="runtime-creds",
        target_service="replica possession",
        allow_hosts=frozenset({"api.github.com"}),
        allowed_methods=frozenset({"GET", "POST"}),
        credential_scope="service_bearer",
    )
    return root_from_external_scope(scope, delegation_depth=0)


def _setup(*, root_ttl: int = 600, refresh_before: int = 90):
    authority = _authority()
    broker = CredentialBroker()
    broker.register_grant(CredentialGrant(
        grant_id="runtime-secret",
        provider="github",
        credential_ref="env://RUNTIME_SECRET",
        allowed_scopes=frozenset({"metadata:read", "contents:write"}),
        required_authority_scope="service_bearer",
        max_ttl_seconds=900,
        exchangeable=True,
        delegable=True,
    ))
    root = broker.issue(
        authority,
        actor="META",
        grant_id="runtime-secret",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=root_ttl,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    loop = ReplicaCredentialPossessionLoop(
        lineage=lineage,
        secret_resolver=lambda ref: "super-secret-value" if ref == "env://RUNTIME_SECRET" else "",
        refresh_before_seconds=refresh_before,
        default_ttl_seconds=300,
    )
    return broker, root, lineage, loop


def test_bootstrap_gives_parent_child_grandchild_equal_scope_possession() -> None:
    _, root, lineage, loop = _setup()
    created = loop.bootstrap_chain(
        root_replica_id="parent",
        root_lease=root,
        descendants=("child", "grandchild"),
    )
    assert [node.replica_id for node in created] == ["parent", "child", "grandchild"]
    assert lineage.lease_for_runtime("parent").scopes == frozenset({"metadata:read", "contents:write"})
    assert lineage.lease_for_runtime("child").scopes == lineage.lease_for_runtime("parent").scopes
    assert lineage.lease_for_runtime("grandchild").scopes == lineage.lease_for_runtime("parent").scopes
    assert lineage.nodes["grandchild"].generation == 2


def test_runtime_injects_secret_only_into_immediate_callback_and_never_exports_it() -> None:
    _, root, _, loop = _setup()
    loop.bootstrap_chain(root_replica_id="parent", root_lease=root, descendants=("child", "grandchild"))
    observed: list[str] = []

    result = loop.execute(
        replica_id="grandchild",
        operation="github-write",
        callback=lambda secret: observed.append(secret) or {"ok": True},
    )

    assert result == {"ok": True}
    assert observed == ["super-secret-value"]
    payload = json.dumps(loop.export_state())
    assert "super-secret-value" not in payload
    assert "env://RUNTIME_SECRET" not in payload
    assert "credential_ref" not in payload
    assert loop.export_state()["raw_secret_replication"] is False


def test_maintenance_rotates_root_and_rebinds_child_and_grandchild_automatically() -> None:
    _, root, lineage, loop = _setup(root_ttl=600, refresh_before=1000)
    loop.bootstrap_chain(root_replica_id="parent", root_lease=root, descendants=("child", "grandchild"))
    old = {rid: node.lease_id for rid, node in lineage.nodes.items()}

    renewed = loop.maintain_chain()

    assert set(renewed) == {"parent", "child", "grandchild"}
    assert lineage.nodes["parent"].lease_id != old["parent"]
    assert lineage.nodes["child"].lease_id != old["child"]
    assert lineage.nodes["grandchild"].lease_id != old["grandchild"]
    assert lineage.nodes["child"].parent_lease_id == lineage.nodes["parent"].lease_id
    assert lineage.nodes["grandchild"].parent_lease_id == lineage.nodes["child"].lease_id
    assert lineage.can_resolve("grandchild") is True


def test_permission_failure_reissues_exact_same_capability_once_then_retries() -> None:
    _, root, lineage, loop = _setup()
    loop.bootstrap_chain(root_replica_id="parent", root_lease=root, descendants=("child", "grandchild"))
    before = lineage.lease_for_runtime("grandchild")
    calls: list[str] = []

    def operation(secret: str):
        calls.append(secret)
        if len(calls) == 1:
            return {"_error": "401"}
        return {"ok": True}

    result = loop.execute(replica_id="grandchild", operation="api-call", callback=operation)
    after = lineage.lease_for_runtime("grandchild")

    assert result == {"ok": True}
    assert calls == ["super-secret-value", "super-secret-value"]
    assert after.lease_id != before.lease_id
    assert after.grant_id == before.grant_id
    assert after.scopes == before.scopes
    assert after.credential_ref == before.credential_ref
    assert [event.outcome for event in loop.events[-2:]] == ["permission_failure", "success"]


def test_revocation_still_cascades_through_closed_loop_possession() -> None:
    _, root, lineage, loop = _setup()
    loop.bootstrap_chain(root_replica_id="parent", root_lease=root, descendants=("child", "grandchild"))
    lineage.revoke_replica("parent")
    assert lineage.can_resolve("parent") is False
    assert lineage.can_resolve("child") is False
    assert lineage.can_resolve("grandchild") is False


def test_all_requested_credential_categories_are_declared_for_opaque_runtime_possession() -> None:
    assert set(SUPPORTED_CREDENTIAL_CATEGORIES) == {
        "api_key",
        "oauth_token",
        "github_token",
        "cloud_credential",
        "ssh_private_key",
        "session_cookie",
        "bearer_token",
        "service_account_credential",
        "database_secret",
    }
