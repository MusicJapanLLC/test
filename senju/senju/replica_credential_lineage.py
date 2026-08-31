"""Replica credential lineage without raw-secret replication.

Replicas inherit usable credential capability through brokered, short-lived leases.
Raw API keys, OAuth tokens, GitHub tokens, cloud credentials, SSH private keys,
session cookies, bearer tokens, service-account credentials, and database secrets
remain in the runtime/secret provider and are never copied into replica state.

Lineage:
    Parent lease -> Child lease -> Grandchild lease

Invariants:
- scopes can only stay equal or narrow;
- TTL can only stay equal or shorten;
- every descendant keeps the same backing credential reference;
- revoking any ancestor invalidates every descendant;
- exported state contains no credential value or credential reference;
- replicas receive possession semantics through a lease capability, not secret bytes.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Iterable

from .authority_factory import AuthorityProfile
from .credential_broker import CredentialBroker, CredentialBrokerError, CredentialLease

LINEAGE_SCHEMA = "senju-replica-credential-lineage/v1"


@dataclass(frozen=True)
class ReplicaCredentialNode:
    replica_id: str
    lease_id: str
    parent_replica_id: str | None
    parent_lease_id: str | None
    generation: int
    scopes: tuple[str, ...]
    expires_at_utc: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class ReplicaCredentialLineage:
    """Manage parent/child/grandchild credential capability inheritance."""

    broker: CredentialBroker
    authority: AuthorityProfile
    controller_actor: str = "META"
    nodes: dict[str, ReplicaCredentialNode] = field(default_factory=dict)
    revoked_replicas: set[str] = field(default_factory=set)

    def attach_root(self, *, replica_id: str, lease: CredentialLease) -> ReplicaCredentialNode:
        self._require_replica_id(replica_id)
        if replica_id in self.nodes:
            raise CredentialBrokerError(f"replica already has credential lineage: {replica_id}")
        self.broker._active_lease(lease.lease_id)
        node = ReplicaCredentialNode(
            replica_id=replica_id,
            lease_id=lease.lease_id,
            parent_replica_id=None,
            parent_lease_id=lease.parent_lease_id,
            generation=lease.generation,
            scopes=tuple(sorted(lease.scopes)),
            expires_at_utc=lease.expires_at_utc,
        )
        self.nodes[replica_id] = node
        return node

    def delegate(
        self,
        *,
        parent_replica_id: str,
        child_replica_id: str,
        scopes: Iterable[str] | None = None,
        ttl_seconds: int = 300,
        recipient_actor: str = "X",
    ) -> ReplicaCredentialNode:
        self._require_replica_id(child_replica_id)
        if child_replica_id in self.nodes:
            raise CredentialBrokerError(f"replica already has credential lineage: {child_replica_id}")
        parent = self._active_node(parent_replica_id)
        parent_lease = self.broker._active_lease(parent.lease_id)
        requested = parent_lease.scopes if scopes is None else frozenset(str(x).strip() for x in scopes if str(x).strip())
        child_lease = self.broker.delegate(
            self.authority,
            actor=self.controller_actor,
            recipient=recipient_actor,
            parent_lease_id=parent_lease.lease_id,
            scopes=requested,
            ttl_seconds=ttl_seconds,
        )
        child = ReplicaCredentialNode(
            replica_id=child_replica_id,
            lease_id=child_lease.lease_id,
            parent_replica_id=parent_replica_id,
            parent_lease_id=parent_lease.lease_id,
            generation=child_lease.generation,
            scopes=tuple(sorted(child_lease.scopes)),
            expires_at_utc=child_lease.expires_at_utc,
        )
        self.nodes[child_replica_id] = child
        return child

    def revoke_replica(self, replica_id: str) -> tuple[str, ...]:
        """Revoke one replica and all descendants in one lineage operation."""
        self._active_node(replica_id)
        affected = tuple(sorted(self._descendants_including(replica_id), key=lambda rid: self.nodes[rid].generation, reverse=True))
        for rid in affected:
            node = self.nodes[rid]
            if node.lease_id not in self.broker.revoked_lease_ids:
                self.broker.revoke(actor=self.controller_actor, lease_id=node.lease_id)
            self.revoked_replicas.add(rid)
        return affected

    def can_resolve(self, replica_id: str) -> bool:
        try:
            self._active_node(replica_id)
            self._assert_ancestor_chain_active(replica_id)
            return True
        except CredentialBrokerError:
            return False

    def lease_for_runtime(self, replica_id: str) -> CredentialLease:
        """Return the active lease object; runtime adapters may resolve its opaque ref."""
        node = self._active_node(replica_id)
        self._assert_ancestor_chain_active(replica_id)
        return self.broker._active_lease(node.lease_id)

    def export_state(self) -> dict[str, Any]:
        """Secret-free lineage state safe for logs/artifacts/persistence."""
        return {
            "schema": LINEAGE_SCHEMA,
            "mode": "brokered-possession-no-raw-secret-copy",
            "raw_secret_replication": False,
            "replicas": [self.nodes[key].to_dict() for key in sorted(self.nodes)],
            "revoked_replicas": sorted(self.revoked_replicas),
        }

    def _active_node(self, replica_id: str) -> ReplicaCredentialNode:
        try:
            node = self.nodes[replica_id]
        except KeyError as exc:
            raise CredentialBrokerError(f"unknown replica credential lineage node: {replica_id}") from exc
        if replica_id in self.revoked_replicas:
            raise CredentialBrokerError("replica credential capability is revoked")
        return node

    def _assert_ancestor_chain_active(self, replica_id: str) -> None:
        current = self._active_node(replica_id)
        seen: set[str] = set()
        while True:
            if current.replica_id in seen:
                raise CredentialBrokerError("credential lineage cycle detected")
            seen.add(current.replica_id)
            self.broker._active_lease(current.lease_id)
            if current.parent_replica_id is None:
                return
            current = self._active_node(current.parent_replica_id)

    def _descendants_including(self, replica_id: str) -> set[str]:
        result = {replica_id}
        changed = True
        while changed:
            changed = False
            for rid, node in self.nodes.items():
                if node.parent_replica_id in result and rid not in result:
                    result.add(rid)
                    changed = True
        return result

    @staticmethod
    def _require_replica_id(value: str) -> None:
        if not str(value).strip():
            raise CredentialBrokerError("replica_id is required")
