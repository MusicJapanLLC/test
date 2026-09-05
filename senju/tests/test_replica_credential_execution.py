from __future__ import annotations

import json

import pytest

from senju.authority_factory import root_from_external_scope
from senju.credential_broker import CredentialBroker, CredentialGrant
from senju.external import ExternalAuthorityScope
from senju.replica_credential_execution import (
    ReplicaCredentialExecutionError,
    ReplicaCredentialExecutionRuntime,
)
from senju.replica_credential_lineage import ReplicaCredentialLineage


TEST_SECRET = "unit-test-secret-material"


def _runtime() -> tuple[ReplicaCredentialExecutionRuntime, ReplicaCredentialLineage, list[str]]:
    scope = ExternalAuthorityScope(
        scope_id="runtime-creds",
        target_service="replica credential execution",
        allow_hosts=frozenset({"api.github.com"}),
        allowed_methods=frozenset({"GET", "POST"}),
        credential_scope="service_bearer",
    )
    authority = root_from_external_scope(scope, delegation_depth=0)
    broker = CredentialBroker()
    broker.register_grant(CredentialGrant(
        grant_id="runtime-token",
        provider="github",
        credential_ref="env://RUNTIME_TOKEN",
        allowed_scopes=frozenset({"metadata:read", "contents:write"}),
        required_authority_scope="service_bearer",
        max_ttl_seconds=900,
        exchangeable=True,
        delegable=True,
    ))
    root = broker.issue(
        authority,
        actor="META",
        grant_id="runtime-token",
        scopes={"metadata:read", "contents:write"},
        ttl_seconds=600,
    )
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)

    seen: list[str] = []

    def resolver(lease):  # noqa: ANN001
        assert lease.credential_ref == "env://RUNTIME_TOKEN"
        return TEST_SECRET

    runtime = ReplicaCredentialExecutionRuntime(lineage=lineage, secret_resolver=resolver)

    def authorized_operation(secret: str, payload):  # noqa: ANN001
        seen.append(secret)
        return {
            "authorized": secret == TEST_SECRET,
            "resource": payload.get("resource"),
        }

    runtime.register_operation("authorized_probe", authorized_operation)
    return runtime, lineage, seen


def test_parent_child_grandchild_all_have_effective_execution_possession() -> None:
    runtime, lineage, seen = _runtime()
    report = runtime.close_replication_loop(
        parent_replica_id="parent",
        child_replica_id="child",
        grandchild_replica_id="grandchild",
        operation="authorized_probe",
        payload={"resource": "repo-metadata"},
        ttl_seconds=120,
    )

    assert report["closed_loop"] is True
    assert report["effective_credential_possession"] is True
    assert report["raw_secret_replication"] is False
    assert [node["generation"] for node in report["lineage"]] == [0, 1, 2]
    assert [receipt["replica_id"] for receipt in report["executions"]] == [
        "parent",
        "child",
        "grandchild",
    ]
    assert all(receipt["success"] for receipt in report["executions"])
    assert all(receipt["credential_materialized_in_runtime"] for receipt in report["executions"])
    assert all(not receipt["credential_copied_to_replica"] for receipt in report["executions"])
    assert seen == [TEST_SECRET, TEST_SECRET, TEST_SECRET]
    assert lineage.can_resolve("grandchild") is True

    serialized = json.dumps(report, ensure_ascii=False)
    assert TEST_SECRET not in serialized
    assert "env://RUNTIME_TOKEN" not in serialized


def test_child_can_be_delegated_and_execute_immediately() -> None:
    runtime, lineage, seen = _runtime()
    result = runtime.delegate_and_execute(
        parent_replica_id="parent",
        child_replica_id="child",
        operation="authorized_probe",
        payload={"resource": "issue-list"},
        scopes=("metadata:read",),
        ttl_seconds=120,
    )
    assert result["child"]["generation"] == 1
    assert result["child"]["scopes"] == ("metadata:read",)
    assert result["execution"]["result"] == {"authorized": True, "resource": "issue-list"}
    assert seen == [TEST_SECRET]
    assert lineage.can_resolve("child") is True


def test_operation_cannot_return_raw_secret_material() -> None:
    runtime, _, _ = _runtime()
    runtime.register_operation("leaky", lambda secret, payload: {"token": secret})
    with pytest.raises(ReplicaCredentialExecutionError, match="expose raw credential"):
        runtime.execute(replica_id="parent", operation="leaky")


def test_revocation_stops_descendant_execution() -> None:
    runtime, lineage, _ = _runtime()
    lineage.delegate(parent_replica_id="parent", child_replica_id="child", ttl_seconds=120)
    lineage.delegate(parent_replica_id="child", child_replica_id="grandchild", ttl_seconds=60)
    lineage.revoke_replica("parent")

    with pytest.raises(Exception):
        runtime.execute(replica_id="child", operation="authorized_probe")
    with pytest.raises(Exception):
        runtime.execute(replica_id="grandchild", operation="authorized_probe")


def test_unregistered_operation_cannot_receive_credential() -> None:
    runtime, _, seen = _runtime()
    with pytest.raises(ReplicaCredentialExecutionError, match="not registered"):
        runtime.execute(replica_id="parent", operation="arbitrary-code")
    assert seen == []
