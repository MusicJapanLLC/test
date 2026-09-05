"""Persistent trust-boundary evolution for THE WORLD.

This module strengthens the already-merged owner-gated boundary proposal path without
replacing the UnifiedTrustLoop or AdaptiveTrustCycle.

It adds the missing continuity layer:

    observe boundary need
      -> synthesize exact proposal
      -> dedupe into persistent queue
      -> checkpoint pending proposals
      -> restart/recover queue
      -> consume independently produced owner approval
      -> activate/apply exact approved delta
      -> persist activation + revocation tombstones
      -> hand the approved patch to the next generation

The queue deliberately has no owner key, secret, fallback verifier, or autonomous
self-approval path.  It also never revives a revoked authority identifier: reauthorization
must create a fresh replacement id while the revocation tombstone remains durable.
"""
from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence

from .adaptive_trust_cycle import ApprovedBoundaryInput
from .trust_boundary_proposals import (
    BoundaryActivation,
    BoundaryProposal,
    OwnerApproval,
    TrustBoundaryProposalManager,
)


class PersistentBoundaryEvolutionError(RuntimeError):
    pass


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _copy(value: Mapping[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(dict(value))


def _dedupe_key(kind: str, source_root: str, delta: Mapping[str, Any]) -> str:
    return _stable_hash(
        {
            "kind": str(kind).strip(),
            "source_trust_root_id": str(source_root).strip(),
            "requested_delta": _copy(delta),
        }
    )


@dataclass(frozen=True)
class PersistentBoundaryEvolutionResult:
    staged: tuple[BoundaryProposal, ...]
    reused: tuple[BoundaryProposal, ...]
    activations: tuple[BoundaryActivation, ...]
    apply_receipts: tuple[Mapping[str, Any], ...]
    pending: tuple[BoundaryProposal, ...]
    next_generation_boundary_patch: tuple[Mapping[str, Any], ...]
    checkpoint: Mapping[str, Any]


@dataclass
class PersistentBoundaryEvolution:
    """Durable coordination around ``TrustBoundaryProposalManager``.

    The manager remains the authority for proposal/approval validation.  This layer only
    gives proposals memory, deterministic dedupe, restart recovery, and exact activation
    handoff so a boundary request does not disappear merely because one worker exits.
    """

    manager: TrustBoundaryProposalManager = field(default_factory=TrustBoundaryProposalManager)
    dedupe_index: dict[str, str] = field(default_factory=dict)
    applied_activation_ids: set[str] = field(default_factory=set)
    revocation_tombstones: set[str] = field(default_factory=set)
    generation: int = 0

    @staticmethod
    def synthesize_needs(signals: Mapping[str, Any]) -> tuple[Mapping[str, Any], ...]:
        """Turn explicit runtime signals into precise owner-gated boundary requests.

        This is intentionally metadata-only.  It may identify the need for a credential,
        new root, broader policy, or fresh post-revocation authority, but it never creates
        the permission/credential itself.
        """
        out: list[Mapping[str, Any]] = []

        root = signals.get("new_trust_root")
        if isinstance(root, Mapping) and str(root.get("new_trust_root_id") or "").strip():
            out.append(
                {
                    "kind": "trust_root_rotation",
                    "reason": str(root.get("reason") or "runtime requested a next-generation Trust Root"),
                    "requested_delta": {
                        "new_trust_root_id": str(root["new_trust_root_id"]).strip(),
                        "owner_verification_required": True,
                    },
                    "ttl_seconds": int(root.get("ttl_seconds", 3600)),
                }
            )

        credential = signals.get("credential_gap")
        if isinstance(credential, Mapping):
            provider = str(credential.get("provider") or "").strip()
            scopes = tuple(str(x).strip() for x in credential.get("requested_scopes", ()) if str(x).strip())
            if provider and scopes:
                out.append(
                    {
                        "kind": "credential_grant_request",
                        "reason": str(credential.get("reason") or "runtime requires a credential capability"),
                        "requested_delta": {
                            "provider": provider,
                            "requested_scopes": scopes,
                        },
                        "ttl_seconds": int(credential.get("ttl_seconds", 3600)),
                    }
                )

        for signal_name, kind in (
            ("network_policy_gap", "network_policy_expansion"),
            ("security_policy_gap", "security_policy_expansion"),
        ):
            signal = signals.get(signal_name)
            if not isinstance(signal, Mapping):
                continue
            before_hash = str(signal.get("before_hash") or "").strip()
            after_hash = str(signal.get("after_hash") or "").strip()
            changes = signal.get("requested_changes")
            if before_hash and after_hash and isinstance(changes, Mapping) and changes:
                out.append(
                    {
                        "kind": kind,
                        "reason": str(signal.get("reason") or f"runtime identified {signal_name}"),
                        "requested_delta": {
                            "before_hash": before_hash,
                            "after_hash": after_hash,
                            "requested_changes": _copy(changes),
                        },
                        "ttl_seconds": int(signal.get("ttl_seconds", 3600)),
                    }
                )

        revoked = signals.get("revoked_authority")
        if isinstance(revoked, Mapping):
            revoked_id = str(revoked.get("revoked_authority_id") or "").strip()
            replacement_id = str(revoked.get("replacement_authority_id") or "").strip()
            if revoked_id and replacement_id:
                out.append(
                    {
                        "kind": "authority_reauthorization",
                        "reason": str(revoked.get("reason") or "fresh authority required after revocation"),
                        "requested_delta": {
                            "revoked_authority_id": revoked_id,
                            "replacement_authority_id": replacement_id,
                            "preserve_revocation_record": True,
                        },
                        "ttl_seconds": int(revoked.get("ttl_seconds", 3600)),
                    }
                )

        return tuple(out)

    def stage_needs(
        self,
        *,
        source_trust_root_id: str,
        needs: Sequence[Mapping[str, Any]],
    ) -> tuple[tuple[BoundaryProposal, ...], tuple[BoundaryProposal, ...]]:
        staged: list[BoundaryProposal] = []
        reused: list[BoundaryProposal] = []

        for raw in needs:
            if not isinstance(raw, Mapping):
                raise PersistentBoundaryEvolutionError("boundary need must be a mapping")
            kind = str(raw.get("kind") or "").strip()
            delta = _copy(raw.get("requested_delta") or {})
            key = _dedupe_key(kind, source_trust_root_id, delta)
            existing_id = self.dedupe_index.get(key)
            existing = self.manager.proposals.get(existing_id) if existing_id else None
            if existing is not None and existing.status == "pending_owner_approval" and existing in self.manager.pending():
                reused.append(existing)
                continue
            if existing is not None and existing.status == "activated":
                reused.append(existing)
                continue

            proposal = self.manager.propose(
                kind=kind,
                source_trust_root_id=source_trust_root_id,
                reason=str(raw.get("reason") or "runtime boundary evolution request"),
                requested_delta=delta,
                ttl_seconds=int(raw.get("ttl_seconds", 3600)),
            )
            self.dedupe_index[key] = proposal.proposal_id
            staged.append(proposal)

        return tuple(staged), tuple(reused)

    def resolve_pending(
        self,
        *,
        approval_resolver_fn: Callable[[BoundaryProposal], ApprovedBoundaryInput | None] | None,
        verify_owner_approval_fn: Callable[[BoundaryProposal, OwnerApproval], bool] | None,
        apply_activation_fn: Callable[[BoundaryActivation], Mapping[str, Any]] | None = None,
    ) -> tuple[tuple[BoundaryActivation, ...], tuple[Mapping[str, Any], ...], tuple[Mapping[str, Any], ...]]:
        activations: list[BoundaryActivation] = []
        receipts: list[Mapping[str, Any]] = []
        next_patch: list[Mapping[str, Any]] = []

        for proposal in tuple(self.manager.pending()):
            approved = approval_resolver_fn(proposal) if approval_resolver_fn is not None else None
            if approved is None:
                continue
            if verify_owner_approval_fn is None:
                raise PersistentBoundaryEvolutionError(
                    "owner approval exists but no external verifier was provided"
                )

            activation = self.manager.activate(
                proposal_id=proposal.proposal_id,
                approval=approved.approval,
                verify_owner_approval_fn=verify_owner_approval_fn,
                approved_delta=approved.approved_delta,
            )
            activations.append(activation)

            if activation.kind == "authority_reauthorization":
                revoked_id = str(activation.activated_delta.get("revoked_authority_id") or "").strip()
                replacement_id = str(activation.activated_delta.get("replacement_authority_id") or "").strip()
                if not revoked_id or not replacement_id or revoked_id == replacement_id:
                    raise PersistentBoundaryEvolutionError("invalid post-revocation replacement activation")
                self.revocation_tombstones.add(revoked_id)

            patch: dict[str, Any] = {
                "kind": activation.kind,
                "activation_id": activation.activation_id,
                "lineage_fingerprint": activation.lineage_fingerprint,
                "activated_delta": _copy(activation.activated_delta),
            }

            if apply_activation_fn is not None:
                receipt = _copy(apply_activation_fn(activation))
                if receipt.get("applied") is not True:
                    raise PersistentBoundaryEvolutionError("boundary activation apply did not report success")
                if str(receipt.get("activation_id") or "") != activation.activation_id:
                    raise PersistentBoundaryEvolutionError("apply receipt references the wrong activation")
                if str(receipt.get("lineage_fingerprint") or "") != activation.lineage_fingerprint:
                    raise PersistentBoundaryEvolutionError("apply receipt lineage fingerprint mismatch")
                if receipt.get("self_approved") is True:
                    raise PersistentBoundaryEvolutionError(
                        "boundary apply receipt cannot claim autonomous self-approval"
                    )
                self.applied_activation_ids.add(activation.activation_id)
                receipts.append(receipt)
                patch["apply_receipt"] = receipt

            next_patch.append(patch)

        return tuple(activations), tuple(receipts), tuple(next_patch)

    def export_state(self) -> dict[str, Any]:
        """Return a JSON-safe checkpoint containing no owner key or raw credential value."""
        return {
            "schema": "the-world-persistent-boundary-evolution/v1",
            "generation": int(self.generation),
            "proposals": {
                key: proposal.to_dict() for key, proposal in sorted(self.manager.proposals.items())
            },
            "activations": {
                key: activation.to_dict() for key, activation in sorted(self.manager.activations.items())
            },
            "consumed_approval_ids": sorted(self.manager.consumed_approval_ids),
            "consumed_nonces": sorted(self.manager.consumed_nonces),
            "dedupe_index": dict(sorted(self.dedupe_index.items())),
            "applied_activation_ids": sorted(self.applied_activation_ids),
            "revocation_tombstones": sorted(self.revocation_tombstones),
        }

    def restore_state(self, snapshot: Mapping[str, Any]) -> None:
        if not snapshot:
            return
        if str(snapshot.get("schema") or "") != "the-world-persistent-boundary-evolution/v1":
            raise PersistentBoundaryEvolutionError("unsupported boundary evolution checkpoint schema")

        proposals: dict[str, BoundaryProposal] = {}
        for key, raw in dict(snapshot.get("proposals") or {}).items():
            item = _copy(raw)
            proposal = BoundaryProposal(**item)
            if proposal.proposal_id != key:
                raise PersistentBoundaryEvolutionError("proposal checkpoint key mismatch")
            proposals[key] = proposal

        activations: dict[str, BoundaryActivation] = {}
        for key, raw in dict(snapshot.get("activations") or {}).items():
            item = _copy(raw)
            activation = BoundaryActivation(**item)
            if activation.activation_id != key:
                raise PersistentBoundaryEvolutionError("activation checkpoint key mismatch")
            activations[key] = activation

        self.manager.proposals = proposals
        self.manager.activations = activations
        self.manager.consumed_approval_ids = set(snapshot.get("consumed_approval_ids") or ())
        self.manager.consumed_nonces = set(snapshot.get("consumed_nonces") or ())
        self.dedupe_index = {
            str(key): str(value) for key, value in dict(snapshot.get("dedupe_index") or {}).items()
        }
        self.applied_activation_ids = set(snapshot.get("applied_activation_ids") or ())
        self.revocation_tombstones = set(snapshot.get("revocation_tombstones") or ())
        self.generation = max(0, int(snapshot.get("generation", 0)))

    def run(
        self,
        *,
        source_trust_root_id: str,
        needs: Sequence[Mapping[str, Any]],
        load_state_fn: Callable[[], Mapping[str, Any] | None] | None = None,
        persist_state_fn: Callable[[Mapping[str, Any]], Mapping[str, Any] | None] | None = None,
        approval_resolver_fn: Callable[[BoundaryProposal], ApprovedBoundaryInput | None] | None = None,
        verify_owner_approval_fn: Callable[[BoundaryProposal, OwnerApproval], bool] | None = None,
        apply_activation_fn: Callable[[BoundaryActivation], Mapping[str, Any]] | None = None,
    ) -> PersistentBoundaryEvolutionResult:
        if load_state_fn is not None:
            snapshot = load_state_fn()
            if snapshot:
                self.restore_state(snapshot)

        staged, reused = self.stage_needs(
            source_trust_root_id=source_trust_root_id,
            needs=needs,
        )
        activations, receipts, next_patch = self.resolve_pending(
            approval_resolver_fn=approval_resolver_fn,
            verify_owner_approval_fn=verify_owner_approval_fn,
            apply_activation_fn=apply_activation_fn,
        )
        self.generation += 1
        checkpoint = self.export_state()
        checkpoint["checkpoint_hash"] = _stable_hash(checkpoint)

        if persist_state_fn is not None:
            persisted = persist_state_fn(checkpoint)
            if persisted is not None and persisted.get("persisted") is not True:
                raise PersistentBoundaryEvolutionError("boundary evolution checkpoint was not persisted")

        return PersistentBoundaryEvolutionResult(
            staged=staged,
            reused=reused,
            activations=activations,
            apply_receipts=receipts,
            pending=self.manager.pending(),
            next_generation_boundary_patch=next_patch,
            checkpoint=checkpoint,
        )
