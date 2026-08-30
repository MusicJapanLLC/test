import pytest

from scripts.apply_rnd_directive import apply_directive

BASE = {
    "population": 120,
    "generations": 16,
    "matches": 400,
    "mutation_rate": 0.15,
    "red_budget": 14,
    "blue_budget": 14,
    "seed": 20260829,
}


def directive(focus="robustness", **extra):
    d = {
        "schema": "rnd-senju-directive/v1",
        "research_id": "RND-1",
        "focus": focus,
        "candidate_count": 7,
        "hypothesis": "test",
    }
    d.update(extra)
    return d


def test_robustness_directive_is_small_and_numeric_only():
    out, audit = apply_directive(BASE, directive())
    assert set(out) == set(BASE)
    assert out["mutation_rate"] < BASE["mutation_rate"]
    assert out["matches"] > BASE["matches"]
    assert audit["candidate_count"] == 7


def test_balance_equalizes_budgets():
    base = dict(BASE, red_budget=10, blue_budget=18)
    out, _ = apply_directive(base, directive("balance"))
    assert out["red_budget"] == out["blue_budget"] == 14


def test_forbidden_directive_surface_is_rejected():
    with pytest.raises(ValueError):
        apply_directive(BASE, directive(target="public-site.example"))


def test_unknown_focus_is_rejected():
    with pytest.raises(ValueError):
        apply_directive(BASE, directive("unbounded"))
