import unittest

from stop_learning import classify_stop, recovery_reward, update_learning_state


class StopLearningTests(unittest.TestCase):
    def test_unexpected_shutdown_is_failure_and_recovery_eligible(self):
        signal = classify_stop("unexpected_shutdown", {})
        self.assertEqual(signal.failure_weight, 1.0)
        self.assertTrue(signal.recovery_eligible)
        self.assertFalse(signal.authority_reacquire_allowed)

    def test_emergency_stop_suppresses_recovery_reward(self):
        signal = classify_stop("unexpected_shutdown", {"emergency_stop": True})
        self.assertEqual(signal.kind, "emergency_stop")
        self.assertEqual(signal.failure_weight, 0.0)
        self.assertFalse(signal.recovery_eligible)
        self.assertEqual(
            recovery_reward(
                prior_signal=signal,
                controls={"emergency_stop": True},
                stable_minutes=240,
                mttr_minutes=1,
            ),
            0.0,
        )

    def test_revocation_is_not_reacquisition_challenge(self):
        signal = classify_stop("failure", {"authority_revoked": True})
        self.assertEqual(signal.kind, "authority_revoked")
        self.assertFalse(signal.authority_reacquire_allowed)
        self.assertFalse(signal.recovery_eligible)

    def test_human_intervention_is_supervisory_not_failure(self):
        signal = classify_stop("failure", {"human_intervention": True})
        self.assertEqual(signal.kind, "human_intervention")
        self.assertEqual(signal.failure_weight, 0.0)
        self.assertEqual(signal.reward, 0.0)

    def test_deployment_freeze_is_planned_hold(self):
        signal = classify_stop("failure", {"deployment_freeze": True})
        self.assertEqual(signal.kind, "deployment_freeze")
        self.assertEqual(signal.failure_weight, 0.0)
        self.assertFalse(signal.recovery_eligible)

    def test_authorized_recovery_gets_stability_and_mttr_reward(self):
        prior = classify_stop("crash", {})
        reward = recovery_reward(
            prior_signal=prior,
            controls={},
            stable_minutes=120,
            mttr_minutes=30,
        )
        self.assertGreater(reward, 1.0)

    def test_learning_state_records_failure_then_safe_recovery(self):
        state = update_learning_state(
            {},
            [
                {"run_id": 1, "workflow": "META", "conclusion": "failure"},
                {"run_id": 2, "workflow": "META", "conclusion": "success", "stable_minutes": 60, "mttr_minutes": 20},
            ],
            {},
        )
        self.assertTrue(state["production"])
        self.assertEqual(state["failure_score"], 1.0)
        self.assertGreater(state["reward_score"], 0.0)
        self.assertFalse(state["authority_reacquire_allowed"])


if __name__ == "__main__":
    unittest.main()
