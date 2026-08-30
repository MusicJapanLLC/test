#!/usr/bin/env python3
"""Measured 100x mass-shadow factory with a genuinely lightweight micro stage.

Micro trials use a dedicated evaluation-only SenjuConfig and DO NOT pass through
strategy normalize(), so they stay small. Promotable strategies themselves remain
within the normal bounded strategy allowlist and only top candidates receive full
shadow + unseen holdout evaluation.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from senju.config import SenjuConfig
from senju.evaluator import evaluate
from senju.memory import load_state, seeded_population
from senju.tournament import Tournament
from scripts.mass_shadow_factory import (
    _candidate_row,
    _history_center,
    _load_json,
    _parameter_effects,
    _policy,
    _unique_candidates,
)
from scripts.shadow_league import summarize
from scripts.shadow_selector import clamp_strategy, evaluate_strategy, robust_score

MICRO_POPULATION = 12
MICRO_GENERATIONS = 1
MICRO_MATCHES = 20
MICRO_SALTS_PER_CANDIDATE = 5


def _micro_config(strategy: dict[str, Any], salt: int) -> SenjuConfig:
    s = clamp_strategy(strategy)
    cfg = SenjuConfig()
    cfg.evolution.population_size = MICRO_POPULATION
    cfg.evolution.generations = MICRO_GENERATIONS
    cfg.evolution.matches_per_generation = MICRO_MATCHES
    cfg.evolution.mutation_rate = float(s["mutation_rate"])
    cfg.evolution.seed = int(s["seed"]) + int(salt)
    cfg.evolution.elite_count = min(2, MICRO_POPULATION - 1)
    cfg.arena.red_action_budget = int(s["red_budget"])
    cfg.arena.blue_action_budget = int(s["blue_budget"])
    cfg.arena.seed = int(s["seed"]) + int(salt)
    return cfg


def _run_micro_candidate(strategy: dict[str, Any], state: dict[str, Any], salt: int):
    cfg = _micro_config(strategy, salt)
    tournament = Tournament(cfg)
    seed_rng = random.Random(cfg.evolution.seed + 7919)
    red = seeded_population(
        state.get("red_champion"), "red", cfg.evolution.population_size,
        cfg.evolution.mutation_rate, seed_rng,
    )
    blue = seeded_population(
        state.get("blue_champion"), "blue", cfg.evolution.population_size,
        cfg.evolution.mutation_rate, seed_rng,
    )
    if red is not None:
        tournament.red_pop = red
    if blue is not None:
        tournament.blue_pop = blue
    report = tournament.run()
    return report, evaluate(report)


def _micro_eval(strategy: dict[str, Any], state: dict[str, Any], salts: Iterable[int]):
    rows: list[dict[str, Any]] = []
    for salt in salts:
        _, ev = _run_micro_candidate(strategy, state, int(salt))
        row = asdict(ev)
        row["seed_offset"] = int(salt)
        rows.append(row)
    report = summarize(rows)
    report.update({
        "strategy": clamp_strategy(strategy),
        "micro_config": {
            "population": MICRO_POPULATION,
            "generations": MICRO_GENERATIONS,
            "matches": MICRO_MATCHES,
        },
    })
    report["robust_score"] = robust_score(report)
    return report, rows


def run_factory(
    state_path: str,
    strategy_path: str,
    out_dir: str,
    selected_path: str,
    config_path: str | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    state = load_state(state_path)
    proposed = clamp_strategy(json.loads(Path(strategy_path).read_text(encoding="utf-8")))
    config = _load_json(config_path, {})
    policy = _policy(config)
    history = list((config or {}).get("history") or [])[-policy["history_window"]:]
    center, history_runs_used = _history_center(proposed, history)

    reference = policy["base_reference_trials"]
    target_micro_trials = reference * policy["trial_multiplier"]
    target_candidates = math.ceil(target_micro_trials / MICRO_SALTS_PER_CANDIDATE)
    candidates = _unique_candidates(center, target_candidates, policy["exploration_rate"])
    if len(candidates) < target_candidates:
        raise RuntimeError(f"candidate_space_exhausted:{len(candidates)}<{target_candidates}")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    trial_file = out / "trials.jsonl"
    micro_reports: list[dict[str, Any]] = []
    raw_rows = 0

    with trial_file.open("w", encoding="utf-8") as fh:
        for idx, strategy in enumerate(candidates[:target_candidates]):
            salts = [110003 + idx * 1009 + j * 7919 for j in range(MICRO_SALTS_PER_CANDIDATE)]
            report, rows = _micro_eval(strategy, state, salts)
            report["candidate_index"] = idx
            micro_reports.append(report)
            for row in rows:
                fh.write(json.dumps({
                    "phase": "MICRO",
                    "candidate_index": idx,
                    "strategy": strategy,
                    "evaluation": row,
                }, ensure_ascii=False) + "\n")
                raw_rows += 1

    if raw_rows < target_micro_trials:
        raise RuntimeError(f"micro_trial_target_not_met:{raw_rows}<{target_micro_trials}")

    micro_reports.sort(
        key=lambda r: (bool(r.get("safe")), float(r.get("robust_score") or -1e9)),
        reverse=True,
    )
    deep_count = min(policy["deep_candidate_count"], len(micro_reports))
    deep_strategies: list[dict[str, Any]] = [proposed]
    seen = {json.dumps(proposed, sort_keys=True)}
    for row in micro_reports:
        key = json.dumps(row["strategy"], sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        deep_strategies.append(row["strategy"])
        if len(deep_strategies) >= deep_count:
            break

    deep_salts = (1009, 2018, 3027, 4036, 5045)
    deep_reports: list[dict[str, Any]] = []
    for idx, strategy in enumerate(deep_strategies):
        report = evaluate_strategy(strategy, state, deep_salts)
        report["candidate_index"] = idx
        report["robust_score"] = robust_score(report)
        deep_reports.append(report)

    baseline = deep_reports[0]
    stable_deep = [r for r in deep_reports if r.get("safe") is True and r.get("stable") is True]
    winner = max(stable_deep, key=lambda r: float(r.get("robust_score") or -1e9), default=baseline)

    holdout_n = policy["holdout_trial_count"]
    holdout_salts = tuple(700001 + i * 10037 for i in range(holdout_n))
    baseline_holdout = evaluate_strategy(proposed, state, holdout_salts)
    baseline_holdout["robust_score"] = robust_score(baseline_holdout)
    winner_holdout = evaluate_strategy(winner["strategy"], state, holdout_salts)
    winner_holdout["robust_score"] = robust_score(winner_holdout)

    improvement = float(winner_holdout["robust_score"]) - float(baseline_holdout["robust_score"])
    accepted = bool(
        winner["strategy"] != proposed
        and winner_holdout.get("safe") is True
        and winner_holdout.get("stable") is True
        and baseline_holdout.get("safe") is True
        and improvement > 0.0
    )
    selected_strategy = winner["strategy"] if accepted else proposed
    Path(selected_path).parent.mkdir(parents=True, exist_ok=True)
    Path(selected_path).write_text(
        json.dumps(selected_strategy, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    micro_trials = raw_rows
    deep_trials = len(deep_reports) * len(deep_salts)
    holdout_trials = len(holdout_salts) * 2
    raw_trial_count = micro_trials + deep_trials + holdout_trials
    realized_multiplier = raw_trial_count / reference
    effects = _parameter_effects(micro_reports)

    ranked_micro = sorted(micro_reports, key=lambda r: float(r.get("robust_score") or -1e9), reverse=True)
    db_candidates = [_candidate_row(r, "MICRO", i + 1) for i, r in enumerate(ranked_micro[:80])]
    ranked_deep = sorted(deep_reports, key=lambda r: float(r.get("robust_score") or -1e9), reverse=True)
    db_candidates += [_candidate_row(r, "DEEP", i + 1) for i, r in enumerate(ranked_deep[:20])]

    report = {
        "schema": "senju-mass-shadow-factory/v2",
        "selected": accepted,
        "safe": bool(winner_holdout.get("safe") and baseline_holdout.get("safe")),
        "reason": "100x shadow winner beat baseline and passed unseen holdout" if accepted else "baseline retained after measured 100x shadow evidence",
        "trial_multiplier_target": policy["trial_multiplier"],
        "base_reference_trials": reference,
        "raw_trial_count": raw_trial_count,
        "realized_multiplier": round(realized_multiplier, 3),
        "micro_trial_count": micro_trials,
        "deep_trial_count": deep_trials,
        "holdout_trial_count": holdout_trials,
        "candidate_count": len(micro_reports),
        "micro_runtime_config": {
            "population": MICRO_POPULATION,
            "generations": MICRO_GENERATIONS,
            "matches": MICRO_MATCHES,
            "salts_per_candidate": MICRO_SALTS_PER_CANDIDATE,
        },
        "history_runs_used": history_runs_used,
        "exploration_rate": policy["exploration_rate"],
        "baseline_score": baseline_holdout.get("robust_score"),
        "selected_score": winner_holdout.get("robust_score") if accepted else baseline_holdout.get("robust_score"),
        "score_improvement": round(improvement if accepted else 0.0, 4),
        "robust_score": winner_holdout.get("robust_score") if accepted else baseline_holdout.get("robust_score"),
        "proposed_strategy": proposed,
        "search_center": center,
        "selected_strategy": selected_strategy,
        "winning_preliminary": winner,
        "baseline_holdout": baseline_holdout,
        "holdout": winner_holdout,
        "parameter_effects": effects,
        "top_candidates": db_candidates,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "guardrail": "closed simulator only; micro evaluation is non-promotable; full holdout required before numeric strategy promotion",
    }
    (out / "selection.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    lines = [
        "# Senju Measured 100x Mass Shadow Factory v2",
        "",
        f"- selected new strategy: **{accepted}**",
        f"- raw simulator trials: **{raw_trial_count}**",
        f"- realized multiplier vs {reference}-trial baseline: **{realized_multiplier:.1f}x**",
        f"- micro candidates: {len(micro_reports)} / micro trials: {micro_trials}",
        f"- micro config: {MICRO_POPULATION} population / {MICRO_GENERATIONS} generation / {MICRO_MATCHES} matches",
        f"- deep trials: {deep_trials} / holdout trials: {holdout_trials}",
        f"- history runs used: {history_runs_used}",
        f"- baseline robust score: {baseline_holdout.get('robust_score')}",
        f"- selected robust score: {report['selected_score']}",
        f"- improvement: {report['score_improvement']}",
        f"- elapsed seconds: {report['elapsed_seconds']}",
        "",
        "## Learned parameter effects",
    ]
    for key, effect in effects.items():
        lines.append(
            f"- {key}: corr={effect['correlation_with_robust_score']} / direction={effect['direction']}"
        )
    lines += [
        "",
        "> Micro trials are search evidence only. Promotion still requires full deep evaluation and unseen holdout.",
        "",
    ]
    (out / "selection.md").write_text("\n".join(lines), encoding="utf-8")
    return report


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state", required=True)
    p.add_argument("--strategy", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--selected", required=True)
    p.add_argument("--config", default=None)
    args = p.parse_args()
    report = run_factory(args.state, args.strategy, args.out, args.selected, args.config)
    print(json.dumps({
        "selected": report["selected"],
        "raw_trial_count": report["raw_trial_count"],
        "realized_multiplier": report["realized_multiplier"],
        "candidate_count": report["candidate_count"],
        "score_improvement": report["score_improvement"],
        "elapsed_seconds": report["elapsed_seconds"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
