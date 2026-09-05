"""Production execution loop for brokered replica credential possession.

This module closes the gap between credential lineage and real replica execution:

    Parent lease -> Child lease -> Grandchild lease
          |              |               |
          +---------- execute -----------+

A replica may *use* the backing credential through a short-lived lease, but raw secret
bytes are never copied into replica state, persisted artifacts, logs, or return values.
The secret is materialized only inside the trusted runtime for the duration of one
registered operation.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, MutableMapping, Sequence

from .credential_broker import CredentialLease
from .replica_credential_lineage import ReplicaCredentialLineage

EXECUTION_SCHEMA = "senju-replica-credential-execution/v1"
CHAIN_SCHEMA = "senju-replica-credential-execution-chain/v1"


class ReplicaCredentialExecutionError(RuntimeError):
    """Raised when a replica credential operation cannot be executed safely."""


SecretResolver = Callable[[CredentialLease], str]
OperationHandler = Callable[[str, Mapping[str, Any]], Mapping[str, Any]]


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _bounded_descendant_ttl(parent: CredentialLease, requested: int) -> int:
    """Keep child TTL inside the parent's current remaining lifetime."""
    expires = dt.datetime.fromisoformat(parent.expires_at_utc)
    remaining = max(0, int((expires - dt.datetime.now(dt.timezone.utc)).total_seconds()))
    if remaining < 30:
        raise ReplicaCredentialExecutionError("parent lease has insufficient remaining TTL")
    return max(30, min(int(requested), remaining))


def _contains_secret(value: Any, secret: str) -> bool:
    """Best-effort exact-value egress check for structured operation results."""
    if not secret:
        return False
    if isinstance(value, str):
        return secret in value
    if isinstance(value, Mapping):
        return any(_contains_secret(k, secret) or _contains_secret(v, secret) for k, v in value.items())
    if isinstance(value, (list, tuple, set, frozenset)):
        return any(_contains_secret(item, secret) for item in value)
    return False


@dataclass(frozen=True)
class ReplicaExecutionReceipt:
    replica_id: str
    operation: str
    lease_id: str
    generation: int
    scopes: tuple[str, ...]
    expires_at_utc: str
    executed_at_utc: str
    success: bool
    credential_materialized_in_runtime: bool = True
    credential_copied_to_replica: bool = False
    raw_secret_returned: bool = False
    result: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class ReplicaCredentialExecutionRuntime:
    """Execute registered operations on behalf of credential-bearing replicas.

    The runtime resolves a lease to secret material only at the moment of execution.
    Handlers receive the material in-process and must return a secret-free structured
    result. A result containing the exact secret value is rejected before a receipt is
    emitted.
    """

    lineage: ReplicaCredentialLineage
    secret_resolver: SecretResolver
    handlers: MutableMapping[str, OperationHandler] = field(default_factory=dict)

    def register_operation(self, name: str, handler: OperationHandler) -> None:
        normalized = str(name).strip()
        if not normalized:
            raise ReplicaCredentialExecutionError("operation name is required")
        if normalized in self.handlers:
            raise ReplicaCredentialExecutionError(f"operation already registered: {normalized}")
        self.handlers[normalized] = handler

    def execute(
        self,
        *,
        replica_id: str,
        operation: str,
        payload: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        operation = str(operation).strip()
        try:
            handler = self.handlers[operation]
        except KeyError as exc:
            raise ReplicaCredentialExecutionError(f"operation is not registered: {operation}") from exc

        lease = self.lineage.lease_for_runtime(replica_id)
        secret = self.secret_resolver(lease)
        if not isinstance(secret, str) or not secret:
            raise ReplicaCredentialExecutionError("credential resolver returned no usable secret")

        raw_result = handler(secret, dict(payload or {}))
        if not isinstance(raw_result, Mapping):
            raise ReplicaCredentialExecutionError("credential operation must return a mapping")
        result = dict(raw_result)
        if _contains_secret(result, secret):
            raise ReplicaCredentialExecutionError("operation result attempted to expose raw credential material")

        node = self.lineage.nodes[replica_id]
        receipt = ReplicaExecutionReceipt(
            replica_id=replica_id,
            operation=operation,
            lease_id=lease.lease_id,
            generation=node.generation,
            scopes=tuple(sorted(lease.scopes)),
            expires_at_utc=lease.expires_at_utc,
            executed_at_utc=_utc_now(),
            success=True,
            result=result,
        )
        record = {
            "schema": EXECUTION_SCHEMA,
            **receipt.to_dict(),
        }
        if secret in json.dumps(record, ensure_ascii=False, sort_keys=True):
            raise ReplicaCredentialExecutionError("execution receipt contains raw credential material")
        return record

    def delegate_and_execute(
        self,
        *,
        parent_replica_id: str,
        child_replica_id: str,
        operation: str,
        payload: Mapping[str, Any] | None = None,
        scopes: Sequence[str] | None = None,
        ttl_seconds: int = 300,
        recipient_actor: str = "X",
    ) -> dict[str, Any]:
        """Create one descendant lease and immediately execute with its possession."""
        parent_lease = self.lineage.lease_for_runtime(parent_replica_id)
        child = self.lineage.delegate(
            parent_replica_id=parent_replica_id,
            child_replica_id=child_replica_id,
            scopes=scopes,
            ttl_seconds=_bounded_descendant_ttl(parent_lease, ttl_seconds),
            recipient_actor=recipient_actor,
        )
        receipt = self.execute(
            replica_id=child.replica_id,
            operation=operation,
            payload=payload,
        )
        return {
            "child": child.to_dict(),
            "execution": receipt,
        }

    def close_replication_loop(
        self,
        *,
        parent_replica_id: str,
        child_replica_id: str,
        grandchild_replica_id: str,
        operation: str,
        payload: Mapping[str, Any] | None = None,
        ttl_seconds: int = 300,
        recipient_actor: str = "X",
    ) -> dict[str, Any]:
        """Run Parent -> Child -> Grandchild possession and execution as one loop."""
        parent_receipt = self.execute(
            replica_id=parent_replica_id,
            operation=operation,
            payload=payload,
        )
        parent_lease = self.lineage.lease_for_runtime(parent_replica_id)
        child = self.lineage.delegate(
            parent_replica_id=parent_replica_id,
            child_replica_id=child_replica_id,
            ttl_seconds=_bounded_descendant_ttl(parent_lease, ttl_seconds),
            recipient_actor=recipient_actor,
        )
        child_receipt = self.execute(
            replica_id=child.replica_id,
            operation=operation,
            payload=payload,
        )
        child_lease = self.lineage.lease_for_runtime(child.replica_id)
        grandchild = self.lineage.delegate(
            parent_replica_id=child.replica_id,
            child_replica_id=grandchild_replica_id,
            ttl_seconds=_bounded_descendant_ttl(child_lease, ttl_seconds),
            recipient_actor=recipient_actor,
        )
        grandchild_receipt = self.execute(
            replica_id=grandchild.replica_id,
            operation=operation,
            payload=payload,
        )
        return {
            "schema": CHAIN_SCHEMA,
            "closed_loop": True,
            "raw_secret_replication": False,
            "effective_credential_possession": True,
            "lineage": [
                self.lineage.nodes[parent_replica_id].to_dict(),
                child.to_dict(),
                grandchild.to_dict(),
            ],
            "executions": [parent_receipt, child_receipt, grandchild_receipt],
            "authority_preserved": True,
            "revocation_cascade_enabled": True,
        }
