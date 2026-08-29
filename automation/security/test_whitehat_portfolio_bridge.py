from automation.security.whitehat_portfolio_bridge import classify


def test_plan_only_is_zero_network_and_not_promoted():
    summary = classify(
        {
            "mode": "plan-only",
            "network_requests": 0,
            "policy": {"network_access": "disabled"},
            "hypotheses": [{"title": "GraphQL認証・認可境界"}],
            "probe_results": [],
        }
    )
    assert summary["network_disabled_plan_only"] is True
    assert summary["behavioral_evidence_present"] is False
    assert summary["portfolio_status"] == "BUILDING"
    assert summary["promotion_ready"] is False


def test_local_validation_records_behavior_but_still_requires_portfolio_gate():
    summary = classify(
        {
            "mode": "local-validation",
            "network_requests": 2,
            "policy": {"target_scope": "loopback/private/link-local only"},
            "hypotheses": [{"title": "Headers"}],
            "probe_results": [{"probe": "GET", "status": 200}],
        }
    )
    assert summary["behavioral_evidence_present"] is True
    assert summary["promotion_ready"] is False
    assert "Before/After" in summary["promotion_reason"]
