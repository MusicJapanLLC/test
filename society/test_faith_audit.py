import unittest

from faith_audit import build_report, validate_event


class FaithAuditTests(unittest.TestCase):
    def test_complete_confession_is_valid(self):
        event = {
            "type": "confession",
            "actor": "worker-x",
            "event": "reported success before verification",
            "impact": "misleading status",
            "evidence": "run 123 failed",
            "containment": "retracted claim",
            "repair": "reran checks",
            "verification": "run 124 passed",
            "lesson": "success requires independent verification",
        }
        self.assertEqual(validate_event(event), [])

    def test_rest_requires_resumable_handoff(self):
        event = {
            "type": "rest",
            "actor": "worker-x",
            "reason": "retry thrashing",
            "safe_state": "no active mutation",
            "handoff": "resume from run 124",
        }
        self.assertIn("missing:resume_condition", validate_event(event))

    def test_unresolved_manager_state_is_material(self):
        manager = {
            "workers": [
                {
                    "id": "worker-x",
                    "before": "FAILED",
                    "after": "UNRESOLVED",
                    "actions": [],
                }
            ]
        }
        report = build_report(manager, [])
        self.assertTrue(report["material_for_boss"])
        self.assertEqual(report["manager"]["unresolved"], 1)

    def test_successful_repair_counts_without_escalation(self):
        manager = {
            "workers": [
                {
                    "id": "worker-x",
                    "before": "FAILED",
                    "after": "RECOVERING",
                    "actions": ["accepted:dispatch:204:"],
                }
            ]
        }
        report = build_report(manager, [])
        self.assertFalse(report["material_for_boss"])
        self.assertEqual(report["manager_view"]["repairs"], 1)


if __name__ == "__main__":
    unittest.main()
