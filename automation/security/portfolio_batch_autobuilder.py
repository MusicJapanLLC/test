#!/usr/bin/env python3
"""Batch portfolio Auto-Builder for Standment Security.

Keeps one deep primary research/Senju bet, while allowing up to three independent
portfolio artifacts to move forward in one R&D cycle. AI-security tracks receive an
explicit company-priority bias. The builder still cannot claim VERIFIED status.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from portfolio_autobuilder import evolve
from portfolio_rnd import inspect_track, load_json

JST = ZoneInfo("Asia/Tokyo")
AI_SECURITY_BIAS = {
    "SEC-PORT-009": 700,  # Agent Permission Boundary Lab
    "SEC-PORT-010": 680,  # LLM Security Evaluation Harness
    "SEC-PORT-005": 620,  # Autonomous-agent auditability
    "SEC-PORT-011": 560,  # Security Evidence Dashboard
    "SEC-PORT-008": 220,  # AI/SaaS architecture review
}

COUNTEREVIDENCE = [
    "What evidence would falsify the current hypothesis?",
    "Can an independent run reproduce the result?",
    "Is the artifact understandable without reading source code?",
    "What remains unverified or environment-dependent?",
    "Does the evidence demonstrate technical quality only, rather than market demand?",
]


def rank_batch(program: dict[str, Any], root: Path, portfolio: str, limit: int) -> list[dict[str, Any]]:
    rows = [
        inspect_track(root, portfolio, track)
        for track in (program.get("tracks") or [])
        if isinstance(track, dict)
    ]
    for row in rows:
        bias = AI_SECURITY_BIAS.get(str(row.get("id")), 0)
        row["ai_security_priority_bias"] = bias
        row["batch_research_score"] = int(row["research_score"]) + bias
    rows.sort(
        key=lambda row: (
            int(row["batch_research_score"]),
            int(row["priority"]),
            str(row["id"]),
        ),
        reverse=True,
    )
    return rows[: max(1, min(int(limit), 3))]


def run_batch(program: dict[str, Any], root: Path, portfolio: str, now: datetime, limit: int = 3) -> dict[str, Any]:
    selected = rank_batch(program, root, portfolio, limit)
    results: list[dict[str, Any]] = []
    created: list[str] = []
    for row in selected:
        synthetic_report = {
            "selected": row,
            "counterevidence_questions": COUNTEREVIDENCE,
        }
        result = evolve(synthetic_report, program, root, now)
        results.append(result)
        for path in result.get("created_or_updated") or []:
            if path not in created:
                created.append(path)

    return {
        "schema": "standment-security-portfolio-batch-autobuilder/v1",
        "track": selected[0]["id"] if selected else None,
        "tracks": [row["id"] for row in selected],
        "ranked": [
            {
                "id": row["id"],
                "portfolio_status": row["portfolio_status"],
                "evidence_ratio": row["evidence_ratio"],
                "research_score": row["research_score"],
                "ai_security_priority_bias": row["ai_security_priority_bias"],
                "batch_research_score": row["batch_research_score"],
            }
            for row in selected
        ],
        "created_or_updated": created,
        "results": results,
        "verification_claimed": False,
        "rule": "one deep Senju bet + up to three independent portfolio advances; AI-security is P0-biased",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--program", default="standment-security/security_portfolio_program.json")
    ap.add_argument("--portfolio", default="PORTFOLIO.md")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--max-tracks", type=int, default=3)
    ap.add_argument("--out", default="reports/standment-security-rnd/evolution.json")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    program = load_json(root / args.program)
    portfolio = (root / args.portfolio).read_text(encoding="utf-8")
    result = run_batch(program, root, portfolio, datetime.now(JST), args.max_tracks)
    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
