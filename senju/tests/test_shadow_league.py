from scripts.shadow_league import summarize


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
