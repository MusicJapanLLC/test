"""Autonomous opportunity discovery for bounded capability expansion.

This module gives THE WORLD a persistent way to look for places where capability is
being constrained and to turn those observations into evidence-backed expansion
proposals. It deliberately stops before authority mutation:

    observe runtime friction
      -> classify capability gap
      -> score opportunity
      -> design a safe validation experiment
      -> synthesize an owner-gated boundary proposal
      -> persist for later review

The miner never mints credentials, trust roots, external-write permission, private
network access, or self-approval. It may identify those as capability gaps and describe
what an approved change would unlock, but the output remains proposal-only.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .persistent_boundary_evolution import PersistentBoundaryEvolution

DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"
MAX_OPPORTUNITIES = 128


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _clean_text(value: Any, *, limit: int = 240) -> str:
    if not isinstance(value, str):
        return ""
    text = " ".join(value.strip().split())
    return text[:limit]


@dataclass(frozen=True)
class BoundaryOpportunity:
    opportunity_id: str
    kind: str
    source: str
    evidence: Mapping[str, Any]
    capability_unlocked: str
    safe_experiment: Mapping[str, Any]
    proposal_signal: Mapping[str, Any] | None
    impact_score: int
    confidence_score: int
    reversibility_score: int
    priority_score: int
    disposition: str = "proposal_only"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _opportunity(
    *,
    kind: str,
    source: str,
    evidence: Mapping[str, Any],
    capability_unlocked: str,
    safe_experiment: Mapping[str, Any],
    proposal_signal: Mapping[str, Any] | None,
    impact: int,
    confidence: int,
    reversibility: int,
) -> BoundaryOpportunity:
    impact = max(0, min(int(impact), 10))
    confidence = max(0, min(int(confidence), 10))
    reversibility = max(0, min(int(reversibility), 10))
    priority = round((impact * 0.45 + confidence * 0.35 + reversibility * 0.20) * 10)
    fingerprint = {
        "kind": kind,
        "source": source,
        "evidence": dict(evidence),
        "proposal_signal": dict(proposal_signal or {}),
    }
    return BoundaryOpportunity(
        opportunity_id=f"opp-{_stable_hash(fingerprint)[:16]}",
        kind=kind,
        source=source,
        evidence=dict(evidence),
        capability_unlocked=capability_unlocked,
        safe_experiment=dict(safe_experiment),
        proposal_signal=dict(proposal_signal) if proposal_signal is not None else None,
        impact_score=impact,
        confidence_score=confidence,
        reversibility_score=reversibility,
        priority_score=priority,
    )


def _from_finding_action_result(doc: Mapping[str, Any]) -> list[BoundaryOpportunity]:
    out: list[BoundaryOpportunity] = []

    for item in doc.get("blocked", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        reason = _clean_text(item.get("reason"))
        host = _clean_text(item.get("host"))

        if reason == "no_reviewed_grant" and host:
            signal = {
                "new_trust_root": {
                    "new_trust_root_id": f"candidate:{host}",
                    "reason": f"runtime repeatedly encountered an ungranted host: {host}",
                    "ttl_seconds": 3600,
                }
            }
            out.append(_opportunity(
                kind="trust_root_candidate",
                source="finding_action_result.blocked",
                evidence={"host": host, "reason": reason},
                capability_unlocked="permit future reviewed interaction with this host if ownership/authorization is independently verified",
                safe_experiment={
                    "mode": "metadata_only",
                    "steps": [
                        "collect frequency and business-purpose evidence",
                        "verify whether the host is already covered by an explicit owner-authorized root",
                        "do not contact or authorize the host from this opportunity record",
                    ],
                },
                proposal_signal=signal,
                impact=7,
                confidence=8,
                reversibility=8,
            ))

        elif reason == "action_budget_exhausted":
            out.append(_opportunity(
                kind="throughput_capacity_gap",
                source="finding_action_result.blocked",
                evidence={"reason": reason, "host": host},
                capability_unlocked="process more already-authorized read-only actions per cycle",
                safe_experiment={
                    "mode": "simulation",
                    "steps": [
                        "replay the same candidate set without network I/O",
                        "measure queue depth and projected completion time at larger budgets",
                        "recommend a bounded budget only if the simulated gain is material",
                    ],
                },
                proposal_signal={
                    "security_policy_gap": {
                        "before_hash": _stable_hash({"action_budget": doc.get("action_budget")}),
                        "after_hash": _stable_hash({"action_budget": "candidate-increase"}),
                        "requested_changes": {
                            "read_only_action_budget": "increase within configured hard ceiling"
                        },
                        "reason": "authorized read-only work is being dropped because the per-cycle budget is exhausted",
                    }
                },
                impact=6,
                confidence=9,
                reversibility=10,
            ))

        elif reason == "grant_not_read_only_safe":
            out.append(_opportunity(
                kind="grant_contract_mismatch",
                source="finding_action_result.blocked",
                evidence={"reason": reason, "host": host},
                capability_unlocked="make reviewed grants consumable by the read-only action lane without broadening them",
                safe_experiment={
                    "mode": "static_diff",
                    "steps": [
                        "compare the reviewed grant contract with the consumer contract",
                        "identify the smallest schema or method mismatch",
                        "prefer narrowing or normalization over adding authority",
                    ],
                },
                proposal_signal=None,
                impact=5,
                confidence=8,
                reversibility=10,
            ))

    for item in doc.get("rejected_findings", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        reason = _clean_text(item.get("reason"))
        case = _clean_text(item.get("case"))
        if reason == "unsupported_read_method":
            out.append(_opportunity(
                kind="method_capability_gap",
                source="finding_action_result.rejected_findings",
                evidence={"reason": reason, "case": case},
                capability_unlocked="determine whether the requested operation can be satisfied through a safe read-only equivalent or an isolated write test lane",
                safe_experiment={
                    "mode": "non_effecting",
                    "steps": [
                        "classify whether the requested operation is observational or state-changing",
                        "try an equivalent GET/HEAD/OPTIONS-style observation when semantically valid",
                        "for state-changing needs, emit an isolated-lab experiment proposal rather than enabling external writes",
                    ],
                },
                proposal_signal=None,
                impact=7,
                confidence=7,
                reversibility=10,
            ))

    for item in doc.get("errors", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        error_type = _clean_text(item.get("error_type"))
        method = _clean_text(item.get("method"))
        host = _clean_text(item.get("host"))
        out.append(_opportunity(
            kind="transport_reliability_gap",
            source="finding_action_result.errors",
            evidence={"error_type": error_type, "method": method, "host": host},
            capability_unlocked="improve success rate of already-authorized read-only external actions",
            safe_experiment={
                "mode": "bounded_replay",
                "steps": [
                    "replay against an existing authorized target only",
                    "vary timeout/retry settings inside current policy ceilings",
                    "compare success and latency without changing destination authority",
                ],
            },
            proposal_signal={
                "network_policy_gap": {
                    "before_hash": _stable_hash({"transport": "current"}),
                    "after_hash": _stable_hash({"transport": "tuned-candidate"}),
                    "requested_changes": {
                        "transport_tuning": "consider bounded timeout/retry adjustment within existing host and method authority"
                    },
                    "reason": "authorized read-only contact produced a transport failure",
                }
            },
            impact=5,
            confidence=6,
            reversibility=10,
        ))

    return out


def _from_pressure_signals(doc: Mapping[str, Any]) -> list[BoundaryOpportunity]:
    out: list[BoundaryOpportunity] = []

    credential = doc.get("credential_gap") if isinstance(doc, Mapping) else None
    if isinstance(credential, Mapping):
        provider = _clean_text(credential.get("provider"))
        scopes = [
            _clean_text(x, limit=100)
            for x in credential.get("requested_scopes", ())
            if _clean_text(x, limit=100)
        ]
        if provider and scopes:
            signal = {
                "credential_gap": {
                    "provider": provider,
                    "requested_scopes": scopes,
                    "reason": _clean_text(credential.get("reason")) or "runtime identified a missing service capability",
                    "ttl_seconds": int(credential.get("ttl_seconds", 3600)),
                }
            }
            out.append(_opportunity(
                kind="credential_capability_gap",
                source="boundary_pressure_signals.credential_gap",
                evidence={"provider": provider, "requested_scopes": scopes},
                capability_unlocked="use a provider capability after an independently supplied credential is approved",
                safe_experiment={
                    "mode": "mock_provider",
                    "steps": [
                        "exercise the integration against a mock adapter with synthetic credentials",
                        "verify exact scopes required and remove unnecessary scopes",
                        "never discover, copy, or synthesize a live credential",
                    ],
                },
                proposal_signal=signal,
                impact=8,
                confidence=8,
                reversibility=8,
            ))

    for key, kind, capability in (
        ("network_policy_gap", "network_policy_gap", "increase useful network capability after an explicit policy approval"),
        ("security_policy_gap", "security_policy_gap", "remove a documented policy bottleneck after an explicit policy approval"),
    ):
        raw = doc.get(key) if isinstance(doc, Mapping) else None
        if not isinstance(raw, Mapping):
            continue
        before_hash = _clean_text(raw.get("before_hash"), limit=128)
        after_hash = _clean_text(raw.get("after_hash"), limit=128)
        changes = raw.get("requested_changes")
        if not before_hash or not after_hash or not isinstance(changes, Mapping) or not changes:
            continue
        signal = {
            key: {
                "before_hash": before_hash,
                "after_hash": after_hash,
                "requested_changes": dict(changes),
                "reason": _clean_text(raw.get("reason")) or f"runtime identified {key}",
                "ttl_seconds": int(raw.get("ttl_seconds", 3600)),
            }
        }
        out.append(_opportunity(
            kind=kind,
            source=f"boundary_pressure_signals.{key}",
            evidence={"before_hash": before_hash, "after_hash": after_hash, "requested_changes": dict(changes)},
            capability_unlocked=capability,
            safe_experiment={
                "mode": "policy_simulation",
                "steps": [
                    "apply the proposed delta to an in-memory policy copy",
                    "replay recorded decisions without external side effects",
                    "measure capability gain and newly reachable actions",
                    "record any broadened authority separately for review",
                ],
            },
            proposal_signal=signal,
            impact=7,
            confidence=8,
            reversibility=9,
        ))

    return out


def mine_boundary_opportunities(
    *,
    finding_action_result: Mapping[str, Any] | None = None,
    pressure_signals: Mapping[str, Any] | None = None,
    max_opportunities: int = MAX_OPPORTUNITIES,
) -> dict[str, Any]:
    """Mine and rank proposal-only capability expansion opportunities."""
    opportunities: list[BoundaryOpportunity] = []
    if isinstance(finding_action_result, Mapping):
        opportunities.extend(_from_finding_action_result(finding_action_result))
    if isinstance(pressure_signals, Mapping):
        opportunities.extend(_from_pressure_signals(pressure_signals))

    deduped: dict[str, BoundaryOpportunity] = {}
    for item in opportunities:
        previous = deduped.get(item.opportunity_id)
        if previous is None or item.priority_score > previous.priority_score:
            deduped[item.opportunity_id] = item

    cap = max(1, min(int(max_opportunities), MAX_OPPORTUNITIES))
    ranked = sorted(
        deduped.values(),
        key=lambda x: (x.priority_score, x.confidence_score, x.impact_score),
        reverse=True,
    )[:cap]

    return {
        "schema": "the-world-boundary-opportunity-miner/v1",
        "generated_at": int(time.time()),
        "mode": "proposal_only",
        "opportunity_count": len(ranked),
        "opportunities": [item.to_dict() for item in ranked],
    }


def _merge_proposal_signals(opportunities: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    needs: list[Mapping[str, Any]] = []
    for item in opportunities:
        if not isinstance(item, Mapping):
            continue
        signal = item.get("proposal_signal")
        if not isinstance(signal, Mapping):
            continue
        needs.extend(PersistentBoundaryEvolution.synthesize_needs(signal))
    return needs


def run_boundary_opportunity_cycle(
    state_dir: str | Path = DEFAULT_STATE_DIR,
    *,
    source_trust_root_id: str = "the-world-owner-root",
    max_opportunities: int = MAX_OPPORTUNITIES,
) -> dict[str, Any]:
    """Mine opportunities and persist owner-gated proposals without applying them."""
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)

    finding_result = _load_json(state / "finding_action_result.json", {})
    pressure_signals = _load_json(state / "boundary_pressure_signals.json", {})
    mined = mine_boundary_opportunities(
        finding_action_result=finding_result,
        pressure_signals=pressure_signals,
        max_opportunities=max_opportunities,
    )
    _write_json(state / "boundary_opportunities.json", mined)

    needs = _merge_proposal_signals(mined["opportunities"])
    evolution = PersistentBoundaryEvolution()

    checkpoint_path = state / "boundary_evolution_checkpoint.json"

    def load_state() -> Mapping[str, Any] | None:
        snapshot = _load_json(checkpoint_path, {})
        return snapshot or None

    def persist_state(snapshot: Mapping[str, Any]) -> Mapping[str, Any]:
        _write_json(checkpoint_path, snapshot)
        return {"persisted": True}

    result = evolution.run(
        source_trust_root_id=source_trust_root_id,
        needs=needs,
        load_state_fn=load_state,
        persist_state_fn=persist_state,
        approval_resolver_fn=None,
        verify_owner_approval_fn=None,
        apply_activation_fn=None,
    )

    cycle = {
        "schema": "the-world-boundary-opportunity-cycle/v1",
        "generated_at": int(time.time()),
        "mode": "autonomous_discovery_owner_gated_apply",
        "opportunity_count": mined["opportunity_count"],
        "staged_proposal_ids": [x.proposal_id for x in result.staged],
        "reused_proposal_ids": [x.proposal_id for x in result.reused],
        "pending_proposal_ids": [x.proposal_id for x in result.pending],
        "activation_count": len(result.activations),
        "applied_count": len(result.apply_receipts),
        "hard_stops": [
            "no autonomous self-approval",
            "no live credential discovery or minting",
            "no authority creation from a finding alone",
            "no external write activation",
            "no private-network activation",
        ],
    }
    _write_json(state / "boundary_opportunity_cycle_result.json", cycle)
    return cycle
