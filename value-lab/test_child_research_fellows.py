import unittest

from child_research_fellows import build_sparks, choose_challenge_focus


REGISTRY = {
    "shared_rules": {"credential_or_secret_access": False},
    "members": [{"id": f"CHILD-{i:02d}", "name": f"Kid{i:02d}"} for i in range(1, 51)],
}
QUEUE = {"active": [{
    "research_id": "RND-1", "title": "Robustness", "focus": "robustness", "priority": 100,
}]}


class ChildResearchFellowsTests(unittest.TestCase):
    def test_three_fictional_fellows_generate_bounded_spark(self):
        sparks = build_sparks(REGISTRY, QUEUE, {"shadow_champion": {"holdout": {
            "worst_balance": 0.7, "worst_learning_signal": 1.0, "score_stdev": 10.0,
        }}}, "seed-1")
        self.assertTrue(sparks["fictional_personas"])
        self.assertEqual(len(sparks["fellows"]), 3)
        self.assertEqual(len({x["id"] for x in sparks["fellows"]}), 3)
        self.assertIn(sparks["challenge_focus"], {"robustness", "learning", "balance", "efficiency"})
        self.assertEqual(sparks["candidate_bonus"], 1)
        self.assertEqual(len(sparks["questions"]), 3)

    def test_visible_weakness_drives_challenge(self):
        focus, _ = choose_challenge_focus({"focus": "robustness"}, {"shadow_champion": {"holdout": {
            "worst_balance": 0.4, "worst_learning_signal": 1.0, "score_stdev": 2.0,
        }}})
        self.assertEqual(focus, "balance")

    def test_secret_boundary_must_be_locked(self):
        unsafe = dict(REGISTRY)
        unsafe["shared_rules"] = {"credential_or_secret_access": True}
        with self.assertRaises(ValueError):
            build_sparks(unsafe, QUEUE, {}, "seed-2")


if __name__ == "__main__":
    unittest.main()
