import unittest

from automation.world import ai_security_joint_lab as joint


class JointLabTests(unittest.TestCase):
    def test_combines_ai_security_and_research_without_verification(self):
        packet = joint.build_packet(
            {"report_fingerprint": "ai-1", "weakest_next_focus": "reliability", "material_delta": True, "rounds": 120},
            {"run_id": "sec-1", "priority_next": {"lens_id": "RECOVERY", "stage": "RETEST", "artifact": "Recovery Pack", "next_improvement": "rerun"}},
            {"github_run_id": 9, "program_count": 2, "trial_count": 900, "cycles": [{"program_key": "RESILIENCE", "mode": "REPLICATE", "novelty": 0.4, "confidence": 0.7, "reproducibility": 0.9}]},
        )
        self.assertEqual(packet["status"], "BUILDING")
        self.assertEqual(packet["joint_focus"]["research_bias"], "RESILIENCE")
        self.assertIn("RECOVERY", packet["joint_question"])
        self.assertTrue(packet["promotion_blockers"])
        self.assertEqual(packet["owner_action"], "NONE")

    def test_missing_sources_fail_soft_and_are_deterministic(self):
        a = joint.build_packet({}, {}, {})
        b = joint.build_packet({}, {}, {})
        self.assertEqual(a["assist_seed"], b["assist_seed"])
        self.assertEqual(a["joint_focus"]["security_lens"], "UNKNOWN")
        self.assertEqual(a["status"], "BUILDING")

    def test_security_boundary_biases_governance(self):
        packet = joint.build_packet(
            {"weakest_next_focus": "architecture"},
            {"priority_next": {"lens_id": "AGENT-BOUNDARY", "stage": "FALSIFICATION", "artifact": "Agent Permission Boundary"}},
            {},
        )
        self.assertEqual(packet["joint_focus"]["research_bias"], "GOVERNANCE")


if __name__ == "__main__":
    unittest.main()
