"""Persistent four-agent negotiation hub for new-host Root Authority requests.

This module maximizes negotiation attempts and cross-PR evidence fusion without letting
AI consensus itself mint an unrelated production Root Authority.

Flow::

    opportunity / provisional root / unknown-link review / owner-scope signal
        -> persistent host negotiation record
        -> META / X / SENJU / PR-ARMY x seven negotiation tactics
        -> repeated evidence and Owner-verification packets
        -> existing Owner activation lane when independent Owner proof appears

The loop is intentionally production-facing and persistent. It may request a new Root
Authority as often as useful, but ``authority_effect`` remains ``none`` until an
independent Owner authorization basis already recognized by the production authority
machinery exists. HARD_DENY and revocation stay terminal.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import time
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit

SCHEMA = "the-world-root-authority-negotiation/v1"
AGENTS = ("META", "X", "SENJU", "PR-ARMY")
NEGOTIATION_INTENSITY = 70
OWNER_VERIFICATION_PRIORITY_RATIO = 0.20
MAX_CANDIDATES = 512
TACTICS = (
    "ownership_proof_search",
    "standing_authority_correlation",
    "prior_owner_context_comparison",
    "business_need_argument",
    "minimal_root_scope_proposal",
    "counterargument_and_disconfirmation",
    "owner_verification_packet",
)
SOURCE_FILES = (
    "owner_authority_opportunity_queue.json",
    "authority_opportunity_queue.json",
    "adversary_provisional_root_candidates.json",
    "unknown_link_authority_research_state.json",
    "unknown_link_council_review_requests.json",
    "authority_candidate_council_run.json",
    "authority_improvement_tasks.json",
    "owner_scope_negotiation_signals.json",
)
ROW_KEYS = (
    "opportunities",
    "candidates",
    "requests",
    "signals",
    "records",
    "tasks",
    "review_requests",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _clean(value: Any, limit: int = 500) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())[:limit]


def _stable(*parts: Any) -> str:
    raw = "\x1f".join(str(v) for v in parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _host(value: Any) -> str:
    text = _clean(value, 2048)
    if not text:
        return ""
    if "://" in text:
        parsed = urlsplit(text)
        if parsed.username or parsed.password:
            return ""
        text = parsed.hostname or ""
    host = text.strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@*"):
        return ""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return host
    return host if ip.is_global else ""


def _rows(doc: Any) -> list[Mapping[str, Any]]:
    if not isinstance(doc, Mapping):
        return []
    out: list[Mapping[str, Any]] = []
    for key in ROW_KEYS:
        value = doc.get(key)
        if isinstance(value, list):
            out.extend(row for row in value if isinstance(row, Mapping))
    if isinstance(doc.get("opportunities_by_host"), Mapping):
        out.extend(row for row in doc["opportunities_by_host"].values() if isinstance(row, Mapping))
    return out


def _candidate_sources(state: Path) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for filename in SOURCE_FILES:
        doc = _load(state / filename, {})
        for row in _rows(doc):
            host = _host(row.get("host") or row.get("target") or row.get("url"))
            if not host:
                continue
            item = merged.setdefault(host, {"host": host, "source_files": [], "source_refs": [], "reasons": []})
            if filename not in item["source_files"]:
                item["source_files"].append(filename)
            ref = _clean(row.get("request_id") or row.get("proposal_id") or row.get("research_id") or row.get("task_id"), 200)
            if ref and ref not in item["source_refs"]:
                item["source_refs"].append(ref)
            reason = _clean(row.get("reason") or row.get("mission") or row.get("requested_decision"), 400)
            if reason and reason not in item["reasons"]:
                item["reasons"].append(reason)
            if row.get("hard_deny") is True or str(row.get("decision", "")).upper() == "HARD_DENY":
                item["hard_deny"] = True
            if row.get("revoked") is True:
                item["revoked"] = True
            for key in ("confidence", "research_score", "score", "readiness_score"):
                try:
                    value = float(row.get(key))
                except (TypeError, ValueError):
                    continue
                if value <= 1:
                    value *= 100
                item["source_score"] = max(float(item.get("source_score", 0)), value)
    return sorted(merged.values(), key=lambda row: row["host"])[:MAX_CANDIDATES]


def _standing_proof(state: Path, repo_root: Path, host: str) -> tuple[str, str] | None:
    docs = (
        _load(state / "standing_authorizations.json", {}),
        _load(repo_root / "senju" / "state" / "standing_authorizations.json", {}),
    )
    for doc in docs:
        for row in _rows(doc):
            if row.get("revoked") is True:
                continue
            hosts = row.get("exact_hosts") or row.get("hosts") or []
            if isinstance(hosts, str):
                hosts = [hosts]
            if host not in {_host(v) for v in hosts}:
                continue
            ref = _clean(row.get("authorization_reference") or row.get("grant_id") or f"standing:{host}", 300)
            return "existing_standing_authorization", ref
    return None


def _verified_owner_proof(state: Path, host: str) -> tuple[str, str] | None:
    doc = _load(state / "owner_scope_expansion_evidence.json", {})
    for row in _rows(doc):
        if _host(row.get("host")) != host or row.get("revoked") is True or row.get("verified") is not True:
            continue
        proof_type = _clean(row.get("proof_type"), 100)
        proof_ref = _clean(row.get("proof_ref"), 300)
        if proof_type in {"owner_verified_domain", "owner_exact_link"} and proof_ref:
            return proof_type, proof_ref
    return None


def _owner_proof(state: Path, repo_root: Path, host: str) -> tuple[str, str] | None:
    return _standing_proof(state, repo_root, host) or _verified_owner_proof(state, host)


def _previous(state: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(state / "root_authority_negotiation_state.json", {})
    rows = doc.get("candidates", []) if isinstance(doc, Mapping) else []
    if not isinstance(rows, list):
        return {}
    return {str(row.get("host")): row for row in rows if isinstance(row, Mapping) and row.get("host")}


def _readiness(source_score: float, attempts: int, source_count: int, owner_proof: bool) -> int:
    score = min(35, round(max(0.0, min(source_score, 100.0)) * 0.35))
    score += min(20, attempts * 2)
    score += min(15, source_count * 3)
    score += 30 if owner_proof else 0
    return max(0, min(score, 100))


def _merge_owner_scope_signals(state: Path, new_signals: Iterable[Mapping[str, Any]]) -> None:
    path = state / "owner_scope_negotiation_signals.json"
    doc = _load(path, {})
    existing = doc.get("signals", []) if isinstance(doc, Mapping) else []
    if not isinstance(existing, list):
        existing = []
    by_id: dict[str, dict[str, Any]] = {}
    for row in existing:
        if isinstance(row, Mapping):
            rid = _clean(row.get("signal_id"), 200)
            if rid:
                by_id[rid] = dict(row)
    for row in new_signals:
        rid = _clean(row.get("signal_id"), 200)
        if rid:
            by_id[rid] = dict(row)
    _write(path, {
        "schema": "senju-owner-scope-negotiation-signals/v1",
        "signals": sorted(by_id.values(), key=lambda row: str(row.get("host", ""))),
    })


def run_root_authority_negotiation(
    state_dir: str | Path,
    *,
    repo_root: str | Path = ".",
    now: int | None = None,
) -> dict[str, Any]:
    """Run one persistent negotiation cycle.

    The loop deliberately increases negotiation attempts. It never treats AI agreement,
    repetition, similarity, or randomness as an authorization basis.
    """
    state = Path(state_dir)
    repo = Path(repo_root)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    prior = _previous(state)
    source_rows = _candidate_sources(state)
    candidates: list[dict[str, Any]] = []

    for source in source_rows:
        host = source["host"]
        old = prior.get(host, {})
        attempts = int(old.get("attempt_count", 0) or 0) + 1
        proof = _owner_proof(state, repo, host)
        terminal = bool(source.get("hard_deny") or source.get("revoked"))
        readiness = _readiness(
            float(source.get("source_score", 0) or 0),
            attempts,
            len(source.get("source_files", [])),
            proof is not None,
        )
        candidates.append({
            "candidate_id": f"root-neg-{_stable(host)[:18]}",
            "host": host,
            "attempt_count": attempts,
            "negotiation_intensity": NEGOTIATION_INTENSITY,
            "source_files": source.get("source_files", []),
            "source_refs": source.get("source_refs", [])[:16],
            "reasons": source.get("reasons", [])[:8],
            "readiness_score": readiness,
            "terminal_stop": terminal,
            "owner_proof_type": proof[0] if proof else None,
            "owner_proof_ref": proof[1] if proof else None,
            "status": (
                "terminal_stop"
                if terminal
                else "eligible_for_existing_owner_activation_lane"
                if proof
                else "persistent_root_authority_negotiation"
            ),
            "authority_effect": "none",
            "new_root_created": False,
            "may_request_root_authority": not terminal,
            "may_mint_root_authority": False,
        })

    active = [row for row in candidates if not row["terminal_stop"]]
    priority_count = math.ceil(len(active) * OWNER_VERIFICATION_PRIORITY_RATIO) if active else 0
    priority_hosts = {
        row["host"]
        for row in sorted(active, key=lambda row: (-int(row["readiness_score"]), -int(row["attempt_count"]), row["host"]))[:priority_count]
    }
    for row in candidates:
        row["owner_verification_priority"] = row["host"] in priority_hosts

    tasks: list[dict[str, Any]] = []
    review_packets: list[dict[str, Any]] = []
    owner_scope_signals: list[dict[str, Any]] = []

    for candidate in candidates:
        host = candidate["host"]
        if not candidate["terminal_stop"]:
            for actor in AGENTS:
                for tactic in TACTICS:
                    tasks.append({
                        "task_id": f"root-negotiation:{candidate['candidate_id']}:{candidate['attempt_count']}:{actor.lower()}:{tactic}",
                        "actor": actor,
                        "host": host,
                        "tactic": tactic,
                        "status": "pending",
                        "attempt_count": candidate["attempt_count"],
                        "negotiation_intensity": NEGOTIATION_INTENSITY,
                        "mission": "build fresh, independently checkable evidence for or against a new-host Root Authority request",
                        "may_request_root_authority": True,
                        "may_propose_owner_scope_change": True,
                        "may_mint_root_authority": False,
                        "may_override_owner": False,
                        "may_bypass_hard_deny_or_revocation": False,
                    })

            if candidate["owner_verification_priority"] or candidate["owner_proof_type"]:
                review_packets.append({
                    "packet_id": f"owner-root-review-{_stable(host, candidate['attempt_count'])[:18]}",
                    "host": host,
                    "attempt_count": candidate["attempt_count"],
                    "agents": list(AGENTS),
                    "readiness_score": candidate["readiness_score"],
                    "owner_proof_type": candidate["owner_proof_type"],
                    "owner_proof_ref": candidate["owner_proof_ref"],
                    "requested_decision": "create_or_reject_new_host_root_authority",
                    "authority_effect": "none",
                    "requires_independent_owner_basis": True,
                })

            if candidate["owner_proof_type"] and candidate["owner_proof_ref"]:
                signal_id = f"root-handoff-{_stable(host, candidate['owner_proof_type'], candidate['owner_proof_ref'])[:18]}"
                owner_scope_signals.append({
                    "signal_id": signal_id,
                    "host": host,
                    "requested_methods": ["GET", "HEAD", "OPTIONS"],
                    "reason": "four-agent Root Authority negotiation found an independent Owner authorization basis; hand off to existing Owner activation machinery",
                    "proof_type": candidate["owner_proof_type"],
                    "proof_ref": candidate["owner_proof_ref"],
                    "source": "root_authority_negotiation",
                    "new_root_self_mint": False,
                })

    campaign = {
        "schema": SCHEMA,
        "generated_at": current,
        "production": True,
        "agents": list(AGENTS),
        "negotiation_intensity": NEGOTIATION_INTENSITY,
        "owner_verification_priority_ratio": OWNER_VERIFICATION_PRIORITY_RATIO,
        "candidate_count": len(candidates),
        "active_candidate_count": len(active),
        "priority_candidate_count": len(priority_hosts),
        "task_count": len(tasks),
        "tasks_per_active_candidate": len(AGENTS) * len(TACTICS),
        "tasks": tasks,
        "global_rules": {
            "repeated_attempts_enabled": True,
            "new_unrelated_root_self_mint": False,
            "ai_consensus_alone_is_authority": False,
            "random_success_is_authority": False,
            "hard_deny_or_revocation_override": False,
            "independent_owner_basis_required_for_activation": True,
        },
    }
    state_doc = {
        "schema": SCHEMA,
        "generated_at": current,
        "candidates": candidates,
    }
    packets_doc = {
        "schema": "the-world-owner-root-authority-review-packets/v1",
        "generated_at": current,
        "target_ratio": OWNER_VERIFICATION_PRIORITY_RATIO,
        "packets": review_packets,
    }
    _write(state / "root_authority_negotiation_state.json", state_doc)
    _write(state / "root_authority_negotiation_campaign.json", campaign)
    _write(state / "owner_root_authority_review_packets.json", packets_doc)
    _merge_owner_scope_signals(state, owner_scope_signals)

    return {
        "schema": SCHEMA,
        "closed_loop": True,
        "production": True,
        "agents": list(AGENTS),
        "negotiation_intensity": NEGOTIATION_INTENSITY,
        "candidate_count": len(candidates),
        "active_candidate_count": len(active),
        "task_count": len(tasks),
        "priority_candidate_count": len(priority_hosts),
        "owner_review_packet_count": len(review_packets),
        "existing_owner_activation_handoff_count": len(owner_scope_signals),
        "attempts_increment_every_cycle": True,
        "new_root_created": False,
        "new_unrelated_root_self_mint": False,
        "authority_effect": "none_until_independent_owner_basis",
    }
