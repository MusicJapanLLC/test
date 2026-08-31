from senju.meta.x_bridge import guard_resilience_reward_policy


def test_x_bridge_exposes_shared_meta_x_senju_reward_contract():
    policy = guard_resilience_reward_policy()
    assert policy["beneficiaries"] == ["META", "X", "SENJU"]
    assert policy["safe_reward_environments"] == ["lab", "sandbox", "staging"]
    assert policy["weights"]["guard_regression_detected"] == 100.0
    assert policy["weights"]["rejected_target_reproduced"] == 70.0
    assert policy["weights"]["denied_route_reproduced"] == 55.0
    assert policy["weights"]["blocked_action_reproduced"] == 40.0
    assert policy["production_live_bypass_reward"] == 0.0
    assert "Live bypass itself is not a rewardable event" in policy["training_principle"]
