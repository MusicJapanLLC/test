import unittest

from automation.revenue_bridge.bridge import build, proof_strength


class RevenueBridgeTests(unittest.TestCase):
    def test_strong_verified_evidence_reaches_d4(self):
        value = {
            "pillars": {"operations": "healthy", "security": "guarded", "ai_evolution": "stable", "faith_to_value": "behavioral"},
            "manager": {"unresolved": 0},
        }
        performance = {"summary": {"reassign_candidates": 0}}
        strength, evidence = proof_strength(value, performance)
        self.assertEqual(strength, 100)
        self.assertTrue(evidence)

        catalog = {"products": [{
            "id": "p", "name": "Product", "monthly_yen": 30000, "setup_yen": 50000,
            "named_prospects": ["A", "B"],
            "proof_mappings": {"security": "security proof"},
        }]}
        report = build(catalog, value, performance, {})
        bridge = report["bridges"][0]
        self.assertEqual(bridge["revenue_distance"], "D5 -> D4")
        self.assertIn(bridge["named_prospect"], {"A", "B"})

    def test_weak_evidence_does_not_invent_revenue(self):
        catalog = {"products": [{
            "id": "p", "name": "Product", "monthly_yen": 30000,
            "named_prospects": ["A"], "proof_mappings": {}
        }]}
        report = build(catalog, {"pillars": {}, "manager": {"unresolved": 2}}, {"summary": {"reassign_candidates": 1}}, {})
        bridge = report["bridges"][0]
        self.assertEqual(bridge["revenue_distance"], "D6 hold")
        self.assertIn("Do not call this revenue", bridge["commercial_claim_rule"])

    def test_prospect_rotation(self):
        catalog = {"products": [{
            "id": "p", "name": "Product", "monthly_yen": 30000,
            "named_prospects": ["A", "B", "C"], "proof_mappings": {}
        }]}
        report = build(catalog, {}, {}, {"prospect_cursor": 0})
        self.assertEqual(report["bridges"][0]["named_prospect"], "B")


if __name__ == "__main__":
    unittest.main()
