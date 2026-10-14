#!/usr/bin/env python3
"""Select a robust Senju promotion candidate inside the closed simulator.

The selector turns Shadow from a yes/no gate into a bounded selection factory:
1. build a small allowlisted neighborhood around the proposed strategy;
2. evaluate every candidate on the same five selection salts;
3. rank only stable candidates with a worst-case-heavy objective;
4. re-test the winner on three unseen holdout salts;
5. write the selected strategy only if the holdout is also stable.

No target, network, permission, secret, workflow, or executable attack surface is
changed here. The selector only changes numeric simulator strategy parameters.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from senju.autopilot import run_candidate
from senju.improvement import normalize
from senju.memory import load_state
from scripts.shadow_league import summarize

SELECTION_SALTS = (1009, 2018, 3027, 4036, 5045)
HOLDOUT_SALTS = (7919, 9011, 10037)

BOUNDS: dict[str, tuple[float, float]] = {
    "population": (40, 240),
    "generations": (6, 40),
    "matches": (100, 1200),
    "mutation_rate": (0.05, 0.35),
    "red_budget": (6, 24),
    "blue_budget": (6, 24),
    "seed": (1, 2_147_483_647),
}


def clamp_strategy(raw: dict[str, Any]) -> dict[str, Any]:
    strategy = normalize(raw)
    if set(strategy) != set(BOUNDS):
        raise ValueError(f"strategy surface mismatch: {sorted(strategy)}")
    out: dict[str, Any] = {}
    for key, value in strategy.items():
        lo, hi = BOUNDS[key]
        bounded = min(hi, max(lo, float(value)))
        out[key] = round(bounded, 4) if key == "mutation_rate" else int(round(bounded))
    return out


def _variant(base: dict[str, Any], **updates: Any) -> dict[str, Any]:
    candidate = dict(base)
    candidate.update(updates)
    return clamp_strategy(candidate)


def neighborhood(proposed: dict[str, Any], limit: int = 7) -> list[dict[str, Any]]:
    """Build deterministic, bounded, unique nearby strategies.

    The proposed strategy is always first. Variants change one narrow simulator
    parameter at a time so a robust winner remains attributable and reviewable.
    """
    base = clamp_strategy(proposed)
    mutation = float(base["mutation_rate"])
    population = int(base["population"])
    generations = int(base["generations"])
    matches = int(base["matches"])

    variants = [
        base,
        _variant(base, mutation_rate=mutation * 0.75),
        _variant(base, mutation_rate=mutation * 1.25),
        _variant(base, mutation_rate=mutation - 0.03),
        _variant(base, mutation_rate=mutation + 0.03),
        _variant(base, population=round(population * 0.90), matches=round(matches * 0.92)),
        _variant(base, population=round(population * 1.10), generations=round(generations * 1.08)),
        _variant(base, matches=round(matches * 0.85)),
        _variant(base, matches=round(matches * 1.15)),
    ]
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in variants:
        key = json.dumps(candidate, sort_keys=True, separators=(",", ":"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
        if len(unique) >= max(3, min(int(limit), 9)):
            break
    return unique


def evaluate_strategy(strategy: dict[str, Any], state: dict[str, Any], salts: Iterable[int]) -> dict[str, Any]:
    probe = clamp_strategy(strategy)
    probe["population"] = min(int(probe["population"]), 80)
    probe["generations"] = min(int(probe["generations"]), 8)
    probe["matches"] = min(int(probe["matches"]), 240)

    evaluations: list[dict[str, Any]] = []
    for salt in salts:
        _, ev = run_candidate(probe, state, salt=int(salt))
        row = asdict(ev)
        row["seed_offset"] = int(salt)
        evaluations.append(row)
    report = summarize(evaluations)
    report.update({
        "strategy": clamp_strategy(strategy),
        "probe_strategy": probe,
        "evaluations": evaluations,
    })
    return report


def robust_score(report: dict[str, Any]) -> float:
    """Rank stable candidates with emphasis on worst-case behavior."""
    return round(
        0.55 * float(report.get("worst_score", 0.0))
        + 0.35 * float(report.get("mean_score", 0.0))
        + 20.0 * float(report.get("worst_balance", 0.0))
        + 10.0 * float(report.get("worst_learning_signal", 0.0))
        - 0.25 * float(report.get("score_stdev", 0.0)),
        4,
    )


def choose_stable(reports: Iterable[dict[str, Any]]) -> dict[str, Any] | None:
    stable = [dict(r) for r in reports if r.get("stable") is True and r.get("safe") is True]
    if not stable:
        return None
    for report in stable:
        report["robust_score"] = robust_score(report)
    stable.sort(
        key=lambda r: (
            float(r["robust_score"]),
            float(r.get("worst_score", 0)),
            float(r.get("worst_balance", 0)),
            float(r.get("mean_score", 0)),
        ),
        reverse=True,
    )
    return stable[0]


def select(state_path: str, strategy_path: str, candidates: int = 7) -> dict[str, Any]:
    state = load_state(state_path)
    proposed = clamp_strategy(json.loads(Path(strategy_path).read_text(encoding="utf-8")))
    candidate_strategies = neighborhood(proposed, candidates)

    preliminary: list[dict[str, Any]] = []
    for index, strategy in enumerate(candidate_strategies):
        report = evaluate_strategy(strategy, state, SELECTION_SALTS)
        report["candidate_index"] = index
        report["robust_score"] = robust_score(report)
        preliminary.append(report)

    winner = choose_stable(preliminary)
    if winner is None:
        return {
            "schema": "senju-shadow-selector/v1",
            "selected": False,
            "reason": "no stable preliminary candidate",
            "proposed_strategy": proposed,
            "candidate_count": len(preliminary),
            "preliminary": preliminary,
            "holdout": None,
            "guardrail": "simulator-only numeric strategy selection",
        }

    holdout = evaluate_strategy(winner["strategy"], state, HOLDOUT_SALTS)
    holdout["robust_score"] = robust_score(holdout)
    selected = bool(holdout.get("stable") and holdout.get("safe"))
    return {
        "schema": "senju-shadow-selector/v1",
        "selected": selected,
        "reason": "stable preliminary winner passed unseen holdout" if selected else "preliminary winner failed unseen holdout",
        "proposed_strategy": proposed,
        "candidate_count": len(preliminary),
        "winning_preliminary": winner,
        "preliminary": preliminary,
        "holdout": holdout,
        "selected_strategy": winner["strategy"] if selected else None,
        "guardrail": "simulator-only numeric strategy selection; no scope/network/permission/secret mutation",
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# Senju Shadow Champion Selector",
        "",
        f"- selected: **{report.get('selected', False)}**",
        f"- reason: {report.get('reason', '')}",
        f"- candidates: {report.get('candidate_count', 0)}",
        "",
        "## Preliminary league",
    ]
    for row in report.get("preliminary", []):
        lines.append(
            f"- #{row.get('candidate_index')} stable={row.get('stable')} robust={row.get('robust_score')} "
            f"worst={row.get('worst_score')} mean={row.get('mean_score')} stdev={row.get('score_stdev')} "
            f"balance={row.get('worst_balance')} learning={row.get('worst_learning_signal')}"
        )
    holdout = report.get("holdout")
    if isinstance(holdout, dict):
        lines += [
            "",
            "## Holdout",
            f"- stable: **{holdout.get('stable')}**",
            f"- safe: **{holdout.get('safe')}**",
            f"- robust score: {holdout.get('robust_score')}",
            f"- worst score: {holdout.get('worst_score')}",
            f"- mean score: {holdout.get('mean_score')}",
            f"- score stdev: {holdout.get('score_stdev')}",
            f"- worst balance: {holdout.get('worst_balance')}",
            f"- worst learning signal: {holdout.get('worst_learning_signal')}",
        ]
    lines += [
        "",
        "> Promotion is allowed only after preliminary stability and an unseen holdout both pass.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--selected", required=True)
    ap.add_argument("--candidates", type=int, default=7)
    args = ap.parse_args()

    report = select(args.state, args.strategy, args.candidates)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "selection.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "selection.md").write_text(render(report), encoding="utf-8")

    if report.get("selected"):
        selected = Path(args.selected)
        selected.parent.mkdir(parents=True, exist_ok=True)
        selected.write_text(json.dumps(report["selected_strategy"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "selected": True,
            "candidate_count": report["candidate_count"],
            "robust_score": report["holdout"]["robust_score"],
        }, ensure_ascii=False))
        return 0

    print(json.dumps({
        "selected": False,
        "candidate_count": report.get("candidate_count", 0),
        "reason": report.get("reason"),
    }, ensure_ascii=False))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
