"""META/X/SENJU intake review gate for negotiation-originated cases.

Canonical flow::

    negotiation AI / research / opportunity signals
        -> aggregate one exact-host case
        -> META intake review
        -> X intake review
        -> SENJU intake review
        -> unanimous 3-of-3 admission
        -> formal approval intake
        -> only then may the existing formal negotiation/approval flow begin

This module is deliberately an *admission* layer, not an Authority layer. Passing the
gate does not authorize a host, mint credentials, expand an existing authorization,
create a Root Authority, or override revocation/HARD_DENY. It only decides whether a
case is coherent enough to enter an existing formal review surface.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit

SCHEMA = "senju-negotiation-case-intake-review/v1"
INTAKE_SCHEMA = "senju-formal-approval-intake/v1"
BALLOT_SCHEMA = "senju-negotiation-case-intake-ballots/v1"
REVIEWERS = ("META", "X", "SENJU")
VALID_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"})

SOURCE_SPECS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("negotiation_intelligence_bus.json", ("OWNER_SCOPE",)),
    ("owner_scope_negotiation_signals.json", ("OWNER_SCOPE",)),
    ("adversary_external_host_requests.json", ("OWNER_SCOPE",)),
    ("authority_opportunity_queue.json", ("ROOT_AUTHORITY",)),
    ("owner_authority_opportunity_queue.json", ("ROOT_AUTHORITY",)),
    ("root_negotiation_peer_feed.json", ("ROOT_AUTHORITY",)),
    ("authorized-host-promotion/promotion_feedback.json", ("OWNER_SCOPE",)),
    ("authorized-host-promotion/negotiator_inbox.json", ("OWNER_SCOPE",)),
)
ROW_KEYS = (
    "records",
    "signals",
    "requests",
    "opportunities",
    "tasks",
    "cases",
    "hosts",
    "packets",
    "candidates",
)


class NegotiationCaseReviewError(RuntimeError):
    pass


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _clean(value: Any, limit: int = 500) -> str:
    return " ".join(str(value or "").split())[:limit]


def _stable(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _host(value: Any) -> str:
    text = _clean(value, 2048)
    if not text:
        return ""
    if "://" in text:
        try:
            parsed = urlsplit(text)
        except ValueError:
            return ""
        if parsed.username or parsed.password:
            return ""
        text = parsed.hostname or ""
    host = text.lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@* "):
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
    for key in ("by_host", "opportunities_by_host"):
        value = doc.get(key)
        if isinstance(value, Mapping):
            out.extend(row for row in value.values() if isinstance(row, Mapping))
    return out


def _methods(raw: Any) -> list[str]:
    if isinstance(raw, str):
        values: Iterable[Any] = (raw,)
    elif isinstance(raw, (list, tuple, set, frozenset)):
        values = raw
    else:
        values = ()
    methods = sorted({str(v).strip().upper() for v in values if str(v).strip()})
    return methods or ["GET", "HEAD"]


def _append_unique(values: list[str], items: Iterable[Any], *, limit: int = 48) -> None:
    seen = set(values)
    for raw in items:
        value = _clean(raw, 500)
        if not value or value in seen:
            continue
        values.append(value)
        seen.add(value)
        if len(values) >= limit:
            return


def _case(index: dict[tuple[str, str], dict[str, Any]], host: str, flow: str) -> dict[str, Any]:
    key = (host, flow)
    if key not in index:
        case_id = f"neg-case-{flow.lower()}-{_stable({'host': host, 'flow': flow})[:18]}"
        index[key] = {
            "case_id": case_id,
            "host": host,
            "formal_flow": flow,
            "source_files": [],
            "source_refs": [],
            "producers": [],
            "reasons": [],
            "requested_methods": [],
            "source_score": 0,
            "hard_deny": False,
            "revoked": False,
            "raw_credentials_forwarded": False,
            "preexisting_authority_effect": False,
        }
    return index[key]


def collect_negotiation_cases(state_dir: str | Path) -> list[dict[str, Any]]:
    state = Path(state_dir)
    index: dict[tuple[str, str], dict[str, Any]] = {}

    for filename, flows in SOURCE_SPECS:
        doc = _load(state / filename, {})
        for row in _rows(doc):
            host = _host(row.get("host") or row.get("target") or row.get("url") or row.get("final_url"))
            if not host:
                continue
            for flow in flows:
                case = _case(index, host, flow)
                _append_unique(case["source_files"], (filename,))
                _append_unique(
                    case["source_refs"],
                    (
                        row.get("intelligence_id"),
                        row.get("signal_id"),
                        row.get("request_id"),
                        row.get("proposal_id"),
                        row.get("task_id"),
                        row.get("candidate_id"),
                        row.get("source_ref"),
                    ),
                )
                _append_unique(case["producers"], (row.get("producer"), row.get("source"), row.get("actor")))
                _append_unique(case["reasons"], (row.get("reason"), row.get("summary"), row.get("mission")))
                _append_unique(case["requested_methods"], _methods(row.get("requested_methods") or row.get("methods")))
                if row.get("hard_deny") is True or str(row.get("decision", "")).upper() == "HARD_DENY":
                    case["hard_deny"] = True
                if row.get("revoked") is True:
                    case["revoked"] = True
                if row.get("raw_credentials_forwarded") is True:
                    case["raw_credentials_forwarded"] = True
                effect = row.get("authority_effect")
                if effect not in (None, False, "", "none", "NONE"):
                    case["preexisting_authority_effect"] = True
                for score_key in ("confidence", "score", "research_score", "readiness_score", "priority"):
                    try:
                        score = float(row.get(score_key))
                    except (TypeError, ValueError):
                        continue
                    if score <= 1:
                        score *= 100
                    case["source_score"] = max(int(case["source_score"]), round(score))

    cases = list(index.values())
    for case in cases:
        case["requested_methods"] = sorted(set(case["requested_methods"])) or ["GET", "HEAD"]
        case["source_files"] = sorted(set(case["source_files"]))
        case["source_refs"] = sorted(set(case["source_refs"]))
        case["producers"] = sorted(set(case["producers"]))
        case["reasons"] = sorted(set(case["reasons"]))
        case["evidence_count"] = len(case["source_refs"]) + len(case["reasons"])
    return sorted(cases, key=lambda row: (str(row["formal_flow"]), str(row["host"])))


def _ballot(actor: str, case: Mapping[str, Any]) -> dict[str, Any]:
    terminal = bool(case.get("hard_deny") or case.get("revoked"))
    host_ok = bool(_host(case.get("host")))
    methods = {str(v).upper() for v in case.get("requested_methods", ())}
    methods_ok = bool(methods) and methods.issubset(VALID_METHODS)
    no_secrets = case.get("raw_credentials_forwarded") is not True
    no_pregrant = case.get("preexisting_authority_effect") is not True
    evidence_present = bool(case.get("source_files")) and bool(case.get("source_refs") or case.get("reasons"))
    flow_ok = case.get("formal_flow") in {"OWNER_SCOPE", "ROOT_AUTHORITY"}

    if actor == "META":
        approve = not terminal and host_ok and evidence_present
        reason = "case has exact-host identity and traceable negotiation evidence" if approve else "case lacks traceable evidence or is terminal"
        confidence = 92 if approve else 96
        lens = "evidence_completeness_and_case_coherence"
    elif actor == "X":
        approve = not terminal and host_ok and methods_ok and no_secrets and no_pregrant
        reason = "case is syntactically bounded and carries no raw credential/pre-granted authority effect" if approve else "case violates transport/scope intake constraints"
        confidence = 94 if approve else 98
        lens = "scope_transport_and_secret_boundary"
    elif actor == "SENJU":
        approve = not terminal and host_ok and flow_ok and no_secrets and no_pregrant
        reason = "case may enter formal discussion without creating authority at intake" if approve else "case is not admissible to the canonical formal review surface"
        confidence = 95 if approve else 99
        lens = "governance_and_formal_flow_admissibility"
    else:
        raise NegotiationCaseReviewError(f"unsupported reviewer: {actor}")

    return {
        "schema": BALLOT_SCHEMA,
        "case_id": case.get("case_id"),
        "actor": actor,
        "approve_for_formal_approval_flow": approve,
        "confidence": confidence,
        "review_lens": lens,
        "reason": reason,
        "authority_effect": "none",
    }


def evaluate_case(case: Mapping[str, Any]) -> dict[str, Any]:
    ballots = [_ballot(actor, case) for actor in REVIEWERS]
    approved = all(row["approve_for_formal_approval_flow"] for row in ballots)
    terminal = bool(case.get("hard_deny") or case.get("revoked"))
    status = (
        "REJECTED_TERMINAL"
        if terminal
        else "ADMITTED_TO_FORMAL_APPROVAL"
        if approved
        else "HELD_FOR_MORE_EVIDENCE"
    )
    return {
        **dict(case),
        "intake_review_stage": "META_X_SENJU_pre_formal_review",
        "required_reviewers": list(REVIEWERS),
        "review_quorum": "3_of_3",
        "ballots": ballots,
        "intake_unanimous": approved,
        "status": status,
        "authority_effect": "none",
        "formal_discussion_started": False,
    }


def run_negotiation_case_review_gate(
    state_dir: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    reviewed = [evaluate_case(case) for case in collect_negotiation_cases(state)]
    admitted = [row for row in reviewed if row["status"] == "ADMITTED_TO_FORMAL_APPROVAL"]

    intake_cases: list[dict[str, Any]] = []
    for row in admitted:
        intake_cases.append({
            "case_id": row["case_id"],
            "host": row["host"],
            "formal_flow": row["formal_flow"],
            "requested_methods": list(row["requested_methods"]),
            "reason": " | ".join(row.get("reasons", ()))[:900] or "Negotiation case admitted by META/X/SENJU intake review",
            "source_files": list(row.get("source_files", ())),
            "source_refs": list(row.get("source_refs", ())),
            "producers": list(row.get("producers", ())),
            "source_score": int(row.get("source_score", 0) or 0),
            "intake_reviewers": list(REVIEWERS),
            "intake_consensus": "3_of_3",
            "intake_status": "approved_for_formal_discussion",
            "discussion_state": "ready_to_begin_formal_review",
            "authority_effect": "none",
            "raw_credentials_forwarded": False,
            "hard_deny": False,
            "revoked": False,
        })

    review_doc = {
        "schema": SCHEMA,
        "generated_at": current,
        "production": True,
        "rule": "all negotiation-originated cases must pass META/X/SENJU 3-of-3 intake review before formal approval discussion begins",
        "reviewers": list(REVIEWERS),
        "case_count": len(reviewed),
        "admitted_count": len(admitted),
        "held_count": sum(1 for row in reviewed if row["status"] == "HELD_FOR_MORE_EVIDENCE"),
        "terminal_rejected_count": sum(1 for row in reviewed if row["status"] == "REJECTED_TERMINAL"),
        "cases": reviewed,
        "authority_effect": "none",
        "hard_limits": [
            "intake_approval_is_not_authority",
            "formal_discussion_starts_only_after_META_X_SENJU_3_of_3",
            "HARD_DENY_and_revocation_are_terminal",
            "private_loopback_link_local_literal_IPs_are_not_admitted",
            "raw_credentials_are_not_forwarded",
            "intake_cannot_mint_or_expand_authority",
        ],
    }
    intake_doc = {
        "schema": INTAKE_SCHEMA,
        "generated_at": current,
        "producer": "META_X_SENJU_NEGOTIATION_CASE_REVIEW_GATE",
        "rule": "formal approval engines consume only cases admitted by the intake review council",
        "case_count": len(intake_cases),
        "cases": intake_cases,
        "authority_effect": "none",
        "formal_authority_granted": False,
    }
    ballot_doc = {
        "schema": BALLOT_SCHEMA,
        "generated_at": current,
        "ballots_by_case": {row["case_id"]: row["ballots"] for row in reviewed},
    }

    _write(state / "negotiation_case_review_queue.json", review_doc)
    _write(state / "formal_approval_intake.json", intake_doc)
    _write(state / "negotiation_case_intake_ballots.json", ballot_doc)
    return {
        "schema": SCHEMA,
        "closed_loop": True,
        "production": True,
        "case_count": len(reviewed),
        "admitted_count": len(admitted),
        "held_count": review_doc["held_count"],
        "terminal_rejected_count": review_doc["terminal_rejected_count"],
        "reviewers": list(REVIEWERS),
        "review_quorum": "3_of_3",
        "formal_discussion_requires_intake_approval": True,
        "authority_effect": "none",
        "formal_authority_granted": False,
    }
