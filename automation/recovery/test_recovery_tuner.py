import unittest

from apply_recovery_tuning import apply_dynamic_tuning, apply_tuning
from recovery_tuner import derive_recovery_tuning


REGISTRY = {
    "policy": {"max_recovery_dispatches_per_run": 6},
    "workers": [
        {
            "id": "meta",
            "stale_after_seconds": 7200,
            "recovery": {"workflow": "meta-consciousness.yml"},
        },
        {
            "id": "x",
            "stale_after_seconds": 10800,
            "recovery": {"workflow": "autonomous-codegen-loop.yml"},
        },
    ],
}


class RecoveryTunerTests(unittest.TestCase):
    def test_failure_pressure_strengthens_recovery_within_cap(self):
        tuning = derive_recovery_tuning(
            {"failure_score": 8.0, "reward_score": 1.0, "pending_failures": {"META": {}}},
            REGISTRY,
            {},
        )
        self.assertTrue(tuning["enabled"])
        self.assertLess(tuning["stale_after_multiplier"], 1.0)
        self.assertGreaterEqual(tuning["max_dispatches_per_run"], 1)
        self.assertLessEqual(tuning["max_dispatches_per_run"], 6)
        self.assertIn(tuning["strategy"], {"steady_recovery", "accelerated_recovery", "rapid_recovery"})
        self.assertGreaterEqual(tuning["dispatch_spacing_seconds"], 5)

    def test_active_control_disables_runtime_recovery_tuning(self):
        tuning = derive_recovery_tuning(
            {"failure_score": 100.0, "pending_failures": {"META": {}}},
            REGISTRY,
            {"emergency_stop": True},
        )
        self.assertFalse(tuning["enabled"])
        self.assertEqual(tuning["strategy"], "control_hold")
        self.assertEqual(tuning["max_dispatches_per_run"], 0)
        self.assertFalse(tuning["emergency_stop_bypass_allowed"])
        self.assertFalse(tuning["authority_reacquire_allowed"])

    def test_tuning_never_expands_dispatch_cap(self):
        tuned = apply_tuning(
            REGISTRY,
            {
                "enabled": True,
                "active_controls": [],
                "max_dispatches_per_run": 999,
                "stale_after_multiplier": 0.1,
            },
        )
        self.assertEqual(tuned["policy"]["max_recovery_dispatches_per_run"], 6)
        self.assertEqual(tuned["workers"][0]["stale_after_seconds"], 2520)

    def test_disabled_tuning_zeroes_dispatch_budget(self):
        tuned = apply_tuning(REGISTRY, {"enabled": False, "active_controls": []})
        self.assertEqual(tuned["policy"]["max_recovery_dispatches_per_run"], 0)

    def test_per_workflow_learning_makes_failed_workflow_faster_and_first(self):
        state = {
            "failure_score": 3.0,
            "reward_score": 1.0,
            "pending_failures": {"autonomous-codegen-loop.yml": {"kind": "failure"}},
            "history": [
                {
                    "event": "stop_observed",
                    "workflow": "autonomous-codegen-loop.yml",
                    "signal": {"failure_weight": 1.0},
                },
                {
                    "event": "stop_observed",
                    "workflow": "autonomous-codegen-loop.yml",
                    "signal": {"failure_weight": 1.0},
                },
                {
                    "event": "safe_recovery",
                    "workflow": "meta-consciousness.yml",
                    "reward": 2.0,
                },
            ],
        }
        tuning = derive_recovery_tuning(state, REGISTRY, {})
        tuned = apply_tuning(REGISTRY, tuning)
        self.assertEqual(tuned["workers"][0]["id"], "x")
        self.assertGreater(tuned["workers"][0]["recovery_priority"], tuned["workers"][1]["recovery_priority"])
        self.assertLess(tuned["workers"][0]["learned_stale_multiplier"], tuned["workers"][1]["learned_stale_multiplier"])

    def test_dynamic_workers_receive_same_learned_strategy(self):
        tuning = {
            "enabled": True,
            "active_controls": [],
            "stale_after_multiplier": 0.8,
            "workflow_stale_after_multiplier": {
                "autonomous-codegen-loop.yml": 0.4,
                "meta-consciousness.yml": 0.9,
            },
            "workflow_priority": {
                "autonomous-codegen-loop.yml": 90,
                "meta-consciousness.yml": 20,
            },
        }
        dynamic = {
            "workers": [
                {"id": "meta", "stale_after_seconds": 1000, "recovery": {"workflow": "meta-consciousness.yml"}},
                {"id": "x", "stale_after_seconds": 1000, "recovery": {"workflow": "autonomous-codegen-loop.yml"}},
            ]
        }
        tuned = apply_dynamic_tuning(dynamic, tuning)
        self.assertEqual(tuned["workers"][0]["id"], "x")
        self.assertEqual(tuned["workers"][0]["stale_after_seconds"], 400)


if __name__ == "__main__":
    unittest.main()
