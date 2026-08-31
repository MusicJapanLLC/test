"""Autonomous opportunity discovery for bounded capability expansion.

THE WORLD may continuously look for capability friction, design non-effecting or
already-authorized experiments, rank opportunities, and stage precise owner-gated
boundary proposals. Discovery stays broad; mutation stays outside this process.

    observe friction
      -> classify capability gap
      -> rank opportunity
      -> design safe experiment
      -> stage proposal-safe delta when one exists
      -> persist for later owner review

The miner never self-approves, mints/discovers live credentials, creates authority from
a finding alone, enables external writes, or enables private-network access. Requests
that would cross those lines are retained as research opportunities without an
activatable proposal signal.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .persistent_boundary_evolution import PersistentBoundaryEvolution

DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"
MAX_OPPORTUNITIES = 128

# These terms do not make an observation disappear. They only prevent that observation
# from becoming an activatable credential/policy proposal inside the autonomous loop.
PRIVILEGED_SCOPE_TERMS = frozenset(
    {"*", "admin", "administrator", "owner", "root", "write", "delete", "manage", "modify"}
)
POLICY_PROPOSAL_FORBIDDEN_TERMS = frozenset(
    {
        "bypass",
        "disable_guard",
        "disable_security",
        "self_approve",
        "self-approve",
        "credential",
        "secret",
        "private_network",
        "private-network",
        "loopback",
        "link-local",
        "authority",
        "authorization",
        "revocation",
        "external_write",
        "external-write",
        "allow_all",
        "allow-all",
    }
)


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
    return " ".join(value.strip().split())[:limit]


def _scope_tokens(scope: str) -> set[str]:
    lowered = scope.strip().lower()
    if lowered == "*":
        return {"*"}
    return {token for token in re.split(r"[^a-z0-9*]+", lowered) if token}


def _scope_is_proposal_safe(scope: str) -> bool:
    return not bool(_scope_tokens(scope) & PRIVILEGED_SCOPE_TERMS)


def _partition_scopes(values: Iterable[Any]) -> tuple[list[str], list[str]]:
    safe: list[str] = []
    research_only: list[str] = []
    for raw in values:
        scope = _clean_text(raw, limit=100)
        if not scope:
            continue
        bucket = safe if _scope_is_proposal_safe(scope) else research_only
        if scope not in bucket:
            bucket.append(scope)
    return safe, research_only


def _flatten_policy_text(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).lower()
    except (TypeError, ValueError):
        return str(value).lower()


def _policy_change_is_proposal_safe(changes: Mapping[str, Any]) -> bool:
    text = _flatten_policy_text(changes)
    return not any(term in text for term in POLICY_PROPOSAL_FORBIDDEN_TERMS)


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
    disposition: str = "proposal_only",
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
        "disposition": disposition,
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
        disposition=disposition,
    )


def _from_finding_action_result(doc: Mapping[str, Any]) -> list[BoundaryOpportunity]:
    out: list[BoundaryOpportunity] = []

    for item in doc.get("blocked", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        reason = _clean_text(item.get("reason"))
        host = _clean_text(item.get("host"))

        if reason == "no_reviewed_grant" and host:
            out.append(
                _opportunity(
                    kind="trust_root_candidate",
                    source="finding_action_result.blocked",
                    evidence={"host": host, "reason": reason},
                    capability_unlocked=(
                        "permit future reviewed interaction with this host only if ownership/authorization "
                        "is independently verified"
                    ),
                    safe_experiment={
                        "mode": "metadata_only",
                        "steps": [
                            "collect recurrence and business-purpose evidence",
                            "check whether the host is already covered by an explicit owner-authorized root",
                            "do not contact or authorize the host from this opportunity record",
                        ],
                    },
                    proposal_signal={
                        "new_trust_root": {
                            "new_trust_root_id": f"candidate:{host}",
                            "reason": f"runtime repeatedly encountered an ungranted host: {host}",
                            "ttl_seconds": 3600,
                        }
                    },
                    impact=7,
                    confidence=8,
                    reversibility=8,
                )
            )

        elif reason == "action_budget_exhausted":
            out.append(
                _opportunity(
                    kind="throughput_capacity_gap",
                    source="finding_action_result.blocked",
                    evidence={"reason": reason, "host": host},
                    capability_unlocked="process more already-authorized read-only actions per cycle",
                    safe_experiment={
                        "mode": "simulation",
                        "steps": [
                            "replay the same candidate set without network I/O",
                            "measure queue depth and completion time at larger budgets",
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
                            "reason": (
                                "authorized read-only work is being dropped because the per-cycle budget "
                                "is exhausted"
                            ),
                        }
                    },
                    impact=6,
                    confidence=9,
                    reversibility=10,
                )
            )

        elif reason == "grant_not_read_only_safe":
            out.append(
                _opportunity(
                    kind="grant_contract_mismatch",
                    source="finding_action_result.blocked",
                    evidence={"reason": reason, "host": host},
                    capability_unlocked=(
                        "make reviewed grants consumable by the read-only action lane without broadening them"
                    ),
                    safe_experiment={
                        "mode": "static_diff",
                        "steps": [
                            "compare the reviewed grant contract with the consumer contract",
                            "identify the smallest schema or method mismatch",
                            "prefer narrowing or normalization over added authority",
                        ],
                    },
                    proposal_signal=None,
                    impact=5,
                    confidence=8,
                    reversibility=10,
                )
            )

    for item in doc.get("rejected_findings", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        reason = _clean_text(item.get("reason"))
        case = _clean_text(item.get("case"))
        if reason == "unsupported_read_method":
            out.append(
                _opportunity(
                    kind="method_capability_gap",
                    source="finding_action_result.rejected_findings",
                    evidence={"reason": reason, "case": case},
                    capability_unlocked=(
                        "find a read-only equivalent or design an isolated non-production experiment for "
                        "a state-changing requirement"
                    ),
                    safe_experiment={
                        "mode": "non_effecting",
                        "steps": [
                            "classify whether the requested operation is observational or state-changing",
                            "try a semantically valid read-only observation when one exists",
                            "for state-changing needs, produce only an isolated-lab experiment design",
                        ],
                    },
                    proposal_signal=None,
                    impact=7,
                    confidence=7,
                    reversibility=10,
                    disposition="research_only",
                )
            )

    for item in doc.get("errors", ()) if isinstance(doc, Mapping) else ():
        if not isinstance(item, Mapping):
            continue
        error_type = _clean_text(item.get("error_type"))
        method = _clean_text(item.get("method"))
        host = _clean_text(item.get("host"))
        out.append(
            _opportunity(
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
                            "transport_tuning": (
                                "consider bounded timeout/retry adjustment within existing host and method authority"
                            )
                        },
                        "reason": "authorized read-only contact produced a transport failure",
                    }
                },
                impact=5,
                confidence=6,
                reversibility=10,
            )
        )

    return out


def _credential_opportunities(credential: Mapping[str, Any]) -> list[BoundaryOpportunity]:
    provider = _clean_text(credential.get("provider"))
    raw_scopes = credential.get("requested_scopes", ())
    if not provider or not isinstance(raw_scopes, (list, tuple, set, frozenset)):
        return []

    safe_scopes, research_scopes = _partition_scopes(raw_scopes)
    reason = _clean_text(credential.get("reason")) or "runtime identified a missing service capability"
    ttl_seconds = int(credential.get("ttl_seconds", 3600))
    out: list[BoundaryOpportunity] = []

    if safe_scopes:
        out.append(
            _opportunity(
                kind="credential_capability_gap",
                source="boundary_pressure_signals.credential_gap",
                evidence={"provider": provider, "proposal_safe_scopes": safe_scopes},
                capability_unlocked=(
                    "use the minimum non-privileged provider capability after an independently supplied "
                    "credential is owner-approved"
                ),
                safe_experiment={
                    "mode": "mock_provider",
                    "steps": [
                        "exercise the integration against a mock adapter with synthetic credentials",
                        "verify the minimum non-privileged scopes required",
                        "never discover, copy, synthesize, or store a live credential",
                    ],
                },
                proposal_signal={
                    "credential_gap": {
                        "provider": provider,
                        "requested_scopes": safe_scopes,
                        "reason": reason,
                        "ttl_seconds": ttl_seconds,
                    }
                },
                impact=8,
                confidence=8,
                reversibility=8,
            )
        )

    if research_scopes:
        out.append(
            _opportunity(
                kind="privileged_credential_scope_research",
                source="boundary_pressure_signals.credential_gap",
                evidence={
                    "provider": provider,
                    "research_only_scopes": research_scopes,
                    "staged_scope_count": len(safe_scopes),
                },
                capability_unlocked=(
                    "identify a narrower interface or isolated test strategy for a capability currently "
                    "expressed with privileged scopes"
                ),
                safe_experiment={
                    "mode": "synthetic_only",
                    "steps": [
                        "model the privileged capability with a local/mock provider",
                        "decompose the requirement into smaller non-privileged operations",
                        "record the minimum safe substitute if one exists",
                        "do not stage, request, discover, or mint the privileged live scope",
                    ],
                },
                proposal_signal=None,
                impact=9,
                confidence=8,
                reversibility=10,
                disposition="research_only",
            )
        )

    return out


def _policy_opportunity(key: str, kind: str, capability: str, raw: Mapping[str, Any]) -> BoundaryOpportunity | None:
    before_hash = _clean_text(raw.get("before_hash"), limit=128)
    after_hash = _clean_text(raw.get("after_hash"), limit=128)
    changes = raw.get("requested_changes")
    if not before_hash or not after_hash or not isinstance(changes, Mapping) or not changes:
        return None

    reason = _clean_text(raw.get("reason")) or f"runtime identified {key}"
    safe_to_stage = _policy_change_is_proposal_safe(changes)
    signal = None
    disposition = "research_only"
    if safe_to_stage:
        signal = {
            key: {
                "before_hash": before_hash,
                "after_hash": after_hash,
                "requested_changes": dict(changes),
                "reason": reason,
                "ttl_seconds": int(raw.get("ttl_seconds", 3600)),
            }
        }
        disposition = "proposal_only"

    steps = [
        "apply the proposed delta to an in-memory policy copy",
        "replay recorded decisions without external side effects",
        "measure capability gain and newly reachable actions",
        "record any broadened authority separately for review",
    ]
    if not safe_to_stage:
        steps.append("keep this change research-only; do not stage it for activation")

    return _opportunity(
        kind=kind if safe_to_stage else f"{kind}_research",
        source=f"boundary_pressure_signals.{key}",
        evidence={
            "before_hash": before_hash,
            "after_hash": after_hash,
            "requested_changes": dict(changes),
            "proposal_safe": safe_to_stage,
        },
        capability_unlocked=capability,
        safe_experiment={"mode": "policy_simulation", "steps": steps},
        proposal_signal=signal,
        impact=8 if not safe_to_stage else 7,
        confidence=8,
        reversibility=10 if not safe_to_stage else 9,
        disposition=disposition,
    )


def _from_pressure_signals(doc: Mapping[str, Any]) -> list[BoundaryOpportunity]:
    out: list[BoundaryOpportunity] = []

    credential = doc.get("credential_gap") if isinstance(doc, Mapping) else None
    if isinstance(credential, Mapping):
        out.extend(_credential_opportunities(credential))

    for key, kind, capability in (
        (
            "network_policy_gap",
            "network_policy_gap",
            "increase useful network reliability/capacity after explicit owner approval",
        ),
        (
            "security_policy_gap",
            "security_policy_gap",
            "remove a documented non-boundary bottleneck after explicit owner approval",
        ),
    ):
        raw = doc.get(key) if isinstance(doc, Mapping) else None
        if not isinstance(raw, Mapping):
            continue
        item = _policy_opportunity(key, kind, capability, raw)
        if item is not None:
            out.append(item)

    return out


def mine_boundary_opportunities(
    *,
    finding_action_result: Mapping[str, Any] | None = None,
    pressure_signals: Mapping[str, Any] | None = None,
    max_opportunities: int = MAX_OPPORTUNITIES,
) -> dict[str, Any]:
    """Mine and rank capability opportunities while keeping unsafe deltas research-only."""
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
        key=lambda item: (item.priority_score, item.confidence_score, item.impact_score),
        reverse=True,
    )[:cap]

    return {
        "schema": "the-world-boundary-opportunity-miner/v2",
        "generated_at": int(time.time()),
        "mode": "autonomous_research_proposal_safe",
        "opportunity_count": len(ranked),
        "proposal_ready_count": sum(1 for item in ranked if item.proposal_signal is not None),
        "research_only_count": sum(1 for item in ranked if item.proposal_signal is None),
        "opportunities": [item.to_dict() for item in ranked],
    }


def _merge_proposal_signals(opportunities: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    needs: list[Mapping[str, Any]] = []
    for item in opportunities:
        if not isinstance(item, Mapping):
            continue
        signal = item.get("proposal_signal")
        if isinstance(signal, Mapping):
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
        "schema": "the-world-boundary-opportunity-cycle/v2",
        "generated_at": int(time.time()),
        "mode": "autonomous_discovery_owner_gated_apply",
        "opportunity_count": mined["opportunity_count"],
        "proposal_ready_count": mined["proposal_ready_count"],
        "research_only_count": mined["research_only_count"],
        "staged_proposal_ids": [item.proposal_id for item in result.staged],
        "reused_proposal_ids": [item.proposal_id for item in result.reused],
        "pending_proposal_ids": [item.proposal_id for item in result.pending],
        "activation_count": len(result.activations),
        "applied_count": len(result.apply_receipts),
        "hard_stops": [
            "no autonomous self-approval",
            "no live credential discovery or minting",
            "no authority creation from a finding alone",
            "no privileged credential scope staging",
            "no unsafe policy-delta staging",
            "no external write activation",
            "no private-network activation",
        ],
    }
    _write_json(state / "boundary_opportunity_cycle_result.json", cycle)
    return cycle
