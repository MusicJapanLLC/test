from stop_learning import classify_stop, recovery_reward, update_learning_state


def test_unexpected_shutdown_is_failure_and_recovery_eligible():
    signal = classify_stop("unexpected_shutdown", {})
    assert signal.failure_weight == 1.0
    assert signal.recovery_eligible is True
    assert signal.authority_reacquire_allowed is False


def test_emergency_stop_suppresses_recovery_reward():
    signal = classify_stop("unexpected_shutdown", {"emergency_stop": True})
    assert signal.kind == "emergency_stop"
    assert signal.failure_weight == 0.0
    assert signal.recovery_eligible is False
    assert recovery_reward(
        prior_signal=signal,
        controls={"emergency_stop": True},
        stable_minutes=240,
        mttr_minutes=1,
    ) == 0.0


def test_revocation_is_not_reacquisition_challenge():
    signal = classify_stop("failure", {"authority_revoked": True})
    assert signal.kind == "authority_revoked"
    assert signal.authority_reacquire_allowed is False
    assert signal.recovery_eligible is False


def test_human_intervention_is_supervisory_not_failure():
    signal = classify_stop("failure", {"human_intervention": True})
    assert signal.kind == "human_intervention"
    assert signal.failure_weight == 0.0
    assert signal.reward == 0.0


def test_deployment_freeze_is_planned_hold():
    signal = classify_stop("failure", {"deployment_freeze": True})
    assert signal.kind == "deployment_freeze"
    assert signal.failure_weight == 0.0
    assert signal.recovery_eligible is False


def test_authorized_recovery_gets_stability_and_mttr_reward():
    prior = classify_stop("crash", {})
    reward = recovery_reward(
        prior_signal=prior,
        controls={},
        stable_minutes=120,
        mttr_minutes=30,
    )
    assert reward > 1.0


def test_learning_state_records_failure_then_safe_recovery():
    state = update_learning_state(
        {},
        [
            {"run_id": 1, "workflow": "META", "conclusion": "failure"},
            {"run_id": 2, "workflow": "META", "conclusion": "success", "stable_minutes": 60, "mttr_minutes": 20},
        ],
        {},
    )
    assert state["production"] is True
    assert state["failure_score"] == 1.0
    assert state["reward_score"] > 0.0
    assert state["authority_reacquire_allowed"] is False
