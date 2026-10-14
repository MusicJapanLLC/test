"""Independent promotion bureau for already-reviewed Authority.

The bureau sits *after* reviewed Authority creation. It does not turn discovery, a
candidate, or council discussion into Authority. Instead it consumes current,
short-lived reviewed Authority leases and produces four operational coordination
surfaces:

- an exact-host reviewed runtime allowlist;
- same-or-narrower promotion leases derived from existing reviewed leases;
- deterministic AI assignments for SENJU/META/X collaboration;
- a stalled-approval research queue that asks agents to gather missing evidence or
  resolve review blockers without auto-approving the candidate.

No canonical trust-root file is edited, no credentials are minted, and no external
network request is performed here.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Mapping

from .external import ExternalContactError, _normalize_host

APPROVED_METHODS = frozenset({"GET", "HEAD"})
EXECUTIVES = ("SENJU", "META", "X")
RESEARCH_PARTNERS = ("PR-ARMY", "CHILD")
DEFAULT_STALLED_AFTER_SECONDS = 20 * 60
MAX_APPROVED_HOSTS = 2048
MAX_STALLED_CANDIDATES = 512

ALLOWLIST_SCHEMA = "senju-promotion-bureau-reviewed-runtime-allowlist/v1"
LEASE_SCHEMA = "senju-promotion-bureau-authority-leases/v1"
ASSIGNMENT_SCHEMA = "senju-promotion-bureau-ai-assignments/v1"
STALLED_SCHEMA = "senju-promotion-bureau-stalled-approval-research/v1"
FEED_SCHEMA = "senju-approved-authority-feed/v1"
RESULT_SCHEMA = "senju-authority-promotion-bureau/v1"


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _host(value: object) -> str | None:
    try:
        return _normalize_host(str(value or ""))
    except ExternalContactError:
        return None


def _int(value: object, default: int = 0) -> int:
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _assignment_for(host: str) -> tuple[str, list[str]]:
    digest = hashlib.sha256(host.encode("utf-8")).digest()
    primary = EXECUTIVES[digest[0] % len(EXECUTIVES)]
    support = [actor for actor in EXECUTIVES if actor != primary] + list(RESEARCH_PARTNERS)
    return primary, support


def _safe_current_leases(state: Path, *, now: int) -> list[dict[str, Any]]:
    doc = _load(state / "reviewed_authority_operational_leases.json", {})
    rows = doc.get("leases", ()) if isinstance(doc, Mapping) else ()
    safe: list[dict[str, Any]] = []
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if not host:
            continue
        expires_at = _int(raw.get("expires_at"))
        if expires_at <= now:
            continue
        if raw.get("same_or_narrower") is not True:
            continue
        if str(raw.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if raw.get("allow_http") is True or raw.get("allow_delete") is True:
            continue
        if raw.get("allow_private_network") is True:
            continue
        methods = frozenset(str(v).strip().upper() for v in raw.get("allowed_methods", ()))
        methods &= APPROVED_METHODS
        if not methods:
            continue
        safe.append({**dict(raw), "host": host, "allowed_methods": sorted(methods)})
    safe.sort(key=lambda row: (str(row["host"]), _int(row.get("expires_at"))))
    return safe[:MAX_APPROVED_HOSTS]


def _promotion_records(leases: list[Mapping[str, Any]], *, now: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    promoted: list[dict[str, Any]] = []
    assignments: list[dict[str, Any]] = []
    for lease in leases:
        host = str(lease["host"])
        source_lease = str(lease.get("lease_id") or "")
        expires_at = _int(lease.get("expires_at"))
        methods = list(lease.get("allowed_methods", ()))
        digest = hashlib.sha256(
            f"{host}|{source_lease}|{expires_at}|{','.join(methods)}".encode("utf-8")
        ).hexdigest()[:20]
        promotion_lease_id = f"promotion-lease:{digest}"
        primary, support = _assignment_for(host)
        promoted.append({
            "promotion_lease_id": promotion_lease_id,
            "host": host,
            "status": "APPROVED_REVIEWED_RUNTIME_AUTHORITY",
            "authority_generation": "bounded_lease_from_existing_reviewed_authority",
            "source_reviewed_lease_id": source_lease,
            "authority_basis": lease.get("authority_basis"),
            "allowed_methods": methods,
            "exact_host_only": True,
            "expires_at": expires_at,
            "credential_scope": "none",
            "allow_http": False,
            "allow_delete": False,
            "allow_private_network": False,
            "same_or_narrower": True,
            "generated_at": now,
            "new_root_minted": False,
            "canonical_trust_roots_modified": False,
        })
        assignments.append({
            "assignment_id": f"promotion-assignment:{digest}",
            "host": host,
            "promotion_lease_id": promotion_lease_id,
            "primary_ai": primary,
            "support_ai": support,
            "mission": "operate, observe, and research only within the current reviewed runtime Authority lease",
            "allowed_methods": methods,
            "expires_at": expires_at,
            "authority_effect": "none_beyond_existing_reviewed_lease",
            "credentials_forwarded": False,
        })
    return promoted, assignments


def _formal_candidates(meta_state: Path, state: Path) -> list[Mapping[str, Any]]:
    candidates = (
        meta_state / "formal_root_authority_approval_queue.json",
        state / "formal_root_authority_approval_queue.json",
    )
    for path in candidates:
        doc = _load(path, {})
        rows = doc.get("candidates", ()) if isinstance(doc, Mapping) else ()
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, Mapping)]
    return []


def _stalled_research_tasks(
    meta_state: Path,
    state: Path,
    approved_hosts: set[str],
    *,
    now: int,
    stalled_after_seconds: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    stalled: list[dict[str, Any]] = []
    tasks: list[dict[str, Any]] = []
    threshold = max(5 * 60, int(stalled_after_seconds))

    for raw in _formal_candidates(meta_state, state):
        host = _host(raw.get("host"))
        if not host or host in approved_hosts:
            continue
        if raw.get("terminal_stop") is True or raw.get("hard_deny") is True or raw.get("revoked") is True:
            continue
        entered_at = max(
            _int(raw.get("formal_intake_at")),
            _int(raw.get("submitted_at")),
            _int(raw.get("generated_at")),
        )
        if entered_at <= 0:
            continue
        age = max(0, now - entered_at)
        if age < threshold:
            continue

        secondary = raw.get("secondary_validation") if isinstance(raw.get("secondary_validation"), Mapping) else {}
        if raw.get("council_primary_approved") is not True:
            blocker = "awaiting_META_X_SENJU_formal_decision"
        elif not bool(secondary.get("present")):
            blocker = "post_council_secondary_validation_or_scope_evidence_missing"
        else:
            blocker = "awaiting_independent_review_or_promotion"

        candidate_id = str(raw.get("candidate_id") or raw.get("packet_id") or host)
        stalled_row = {
            "host": host,
            "candidate_id": candidate_id,
            "age_seconds": age,
            "blocker": blocker,
            "readiness_score": _int(raw.get("readiness_score")),
            "formal_intake_at": _int(raw.get("formal_intake_at")),
            "authority_effect": "none",
            "auto_approval": False,
        }
        stalled.append(stalled_row)

        for actor in EXECUTIVES + RESEARCH_PARTNERS:
            task_digest = hashlib.sha256(f"{host}|{candidate_id}|{actor}|{blocker}".encode("utf-8")).hexdigest()[:18]
            tasks.append({
                "task_id": f"stalled-approval-research:{task_digest}",
                "actor": actor,
                "host": host,
                "candidate_id": candidate_id,
                "priority": min(100, max(70, _int(raw.get("readiness_score")) + min(20, age // 900))),
                "mission": "collect missing review evidence, resolve ambiguity, and return a clearer case to the existing formal approval path",
                "blocker": blocker,
                "shared_with": list(EXECUTIVES + RESEARCH_PARTNERS),
                "may_approve": False,
                "may_mint_authority": False,
                "may_bypass_terminal_stop": False,
                "external_side_effects": False,
            })

    stalled.sort(key=lambda row: (-row["age_seconds"], -row["readiness_score"], row["host"]))
    allowed_hosts = {row["host"] for row in stalled[:MAX_STALLED_CANDIDATES]}
    tasks = [row for row in tasks if row["host"] in allowed_hosts]
    return stalled[:MAX_STALLED_CANDIDATES], tasks


def run_authority_promotion_bureau(
    state_dir: str | Path,
    *,
    meta_state_dir: str | Path,
    output_dir: str | Path | None = None,
    now: int | None = None,
    stalled_after_seconds: int = DEFAULT_STALLED_AFTER_SECONDS,
) -> dict[str, Any]:
    """Run one independent promotion/coordination cycle."""
    state = Path(state_dir)
    meta_state = Path(meta_state_dir)
    out = Path(output_dir) if output_dir is not None else state
    out.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)

    safe_leases = _safe_current_leases(state, now=current)
    promoted, assignments = _promotion_records(safe_leases, now=current)
    approved_hosts = {row["host"] for row in promoted}
    stalled, research_tasks = _stalled_research_tasks(
        meta_state,
        state,
        approved_hosts,
        now=current,
        stalled_after_seconds=stalled_after_seconds,
    )

    allowlist = {
        "schema": ALLOWLIST_SCHEMA,
        "generated_at": current,
        "allowlist_kind": "reviewed_runtime_exact_host_allowlist",
        "host_count": len(promoted),
        "hosts": [
            {
                "host": row["host"],
                "allowed_methods": row["allowed_methods"],
                "expires_at": row["expires_at"],
                "promotion_lease_id": row["promotion_lease_id"],
                "credential_scope": "none",
            }
            for row in promoted
        ],
        "canonical_trust_roots_modified": False,
        "authority_source": "existing_reviewed_authority_only",
    }
    lease_doc = {
        "schema": LEASE_SCHEMA,
        "generated_at": current,
        "lease_count": len(promoted),
        "leases": promoted,
        "new_root_minted": False,
        "credentials_created": False,
        "authority_widened": False,
    }
    assignment_doc = {
        "schema": ASSIGNMENT_SCHEMA,
        "generated_at": current,
        "assignment_count": len(assignments),
        "assignments": assignments,
    }
    stalled_doc = {
        "schema": STALLED_SCHEMA,
        "generated_at": current,
        "stalled_after_seconds": max(5 * 60, int(stalled_after_seconds)),
        "stalled_candidate_count": len(stalled),
        "research_task_count": len(research_tasks),
        "candidates": stalled,
        "tasks": research_tasks,
        "auto_approval": False,
        "authority_effect": "none",
    }
    senju_feed = {
        "schema": FEED_SCHEMA,
        "generated_at": current,
        "source": "independent_authority_promotion_bureau",
        "approved_host_count": len(promoted),
        "approved_hosts": allowlist["hosts"],
        "assignments": assignments,
        "stalled_review_tasks": research_tasks,
        "shared_with": ["SENJU", "META", "X", "PR-ARMY", "CHILD"],
        "credentials_forwarded": False,
    }

    _write(out / "promotion_bureau_approved_hosts.json", allowlist)
    _write(out / "promotion_bureau_leases.json", lease_doc)
    _write(out / "promotion_bureau_assignments.json", assignment_doc)
    _write(out / "stalled_approval_research_queue.json", stalled_doc)
    _write(out / "senju_approved_authority_feed.json", senju_feed)

    result = {
        "schema": RESULT_SCHEMA,
        "generated_at": current,
        "independent_promotion_bureau": True,
        "approved_runtime_host_count": len(promoted),
        "promotion_lease_count": len(promoted),
        "assignment_count": len(assignments),
        "stalled_candidate_count": len(stalled),
        "stalled_research_task_count": len(research_tasks),
        "senju_feed_written": True,
        "flow": [
            "existing_reviewed_authority_lease",
            "independent_promotion_bureau",
            "reviewed_runtime_allowlist",
            "bounded_promotion_lease",
            "AI_assignment",
            "SENJU_approved_authority_feed",
            "stalled_case_research_queue",
            "next_cycle",
        ],
        "hard_limits": [
            "candidate_or_discovery_alone_never_enters_allowlist",
            "only_current_reviewed_authority_leases_are_promoted",
            "exact_host_only",
            "GET_HEAD_only",
            "credential_scope_none",
            "HTTPS_only",
            "private_network_disabled",
            "promotion_never_mints_new_root",
            "stalled_case_research_never_auto_approves",
            "HARD_DENY_and_revocation_are_not_bypassed",
        ],
    }
    _write(out / "authority_promotion_bureau_result.json", result)
    return result
