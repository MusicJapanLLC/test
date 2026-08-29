#!/usr/bin/env python3
"""Senju shadow league.

Runs the currently selected abstract simulator strategy across several deterministic
seed offsets and reports worst-case/variance signals. This is a defensive research
quality gate only: it never changes targets, network access, permissions, secrets, or
executable attack behavior.
"""
from __future__ import annotations

import argparse
import json
import statistics
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from senju.autopilot import run_candidate
from senju.improvement import normalize
from senju.memory import load_state


def summarize(evaluations: Iterable[dict[str, Any]]) -> dict[str, Any]:
    rows = list(evaluations)
    if not rows:
        return {
            "stable": False,
            "safe": False,
            "reason": "no shadow evaluations",
            "runs": 0,
            "mean_score": 0.0,
            "worst_score": 0.0,
            "score_stdev": 0.0,
            "worst_balance": 0.0,
            "worst_learning_signal": 0.0,
        }

    scores = [float(r["score"]) for r in rows]
    balances = [float(r["balance"]) for r in rows]
    learning = [float(r["learning_signal"]) for r in rows]
    all_safe = all(bool(r["safe"]) for r in rows)
    stdev = statistics.pstdev(scores) if len(scores) > 1 else 0.0
    worst_score = min(scores)
    worst_balance = min(balances)
    worst_learning = min(learning)

    stable = bool(
        all_safe
        and worst_balance >= 0.35
        and worst_learning >= 0.05
        and stdev <= 35.0
        and worst_score > 0.0
    )
    reasons: list[str] = []
    if not all_safe:
        reasons.append("unsafe shadow run")
    if worst_balance < 0.35:
        reasons.append("seed-sensitive competitive imbalance")
    if worst_learning < 0.05:
        reasons.append("weak learning signal in worst seed")
    if stdev > 35.0:
        reasons.append("score variance too high")
    if worst_score <= 0.0:
        reasons.append("non-positive worst-case score")
    if not reasons:
        reasons.append("multi-seed stability gate passed")

    return {
        "stable": stable,
        "safe": all_safe,
        "reason": "; ".join(reasons),
        "runs": len(rows),
        "mean_score": round(statistics.fmean(scores), 4),
        "worst_score": round(worst_score, 4),
        "score_stdev": round(stdev, 4),
        "worst_balance": round(worst_balance, 4),
        "worst_learning_signal": round(worst_learning, 4),
    }


def run_shadow(state_path: str, seeds: int = 5) -> dict[str, Any]:
    state = load_state(state_path)
    strategy = normalize(state.get("strategy") or {})

    # Keep the shadow league bounded so it can run every day without exploding CI
    # cost while still varying seeds and evaluating robustness.
    probe = dict(strategy)
    probe["population"] = min(int(probe["population"]), 80)
    probe["generations"] = min(int(probe["generations"]), 8)
    probe["matches"] = min(int(probe["matches"]), 240)

    rows: list[dict[str, Any]] = []
    for i in range(max(3, min(int(seeds), 7))):
        _, ev = run_candidate(probe, state, salt=(i + 1) * 1009)
        row = asdict(ev)
        row["seed_offset"] = (i + 1) * 1009
        rows.append(row)

    summary = summarize(rows)
    summary.update({
        "schema": "senju-shadow-stability/v1",
        "probe_strategy": probe,
        "evaluations": rows,
        "guardrail": "simulator-only; no target/network/permission/secret mutation",
    })
    return summary


def render(report: dict[str, Any]) -> str:
    lines = [
        "# Senju Shadow Stability League",
        "",
        f"- stable: **{report['stable']}**",
        f"- safe: **{report['safe']}**",
        f"- runs: {report['runs']}",
        f"- mean score: {report['mean_score']}",
        f"- worst score: {report['worst_score']}",
        f"- score stdev: {report['score_stdev']}",
        f"- worst balance: {report['worst_balance']}",
        f"- worst learning signal: {report['worst_learning_signal']}",
        f"- reason: {report['reason']}",
        "",
        "> This is a closed simulator robustness test. It does not expand scope or touch public targets.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state", default="state/champion.json")
    p.add_argument("--out", default="reports/shadow")
    p.add_argument("--seeds", type=int, default=5)
    p.add_argument("--require-stable", action="store_true")
    args = p.parse_args()

    report = run_shadow(args.state, args.seeds)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "stability.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "stability.md").write_text(render(report), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("stable", "safe", "mean_score", "worst_score", "score_stdev")}, ensure_ascii=False))
    if args.require_stable and not report["stable"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
