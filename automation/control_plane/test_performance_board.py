import unittest

from automation.control_plane.performance_board import build


class PerformanceBoardTests(unittest.TestCase):
    def test_healthy_worker_is_champion(self):
        report = build({"workers": [{
            "id": "w1", "name": "Worker", "priority": "P1", "after": "HEALTHY",
            "score": 100, "actions": [], "reason": "ok"
        }]}, {})
        row = report["workers"][0]
        self.assertEqual(row["band"], "CHAMPION")
        self.assertEqual(row["low_streak"], 0)

    def test_repeated_unresolved_becomes_reassign(self):
        previous = {"workers": [{"id": "w1", "score": 5, "low_streak": 1}]}
        report = build({"workers": [{
            "id": "w1", "name": "Worker", "priority": "P0", "after": "UNRESOLVED",
            "score": 5, "actions": [], "reason": "still broken"
        }]}, previous)
        row = report["workers"][0]
        self.assertEqual(row["band"], "REASSIGN")
        self.assertEqual(row["low_streak"], 2)

    def test_recovery_action_is_not_treated_as_failure(self):
        report = build({"workers": [{
            "id": "w1", "name": "Worker", "priority": "P1", "after": "RECOVERING",
            "score": 65, "actions": ["accepted:rerun"], "reason": "recovering"
        }]}, {})
        row = report["workers"][0]
        self.assertGreaterEqual(row["score"], 65)
        self.assertNotEqual(row["band"], "REASSIGN")


if __name__ == "__main__":
    unittest.main()
