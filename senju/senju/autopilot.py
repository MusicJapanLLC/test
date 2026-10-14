"""Daily closed-loop self evolution for Senju's isolated simulator.

Pipeline:
  memory -> candidate strategies -> tournaments -> evaluator -> select winner
  -> persist champion + strategy -> emit improvement plan

The loop can evolve only abstract simulator genomes and bounded numerical settings.
Scope policy, target adapters, network access, and executable attack behavior are not
part of the mutation surface.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import random
from pathlib import Path
from typing import Any

from .config import SenjuConfig
from .evaluator import Evaluation, evaluate
from .improvement import DEFAULT_STRATEGY, describe_change, normalize, propose
from .memory import agent_to_dict, load_state, save_state, seeded_population
from .report import write_report
from .tournament import Tournament, TournamentReport


def _configure(strategy: dict[str, Any], salt: int = 0) -> SenjuConfig:
    s = normalize(strategy)
    cfg = SenjuConfig()
    cfg.evolution.population_size = int(s["population"])
    cfg.evolution.generations = int(s["generations"])
    cfg.evolution.matches_per_generation = int(s["matches"])
    cfg.evolution.mutation_rate = float(s["mutation_rate"])
    cfg.evolution.seed = int(s["seed"]) + salt
    cfg.arena.red_action_budget = int(s["red_budget"])
    cfg.arena.blue_action_budget = int(s["blue_budget"])
    cfg.arena.seed = int(s["seed"]) + salt
    return cfg


def run_candidate(
    strategy: dict[str, Any], state: dict[str, Any], salt: int
) -> tuple[TournamentReport, Evaluation]:
    cfg = _configure(strategy, salt)
    tournament = Tournament(cfg)

    # Carry yesterday's learned champion forward. The rest of the population is a
    # mutated neighborhood around that champion, so each daily run starts from the
    # previous day's knowledge rather than from zero.
    seed_rng = random.Random(cfg.evolution.seed + 7919)
    red = seeded_population(
        state.get("red_champion"),
        "red",
        cfg.evolution.population_size,
        cfg.evolution.mutation_rate,
        seed_rng,
    )
    blue = seeded_population(
        state.get("blue_champion"),
        "blue",
        cfg.evolution.population_size,
        cfg.evolution.mutation_rate,
        seed_rng,
    )
    if red is not None:
        tournament.red_pop = red
    if blue is not None:
        tournament.blue_pop = blue

    report = tournament.run()
    return report, evaluate(report)


def _evaluation_dict(ev: Evaluation) -> dict[str, Any]:
    return dataclasses.asdict(ev)


def _code_suggestions(ev: Evaluation) -> list[str]:
    suggestions: list[str] = []
    if ev.balance < 0.55:
        suggestions.append("Simulator: consider adaptive matchmaking to reduce one-sided generations.")
    if ev.learning_signal < 0.30:
        suggestions.append("Simulator: add more synthetic scenario archetypes or feedback instrumentation.")
    if ev.rating_gain < 0:
        suggestions.append("Evolution engine: review selection pressure and resource inheritance constants.")
    if not suggestions:
        suggestions.append("No executable code change recommended; keep collecting comparative evidence.")
    return suggestions


def run_autopilot(
    state_path: str,
    output_dir: str,
    candidates: int = 5,
    min_improvement: float = 0.5,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    previous_strategy = normalize(state.get("strategy") or DEFAULT_STRATEGY)
    if overrides:
        previous_strategy = normalize({**previous_strategy, **overrides})

    strategies = propose(previous_strategy, limit=max(1, candidates))
    results: list[tuple[dict[str, Any], TournamentReport, Evaluation]] = []
    # Same salt keeps candidate comparison reproducible and fair. Their own settings
    # are the experimental variable.
    for strategy in strategies:
        report, ev = run_candidate(strategy, state, salt=0)
        results.append((strategy, report, ev))

    baseline_strategy, baseline_report, baseline_ev = results[0]
    best_strategy, best_report, best_ev = max(results, key=lambda item: item[2].score)
    accepted = bool(
        best_ev.safe
        and best_ev.score >= baseline_ev.score + float(min_improvement)
        and best_strategy != baseline_strategy
    )
    selected_strategy = best_strategy if accepted else baseline_strategy
    selected_report = best_report if accepted else baseline_report
    selected_ev = best_ev if accepted else baseline_ev

    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    history = list(state.get("history") or [])[-29:]
    history.append(
        {
            "at": now,
            "baseline_score": baseline_ev.score,
            "best_score": best_ev.score,
            "selected_score": selected_ev.score,
            "accepted_strategy_change": accepted,
            "changes": describe_change(previous_strategy, selected_strategy),
        }
    )

    next_state = {
        "version": 1,
        "updated_at": now,
        "strategy": selected_strategy,
        "score": selected_ev.score,
        "evaluation": _evaluation_dict(selected_ev),
        "red_champion": agent_to_dict(selected_report.red_champion),
        "blue_champion": agent_to_dict(selected_report.blue_champion),
        "history": history,
    }

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    save_state(out / "state.next.json", next_state)
    (out / "strategy.next.json").write_text(
        json.dumps(selected_strategy, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_report(selected_report, str(out))

    summary = {
        "accepted_strategy_change": accepted,
        "previous_strategy": previous_strategy,
        "selected_strategy": selected_strategy,
        "baseline": _evaluation_dict(baseline_ev),
        "best": _evaluation_dict(best_ev),
        "selected": _evaluation_dict(selected_ev),
        "changes": describe_change(previous_strategy, selected_strategy),
        "code_suggestions": _code_suggestions(selected_ev),
        "candidate_scores": [
            {"strategy": s, "evaluation": _evaluation_dict(ev)} for s, _, ev in results
        ],
    }
    (out / "evolution-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    plan = [
        "# Senju Improvement Plan",
        "",
        f"- accepted strategy change: **{accepted}**",
        f"- baseline score: **{baseline_ev.score}**",
        f"- selected score: **{selected_ev.score}**",
        "",
        "## Strategy delta",
        *[f"- {x}" for x in summary["changes"]],
        "",
        "## Code-level recommendations (proposal only)",
        *[f"- {x}" for x in summary["code_suggestions"]],
        "",
        "> Executable code is never auto-mutated. Only bounded simulator state/strategy may be promoted automatically after tests and safety gates.",
        "",
    ]
    (out / "evolution-plan.md").write_text("\n".join(plan), encoding="utf-8")
    return summary


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--state", default="state/champion.json")
    p.add_argument("--out", default="reports/evolution")
    p.add_argument("--candidates", type=int, default=5)
    p.add_argument("--min-improvement", type=float, default=0.5)
    p.add_argument("--population", type=int)
    p.add_argument("--generations", type=int)
    p.add_argument("--matches", type=int)
    args = p.parse_args()
    overrides = {
        k: v
        for k, v in {
            "population": args.population,
            "generations": args.generations,
            "matches": args.matches,
        }.items()
        if v is not None
    }
    summary = run_autopilot(
        args.state,
        args.out,
        candidates=args.candidates,
        min_improvement=args.min_improvement,
        overrides=overrides,
    )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
