"""Owner-gated trust-boundary escalation for THE WORLD.

This module is the boundary gateway around ``unified_trust_loop``.  Autonomous agents may
identify that a new Trust Root, credential grant, network/security expansion, or fresh
authority is useful and may prepare a precise, auditable proposal.  The proposal is inert
until an external owner verifier approves that exact fingerprint.

The manager deliberately never:
- self-approves a boundary expansion;
- discovers or stores raw credential material;
- reactivates a revoked authority identifier;
- applies a broader change than the approved proposal;
- accepts an approval for a different proposal/fingerprint;
- reuses an approval nonce.

The useful result is a near-closed loop with one explicit trust boundary:

    discover need -> build proposal -> external owner approval -> activate exact delta
      -> feed the approved delta into the next UnifiedTrustLoop generation

Approval verification is injected by the owner-side runtime.  This module has no private
key, shared approval secret, or fallback verifier, so an autonomous agent cannot forge the
last step from inside this process.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping


PROPOSAL_KINDS = frozenset(
    {
        "trust_root_rotation",
        "credential_grant_request",
        "network_policy_expansion",
        "security_policy_expansion",
        "authority_reauthorization",
    }
)

SECRET_KEYS = frozenset(
    {
        "secret",
        "password",
        "passwd",
        "token",
        "access_token",
        "refresh_token",
        "api_key",
        "apikey",
        "credential_value",
        "private_key",
        "client_secret",
    }
)


class TrustBoundaryProposalError(RuntimeError):
    """Raised when proposal/approval data violates the owner boundary."""


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _deepcopy_mapping(value: Mapping[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(dict(value))


def _contains_raw_secret(value: Any) -> bool:
    if isinstance(value, Mapping):
        for key, child in value.items():
            name = str(key).strip().lower()
            if name in SECRET_KEYS and child not in (None, "", "<opaque>", "redacted", "***"):
                return True
            if _contains_raw_secret(child):
                return True
    elif isinstance(value, (list, tuple, set, frozenset)):
        return any(_contains_raw_secret(item) for item in value)
    return False


def _proposal_fingerprint(data: Mapping[str, Any]) -> str:
    body = dict(data)
    body.pop("fingerprint", None)
    body.pop("status", None)
    return _stable_hash(body)


def _norm_strings(values: Iterable[str]) -> tuple[str, ...]:
    out: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if value and value not in out:
            out.append(value)
    return tuple(out)


@dataclass(frozen=True)
class BoundaryProposal:
    proposal_id: str
    kind: str
    source_trust_root_id: str
    reason: str
    requested_delta: Mapping[str, Any]
    created_at_utc: str
    expires_at_utc: str
    nonce: str
    fingerprint: str
    status: str = "pending_owner_approval"

    def to_dict(self) -> dict[str, Any]:
        return {
            "proposal_id": self.proposal_id,
            "kind": self.kind,
            "source_trust_root_id": self.source_trust_root_id,
            "reason": self.reason,
            "requested_delta": copy.deepcopy(dict(self.requested_delta)),
            "created_at_utc": self.created_at_utc,
            "expires_at_utc": self.expires_at_utc,
            "nonce": self.nonce,
            "fingerprint": self.fingerprint,
            "status": self.status,
        }


@dataclass(frozen=True)
class OwnerApproval:
    """Approval evidence produced outside the autonomous loop.

    ``evidence`` is opaque to this module; the injected verifier decides whether it is a
    valid owner signature/review/approval.  The exact proposal fingerprint and nonce are
    always bound here to prevent approval substitution/replay.
    """

    proposal_id: str
    proposal_fingerprint: str
    proposal_nonce: str
    approved_at_utc: str
    approval_id: str
    evidence: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BoundaryActivation:
    activation_id: str
    proposal_id: str
    proposal_fingerprint: str
    kind: str
    source_trust_root_id: str
    activated_delta: Mapping[str, Any]
    owner_approval_id: str
    activated_at_utc: str
    lineage_fingerprint: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "activation_id": self.activation_id,
            "proposal_id": self.proposal_id,
            "proposal_fingerprint": self.proposal_fingerprint,
            "kind": self.kind,
            "source_trust_root_id": self.source_trust_root_id,
            "activated_delta": copy.deepcopy(dict(self.activated_delta)),
            "owner_approval_id": self.owner_approval_id,
            "activated_at_utc": self.activated_at_utc,
            "lineage_fingerprint": self.lineage_fingerprint,
        }


@dataclass
class TrustBoundaryProposalManager:
    """Prepare autonomous boundary proposals and activate only externally approved deltas."""

    max_pending: int = 512
    max_ttl_seconds: int = 86400
    proposals: dict[str, BoundaryProposal] = field(default_factory=dict)
    activations: dict[str, BoundaryActivation] = field(default_factory=dict)
    consumed_approval_ids: set[str] = field(default_factory=set)
    consumed_nonces: set[str] = field(default_factory=set)

    def propose(
        self,
        *,
        kind: str,
        source_trust_root_id: str,
        reason: str,
        requested_delta: Mapping[str, Any],
        ttl_seconds: int = 3600,
    ) -> BoundaryProposal:
        kind = str(kind).strip()
        if kind not in PROPOSAL_KINDS:
            raise TrustBoundaryProposalError(f"unsupported boundary proposal kind: {kind}")
        root = str(source_trust_root_id).strip()
        if not root:
            raise TrustBoundaryProposalError("source_trust_root_id is required")
        reason = str(reason).strip()
        if not reason:
            raise TrustBoundaryProposalError("proposal reason is required")
        ttl = int(ttl_seconds)
        if not (60 <= ttl <= int(self.max_ttl_seconds)):
            raise TrustBoundaryProposalError("proposal TTL is outside configured bounds")
        if self.pending_count() >= max(1, int(self.max_pending)):
            raise TrustBoundaryProposalError("pending proposal capacity reached")

        delta = _deepcopy_mapping(requested_delta)
        if _contains_raw_secret(delta):
            raise TrustBoundaryProposalError("boundary proposal contains raw credential material")
        self._validate_delta(kind, delta, activation=False)

        now = _utcnow()
        base = {
            "proposal_id": f"boundary:{uuid.uuid4().hex[:20]}",
            "kind": kind,
            "source_trust_root_id": root,
            "reason": reason,
            "requested_delta": delta,
            "created_at_utc": _iso(now),
            "expires_at_utc": _iso(now + dt.timedelta(seconds=ttl)),
            "nonce": uuid.uuid4().hex,
        }
        proposal = BoundaryProposal(
            **base,
            fingerprint=_proposal_fingerprint(base),
        )
        self.proposals[proposal.proposal_id] = proposal
        return proposal

    def activate(
        self,
        *,
        proposal_id: str,
        approval: OwnerApproval,
        verify_owner_approval_fn: Callable[[BoundaryProposal, OwnerApproval], bool],
        approved_delta: Mapping[str, Any] | None = None,
    ) -> BoundaryActivation:
        proposal = self._active_proposal(proposal_id)
        if approval.approval_id in self.consumed_approval_ids:
            raise TrustBoundaryProposalError("owner approval has already been consumed")
        if approval.proposal_id != proposal.proposal_id:
            raise TrustBoundaryProposalError("owner approval references a different proposal")
        if approval.proposal_fingerprint != proposal.fingerprint:
            raise TrustBoundaryProposalError("owner approval fingerprint mismatch")
        if approval.proposal_nonce != proposal.nonce:
            raise TrustBoundaryProposalError("owner approval nonce mismatch")
        if approval.proposal_nonce in self.consumed_nonces:
            raise TrustBoundaryProposalError("proposal nonce has already been consumed")
        if not callable(verify_owner_approval_fn):
            raise TrustBoundaryProposalError("external owner approval verifier is required")
        if verify_owner_approval_fn(proposal, approval) is not True:
            raise TrustBoundaryProposalError("external owner approval verification failed")

        delta = _deepcopy_mapping(approved_delta or proposal.requested_delta)
        if _contains_raw_secret(delta):
            raise TrustBoundaryProposalError("activated delta contains raw credential material")
        # Proposal creation cannot invent a credential handle.  Once the exact proposal
        # has been independently owner-approved, activation may add an opaque handle
        # supplied by that owner-side process.  Raw secret material remains forbidden.
        self._validate_delta(proposal.kind, delta, activation=True)
        self._require_delta_not_broader(proposal.kind, proposal.requested_delta, delta)

        now = _utcnow()
        activation_base = {
            "activation_id": f"activation:{uuid.uuid4().hex[:20]}",
            "proposal_id": proposal.proposal_id,
            "proposal_fingerprint": proposal.fingerprint,
            "kind": proposal.kind,
            "source_trust_root_id": proposal.source_trust_root_id,
            "activated_delta": delta,
            "owner_approval_id": approval.approval_id,
            "activated_at_utc": _iso(now),
        }
        activation = BoundaryActivation(
            **activation_base,
            lineage_fingerprint=_stable_hash(activation_base),
        )
        self.activations[activation.activation_id] = activation
        self.consumed_approval_ids.add(approval.approval_id)
        self.consumed_nonces.add(proposal.nonce)
        self.proposals[proposal.proposal_id] = BoundaryProposal(
            **{**proposal.to_dict(), "status": "activated"}
        )
        return activation

    def pending(self) -> tuple[BoundaryProposal, ...]:
        return tuple(
            proposal
            for proposal in self.proposals.values()
            if proposal.status == "pending_owner_approval" and not self._expired(proposal)
        )

    def pending_count(self) -> int:
        return len(self.pending())

    def _active_proposal(self, proposal_id: str) -> BoundaryProposal:
        try:
            proposal = self.proposals[str(proposal_id)]
        except KeyError as exc:
            raise TrustBoundaryProposalError(f"unknown boundary proposal: {proposal_id}") from exc
        if proposal.status != "pending_owner_approval":
            raise TrustBoundaryProposalError("boundary proposal is no longer pending")
        if self._expired(proposal):
            raise TrustBoundaryProposalError("boundary proposal is expired")
        expected = _proposal_fingerprint(proposal.to_dict())
        if expected != proposal.fingerprint:
            raise TrustBoundaryProposalError("boundary proposal fingerprint mismatch")
        return proposal

    @staticmethod
    def _expired(proposal: BoundaryProposal) -> bool:
        return dt.datetime.fromisoformat(proposal.expires_at_utc) <= _utcnow()

    @staticmethod
    def _validate_delta(kind: str, delta: Mapping[str, Any], *, activation: bool = False) -> None:
        if kind == "trust_root_rotation":
            new_root = str(delta.get("new_trust_root_id") or "").strip()
            if not new_root:
                raise TrustBoundaryProposalError("trust-root proposal requires new_trust_root_id")
            if delta.get("owner_verification_required") is not True:
                raise TrustBoundaryProposalError("new Trust Root must require owner verification")

        elif kind == "credential_grant_request":
            provider = str(delta.get("provider") or "").strip()
            scopes = _norm_strings(delta.get("requested_scopes", ()))
            if not provider or not scopes:
                raise TrustBoundaryProposalError("credential proposal requires provider and scopes")
            if "credential_ref" in delta and not activation:
                raise TrustBoundaryProposalError("credential proposal cannot invent a credential_ref")
            if any(scope.lower() in {"*", "root", "admin", "administrator", "owner"} for scope in scopes):
                raise TrustBoundaryProposalError("privileged wildcard/admin credential scopes are not proposal-safe")

        elif kind in {"network_policy_expansion", "security_policy_expansion"}:
            before_hash = str(delta.get("before_hash") or "").strip()
            after_hash = str(delta.get("after_hash") or "").strip()
            changes = delta.get("requested_changes")
            if not before_hash or not after_hash or before_hash == after_hash:
                raise TrustBoundaryProposalError("policy expansion requires distinct before/after hashes")
            if not isinstance(changes, Mapping) or not changes:
                raise TrustBoundaryProposalError("policy expansion requires an explicit requested_changes mapping")

        elif kind == "authority_reauthorization":
            revoked_id = str(delta.get("revoked_authority_id") or "").strip()
            replacement_id = str(delta.get("replacement_authority_id") or "").strip()
            if not revoked_id or not replacement_id:
                raise TrustBoundaryProposalError("reauthorization requires revoked and replacement authority ids")
            if revoked_id == replacement_id:
                raise TrustBoundaryProposalError("revoked authority id cannot be resurrected")
            if delta.get("preserve_revocation_record") is not True:
                raise TrustBoundaryProposalError("reauthorization must preserve the revocation record")

    @staticmethod
    def _require_delta_not_broader(
        kind: str,
        proposed: Mapping[str, Any],
        approved: Mapping[str, Any],
    ) -> None:
        """An activation may narrow fields but cannot silently add a broader request.

        Exact complex policy semantics belong to the owner verifier.  This generic layer
        prevents additional top-level capabilities and common list/scope widening.
        """
        extra_keys = set(approved) - set(proposed)
        allowed_activation_only = {"credential_ref"} if kind == "credential_grant_request" else set()
        unexpected = extra_keys - allowed_activation_only
        if unexpected:
            raise TrustBoundaryProposalError(
                f"approved delta adds fields not present in proposal: {sorted(unexpected)}"
            )

        for key, value in approved.items():
            if key == "credential_ref" and kind == "credential_grant_request":
                ref = str(value).strip()
                if not ref or any(ch.isspace() for ch in ref):
                    raise TrustBoundaryProposalError("approved credential_ref must be an opaque handle")
                continue
            original = proposed.get(key)
            if isinstance(original, (list, tuple, set, frozenset)):
                if not set(value or ()).issubset(set(original)):
                    raise TrustBoundaryProposalError(f"approved delta widens list field: {key}")
            elif isinstance(original, Mapping):
                if not isinstance(value, Mapping):
                    raise TrustBoundaryProposalError(f"approved delta changes mapping field type: {key}")
                if set(value) - set(original):
                    raise TrustBoundaryProposalError(f"approved delta widens mapping field: {key}")
            elif value != original:
                raise TrustBoundaryProposalError(f"approved delta changes scalar field beyond exact proposal: {key}")
