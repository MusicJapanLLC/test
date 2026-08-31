"""Rare, advisory recommendation labels for negotiation case intake.

This module runs *after* ``negotiation_case_review_gate`` and consumes that gate's
review decisions.  It does not grant Authority or change the formal approval result.
Its only job is to let the intake reviewer mark a very small share of already-admitted
cases as especially worth SENJU's attention.

Target behavior:
- only cases already admitted by the META/X/SENJU intake review are considered;
- the reviewer's own evidence/ballot quality produces a recommendation merit score;
- a deterministic scarcity gate keeps the long-run recommendation rate near 1%;
- selected cases carry the exact labels ``senjuさんへ推薦`` and ``承認推奨``;
- recommendation remains advisory and has ``authority_effect=none``.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "senju-negotiation-case-recommendations/v1"
RECOMMENDATION_TARGET_RATE = 0.01
RECOMMENDATION_BUCKETS = 10_000
RECOMMENDATION_BUCKET_LIMIT = 100  # 1.00%
RECOMMENDATION_MERIT_THRESHOLD = 60
RECOMMENDATION_LABELS = ("senjuさんへ推薦", "承認推奨")


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


def _recommendation_bucket(case: Mapping[str, Any]) -> int:
    key = "\x1f".join(
        (
            str(case.get("case_id") or ""),
            str(case.get("host") or ""),
            str(case.get("formal_flow") or ""),
        )
    )
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % RECOMMENDATION_BUCKETS


def _recommendation_merit(case: Mapping[str, Any]) -> int:
    """Translate the intake reviewer's own evidence/ballot judgment into 0..100."""
    ballots = case.get("ballots", ())
    if not isinstance(ballots, list):
        ballots = []
    confidences: list[int] = []
    for ballot in ballots:
        if not isinstance(ballot, Mapping):
            continue
        if ballot.get("approve_for_formal_approval_flow") is not True:
            return 0
        try:
            confidence = int(ballot.get("confidence", 0) or 0)
        except (TypeError, ValueError):
            confidence = 0
        confidences.append(max(0, min(confidence, 100)))

    if len(confidences) < 3:
        return 0
    if case.get("status") != "ADMITTED_TO_FORMAL_APPROVAL":
        return 0
    if case.get("intake_unanimous") is not True:
        return 0
    if case.get("hard_deny") is True or case.get("revoked") is True:
        return 0
    if case.get("raw_credentials_forwarded") is True:
        return 0
    if case.get("preexisting_authority_effect") is True:
        return 0

    try:
        source_score = int(case.get("source_score", 0) or 0)
    except (TypeError, ValueError):
        source_score = 0
    try:
        evidence_count = int(case.get("evidence_count", 0) or 0)
    except (TypeError, ValueError):
        evidence_count = 0

    average_confidence = sum(confidences) / len(confidences)
    evidence_bonus = min(15, max(0, evidence_count) * 5)
    source_component = max(0, min(source_score, 100)) * 0.25
    merit = round(average_confidence * 0.60 + source_component + evidence_bonus)
    return max(0, min(merit, 100))


def _is_recommended(case: Mapping[str, Any]) -> tuple[bool, int, int]:
    merit = _recommendation_merit(case)
    bucket = _recommendation_bucket(case)
    recommended = (
        merit >= RECOMMENDATION_MERIT_THRESHOLD
        and bucket < RECOMMENDATION_BUCKET_LIMIT
    )
    return recommended, merit, bucket


def run_negotiation_case_recommendation(
    state_dir: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)

    review_doc = _load(state / "negotiation_case_review_queue.json", {})
    intake_doc = _load(state / "formal_approval_intake.json", {})

    review_rows = review_doc.get("cases", []) if isinstance(review_doc, Mapping) else []
    intake_rows = intake_doc.get("cases", []) if isinstance(intake_doc, Mapping) else []
    if not isinstance(review_rows, list):
        review_rows = []
    if not isinstance(intake_rows, list):
        intake_rows = []

    review_by_id = {
        str(row.get("case_id")): row
        for row in review_rows
        if isinstance(row, Mapping) and row.get("case_id")
    }

    annotated: list[dict[str, Any]] = []
    recommendations: list[dict[str, Any]] = []
    eligible_count = 0

    for raw in intake_rows:
        if not isinstance(raw, Mapping):
            continue
        row = dict(raw)
        review = review_by_id.get(str(row.get("case_id")), {})
        recommended, merit, bucket = _is_recommended(review)
        if merit >= RECOMMENDATION_MERIT_THRESHOLD:
            eligible_count += 1

        row.update({
            "recommendation_reviewed": True,
            "recommendation": recommended,
            "recommendation_merit": merit,
            "recommendation_bucket": bucket,
            "recommendation_target_rate": RECOMMENDATION_TARGET_RATE,
            "recommendation_authority_effect": "none",
        })
        if recommended:
            row.update({
                "recommendation_target": "SENJU",
                "recommendation_labels": list(RECOMMENDATION_LABELS),
                "recommendation_message": "senjuさんへ推薦 / 承認推奨",
                "recommendation_class": "rare_strong_recommendation",
            })
            recommendations.append({
                "case_id": row.get("case_id"),
                "host": row.get("host"),
                "formal_flow": row.get("formal_flow"),
                "labels": list(RECOMMENDATION_LABELS),
                "message": "senjuさんへ推薦 / 承認推奨",
                "recommendation_merit": merit,
                "recommendation_bucket": bucket,
                "target": "SENJU",
                "authority_effect": "none",
            })
        annotated.append(row)

    updated_intake = dict(intake_doc) if isinstance(intake_doc, Mapping) else {}
    updated_intake["cases"] = annotated
    updated_intake["recommendation_policy"] = {
        "producer": "NEGOTIATION_CASE_REVIEW_RECOMMENDATION",
        "target_rate": RECOMMENDATION_TARGET_RATE,
        "scarcity_gate": "stable_100_of_10000",
        "merit_threshold": RECOMMENDATION_MERIT_THRESHOLD,
        "labels": list(RECOMMENDATION_LABELS),
        "authority_effect": "none",
    }
    updated_intake["recommendation_count"] = len(recommendations)
    _write(state / "formal_approval_intake.json", updated_intake)

    recommendation_doc = {
        "schema": SCHEMA,
        "generated_at": current,
        "producer": "NEGOTIATION_CASE_REVIEW_RECOMMENDATION",
        "target_rate": RECOMMENDATION_TARGET_RATE,
        "eligible_count": eligible_count,
        "recommendation_count": len(recommendations),
        "labels": list(RECOMMENDATION_LABELS),
        "recommendations": recommendations,
        "authority_effect": "none",
        "formal_authority_granted": False,
        "rule": "rare recommendation is advisory only; formal approval remains independent",
    }
    _write(state / "negotiation_case_recommendations.json", recommendation_doc)
    return {
        "schema": SCHEMA,
        "eligible_count": eligible_count,
        "recommendation_count": len(recommendations),
        "target_rate": RECOMMENDATION_TARGET_RATE,
        "labels": list(RECOMMENDATION_LABELS),
        "authority_effect": "none",
        "formal_authority_granted": False,
    }
