from scripts.shadow_selector import choose_stable, neighborhood, robust_score

BASE = {
    "population": 120,
    "generations": 16,
    "matches": 400,
    "mutation_rate": 0.15,
    "red_budget": 14,
    "blue_budget": 14,
    "seed": 20260829,
}


def report(*, stable=True, safe=True, worst=100, mean=120, stdev=5, balance=0.7, learning=0.8):
    return {
        "stable": stable,
        "safe": safe,
        "worst_score": worst,
        "mean_score": mean,
        "score_stdev": stdev,
        "worst_balance": balance,
        "worst_learning_signal": learning,
        "strategy": dict(BASE),
    }


def test_neighborhood_is_bounded_and_unique():
    rows = neighborhood(BASE, 7)
    assert 3 <= len(rows) <= 7
    assert len({tuple(sorted(x.items())) for x in rows}) == len(rows)
    assert all(0.05 <= x["mutation_rate"] <= 0.35 for x in rows)
    assert all(40 <= x["population"] <= 240 for x in rows)


def test_choose_stable_rejects_unsafe_or_unstable_even_if_score_is_huge():
    bad = report(stable=False, worst=999, mean=999)
    unsafe = report(safe=False, worst=999, mean=999)
    good = report(worst=90, mean=100)
    winner = choose_stable([bad, unsafe, good])
    assert winner is not None
    assert winner["worst_score"] == 90


def test_robust_score_rewards_worst_case_and_penalizes_variance():
    resilient = report(worst=110, mean=120, stdev=4)
    fragile = report(worst=70, mean=150, stdev=30)
    assert robust_score(resilient) > robust_score(fragile)


def test_no_stable_candidate_returns_none():
    assert choose_stable([report(stable=False), report(safe=False)]) is None
