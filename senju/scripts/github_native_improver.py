#!/usr/bin/env python3
"""GitHub-native bounded improvement planner for Senju.

The durable core does not require an external LLM. It first tries an optional model
provider, then falls back to the tournament's own evaluator evidence. Either path may
modify only a small allowlisted strategy surface. Targets, network scope, workflows,
permissions, executable code and ScopeGuard are outside the autonomous surface.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.request
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


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise ValueError("model response contained no JSON object")
    return json.loads(match.group(0))


def call_model(token: str, model: str, prompt: str) -> dict[str, Any]:
    payload = {
        "model": model,
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Senju's bounded strategy evaluator. Return JSON only. "
                    "Never propose targets, URLs, credentials, network actions, repository permissions, "
                    "workflow changes, code execution, exploitation, persistence, or external scanning."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    req = urllib.request.Request(
        "https://models.github.ai/inference/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:  # noqa: S310
            body = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"GitHub Models HTTP {exc.code}: {detail}") from exc
    return _extract_json(body["choices"][0]["message"]["content"])


def bounded_strategy(base: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    if set(proposed) - set(ALLOWED):
        raise ValueError(f"forbidden strategy keys: {sorted(set(proposed) - set(ALLOWED))}")
    out = dict(base)
    for key, value in proposed.items():
        if key not in ALLOWED:
            continue
        lo, hi = ALLOWED[key]
        if key == "mutation_rate":
            value = float(value)
        else:
            value = int(value)
        value = min(hi, max(lo, value))
        old = float(base[key])
        if key != "seed" and old:
            max_step = abs(old) * MAX_RELATIVE_STEP[key]
            value = min(old + max_step, max(old - max_step, float(value)))
            if key != "mutation_rate":
                value = int(round(value))
            else:
                value = round(value, 4)
        out[key] = value
    return out


def local_evaluator_proposal(base: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    """Select the strongest safe strategy already measured by Senju's evaluator.

    This is deliberately evidence-only: no new target, behavior, payload, or code is
    invented. If no trustworthy candidate evidence exists, it keeps the current
    strategy unchanged.
    """
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
        proposed = {k: candidate[k] for k in ALLOWED if k in candidate and candidate[k] != base.get(k)}
        return {
            "strategy": proposed,
            "reason": (
                f"Local evaluator selected the best already-measured safe candidate "
                f"with score={score:.3f}, rating_gain={evaluation.get('rating_gain')}, "
                f"balance={evaluation.get('balance')}, learning_signal={evaluation.get('learning_signal')}."
            ),
            "hypothesis": "Carry forward the strongest safe measured strategy and verify it again in the bounded smoke tournament.",
            "confidence": 0.90,
            "engine": "local-evaluator",
        }

    selected_strategy = summary.get("selected_strategy")
    selected = summary.get("selected") or {}
    if isinstance(selected_strategy, dict) and isinstance(selected, dict) and selected.get("safe") is True:
        proposed = {k: selected_strategy[k] for k in ALLOWED if k in selected_strategy and selected_strategy[k] != base.get(k)}
        return {
            "strategy": proposed,
            "reason": "Reused the latest safe selected strategy from the durable Senju evolution summary.",
            "hypothesis": "Revalidate the latest safe selected strategy before promotion.",
            "confidence": 0.80,
            "engine": "local-evaluator",
        }

    return {
        "strategy": {},
        "reason": "No trustworthy safe comparative evidence was available; retaining the current strategy.",
        "hypothesis": "Collect another isolated tournament before changing strategy.",
        "confidence": 0.50,
        "engine": "local-evaluator",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--evolution-summary", required=False)
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--model", default=os.environ.get("SENJU_GITHUB_MODEL", "openai/gpt-4.1"))
    args = ap.parse_args()

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    strategy = load_json(args.strategy, {})
    if set(strategy) != set(ALLOWED):
        raise SystemExit(f"bootstrap strategy keys must exactly match allowlist: {sorted(ALLOWED)}")
    summary = load_json(args.evolution_summary, {}) if args.evolution_summary else {}

    prompt = f"""
Current bounded strategy:
{json.dumps(strategy, ensure_ascii=False, indent=2)}

Latest tournament/evaluator evidence:
{json.dumps(summary, ensure_ascii=False, indent=2)[:14000]}

Choose at most three small changes that are likely to improve the NEXT isolated simulation run.
Optimize learning signal, rating gain, balance and computational efficiency. Safety is a hard gate.
You may ONLY modify these keys: {', '.join(ALLOWED)}.
Do not invent evidence. If evidence is weak, keep the current value.
Return exactly this JSON shape:
{{
  "strategy": {{...only allowlisted keys you want changed...}},
  "reason": "short evidence-based reason",
  "hypothesis": "what should improve next run",
  "confidence": 0.0
}}
""".strip()

    provider_error = None
    raw: dict[str, Any]
    if token:
        try:
            raw = call_model(token, args.model, prompt)
            raw["engine"] = "github-models"
        except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
            provider_error = str(exc)[:1200]
            raw = local_evaluator_proposal(strategy, summary)
    else:
        provider_error = "No model token available"
        raw = local_evaluator_proposal(strategy, summary)

    proposed = raw.get("strategy", {})
    if not isinstance(proposed, dict):
        raise SystemExit("strategy proposal must be an object")
    next_strategy = bounded_strategy(strategy, proposed)

    confidence = float(raw.get("confidence", 0.0))
    confidence = max(0.0, min(1.0, confidence))
    changes = [f"{k}: {strategy[k]} -> {next_strategy[k]}" for k in strategy if strategy[k] != next_strategy[k]]
    engine = str(raw.get("engine", "unknown"))

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "strategy.json").write_text(json.dumps(next_strategy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result = {
        "engine": engine,
        "model": args.model if engine == "github-models" else None,
        "provider_error": provider_error,
        "safe": True,
        "confidence": confidence,
        "changes": changes,
        "reason": str(raw.get("reason", ""))[:1200],
        "hypothesis": str(raw.get("hypothesis", ""))[:1200],
        "previous_strategy": strategy,
        "next_strategy": next_strategy,
        "source_evidence_present": bool(summary),
    }
    (out / "last-evolution-summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    plan = [
        "# Senju GitHub-native improvement plan",
        "",
        f"- engine: `{engine}`",
        f"- safe: `{result['safe']}`",
        f"- confidence: `{confidence:.2f}`",
        f"- evidence present: `{bool(summary)}`",
    ]
    if provider_error:
        plan += [f"- optional provider unavailable: `{provider_error[:300]}`", "- fallback: `local-evaluator`"]
    plan += ["", "## Accepted bounded changes"]
    plan += [f"- {c}" for c in changes] or ["- No parameter change; retain current strategy."]
    plan += ["", "## Reason", result["reason"] or "No reason supplied.", "", "## Next-run hypothesis", result["hypothesis"] or "No hypothesis supplied.", ""]
    (out / "last-evolution-plan.md").write_text("\n".join(plan), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
