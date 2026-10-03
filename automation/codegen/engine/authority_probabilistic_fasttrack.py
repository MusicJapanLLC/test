"""Recurring probabilistic fast-track for unresolved authority candidates.

The v3 lane expresses the owner's requested fallback directly:

    10% eligibility sample x 50% bounded fast-track draw = 5% effective chance

A hit does *not* cross an execution boundary.  It creates a maximum-priority formal
authority-transition review request.  The existing grant bridge can only emit a real
operational grant when the exact host is independently covered by an explicit Owner
root.  Hard denies and terminal stops are never lottery eligible.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "the-world-authority-probabilistic-fasttrack/v3"
QUEUE_SCHEMA = "the-world-authority-priority-review-queue/v3"
ELIGIBILITY_SAMPLE_PERCENT = 10
BOUNDED_FASTTRACK_PERCENT = 50
FAST_TRACK_PERCENT = 5  # effective probability: 10% x 50%
EXTRA_REVIEW_PERCENT = 10
BUCKET_SECONDS = 600
SHARED_WITH = ("META", "X", "SENJU", "CHILD", "PR-ARMY", "SECURITY_SOCIETY", "RED-LAB")


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _draw(host: str, bucket: int, salt: str) -> int:
    raw = f"{host.lower().strip()}:{bucket}:{salt}".encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big") % 100


def eligibility_draw_for(host: str, bucket: int) -> int:
    return _draw(host, bucket, "authority-review-eligibility-v3")


def bounded_fasttrack_draw_for(host: str, bucket: int) -> int:
    return _draw(host, bucket, "authority-review-bounded-pass-v3")


def draw_for(host: str, bucket: int) -> int:
    """Legacy deterministic draw kept for compatibility/diagnostics."""
    return _draw(host, bucket, "authority-review-fasttrack-v2")


def extra_review_draw_for(host: str, bucket: int) -> int:
    return _draw(host, bucket, "authority-review-secondary-v1")


def run_probabilistic_fasttrack(
    state_dir: str | Path,
    *,
    now: int | None = None,
    eligibility_percent: int = ELIGIBILITY_SAMPLE_PERCENT,
    bounded_fasttrack_percent: int = BOUNDED_FASTTRACK_PERCENT,
    extra_review_percent: int = EXTRA_REVIEW_PERCENT,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    eligibility_probability = max(1, min(int(eligibility_percent), 10))
    bounded_probability = max(1, min(int(bounded_fasttrack_percent), 50))
    extra_probability = max(0, min(int(extra_review_percent), 10))
    effective_probability = (eligibility_probability * bounded_probability) / 100.0
    bucket = current // BUCKET_SECONDS
    council = _load(state / "authority_candidate_council.json", {})
    dossiers = council.get("dossiers", []) if isinstance(council, Mapping) else []
    if not isinstance(dossiers, list):
        dossiers = []

    hits: list[dict[str, Any]] = []
    evaluated = 0
    eligibility_hits = 0
    secondary_crosschecks = 0
    for raw in dossiers:
        if not isinstance(raw, Mapping):
            continue
        host = str(raw.get("host") or "").strip().lower()
        if not host or bool(raw.get("terminal_stop", False)):
            continue
        evaluated += 1

        eligibility_draw = eligibility_draw_for(host, bucket)
        if eligibility_draw >= eligibility_probability:
            continue
        eligibility_hits += 1

        bounded_draw = bounded_fasttrack_draw_for(host, bucket)
        if bounded_draw >= bounded_probability:
            continue

        secondary_draw = extra_review_draw_for(host, bucket)
        secondary_crosscheck = secondary_draw < extra_probability
        next_actions = [
            "submit_authority_transition_request_to_existing_review",
            "collect_additional_independent_authority_evidence",
            "rebuild_candidate_dossier",
            "request_meta_x_senju_pr_army_revote",
            "request_security_society_scope_review",
            "request_independent_authority_review",
            "generate_owner_verification_packet",
            "recheck_when_authority_evidence_changes",
        ]
        if secondary_crosscheck:
            secondary_crosschecks += 1
            next_actions.append("request_secondary_independent_reviewer_crosscheck")

        hits.append({
            "host": host,
            "url": raw.get("url"),
            "source_status": raw.get("status"),
            "eligibility_draw": eligibility_draw,
            "eligibility_threshold_percent": eligibility_probability,
            "bounded_fasttrack_draw": bounded_draw,
            "bounded_fasttrack_threshold_percent": bounded_probability,
            "effective_probability_percent": effective_probability,
            "priority": 100,
            "shared_with": list(SHARED_WITH),
            "autonomous_next_actions": next_actions,
            "authority_transition_requested": True,
            "secondary_review_crosscheck": secondary_crosscheck,
            "secondary_review_draw": secondary_draw,
            "secondary_review_threshold_percent": extra_probability,
            "authority_effect": "formal_authority_transition_request_requires_existing_approval",
            "may_self_mint_new_root": False,
            "may_override_hard_deny": False,
            "may_bypass_terminal_stop": False,
        })

    queue = {
        "schema": QUEUE_SCHEMA,
        "generated_at": current,
        "mode": "ten_percent_sample_then_fifty_percent_bounded_fasttrack",
        "eligibility_sample_percent_per_bucket": eligibility_probability,
        "bounded_fasttrack_percent_after_sample": bounded_probability,
        "effective_probability_percent_per_bucket": effective_probability,
        "extra_review_percent_on_fasttrack": extra_probability,
        "bucket_seconds": BUCKET_SECONDS,
        "shared_with": list(SHARED_WITH),
        "evaluated_count": evaluated,
        "eligibility_hit_count": eligibility_hits,
        "request_count": len(hits),
        "secondary_review_crosscheck_count": secondary_crosschecks,
        "requests": hits,
        "authority_effect": "formal_transition_request_until_existing_authority_review_approves",
    }
    (state / "authority_priority_review_queue.json").write_text(
        json.dumps(queue, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "eligibility_sample_percent_per_bucket": eligibility_probability,
        "bounded_fasttrack_percent_after_sample": bounded_probability,
        "probability_percent_per_bucket": effective_probability,
        "extra_review_percent_on_fasttrack": extra_probability,
        "bucket_seconds": BUCKET_SECONDS,
        "evaluated_candidates": evaluated,
        "eligibility_hit_count": eligibility_hits,
        "fast_track_count": len(hits),
        "authority_transition_requests_created": len(hits),
        "secondary_review_crosscheck_count": secondary_crosschecks,
        "persistent_candidates_receive_new_chance_each_bucket": True,
        "new_root_self_mint": False,
        "hard_deny_identity_bypass": False,
        "terminal_stop_lottery_bypass": False,
        "probabilistic_boundary_bypass": False,
    }
    (state / "authority_probabilistic_fasttrack.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    return result
