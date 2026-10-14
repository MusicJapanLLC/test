import unittest

import autonomy_booster as ab


def policy():
    return {
        "schema": "the-world-autonomy-booster-policy/v2",
        "max_dispatches_per_cycle": 4,
        "minimum_interval_minutes": 5,
        "profiles": {
            "security": {"interval_multiplier": 2.4, "score_bonus": 90, "minimum_slots": 1},
            "evolution": {"interval_multiplier": 2.1, "score_bonus": 75, "minimum_slots": 1},
            "research": {"interval_multiplier": 1.9, "score_bonus": 60, "minimum_slots": 1},
            "operations": {"interval_multiplier": 1.3, "score_bonus": 15, "minimum_slots": 0}
        },
        "never_dispatch": ["the-world-autonomy-booster.yml"]
    }


class BoosterTests(unittest.TestCase):
    def test_profiles(self):
        self.assertEqual(ab.profile_for("SECURITY_GUARD", "security-guard.yml"), "security")
        self.assertEqual(ab.profile_for("WORLD_RESEARCH_FABRIC", "research.yml"), "research")
        self.assertEqual(ab.profile_for("WORLD_AGENT_FACTORY", "agent-factory.yml"), "evolution")
        self.assertEqual(ab.profile_for("GMAIL_SORTER", "gmail.yml"), "operations")

    def test_priority_profiles_get_shorter_interval(self):
        row = {"director_min_interval_minutes": 60}
        self.assertLess(ab.effective_interval(row, "security", policy()), 60)
        self.assertLess(ab.effective_interval(row, "evolution", policy()), 60)

    def test_choose_reserves_priority_slots(self):
        candidates = [
            ab.Candidate("sec", "sec.yml", "security", 1, 60, 25, 30, "completed", "success", 100, True, "due"),
            ab.Candidate("evo", "evo.yml", "evolution", 1, 60, 29, 30, "completed", "success", 99, True, "due"),
            ab.Candidate("res", "res.yml", "research", 1, 60, 32, 35, "completed", "success", 98, True, "due"),
            ab.Candidate("ops", "ops.yml", "operations", 999, 60, 46, 60, "completed", "success", 999, True, "due")
        ]
        chosen = ab.choose(candidates, policy())
        profiles = {candidate.profile for candidate in chosen}
        self.assertTrue({"security", "evolution", "research"}.issubset(profiles))
        self.assertEqual(len(chosen), 4)

    def test_never_run_worker_is_due(self):
        score, due, reason = ab.score_candidate(
            {"priority": 10}, profile="operations", age=None,
            conclusion=None, effective=30, policy=policy()
        )
        self.assertTrue(due)
        self.assertEqual(reason, "never_run")
        self.assertGreater(score, 100)

    def test_failed_worker_gets_priority_bonus(self):
        score, due, reason = ab.score_candidate(
            {"priority": 10}, profile="operations", age=1,
            conclusion="failure", effective=30, policy=policy()
        )
        self.assertTrue(due)
        self.assertEqual(reason, "failed")
        self.assertGreater(score, 120)


if __name__ == "__main__":
    unittest.main()
