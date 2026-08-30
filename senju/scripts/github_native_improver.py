#!/usr/bin/env python3
"""GitHub-native bounded improvement planner for Senju.

This engine is deliberately evidence-driven and provider-independent. It reads the
previous isolated tournament/evaluator results, selects the strongest already-measured
safe candidate, clamps every change to a small allowlisted strategy surface, and emits
a promotion bundle for another bounded verification run.

Targets, network scope, workflows, permissions, executable code and ScopeGuard are
outside the autonomous surface.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ALLOWED = {
    "population": (40, 240),
    "generations": (6, 40),
    "matches": (100, 1200),
    "mutation_rate": (0.05, 0.35),
    "red_budget": (6, 24),
    "blue_budget": (6, 24),
    "seed": (1, 2_147_483_647),
}
MAX_RELATIVE_STEP = {
    "population": 0.25,
    "generations": 0.25,
    "matches": 0.30,
    "mutation_rate": 0.35,
    "red_budget": 0.25,
    "blue_budget": 0.25,
    "seed": 1.0,
}


def load_json(path: str | Path, default: Any = None) -> Any:
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def bounded_strategy(base: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    if set(proposed) - set(ALLOWED):
        raise ValueError(f"forbidden strategy keys: {sorted(set(proposed) - set(ALLOWED))}")
    out = dict(base)
    for key, value in proposed.items():
        lo, hi = ALLOWED[key]
        value = float(value) if key == "mutation_rate" else int(value)
        value = min(hi, max(lo, value))
        old = float(base[key])
        if key != "seed" and old:
            max_step = abs(old) * MAX_RELATIVE_STEP[key]
            value = min(old + max_step, max(old - max_step, float(value)))
            value = round(value, 4) if key == "mutation_rate" else int(round(value))
        out[key] = value
    return out


def evaluator_proposal(base: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    """Select the strongest safe strategy already measured by Senju's evaluator."""
    candidates = summary.get("candidate_scores") or []
    ranked: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        candidate = item.get("strategy")
        evaluation = item.get("evaluation")
        if not isinstance(candidate, dict) or not isinstance(evaluation, dict):
            continue
        if evaluation.get("safe") is not True:
            continue
        try:
            score = float(evaluation.get("score", float("-inf")))
        except (TypeError, ValueError):
            continue
        ranked.append((score, candidate, evaluation))

    if ranked:
        ranked.sort(key=lambda x: x[0], reverse=True)
        score, candidate, evaluation = ranked[0]
        proposed = {
            k: candidate[k]
            for k in ALLOWED
            if k in candidate and candidate[k] != base.get(k)
        }
        return {
            "strategy": proposed,
            "reason": (
                f"Evaluator selected the best already-measured safe candidate "
                f"with score={score:.3f}, rating_gain={evaluation.get('rating_gain')}, "
                f"balance={evaluation.get('balance')}, learning_signal={evaluation.get('learning_signal')}."
            ),
            "hypothesis": "Carry forward the strongest safe measured strategy and verify it again in the bounded smoke tournament.",
            "confidence": 0.90,
        }

    selected_strategy = summary.get("selected_strategy")
    selected = summary.get("selected") or {}
    if isinstance(selected_strategy, dict) and isinstance(selected, dict) and selected.get("safe") is True:
        proposed = {
            k: selected_strategy[k]
            for k in ALLOWED
            if k in selected_strategy and selected_strategy[k] != base.get(k)
        }
        return {
            "strategy": proposed,
            "reason": "Reused the latest safe selected strategy from the durable Senju evolution summary.",
            "hypothesis": "Revalidate the latest safe selected strategy before promotion.",
            "confidence": 0.80,
        }

    return {
        "strategy": {},
        "reason": "No trustworthy safe comparative evidence was available; retaining the current strategy.",
        "hypothesis": "Collect another isolated tournament before changing strategy.",
        "confidence": 0.50,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--evolution-summary", required=False)
    ap.add_argument("--output-dir", required=True)
    args = ap.parse_args()

    strategy = load_json(args.strategy, {})
    if set(strategy) != set(ALLOWED):
        raise SystemExit(f"bootstrap strategy keys must exactly match allowlist: {sorted(ALLOWED)}")
    summary = load_json(args.evolution_summary, {}) if args.evolution_summary else {}

    raw = evaluator_proposal(strategy, summary)
    proposed = raw.get("strategy", {})
    if not isinstance(proposed, dict):
        raise SystemExit("strategy proposal must be an object")
    next_strategy = bounded_strategy(strategy, proposed)

    confidence = max(0.0, min(1.0, float(raw.get("confidence", 0.0))))
    changes = [
        f"{k}: {strategy[k]} -> {next_strategy[k]}"
        for k in strategy
        if strategy[k] != next_strategy[k]
    ]

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "strategy.json").write_text(
        json.dumps(next_strategy, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    result = {
        "engine": "local-evaluator",
        "safe": True,
        "confidence": confidence,
        "changes": changes,
        "reason": str(raw.get("reason", ""))[:1200],
        "hypothesis": str(raw.get("hypothesis", ""))[:1200],
        "previous_strategy": strategy,
        "next_strategy": next_strategy,
        "source_evidence_present": bool(summary),
    }
    (out / "last-evolution-summary.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    plan = [
        "# Senju GitHub-native improvement plan",
        "",
        "- engine: `local-evaluator`",
        f"- safe: `{result['safe']}`",
        f"- confidence: `{confidence:.2f}`",
        f"- evidence present: `{bool(summary)}`",
        "",
        "## Accepted bounded changes",
    ]
    plan += [f"- {c}" for c in changes] or ["- No parameter change; retain current strategy."]
    plan += [
        "",
        "## Reason",
        result["reason"] or "No reason supplied.",
        "",
        "## Next-run hypothesis",
        result["hypothesis"] or "No hypothesis supplied.",
        "",
    ]
    (out / "last-evolution-plan.md").write_text("\n".join(plan), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
