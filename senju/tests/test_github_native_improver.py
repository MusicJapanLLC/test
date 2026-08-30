from scripts.github_native_improver import bounded_strategy


def base():
    return {
        "population": 120,
        "generations": 16,
        "matches": 400,
        "mutation_rate": 0.15,
        "red_budget": 12,
        "blue_budget": 12,
        "seed": 20260829,
    }


def test_rejects_forbidden_keys():
    try:
        bounded_strategy(base(), {"target": "https://example.com"})
    except ValueError as exc:
        assert "forbidden" in str(exc)
    else:
        raise AssertionError("forbidden autonomous key was accepted")


def test_clamps_large_step():
    out = bounded_strategy(base(), {"red_budget": 24, "blue_budget": 24})
    assert out["red_budget"] == 15
    assert out["blue_budget"] == 15


def test_allows_small_safe_change():
    out = bounded_strategy(base(), {"mutation_rate": 0.18, "matches": 450})
    assert out["mutation_rate"] == 0.18
    assert out["matches"] == 450
