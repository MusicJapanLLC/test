#!/usr/bin/env python3
"""GitHub-native bounded improvement planner for Senju.

Uses GitHub Models with the ephemeral GITHUB_TOKEN. The model is advisory only:
it may propose values for a small allowlisted strategy surface. This module validates,
clamps, and serializes the proposal; it cannot alter targets, network scope, workflows,
permissions, executable code, or the ScopeGuard.
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--evolution-summary", required=False)
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--model", default=os.environ.get("SENJU_GITHUB_MODEL", "openai/gpt-4.1"))
    args = ap.parse_args()

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("GH_TOKEN/GITHUB_TOKEN is required")

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

    raw = call_model(token, args.model, prompt)
    proposed = raw.get("strategy", {})
    if not isinstance(proposed, dict):
        raise SystemExit("model strategy must be an object")
    next_strategy = bounded_strategy(strategy, proposed)

    confidence = float(raw.get("confidence", 0.0))
    confidence = max(0.0, min(1.0, confidence))
    changes = [f"{k}: {strategy[k]} -> {next_strategy[k]}" for k in strategy if strategy[k] != next_strategy[k]]

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "strategy.json").write_text(json.dumps(next_strategy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result = {
        "model": args.model,
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
        f"- model: `{args.model}`",
        f"- safe: `{result['safe']}`",
        f"- confidence: `{confidence:.2f}`",
        f"- evidence present: `{bool(summary)}`",
        "",
        "## Accepted bounded changes",
    ]
    plan += [f"- {c}" for c in changes] or ["- No parameter change; retain current strategy."]
    plan += ["", "## Reason", result["reason"] or "No reason supplied.", "", "## Next-run hypothesis", result["hypothesis"] or "No hypothesis supplied.", ""]
    (out / "last-evolution-plan.md").write_text("\n".join(plan), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
