#!/usr/bin/env python3
"""Apply a bounded R&D directive to a Senju simulator strategy.

The only accepted R&D inputs are research_id, focus, candidate_count and hypothesis.
The script can change only the existing numeric simulator strategy keys. It cannot
change targets, URLs, network scope, permissions, secrets, workflows or executable
behavior.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ALLOWED_DIRECTIVE_KEYS = {"schema", "research_id", "focus", "candidate_count", "hypothesis"}
ALLOWED_FOCUS = {"robustness", "learning", "balance", "efficiency"}
BOUNDS: dict[str, tuple[float, float]] = {
    "population": (40, 240),
    "generations": (6, 40),
    "matches": (100, 1200),
    "mutation_rate": (0.05, 0.35),
    "red_budget": (6, 24),
    "blue_budget": (6, 24),
    "seed": (1, 2_147_483_647),
}


def normalize_strategy(raw: dict[str, Any]) -> dict[str, Any]:
    if set(raw) != set(BOUNDS):
        raise ValueError(f"strategy surface mismatch: {sorted(raw)}")
    return {
        "population": int(raw["population"]),
        "generations": int(raw["generations"]),
        "matches": int(raw["matches"]),
        "mutation_rate": float(raw["mutation_rate"]),
        "red_budget": int(raw["red_budget"]),
        "blue_budget": int(raw["blue_budget"]),
        "seed": int(raw["seed"]),
    }


def clamp(strategy: dict[str, Any]) -> dict[str, Any]:
    s = normalize_strategy(strategy)
    out: dict[str, Any] = {}
    for key, value in s.items():
        lo, hi = BOUNDS[key]
        bounded = min(hi, max(lo, float(value)))
        out[key] = round(bounded, 4) if key == "mutation_rate" else int(round(bounded))
    return out


def apply_directive(strategy: dict[str, Any], directive: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    extra = set(directive) - ALLOWED_DIRECTIVE_KEYS
    if extra:
        raise ValueError(f"forbidden directive keys: {sorted(extra)}")
    focus = str(directive.get("focus", ""))
    if focus not in ALLOWED_FOCUS:
        raise ValueError(f"unsupported R&D focus: {focus}")
    base = clamp(strategy)
    out = dict(base)

    if focus == "robustness":
        out["mutation_rate"] = max(0.05, round(float(base["mutation_rate"]) * 0.90, 4))
        out["matches"] = min(1200, int(round(int(base["matches"]) * 1.10)))
    elif focus == "learning":
        out["mutation_rate"] = min(0.35, round(float(base["mutation_rate"]) * 1.10, 4))
        out["generations"] = min(40, int(round(int(base["generations"]) * 1.08)))
    elif focus == "balance":
        budget = int(round((int(base["red_budget"]) + int(base["blue_budget"])) / 2))
        out["red_budget"] = budget
        out["blue_budget"] = budget
    elif focus == "efficiency":
        out["population"] = max(40, int(round(int(base["population"]) * 0.90)))
        out["matches"] = max(100, int(round(int(base["matches"]) * 0.90)))

    out = clamp(out)
    changed = {key: {"before": base[key], "after": out[key]} for key in base if base[key] != out[key]}
    audit = {
        "schema": "senju-rnd-applied/v1",
        "research_id": str(directive.get("research_id", "RND-UNKNOWN")),
        "focus": focus,
        "candidate_count": max(3, min(9, int(directive.get("candidate_count", 7) or 7))),
        "changes": changed,
        "guardrail": "numeric simulator strategy only",
    }
    return out, audit


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--directive", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--audit", required=True)
    args = ap.parse_args()

    strategy = json.loads(Path(args.strategy).read_text(encoding="utf-8"))
    directive = json.loads(Path(args.directive).read_text(encoding="utf-8"))
    result, audit = apply_directive(strategy, directive)
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
