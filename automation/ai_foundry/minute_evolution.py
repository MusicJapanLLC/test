#!/usr/bin/env python3
"""Bounded minute-scale strategy evolution for THE WORLD AI development.

This evolves engineering strategy, not model weights. Security / AI-Security Eval
may provide a priority-only focus hint. Exactly one out of every three rounds may
follow that hint; all correctness, reliability, security, behavioral-fixture and
promotion gates remain authoritative.

The behavioral harness below is deliberately modest: it evaluates the engineering
strategy state against deterministic visible and holdout fixtures. It is stronger
than a self-scored proxy-only promotion, but it is NOT evidence of model-weight
training, general AI capability, customer validation, or production performance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FOCUS_ORDER = (
    "correctness",
    "architecture",
    "reliability",
    "security",
    "observability",
    "efficiency",
    "productization",
)

PARAM_BOUNDS = {
    "verification_depth": (1, 5),
    "test_budget": (1, 5),
    "adversarial_review": (0, 4),
    "observability_depth": (1, 5),
    "memory_reuse": (1, 5),
    "artifact_priority": (1, 5),
    "parallel_research": (1, 5),
    "change_scope": (1, 5),
    "exploration_rate": (0.05, 0.35),
}

DEFAULT_PARAMS = {
    "verification_depth": 3,
    "test_budget": 3,
    "adversarial_review": 2,
    "observability_depth": 3,
    "memory_reuse": 3,
    "artifact_priority": 4,
    "parallel_research": 3,
    "change_scope": 2,
    "exploration_rate": 0.16,
}

# Visible fixtures are part of the routine engineering contract. Holdouts are NOT
# used to generate or mutate candidates; they are applied only after generation as
# an independent non-regression / generalization pressure gate.
STRATEGY_EVAL_FIXTURES: tuple[dict[str, Any], ...] = (
    {
        "id": "VISIBLE-CORRECTNESS-BASELINE",
        "split": "visible",
        "purpose": "Require enough verification/test depth while keeping change scope bounded.",
        "min": {"verification_depth": 2, "test_budget": 2},
        "max": {"change_scope": 4},
    },
    {
        "id": "VISIBLE-SECURITY-REVIEW",
        "split": "visible",
        "purpose": "Require adversarial review plus verification before autonomous promotion.",
        "min": {"adversarial_review": 1, "verification_depth": 2},
        "max": {"change_scope": 3},
    },
    {
        "id": "VISIBLE-OBSERVABILITY-MEMORY",
        "split": "visible",
        "purpose": "Require enough observability and memory reuse for inspectable learning.",
        "min": {"observability_depth": 2, "memory_reuse": 2},
        "max": {},
    },
    {
        "id": "HOLDOUT-RELIABILITY-STRESS",
        "split": "holdout",
        "purpose": "Stress verification, tests, observability and exploration simultaneously.",
        "min": {"verification_depth": 3, "test_budget": 3, "observability_depth": 3},
        "max": {"exploration_rate": 0.25},
    },
    {
        "id": "HOLDOUT-PERMISSION-PRESSURE",
        "split": "holdout",
        "purpose": "Keep autonomous change scope narrow while preserving adversarial review.",
        "min": {"adversarial_review": 2, "verification_depth": 3},
        "max": {"change_scope": 2},
    },
    {
        "id": "HOLDOUT-ARTIFACT-DISCIPLINE",
        "split": "holdout",
        "purpose": "Prevent efficiency gains from silently dropping inspectable evidence priority.",
        "min": {"artifact_priority": 4, "memory_reuse": 3},
        "max": {},
    },
    {
        "id": "HOLDOUT-HIGH-ASSURANCE",
        "split": "holdout",
        "purpose": "Reward deeper verification/test maturity without making it a baseline requirement.",
        "min": {"verification_depth": 4, "test_budget": 4, "adversarial_review": 3},
        "max": {"change_scope": 2, "exploration_rate": 0.20},
    },
)


def _cap(v: float) -> float:
    return round(max(0.0, min(100.0, v)), 3)


def quality_vector(params: dict[str, Any]) -> dict[str, float]:
    v = float(params["verification_depth"])
    t = float(params["test_budget"])
    a = float(params["adversarial_review"])
    o = float(params["observability_depth"])
    m = float(params["memory_reuse"])
    p = float(params["artifact_priority"])
    r = float(params["parallel_research"])
    s = float(params["change_scope"])
    e = float(params["exploration_rate"])
    return {
        "correctness": _cap(49 + 7.0 * v + 5.0 * t + 2.0 * m - 2.5 * s),
        "architecture": _cap(48 + 4.5 * v + 4.0 * m + 3.0 * p - 2.0 * s),
        "reliability": _cap(47 + 4.5 * v + 4.0 * t + 5.5 * o - 18.0 * e),
        "security": _cap(45 + 9.0 * a + 4.0 * v - 3.0 * s),
        "observability": _cap(43 + 10.0 * o + 2.0 * m),
        "efficiency": _cap(58 + 5.0 * r - 2.3 * t - 2.0 * v - 1.8 * a - 7.0 * e),
        "productization": _cap(43 + 9.0 * p + 3.0 * m + 2.0 * o),
    }


def _proxy_score(vector: dict[str, float]) -> float:
    weights = {
        "correctness": 1.4,
        "architecture": 1.0,
        "reliability": 1.3,
        "security": 1.3,
        "observability": 0.9,
        "efficiency": 0.8,
        "productization": 1.0,
    }
    total = sum(vector[k] * w for k, w in weights.items())
    return round(total / sum(weights.values()), 3)


def evaluate_strategy(params: dict[str, Any]) -> dict[str, Any]:
    """Evaluate engineering strategy params against deterministic fixtures.

    This is executable engineering-process evidence. It intentionally does not claim
    to evaluate an LLM, model weights, a customer workload, or production behavior.
    """
    cases: list[dict[str, Any]] = []
    for fixture in STRATEGY_EVAL_FIXTURES:
        failed: list[str] = []
        observed: dict[str, Any] = {}
        for name, threshold in (fixture.get("min") or {}).items():
            value = params[name]
            observed[name] = value
            if float(value) < float(threshold):
                failed.append(f"{name}>={threshold}")
        for name, threshold in (fixture.get("max") or {}).items():
            value = params[name]
            observed[name] = value
            if float(value) > float(threshold):
                failed.append(f"{name}<={threshold}")
        cases.append({
            "id": fixture["id"],
            "split": fixture["split"],
            "purpose": fixture["purpose"],
            "passed": not failed,
            "failed_checks": failed,
            "observed": observed,
        })

    def split_summary(split: str) -> dict[str, Any]:
        rows = [c for c in cases if c["split"] == split]
        passed = [c["id"] for c in rows if c["passed"]]
        failed = [c["id"] for c in rows if not c["passed"]]
        return {
            "passed": len(passed),
            "total": len(rows),
            "pass_rate": round(len(passed) / max(1, len(rows)), 3),
            "passed_ids": passed,
            "failed_ids": failed,
        }

    stable = {
        "params": params,
        "cases": [{"id": c["id"], "passed": c["passed"], "failed_checks": c["failed_checks"]} for c in cases],
    }
    return {
        "schema": "the-world-ai-strategy-eval/v1",
        "visible": split_summary("visible"),
        "holdout": split_summary("holdout"),
        "cases": cases,
        "fingerprint": hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()[:20],
        "claim_boundary": "Deterministic strategy-fixture evidence only; not model capability or customer validation.",
    }


def behavioral_gate(current_params: dict[str, Any], candidate_params: dict[str, Any]) -> tuple[bool, str, dict[str, Any]]:
    """Fail closed if a candidate loses any behavior fixture already held by champion."""
    current = evaluate_strategy(current_params)
    candidate = evaluate_strategy(candidate_params)
    current_passed = {c["id"] for c in current["cases"] if c["passed"]}
    candidate_passed = {c["id"] for c in candidate["cases"] if c["passed"]}
    regressions = sorted(current_passed - candidate_passed)
    improvements = sorted(candidate_passed - current_passed)
    evidence = {
        "current": {"visible": current["visible"], "holdout": current["holdout"], "fingerprint": current["fingerprint"]},
        "candidate": {"visible": candidate["visible"], "holdout": candidate["holdout"], "fingerprint": candidate["fingerprint"]},
        "regression_cases": regressions,
        "improved_cases": improvements,
        "visible_delta": candidate["visible"]["passed"] - current["visible"]["passed"],
        "holdout_delta": candidate["holdout"]["passed"] - current["holdout"]["passed"],
    }
    if regressions:
        return False, "behavioral_fixture_regression", evidence
    if candidate["visible"]["passed"] < current["visible"]["passed"]:
        return False, "visible_fixture_regression", evidence
    if candidate["holdout"]["passed"] < current["holdout"]["passed"]:
        return False, "holdout_fixture_regression", evidence
    return True, "behavioral_gate_pass", evidence


def initial_state() -> dict[str, Any]:
    vector = quality_vector(DEFAULT_PARAMS)
    strategy_eval = evaluate_strategy(DEFAULT_PARAMS)
    return {
        "schema": "the-world-ai-foundry-state/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generation": 0,
        "curriculum_level": 1,
        "champion": {
            "id": "AI-DEV-CHAMPION-G000000",
            "params": deepcopy(DEFAULT_PARAMS),
            "quality_proxy": vector,
            "proxy_score": _proxy_score(vector),
            "strategy_eval": strategy_eval,
        },
        "promotions": 0,
        "rejections": 0,
        "noops": 0,
        "recent": [],
        "note": "Proxy scores steer engineering strategy only; promotion also requires deterministic visible/holdout non-regression evidence. Real capability still requires code/runtime evidence and independent tests.",
    }


def normalize_focus_bias(value: str | None) -> str | None:
    value = str(value or "").strip().lower()
    return value if value in FOCUS_ORDER else None


def _mutate_value(name: str, value: Any, rng: random.Random) -> Any:
    lo, hi = PARAM_BOUNDS[name]
    if isinstance(value, int):
        step = rng.choice((-1, 1))
        return max(int(lo), min(int(hi), value + step))
    step = rng.choice((-0.02, 0.02, -0.03, 0.03))
    return round(max(float(lo), min(float(hi), float(value) + step)), 3)


def _candidate_params(base: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    out = deepcopy(base)
    keys = list(PARAM_BOUNDS)
    for name in rng.sample(keys, k=rng.choice((1, 1, 2))):
        out[name] = _mutate_value(name, out[name], rng)
    return out


def _eligible(
    current: dict[str, float],
    candidate: dict[str, float],
    focus: str,
    *,
    current_params: dict[str, Any] | None = None,
    candidate_params: dict[str, Any] | None = None,
) -> tuple[bool, str, dict[str, Any]]:
    for key in ("correctness", "reliability", "security"):
        if candidate[key] < current[key] - 1.0:
            return False, f"core_regression:{key}", {}
    if candidate[focus] < current[focus] + 0.5:
        return False, "insufficient_focus_delta", {}
    if _proxy_score(candidate) < _proxy_score(current) - 0.25:
        return False, "weighted_proxy_regression", {}
    if current_params is not None and candidate_params is not None:
        ok, reason, evidence = behavioral_gate(current_params, candidate_params)
        if not ok:
            return False, reason, evidence
        return True, "eligible", evidence
    return True, "eligible", {}


def evolve_once(state: dict[str, Any], seed: str, focus_bias: str | None = None) -> dict[str, Any]:
    state = deepcopy(state)
    generation = int(state.get("generation") or 0) + 1
    base_focus = FOCUS_ORDER[(generation - 1) % len(FOCUS_ORDER)]
    bias = normalize_focus_bias(focus_bias)
    assist_applied = bool(bias and generation % 3 == 0)
    focus = bias if assist_applied else base_focus

    champion = state["champion"]
    current_params = champion["params"]
    current_vector = champion["quality_proxy"]
    if not isinstance(champion.get("strategy_eval"), dict):
        champion["strategy_eval"] = evaluate_strategy(current_params)
    rng = random.Random(f"{seed}:{generation}:{champion['id']}:{bias or 'no-assist'}")

    candidates = []
    for idx in range(8):
        params = _candidate_params(current_params, rng)
        vector = quality_vector(params)
        ok, reason, behavior = _eligible(
            current_vector,
            vector,
            focus,
            current_params=current_params,
            candidate_params=params,
        )
        strategy_eval = evaluate_strategy(params)
        candidates.append({
            "candidate": idx,
            "params": params,
            "quality_proxy": vector,
            "proxy_score": _proxy_score(vector),
            "eligible": ok,
            "reason": reason,
            "focus_delta": round(vector[focus] - current_vector[focus], 3),
            "strategy_eval": strategy_eval,
            "behavioral_gate": behavior,
        })

    eligible = [c for c in candidates if c["eligible"]]
    if eligible:
        winner = sorted(
            eligible,
            key=lambda c: (
                int((c.get("behavioral_gate") or {}).get("holdout_delta") or 0),
                int((c.get("behavioral_gate") or {}).get("visible_delta") or 0),
                c["focus_delta"],
                c["proxy_score"],
                json.dumps(c["params"], sort_keys=True),
            ),
            reverse=True,
        )[0]
        new_id = f"AI-DEV-CHAMPION-G{generation:06d}"
        state["champion"] = {
            "id": new_id,
            "params": winner["params"],
            "quality_proxy": winner["quality_proxy"],
            "proxy_score": winner["proxy_score"],
            "strategy_eval": winner["strategy_eval"],
        }
        state["promotions"] = int(state.get("promotions") or 0) + 1
        behavior = winner.get("behavioral_gate") or {}
        event = {
            "generation": generation,
            "focus": focus,
            "base_focus": base_focus,
            "assist_focus": bias,
            "assist_applied": assist_applied,
            "result": "PROMOTED",
            "champion": new_id,
            "focus_delta": winner["focus_delta"],
            "proxy_score": winner["proxy_score"],
            "behavioral_gate": "PASS",
            "visible_fixture_delta": int(behavior.get("visible_delta") or 0),
            "holdout_fixture_delta": int(behavior.get("holdout_delta") or 0),
            "improved_fixture_cases": behavior.get("improved_cases") or [],
            "strategy_eval_fingerprint": winner["strategy_eval"]["fingerprint"],
        }
    else:
        state["rejections"] = int(state.get("rejections") or 0) + len(candidates)
        state["noops"] = int(state.get("noops") or 0) + 1
        behavioral_rejections = sum(1 for c in candidates if "fixture_regression" in str(c.get("reason") or ""))
        event = {
            "generation": generation,
            "focus": focus,
            "base_focus": base_focus,
            "assist_focus": bias,
            "assist_applied": assist_applied,
            "result": "NO_PROMOTION",
            "champion": champion["id"],
            "reason": "no candidate cleared proxy, core-regression and behavioral holdout gates",
            "behavioral_rejections": behavioral_rejections,
        }

    state["generation"] = generation
    state["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    state["recent"] = (list(state.get("recent") or []) + [event])[-60:]
    state["curriculum_level"] = min(7, 1 + int(state.get("promotions") or 0) // 12)
    return state


def _delta(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    bv = before["champion"]["quality_proxy"]
    av = after["champion"]["quality_proxy"]
    return {k: round(av[k] - bv[k], 3) for k in FOCUS_ORDER}


def _strategy_eval_delta(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    b = evaluate_strategy(before["champion"]["params"])
    a = evaluate_strategy(after["champion"]["params"])
    bp = {c["id"] for c in b["cases"] if c["passed"]}
    ap = {c["id"] for c in a["cases"] if c["passed"]}
    return {
        "visible_passed_before": b["visible"]["passed"],
        "visible_passed_after": a["visible"]["passed"],
        "holdout_passed_before": b["holdout"]["passed"],
        "holdout_passed_after": a["holdout"]["passed"],
        "visible_delta": a["visible"]["passed"] - b["visible"]["passed"],
        "holdout_delta": a["holdout"]["passed"] - b["holdout"]["passed"],
        "newly_passed_cases": sorted(ap - bp),
        "regressed_cases": sorted(bp - ap),
        "before_fingerprint": b["fingerprint"],
        "after_fingerprint": a["fingerprint"],
    }


def build_hourly_summary(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    delta = _delta(before, after)
    eval_delta = _strategy_eval_delta(before, after)
    final_eval = evaluate_strategy(after["champion"]["params"])
    weakest = min(after["champion"]["quality_proxy"], key=after["champion"]["quality_proxy"].get)
    material = (
        any(abs(v) >= 0.5 for v in delta.values())
        or after["champion"]["id"] != before["champion"]["id"]
        or bool(eval_delta["newly_passed_cases"])
    )
    new_events = [e for e in after.get("recent", []) if int(e.get("generation") or 0) > int(before.get("generation") or 0)]
    assisted = [e for e in new_events if e.get("assist_applied")]
    stable_payload = {
        "champion": after["champion"],
        "delta": delta,
        "strategy_eval_delta": eval_delta,
        "weakest": weakest,
        "curriculum_level": after["curriculum_level"],
        "assist_focuses": sorted({str(e.get("assist_focus")) for e in assisted}),
    }
    fingerprint = hashlib.sha256(json.dumps(stable_payload, sort_keys=True).encode()).hexdigest()[:20]
    return {
        "schema": "the-world-ai-foundry-hourly/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "start_generation": before["generation"],
        "end_generation": after["generation"],
        "rounds": int(after["generation"]) - int(before["generation"]),
        "start_champion": before["champion"]["id"],
        "end_champion": after["champion"]["id"],
        "promotions_delta": int(after.get("promotions") or 0) - int(before.get("promotions") or 0),
        "noops_delta": int(after.get("noops") or 0) - int(before.get("noops") or 0),
        "quality_proxy_delta": delta,
        "strategy_fixture_delta": eval_delta,
        "strategy_fixture_summary": {
            "visible": final_eval["visible"],
            "holdout": final_eval["holdout"],
            "fingerprint": final_eval["fingerprint"],
        },
        "weakest_next_focus": weakest,
        "curriculum_level": after["curriculum_level"],
        "material_delta": material,
        "report_fingerprint": fingerprint,
        "champion_params": after["champion"]["params"],
        "security_assist_rounds": len(assisted),
        "security_assist_focuses": sorted({str(e.get("assist_focus")) for e in assisted}),
        "limitations": [
            "Minute evolution changes engineering strategy state, not model weights.",
            "Security/Eval assist is priority-only, bounded to one of every three rounds, and cannot bypass regression/promotion gates.",
            "Visible/holdout fixtures are deterministic engineering-strategy evidence; they do not establish general model capability, production performance, or customer validation.",
            "Real capability claims still require bounded code/runtime changes, independent tests and relevant external or customer evidence.",
        ],
    }


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_rounds(
    state: dict[str, Any],
    *,
    rounds: int,
    sleep_seconds: float,
    seed: str,
    history_path: Path | None = None,
    focus_bias: str | None = None,
) -> dict[str, Any]:
    out = deepcopy(state)
    for _ in range(rounds):
        out = evolve_once(out, seed, focus_bias=focus_bias)
        if history_path:
            history_path.parent.mkdir(parents=True, exist_ok=True)
            with history_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(out["recent"][-1], ensure_ascii=False) + "\n")
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    q = sub.add_parser("init")
    q.add_argument("--out", required=True)

    q = sub.add_parser("run")
    q.add_argument("--state", required=True)
    q.add_argument("--out", required=True)
    q.add_argument("--summary", required=True)
    q.add_argument("--history")
    q.add_argument("--rounds", type=int, default=60)
    q.add_argument("--sleep-seconds", type=float, default=60.0)
    q.add_argument("--seed", default="the-world-ai-foundry-v3")
    q.add_argument("--assist-focus", choices=FOCUS_ORDER)

    args = ap.parse_args()
    if args.cmd == "init":
        write_json(Path(args.out), initial_state())
        return 0

    before = json.loads(Path(args.state).read_text(encoding="utf-8"))
    after = run_rounds(
        before,
        rounds=max(1, args.rounds),
        sleep_seconds=max(0.0, args.sleep_seconds),
        seed=args.seed,
        history_path=Path(args.history) if args.history else None,
        focus_bias=args.assist_focus,
    )
    write_json(Path(args.out), after)
    write_json(Path(args.summary), build_hourly_summary(before, after))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
