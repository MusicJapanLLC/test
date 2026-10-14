import unittest

from scripts.mass_shadow_factory import (
    _history_center,
    _micro_probe,
    _parameter_effects,
    _policy,
    _unique_candidates,
)


BASE = {
    "population": 120,
    "generations": 16,
    "matches": 440,
    "mutation_rate": 0.08,
    "red_budget": 16,
    "blue_budget": 16,
    "seed": 20260829,
}


class MassShadowFactoryTests(unittest.TestCase):
    def test_policy_caps_multiplier_at_100(self):
        p = _policy({"policy": {"trial_multiplier": 999, "exploration_rate": 9}})
        self.assertEqual(p["trial_multiplier"], 100)
        self.assertEqual(p["exploration_rate"], 0.80)

    def test_micro_probe_is_cheap_and_does_not_mutate_promotable_strategy(self):
        probe = _micro_probe(BASE)
        self.assertLessEqual(probe["population"], 24)
        self.assertLessEqual(probe["generations"], 2)
        self.assertLessEqual(probe["matches"], 48)
        self.assertEqual(BASE["population"], 120)

    def test_candidate_generation_is_deterministic_and_bounded(self):
        a = _unique_candidates(BASE, 30, 0.35)
        b = _unique_candidates(BASE, 30, 0.35)
        self.assertEqual(a, b)
        self.assertGreaterEqual(len(a), 20)
        for row in a:
            self.assertGreaterEqual(row["population"], 40)
            self.assertLessEqual(row["population"], 240)
            self.assertGreaterEqual(row["mutation_rate"], 0.05)
            self.assertLessEqual(row["mutation_rate"], 0.35)

    def test_history_biases_center_without_overriding_current_strategy(self):
        history = [{"score_improvement": 10, "selected_strategy": {**BASE, "population": 200}}]
        center, used = _history_center(BASE, history)
        self.assertEqual(used, 1)
        self.assertGreater(center["population"], BASE["population"])
        self.assertLess(center["population"], 200)

    def test_parameter_effects_returns_directional_evidence(self):
        reports = []
        for i in range(8):
            reports.append({"strategy": {**BASE, "matches": 200 + i * 50}, "robust_score": float(i * 10)})
        effects = _parameter_effects(reports)
        self.assertIn("matches", effects)
        self.assertEqual(effects["matches"]["direction"], "higher")
        self.assertGreater(effects["matches"]["correlation_with_robust_score"], 0.9)


if __name__ == "__main__":
    unittest.main()
