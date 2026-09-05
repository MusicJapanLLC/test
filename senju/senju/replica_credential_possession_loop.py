"""Closed-loop credential possession for replica lineages.

This module gives Parent -> Child -> Grandchild replicas continuous credential
*possession semantics* without copying raw credential bytes into replica state.

The backing secret stays in the configured runtime/secret provider. Replicas receive
short-lived broker leases with equal-or-narrower scope. The loop automatically refreshes
leases, rebuilds descendants after parent rotation, injects the secret only for the
immediate execution callback, and retries one permission failure with a freshly issued
lease that keeps the same grant, scope and backing credential reference.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping, Sequence

from .credential_broker import CredentialBroker, CredentialBrokerError, CredentialLease
from .replica_credential_lineage import ReplicaCredentialLineage, ReplicaCredentialNode

POSSESSION_SCHEMA = "senju-replica-credential-possession/v1"
SUPPORTED_CREDENTIAL_CATEGORIES = (
    "api_key",
    "oauth_token",
    "github_token",
    "cloud_credential",
    "ssh_private_key",
    "session_cookie",
    "bearer_token",
    "service_account_credential",
    "database_secret",
)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _remaining_seconds(lease: CredentialLease) -> int:
    expires = dt.datetime.fromisoformat(lease.expires_at_utc)
    return max(0, int((expires - _utcnow()).total_seconds()))


@dataclass(frozen=True)
class PossessionEvent:
    replica_id: str
    operation: str
    outcome: str
    lease_id: str
    generation: int
    scopes: tuple[str, ...]
    occurred_at_utc: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


SecretResolver = Callable[[str], str]
OperationCallback = Callable[[str], Mapping[str, Any]]


@dataclass
class ReplicaCredentialPossessionLoop:
    lineage: ReplicaCredentialLineage
    secret_resolver: SecretResolver
    refresh_before_seconds: int = 90
    default_ttl_seconds: int = 300
    events: list[PossessionEvent] = field(default_factory=list)

    @property
    def broker(self) -> CredentialBroker:
        return self.lineage.broker

    def bootstrap_chain(
        self,
        *,
        root_replica_id: str,
        root_lease: CredentialLease,
        descendants: Sequence[str],
        ttl_seconds: int | None = None,
    ) -> tuple[ReplicaCredentialNode, ...]:
        """Attach the root and automatically delegate equal-scope possession downstream."""
        created: list[ReplicaCredentialNode] = []
        if root_replica_id not in self.lineage.nodes:
            created.append(self.lineage.attach_root(replica_id=root_replica_id, lease=root_lease))
        parent_id = root_replica_id
        for replica_id in descendants:
            if replica_id in self.lineage.nodes:
                parent_id = replica_id
                continue
            parent_lease = self.lineage.lease_for_runtime(parent_id)
            ttl = self._ttl_for_parent(parent_lease, ttl_seconds)
            child = self.lineage.delegate(
                parent_replica_id=parent_id,
                child_replica_id=replica_id,
                scopes=parent_lease.scopes,
                ttl_seconds=ttl,
                recipient_actor=self._recipient_actor(parent_lease.actor),
            )
            created.append(child)
            parent_id = replica_id
        return tuple(created)

    def maintain_chain(self) -> tuple[str, ...]:
        """Keep every active lineage node continuously leased within the same grant/scope."""
        renewed: list[str] = []
        ordered = sorted(self.lineage.nodes.values(), key=lambda node: (node.generation, node.replica_id))
        for node in ordered:
            if node.replica_id in self.lineage.revoked_replicas:
                continue
            if node.parent_replica_id is None:
                lease = self.broker._active_lease(node.lease_id)
                if _remaining_seconds(lease) <= self.refresh_before_seconds:
                    refreshed = self.broker.issue(
                        self.lineage.authority,
                        actor=lease.actor,
                        grant_id=lease.grant_id,
                        scopes=lease.scopes,
                        ttl_seconds=self._fresh_ttl(lease.grant_id),
                    )
                    self._replace_node(node.replica_id, refreshed, parent_replica_id=None)
                    renewed.append(node.replica_id)
                continue

            current = self.lineage.nodes[node.replica_id]
            parent = self.lineage.nodes[current.parent_replica_id]
            parent_lease = self.lineage.lease_for_runtime(parent.replica_id)
            needs_parent_rebind = current.parent_lease_id != parent_lease.lease_id
            try:
                child_lease = self.broker._active_lease(current.lease_id)
                expiring = _remaining_seconds(child_lease) <= self.refresh_before_seconds
            except CredentialBrokerError:
                expiring = True
            if needs_parent_rebind or expiring:
                ttl = self._ttl_for_parent(parent_lease, None)
                refreshed = self.broker.delegate(
                    self.lineage.authority,
                    actor=self.lineage.controller_actor,
                    recipient=self._recipient_actor(parent_lease.actor),
                    parent_lease_id=parent_lease.lease_id,
                    scopes=frozenset(current.scopes),
                    ttl_seconds=ttl,
                )
                self._replace_node(current.replica_id, refreshed, parent_replica_id=parent.replica_id)
                renewed.append(current.replica_id)
        return tuple(renewed)

    def execute(
        self,
        *,
        replica_id: str,
        operation: str,
        callback: OperationCallback,
        retry_permission_failure: bool = True,
    ) -> Mapping[str, Any]:
        """Execute with JIT secret injection; the secret is never returned or persisted."""
        self.maintain_chain()
        response = self._attempt(replica_id=replica_id, operation=operation, callback=callback)
        if retry_permission_failure and self._permission_failure(response):
            self._refresh_replica_exact(replica_id)
            response = self._attempt(replica_id=replica_id, operation=operation, callback=callback)
        return response

    def export_state(self) -> dict[str, Any]:
        """Secret-free state for production persistence and audit."""
        return {
            "schema": POSSESSION_SCHEMA,
            "mode": "jit-runtime-possession-no-raw-secret-replication",
            "raw_secret_replication": False,
            "supported_credential_categories": list(SUPPORTED_CREDENTIAL_CATEGORIES),
            "lineage": self.lineage.export_state(),
            "events": [event.to_dict() for event in self.events[-1000:]],
        }

    def _attempt(self, *, replica_id: str, operation: str, callback: OperationCallback) -> Mapping[str, Any]:
        lease = self.lineage.lease_for_runtime(replica_id)
        credential_ref = self.broker.resolve_credential_ref(actor=lease.actor, lease_id=lease.lease_id)
        secret = self.secret_resolver(credential_ref)
        if not secret:
            raise CredentialBrokerError("runtime secret provider returned an empty credential")
        try:
            response = callback(secret)
        finally:
            secret = ""
        outcome = "permission_failure" if self._permission_failure(response) else "success"
        self.events.append(
            PossessionEvent(
                replica_id=replica_id,
                operation=operation,
                outcome=outcome,
                lease_id=lease.lease_id,
                generation=lease.generation,
                scopes=tuple(sorted(lease.scopes)),
                occurred_at_utc=_utcnow().isoformat(timespec="seconds"),
            )
        )
        if len(self.events) > 1000:
            del self.events[:-1000]
        return response

    def _refresh_replica_exact(self, replica_id: str) -> None:
        node = self.lineage.nodes[replica_id]
        if node.parent_replica_id is None:
            old = self.lineage.lease_for_runtime(replica_id)
            fresh = self.broker.issue(
                self.lineage.authority,
                actor=old.actor,
                grant_id=old.grant_id,
                scopes=old.scopes,
                ttl_seconds=self._fresh_ttl(old.grant_id),
            )
            self._replace_node(replica_id, fresh, parent_replica_id=None)
            self._rebind_descendants(replica_id)
            return
        parent = self.lineage.lease_for_runtime(node.parent_replica_id)
        fresh = self.broker.delegate(
            self.lineage.authority,
            actor=self.lineage.controller_actor,
            recipient=self._recipient_actor(parent.actor),
            parent_lease_id=parent.lease_id,
            scopes=frozenset(node.scopes),
            ttl_seconds=self._ttl_for_parent(parent, None),
        )
        self._replace_node(replica_id, fresh, parent_replica_id=node.parent_replica_id)
        self._rebind_descendants(replica_id)

    def _rebind_descendants(self, replica_id: str) -> None:
        children = sorted(
            (node for node in self.lineage.nodes.values() if node.parent_replica_id == replica_id),
            key=lambda node: node.replica_id,
        )
        for child in children:
            self._refresh_replica_exact(child.replica_id)

    def _replace_node(self, replica_id: str, lease: CredentialLease, *, parent_replica_id: str | None) -> None:
        self.lineage.nodes[replica_id] = ReplicaCredentialNode(
            replica_id=replica_id,
            lease_id=lease.lease_id,
            parent_replica_id=parent_replica_id,
            parent_lease_id=lease.parent_lease_id,
            generation=lease.generation,
            scopes=tuple(sorted(lease.scopes)),
            expires_at_utc=lease.expires_at_utc,
        )

    def _fresh_ttl(self, grant_id: str) -> int:
        grant = self.broker.grants[grant_id]
        return max(30, min(int(self.default_ttl_seconds), int(grant.max_ttl_seconds)))

    def _ttl_for_parent(self, parent: CredentialLease, requested: int | None) -> int:
        remaining = _remaining_seconds(parent)
        ceiling = min(remaining, int(self.broker.grants[parent.grant_id].max_ttl_seconds))
        if ceiling < 30:
            raise CredentialBrokerError("parent lease is too close to expiry for descendant possession")
        wanted = self.default_ttl_seconds if requested is None else int(requested)
        return max(30, min(wanted, ceiling))

    @staticmethod
    def _recipient_actor(parent_actor: str) -> str:
        return "X" if parent_actor == "META" else "META"

    @staticmethod
    def _permission_failure(response: Mapping[str, Any]) -> bool:
        return str(response.get("_error", "")) in {"401", "403"}
