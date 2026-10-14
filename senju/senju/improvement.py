"""Bounded Improvement Agent for the isolated Senju simulator.

It proposes only numerical simulator strategy changes. It cannot alter scope policy,
network access, workflow permissions, or executable security tooling.
"""
from __future__ import annotations

import copy
from typing import Any


DEFAULT_STRATEGY: dict[str, Any] = {
    "population": 120,
    "generations": 16,
    "matches": 400,
    "mutation_rate": 0.15,
    "red_budget": 12,
    "blue_budget": 12,
    "seed": 20260829,
}

BOUNDS = {
    "population": (40, 250),
    "generations": (6, 40),
    "matches": (100, 1200),
    "mutation_rate": (0.05, 0.30),
    "red_budget": (6, 20),
    "blue_budget": (6, 20),
}


def _clamp(name: str, value: float | int) -> float | int:
    lo, hi = BOUNDS[name]
    value = max(lo, min(hi, value))
    if name == "mutation_rate":
        return round(float(value), 3)
    return int(value)


def normalize(strategy: dict[str, Any] | None) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_STRATEGY)
    if strategy:
        for key in out:
            if key in strategy:
                out[key] = strategy[key]
    for key in BOUNDS:
        out[key] = _clamp(key, out[key])
    out["seed"] = int(out.get("seed", DEFAULT_STRATEGY["seed"]))
    return out


def propose(strategy: dict[str, Any] | None, limit: int = 5) -> list[dict[str, Any]]:
    """Return baseline + bounded exploration candidates.

    Candidate ordering is deterministic so the same memory produces reproducible
    experiments. No candidate can expand target scope or enable network access.
    """
    base = normalize(strategy)
    candidates: list[dict[str, Any]] = [copy.deepcopy(base)]

    variants = [
        {"mutation_rate": base["mutation_rate"] + 0.03},
        {"mutation_rate": base["mutation_rate"] - 0.03},
        {"red_budget": base["red_budget"] + 2, "blue_budget": base["blue_budget"] + 2},
        {"matches": base["matches"] + 100},
        {"population": base["population"] + 20, "generations": base["generations"] + 2},
        {"red_budget": base["red_budget"] - 1, "blue_budget": base["blue_budget"] + 1},
        {"red_budget": base["red_budget"] + 1, "blue_budget": base["blue_budget"] - 1},
    ]
    for delta in variants:
        c = copy.deepcopy(base)
        for key, value in delta.items():
            c[key] = _clamp(key, value)
        if c not in candidates:
            candidates.append(c)
        if len(candidates) >= max(1, limit):
            break
    return candidates


def describe_change(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for key in DEFAULT_STRATEGY:
        if before.get(key) != after.get(key):
            lines.append(f"{key}: {before.get(key)} -> {after.get(key)}")
    return lines or ["no strategy change"]
