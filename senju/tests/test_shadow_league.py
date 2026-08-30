import json

from scripts.shadow_league import load_strategy, summarize


def row(score=100.0, safe=True, balance=0.8, learning=0.4):
    return {
        "score": score,
        "safe": safe,
        "rating_gain": 10.0,
        "balance": balance,
        "learning_signal": learning,
        "reason": "test",
    }


def test_stable_multi_seed_summary():
    report = summarize([row(100), row(105), row(95), row(102), row(98)])
    assert report["stable"] is True
    assert report["safe"] is True
    assert report["runs"] == 5
    assert report["worst_score"] == 95.0


def test_rejects_unsafe_seed():
    report = summarize([row(), row(safe=False)])
    assert report["stable"] is False
    assert report["safe"] is False
    assert "unsafe" in report["reason"]


def test_rejects_high_variance_or_weak_learning():
    report = summarize([row(10), row(100), row(180)])
    assert report["stable"] is False
    assert "variance" in report["reason"]

    report = summarize([row(100, learning=0.01), row(101), row(99)])
    assert report["stable"] is False
    assert "learning" in report["reason"]


def test_proposed_strategy_override(tmp_path):
    p = tmp_path / "strategy.json"
    p.write_text(json.dumps({
        "population": 55,
        "generations": 7,
        "matches": 180,
        "mutation_rate": 0.12,
        "red_budget": 10,
        "blue_budget": 11,
        "seed": 12345,
    }), encoding="utf-8")
    loaded = load_strategy(str(p), {"strategy": {}})
    assert loaded["population"] == 55
    assert loaded["generations"] == 7
    assert loaded["matches"] == 180
    assert loaded["seed"] == 12345
