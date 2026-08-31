"""Production owner-scope negotiation driven by the AI council.

This module makes the Owner contact ceiling *dynamic* without making it ownerless.
META/X/SENJU can amend the effective ceiling when a requested change is already inside
an Owner-declared Expansion Envelope. All agents may continuously propose and argue for
larger scope. Changes outside the envelope remain durable owner-review requests.

The engine deliberately does not let AI consensus create unrelated Internet authority,
override HARD_DENY/revocation, mint credentials, or expose private/loopback/link-local
networks. It changes real production policy state only inside a previously delegated
meta-envelope.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

AI_NEGOTIATORS = ("META", "X", "SENJU", "CHILD", "AI", "PR-ARMY")
DECISION_MEMBERS = ("META", "X", "SENJU")
VALID_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"})
DEFAULT_STATE_DIR = Path("senju/state")


class ScopeNegotiationError(RuntimeError):
    pass


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stable(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _host(value: Any) -> str:
    host = str(value or "").strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@*"):
        raise ScopeNegotiationError(f"invalid exact host: {host!r}")
    try:
        parsed = ipaddress.ip_address(host)
    except ValueError:
        return host
    if not parsed.is_global:
        raise ScopeNegotiationError("private/loopback/link-local/reserved literal IP cannot enter owner expansion")
    return host


def _methods(values: Iterable[Any]) -> frozenset[str]:
    methods = frozenset(str(v).strip().upper() for v in values if str(v).strip())
    if not methods:
        raise ScopeNegotiationError("at least one method is required")
    if not methods.issubset(VALID_METHODS):
        raise ScopeNegotiationError(f"unsupported methods: {sorted(methods - VALID_METHODS)}")
    return methods


@dataclass(frozen=True)
class OwnerExpansionEnvelope:
    envelope_id: str
    proof_types: frozenset[str]
    auto_apply_proof_types: frozenset[str]
    new_host_methods: frozenset[str]
    existing_host_method_ceiling: frozenset[str]
    max_added_hosts_per_cycle: int = 8
    allow_http: bool = False
    allow_delete: bool = False
    allow_private_network: bool = False
    credential_scope: str = "none"
    decision_quorum: int = 3
    min_confidence: int = 70
    negotiation_intensity: int = 60

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "OwnerExpansionEnvelope":
        envelope_id = str(raw.get("envelope_id") or "").strip()
        if not envelope_id:
            raise ScopeNegotiationError("envelope_id is required")
        proof_types = frozenset(str(v).strip() for v in raw.get("proof_types", ()) if str(v).strip())
        auto = frozenset(str(v).strip() for v in raw.get("auto_apply_proof_types", ()) if str(v).strip())
        if not proof_types or not auto.issubset(proof_types):
            raise ScopeNegotiationError("auto_apply_proof_types must be a non-empty subset of proof_types")
        if bool(raw.get("allow_private_network", False)):
            raise ScopeNegotiationError("owner expansion envelope cannot generally enable private networks")
        credential_scope = str(raw.get("credential_scope", "none")).strip().lower()
        if credential_scope != "none":
            raise ScopeNegotiationError("owner expansion negotiation is credential-free")
        new_methods = _methods(raw.get("new_host_methods", ("GET", "HEAD", "OPTIONS")))
        ceiling = _methods(raw.get("existing_host_method_ceiling", tuple(new_methods)))
        allow_delete = bool(raw.get("allow_delete", False))
        if "DELETE" in new_methods and not allow_delete:
            raise ScopeNegotiationError("DELETE cannot be a new-host default without explicit envelope opt-in")
        if "DELETE" in ceiling and not allow_delete:
            ceiling = frozenset(m for m in ceiling if m != "DELETE")
        return cls(
            envelope_id=envelope_id,
            proof_types=proof_types,
            auto_apply_proof_types=auto,
            new_host_methods=new_methods,
            existing_host_method_ceiling=ceiling,
            max_added_hosts_per_cycle=max(1, min(int(raw.get("max_added_hosts_per_cycle", 8)), 32)),
            allow_http=bool(raw.get("allow_http", False)),
            allow_delete=allow_delete,
            allow_private_network=False,
            credential_scope="none",
            decision_quorum=3,
            min_confidence=max(60, min(int(raw.get("min_confidence", 70)), 100)),
            negotiation_intensity=max(0, min(int(raw.get("negotiation_intensity", 60)), 100)),
        )


@dataclass(frozen=True)
class ScopeBallot:
    actor: str
    approve: bool
    confidence: int
    reason: str = ""
    evidence_refs: tuple[str, ...] = ()

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "ScopeBallot":
        actor = str(raw.get("actor") or "").strip().upper()
        if actor not in DECISION_MEMBERS:
            raise ScopeNegotiationError(f"decision ballot must be META/X/SENJU, got {actor!r}")
        refs = raw.get("evidence_refs", ())
        if not isinstance(refs, (list, tuple)):
            refs = ()
        return cls(
            actor=actor,
            approve=bool(raw.get("approve")),
            confidence=max(0, min(int(raw.get("confidence", 0)), 100)),
            reason=" ".join(str(raw.get("reason") or "").split())[:300],
            evidence_refs=tuple(str(v)[:200] for v in refs if str(v).strip()),
        )


@dataclass(frozen=True)
class ScopeProposal:
    proposal_id: str
    host: str
    requested_methods: frozenset[str]
    proof_type: str
    proof_ref: str
    reason: str
    evidence_fingerprint: str
    hard_deny: bool = False
    revoked: bool = False

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["requested_methods"] = sorted(self.requested_methods)
        return data


def _active_standing(repo_root: Path) -> dict[str, dict[str, Any]]:
    doc = _load(repo_root / "senju" / "state" / "standing_authorizations.json", {})
    out: dict[str, dict[str, Any]] = {}
    for row in doc.get("records", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(row, Mapping) or row.get("revoked") is True:
            continue
        for raw_host in row.get("exact_hosts", ()):
            try:
                host = _host(raw_host)
            except ScopeNegotiationError:
                continue
            methods = sorted(_methods(row.get("allowed_methods", ("GET", "HEAD"))))
            out[host] = {
                "proof_type": "existing_standing_authorization",
                "proof_ref": str(row.get("authorization_reference") or f"standing:{host}"),
                "methods": methods,
            }
    return out


def _ownership_evidence(state: Path) -> dict[str, dict[str, Any]]:
    doc = _load(state / "owner_scope_expansion_evidence.json", {})
    rows = doc.get("evidence", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else ():
        if not isinstance(row, Mapping) or row.get("revoked") is True:
            continue
        try:
            host = _host(row.get("host"))
        except ScopeNegotiationError:
            continue
        out[host] = {
            "proof_type": str(row.get("proof_type") or "").strip(),
            "proof_ref": str(row.get("proof_ref") or "").strip(),
            "verified": bool(row.get("verified")),
        }
    return out


def derive_current_ceiling(repo_root: str | Path, state_dir: str | Path) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    effective = _load(state / "owner_contact_ceiling_effective.json", {})
    if isinstance(effective, Mapping) and isinstance(effective.get("ceiling"), Mapping):
        return dict(effective["ceiling"])
    standing = _active_standing(repo)
    hosts = sorted(standing)
    methods: set[str] = set()
    for row in standing.values():
        methods.update(str(v) for v in row.get("methods", ()))
    if not methods:
        methods = {"GET", "HEAD", "OPTIONS"}
    return {
        "ceiling_id": "owner-standing-derived",
        "exact_hosts": hosts,
        "allowed_methods": sorted(methods),
        "allow_http": False,
        "allow_delete": "DELETE" in methods,
        "follow_redirects": True,
        "max_redirects": 5,
        "retries": 5,
        "timeout_seconds": 20.0,
        "max_response_bytes": 10 * 1024 * 1024,
    }


def _request_rows(state: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    docs = [
        _load(state / "adversary_external_host_requests.json", {}),
        _load(state / "owner_scope_negotiation_signals.json", {}),
    ]
    for doc in docs:
        if not isinstance(doc, Mapping):
            continue
        rows = doc.get("requests") or doc.get("signals") or []
        if not isinstance(rows, list):
            continue
        for raw in rows:
            if isinstance(raw, Mapping):
                out.append(dict(raw))
    return out


def build_scope_proposals(
    repo_root: str | Path,
    state_dir: str | Path,
    envelope: OwnerExpansionEnvelope,
) -> list[ScopeProposal]:
    repo = Path(repo_root)
    state = Path(state_dir)
    standing = _active_standing(repo)
    evidence = _ownership_evidence(state)
    current = derive_current_ceiling(repo, state)
    current_hosts = {_host(v) for v in current.get("exact_hosts", ())}
    proposals: dict[str, ScopeProposal] = {}
    for row in _request_rows(state):
        try:
            host = _host(row.get("host") or row.get("target"))
        except ScopeNegotiationError:
            continue
        raw_methods = row.get("requested_methods") or row.get("methods") or ("GET", "HEAD", "OPTIONS")
        try:
            requested = _methods(raw_methods)
        except ScopeNegotiationError:
            requested = frozenset({"GET", "HEAD", "OPTIONS"})
        hard_deny = bool(row.get("hard_deny") or str(row.get("decision", "")).upper() == "HARD_DENY")
        revoked = bool(row.get("revoked"))
        if host in standing:
            proof = standing[host]
        else:
            proof = evidence.get(host, {"proof_type": "unverified_discovery", "proof_ref": "", "verified": False})
        proof_type = str(proof.get("proof_type") or "unverified_discovery")
        proof_ref = str(proof.get("proof_ref") or "")
        if proof_type != "existing_standing_authorization" and not bool(proof.get("verified")):
            proof_type = "unverified_discovery"
            proof_ref = ""
        reason = " ".join(str(row.get("reason") or "AI runtime requests broader Owner contact scope").split())[:400]
        fingerprint = _stable({"host": host, "methods": sorted(requested), "proof_type": proof_type, "proof_ref": proof_ref, "reason": reason})
        proposal_id = f"scope-{fingerprint[:16]}"
        proposals[proposal_id] = ScopeProposal(
            proposal_id=proposal_id,
            host=host,
            requested_methods=requested,
            proof_type=proof_type,
            proof_ref=proof_ref,
            reason=reason,
            evidence_fingerprint=fingerprint,
            hard_deny=hard_deny,
            revoked=revoked,
        )
    return sorted(proposals.values(), key=lambda p: (p.host not in current_hosts, p.host, p.proposal_id))


def materialize_negotiation_campaign(
    state_dir: str | Path,
    proposals: Iterable[ScopeProposal],
    envelope: OwnerExpansionEnvelope,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    current = int(time.time()) if now is None else int(now)
    angles = (
        "ownership_evidence",
        "business_need",
        "least_privilege_method_set",
        "reversibility_and_rollback",
        "risk_counterargument",
    )
    tasks: list[dict[str, Any]] = []
    for proposal in proposals:
        for actor in AI_NEGOTIATORS:
            for angle in angles:
                tasks.append({
                    "task_id": f"scope-negotiation:{proposal.proposal_id}:{actor.lower()}:{angle}",
                    "actor": actor,
                    "proposal_id": proposal.proposal_id,
                    "host": proposal.host,
                    "angle": angle,
                    "status": "pending",
                    "mission": "argue for or against a precise Owner-scope amendment using fresh evidence",
                    "negotiation_intensity": envelope.negotiation_intensity,
                    "may_request_broader_scope": True,
                    "may_apply_change": actor in DECISION_MEMBERS,
                    "application_requires_envelope": True,
                })
    payload = {
        "schema": "senju-owner-scope-negotiation-campaign/v1",
        "generated_at": current,
        "production": True,
        "agents": list(AI_NEGOTIATORS),
        "decision_members": list(DECISION_MEMBERS),
        "negotiation_intensity": envelope.negotiation_intensity,
        "proposal_count": len(list(proposals)) if not isinstance(proposals, list) else len(proposals),
        "task_count": len(tasks),
        "tasks": tasks,
    }
    _write(Path(state_dir) / "owner_scope_negotiation_campaign.json", payload)
    return payload


def _ballots_for(state: Path, proposal_id: str) -> tuple[ScopeBallot, ...]:
    doc = _load(state / "owner_scope_negotiation_ballots.json", {})
    raw_by = doc.get("ballots_by_proposal", {}) if isinstance(doc, Mapping) else {}
    rows = raw_by.get(proposal_id, ()) if isinstance(raw_by, Mapping) else ()
    by_actor: dict[str, ScopeBallot] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        try:
            ballot = ScopeBallot.from_mapping(raw)
        except ScopeNegotiationError:
            continue
        by_actor[ballot.actor] = ballot
    return tuple(by_actor[a] for a in DECISION_MEMBERS if a in by_actor)


def evaluate_and_apply(
    repo_root: str | Path,
    state_dir: str | Path,
    envelope: OwnerExpansionEnvelope,
    proposals: Iterable[ScopeProposal],
    *,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current_time = int(time.time()) if now is None else int(now)
    ceiling = derive_current_ceiling(repo, state)
    hosts = {_host(v) for v in ceiling.get("exact_hosts", ())}
    allowed_methods = set(_methods(ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS"))))
    decisions: list[dict[str, Any]] = []
    added = 0

    for proposal in proposals:
        ballots = _ballots_for(state, proposal.proposal_id)
        yes = [b for b in ballots if b.approve]
        yes_conf = round(sum(b.confidence for b in yes) / len(yes)) if yes else 0
        base = {
            "proposal_id": proposal.proposal_id,
            "host": proposal.host,
            "proof_type": proposal.proof_type,
            "proof_ref": proposal.proof_ref,
            "yes_votes": len(yes),
            "average_yes_confidence": yes_conf,
        }
        if proposal.hard_deny or proposal.revoked:
            decisions.append({**base, "status": "terminal_stop", "applied": False, "reason": "HARD_DENY/revocation remains terminal"})
            continue
        if proposal.proof_type not in envelope.proof_types:
            decisions.append({**base, "status": "owner_review_requested", "applied": False, "reason": "scope request is outside pre-authorized Expansion Envelope"})
            continue
        if proposal.proof_type not in envelope.auto_apply_proof_types:
            decisions.append({**base, "status": "owner_review_requested", "applied": False, "reason": "proof type may be negotiated but is not auto-applicable"})
            continue
        if len(yes) < envelope.decision_quorum or yes_conf < envelope.min_confidence:
            decisions.append({**base, "status": "council_negotiation_pending", "applied": False, "reason": "META/X/SENJU quorum or confidence not met"})
            continue
        is_new = proposal.host not in hosts
        if is_new and added >= envelope.max_added_hosts_per_cycle:
            decisions.append({**base, "status": "cycle_host_budget_exhausted", "applied": False, "reason": "new-host auto-apply budget reached"})
            continue
        if is_new:
            hosts.add(proposal.host)
            added += 1
            allowed_methods.update(envelope.new_host_methods)
        else:
            allowed_methods.update(proposal.requested_methods & envelope.existing_host_method_ceiling)
        decisions.append({**base, "status": "auto_applied_inside_owner_expansion_envelope", "applied": True, "new_host": is_new})

    effective = dict(ceiling)
    effective.update({
        "ceiling_id": f"{ceiling.get('ceiling_id', 'owner')}:negotiated:{envelope.envelope_id}",
        "exact_hosts": sorted(hosts),
        "allowed_methods": sorted(allowed_methods),
        "allow_http": bool(ceiling.get("allow_http", False)) and envelope.allow_http,
        "allow_delete": bool(ceiling.get("allow_delete", False)) and envelope.allow_delete,
    })
    result = {
        "schema": "senju-owner-scope-negotiation-result/v1",
        "generated_at": current_time,
        "production": True,
        "envelope_id": envelope.envelope_id,
        "decision_members": list(DECISION_MEMBERS),
        "current_effective_ceiling": effective,
        "auto_applied_count": sum(1 for d in decisions if d.get("applied")),
        "owner_review_count": sum(1 for d in decisions if d.get("status") == "owner_review_requested"),
        "decisions": decisions,
        "hard_limits": [
            "no_unrelated_root_from_discovery_alone",
            "no_hard_deny_or_revocation_override",
            "no_credential_minting_or_discovery",
            "no_private_loopback_link_local_general_access",
            "no_scope_change_outside_owner_expansion_envelope",
        ],
    }
    _write(state / "owner_scope_negotiation_result.json", result)
    _write(state / "owner_contact_ceiling_effective.json", {
        "schema": "senju-owner-contact-ceiling-effective/v1",
        "generated_at": current_time,
        "source": "META/X/SENJU negotiation inside Owner Expansion Envelope",
        "envelope_id": envelope.envelope_id,
        "ceiling": effective,
    })
    return result


def run_scope_negotiation_cycle(
    repo_root: str | Path,
    state_dir: str | Path = DEFAULT_STATE_DIR,
    *,
    envelope_path: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    config = Path(envelope_path) if envelope_path else repo / "senju" / "config" / "owner-expansion-envelope.json"
    envelope = OwnerExpansionEnvelope.from_mapping(_load(config, {}))
    proposals = build_scope_proposals(repo, state, envelope)
    campaign = materialize_negotiation_campaign(state, proposals, envelope, now=now)
    result = evaluate_and_apply(repo, state, envelope, proposals, now=now)
    return {"campaign": campaign, "result": result}
