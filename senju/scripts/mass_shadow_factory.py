#!/usr/bin/env python3
"""High-volume, closed-simulator experiment factory for Senju.

The previous selector evaluated roughly 35 preliminary shadow trials per selection
(7 candidates x 5 salts). This factory can raise that to 100x by running thousands
of cheap micro-trials inside one GitHub runner, then spending expensive evaluation
only on the best candidates, followed by unseen holdout verification.

Only bounded numeric simulator strategy parameters are explored. No target, network,
permission, credential, workflow, or executable attack surface is part of the search.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from senju.autopilot import run_candidate
from senju.memory import load_state
from scripts.shadow_league import summarize
from scripts.shadow_selector import BOUNDS, clamp_strategy, evaluate_strategy, robust_score

DEFAULT_POLICY = {
    "trial_multiplier": 100,
    "base_reference_trials": 35,
    "deep_candidate_count": 12,
    "holdout_trial_count": 12,
    "exploration_rate": 0.35,
    "max_runtime_seconds": 330,
    "history_window": 20,
}

TUNABLE = ("population", "generations", "matches", "mutation_rate", "red_budget", "blue_budget")


def _load_json(path: str | None, default: Any) -> Any:
    if not path:
        return default
    p = Path(path)
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return default


def _policy(config: dict[str, Any]) -> dict[str, Any]:
    raw = dict(DEFAULT_POLICY)
    raw.update((config or {}).get("policy") or {})
    return {
        "trial_multiplier": max(1, min(100, int(raw["trial_multiplier"]))),
        "base_reference_trials": max(1, int(raw["base_reference_trials"])),
        "deep_candidate_count": max(3, min(50, int(raw["deep_candidate_count"]))),
        "holdout_trial_count": max(3, min(100, int(raw["holdout_trial_count"]))),
        "exploration_rate": max(0.05, min(0.80, float(raw["exploration_rate"]))),
        "max_runtime_seconds": max(60, min(600, int(raw["max_runtime_seconds"]))),
        "history_window": max(3, min(100, int(raw["history_window"]))),
    }


def _history_center(proposed: dict[str, Any], history: list[dict[str, Any]]) -> tuple[dict[str, Any], int]:
    usable: list[tuple[float, dict[str, Any]]] = []
    for row in history:
        s = row.get("selected_strategy")
        if not isinstance(s, dict):
            continue
        try:
            w = max(0.01, float(row.get("score_improvement") or 0.0) + 0.01)
            usable.append((w, clamp_strategy(s)))
        except Exception:
            continue
    if not usable:
        return clamp_strategy(proposed), 0

    center = dict(clamp_strategy(proposed))
    for key in TUNABLE:
        weighted = sum(w * float(s[key]) for w, s in usable)
        total = sum(w for w, _ in usable)
        learned = weighted / total
        current = float(center[key])
        blended = 0.75 * current + 0.25 * learned
        center[key] = blended
    center["seed"] = int(proposed["seed"])
    return clamp_strategy(center), len(usable)


def _sample(center: dict[str, Any], rng: random.Random, exploration: float) -> dict[str, Any]:
    out = dict(center)
    # Relative perturbations are intentionally bounded. Wider exploration is earned
    # only when the experiment policy detects stagnation.
    for key in ("population", "generations", "matches"):
        factor = math.exp(rng.gauss(0.0, 0.30 * exploration))
        out[key] = float(center[key]) * factor
    out["mutation_rate"] = float(center["mutation_rate"]) + rng.gauss(0.0, 0.12 * exploration)
    for key in ("red_budget", "blue_budget"):
        out[key] = float(center[key]) + rng.gauss(0.0, 5.0 * exploration)
    out["seed"] = int(center["seed"])
    return clamp_strategy(out)


def _unique_candidates(center: dict[str, Any], count: int, exploration: float) -> list[dict[str, Any]]:
    rng = random.Random(int(center["seed"]) ^ 0x5EED100)
    candidates = [clamp_strategy(center)]
    seen = {json.dumps(candidates[0], sort_keys=True, separators=(",", ":"))}
    attempts = 0
    while len(candidates) < count and attempts < count * 50:
        attempts += 1
        s = _sample(center, rng, exploration)
        key = json.dumps(s, sort_keys=True, separators=(",", ":"))
        if key in seen:
            continue
        seen.add(key)
        candidates.append(s)
    return candidates


def _micro_probe(strategy: dict[str, Any]) -> dict[str, Any]:
    probe = clamp_strategy(strategy)
    # Evaluation-only settings may be smaller than the promotable strategy bounds.
    # This is what makes thousands of real simulator trials affordable in one run.
    probe["population"] = min(int(probe["population"]), 24)
    probe["generations"] = min(int(probe["generations"]), 2)
    probe["matches"] = min(int(probe["matches"]), 48)
    return probe


def _micro_eval(strategy: dict[str, Any], state: dict[str, Any], salts: Iterable[int]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    probe = _micro_probe(strategy)
    rows: list[dict[str, Any]] = []
    for salt in salts:
        _, ev = run_candidate(probe, state, salt=int(salt))
        row = asdict(ev)
        row["seed_offset"] = int(salt)
        rows.append(row)
    report = summarize(rows)
    report.update({"strategy": clamp_strategy(strategy), "probe_strategy": probe})
    report["robust_score"] = robust_score(report)
    return report, rows


def _parameter_effects(reports: list[dict[str, Any]]) -> dict[str, Any]:
    if len(reports) < 5:
        return {}
    scores = [float(r.get("robust_score") or 0.0) for r in reports]
    mean_y = statistics.fmean(scores)
    effects: dict[str, Any] = {}
    for key in TUNABLE:
        xs = [float(r["strategy"][key]) for r in reports]
        mean_x = statistics.fmean(xs)
        var_x = sum((x - mean_x) ** 2 for x in xs)
        var_y = sum((y - mean_y) ** 2 for y in scores)
        corr = 0.0
        if var_x > 0 and var_y > 0:
            corr = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, scores)) / math.sqrt(var_x * var_y)
        q = max(1, len(reports) // 4)
        ranked = sorted(reports, key=lambda r: float(r.get("robust_score") or 0.0), reverse=True)
        top_mean = statistics.fmean(float(r["strategy"][key]) for r in ranked[:q])
        bottom_mean = statistics.fmean(float(r["strategy"][key]) for r in ranked[-q:])
        effects[key] = {
            "correlation_with_robust_score": round(corr, 5),
            "top_quartile_mean": round(top_mean, 5),
            "bottom_quartile_mean": round(bottom_mean, 5),
            "direction": "higher" if top_mean > bottom_mean else "lower" if top_mean < bottom_mean else "flat",
        }
    return effects


def _candidate_row(report: dict[str, Any], phase: str, rank: int) -> dict[str, Any]:
    return {
        "phase": phase,
        "candidate_rank": rank,
        "candidate_index": report.get("candidate_index"),
        "robust_score": report.get("robust_score"),
        "worst_score": report.get("worst_score"),
        "mean_score": report.get("mean_score"),
        "score_stdev": report.get("score_stdev"),
        "worst_balance": report.get("worst_balance"),
        "worst_learning_signal": report.get("worst_learning_signal"),
        "safe": report.get("safe"),
        "stable": report.get("stable"),
        "strategy": report.get("strategy") or {},
        "evidence": {"runs": report.get("runs"), "reason": report.get("reason")},
    }


def run_factory(state_path: str, strategy_path: str, out_dir: str, selected_path: str, config_path: str | None = None) -> dict[str, Any]:
    started = time.monotonic()
    state = load_state(state_path)
    proposed = clamp_strategy(json.loads(Path(strategy_path).read_text(encoding="utf-8")))
    config = _load_json(config_path, {})
    policy = _policy(config)
    history = list((config or {}).get("history") or [])[-policy["history_window"]:]
    center, history_runs_used = _history_center(proposed, history)

    reference = policy["base_reference_trials"]
    target_micro_trials = reference * policy["trial_multiplier"]
    micro_salts_per_candidate = 5
    target_candidates = max(20, math.ceil(target_micro_trials / micro_salts_per_candidate))
    candidates = _unique_candidates(center, target_candidates, policy["exploration_rate"])

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    trial_file = out / "trials.jsonl"
    micro_reports: list[dict[str, Any]] = []
    raw_rows = 0
    deadline = started + policy["max_runtime_seconds"] * 0.72

    with trial_file.open("w", encoding="utf-8") as fh:
        for idx, strategy in enumerate(candidates):
            if idx > 20 and time.monotonic() >= deadline:
                break
            salts = [110003 + idx * 1009 + j * 7919 for j in range(micro_salts_per_candidate)]
            report, rows = _micro_eval(strategy, state, salts)
            report["candidate_index"] = idx
            micro_reports.append(report)
            for row in rows:
                fh.write(json.dumps({"phase":"MICRO","candidate_index":idx,"strategy":strategy,"evaluation":row}, ensure_ascii=False) + "\n")
                raw_rows += 1

    micro_reports.sort(key=lambda r: (bool(r.get("safe")), float(r.get("robust_score") or -1e9)), reverse=True)
    deep_count = min(policy["deep_candidate_count"], len(micro_reports))
    # Always include the current proposed strategy in deep evaluation as baseline.
    deep_strategies: list[dict[str, Any]] = [proposed]
    seen = {json.dumps(proposed, sort_keys=True)}
    for r in micro_reports:
        key = json.dumps(r["strategy"], sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        deep_strategies.append(r["strategy"])
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
    Path(selected_path).write_text(json.dumps(selected_strategy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    micro_trials = raw_rows
    deep_trials = len(deep_reports) * len(deep_salts)
    holdout_trials = len(holdout_salts) * 2
    raw_trial_count = micro_trials + deep_trials + holdout_trials
    realized_multiplier = raw_trial_count / reference
    effects = _parameter_effects(micro_reports)

    ranked_micro = sorted(micro_reports, key=lambda r: float(r.get("robust_score") or -1e9), reverse=True)
    db_candidates = [_candidate_row(r, "MICRO", i+1) for i, r in enumerate(ranked_micro[:80])]
    ranked_deep = sorted(deep_reports, key=lambda r: float(r.get("robust_score") or -1e9), reverse=True)
    db_candidates += [_candidate_row(r, "DEEP", i+1) for i, r in enumerate(ranked_deep[:20])]

    report = {
        "schema": "senju-mass-shadow-factory/v1",
        "selected": accepted,
        "safe": bool(winner_holdout.get("safe") and baseline_holdout.get("safe")),
        "reason": "100x shadow winner beat baseline and passed unseen holdout" if accepted else "baseline retained after mass shadow evidence",
        "trial_multiplier_target": policy["trial_multiplier"],
        "base_reference_trials": reference,
        "raw_trial_count": raw_trial_count,
        "realized_multiplier": round(realized_multiplier, 3),
        "micro_trial_count": micro_trials,
        "deep_trial_count": deep_trials,
        "holdout_trial_count": holdout_trials,
        "candidate_count": len(micro_reports),
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
        "guardrail": "closed simulator only; numeric strategy search; no scope/network/permission/secret mutation",
    }
    (out / "selection.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Senju 100x Mass Shadow Factory",
        "",
        f"- selected new strategy: **{accepted}**",
        f"- raw simulator trials: **{raw_trial_count}**",
        f"- realized multiplier vs 35-trial baseline: **{realized_multiplier:.1f}x**",
        f"- micro candidates: {len(micro_reports)} / micro trials: {micro_trials}",
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
        lines.append(f"- {key}: corr={effect['correlation_with_robust_score']} / direction={effect['direction']}")
    lines += ["", "> Full micro-trial evidence is retained in trials.jsonl; only bounded numeric simulator state can be promoted.", ""]
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
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
