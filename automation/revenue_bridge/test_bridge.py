import unittest

from automation.revenue_bridge.bridge import build, proof_strength


class RevenueBridgeTests(unittest.TestCase):
    def catalog(self):
        return {"products": [{
            "id": "p",
            "name": "Product",
            "monthly_yen": 30000,
            "setup_yen": 50000,
            "named_prospects": ["A", "B", "C"],
            "proof_mappings": {"security": "security proof"},
        }]}

    def strong_value(self):
        return {
            "pillars": {
                "operations": "healthy",
                "security": "guarded",
                "ai_evolution": "stable",
                "faith_to_value": "behavioral",
            },
            "manager": {"unresolved": 0},
        }

    def test_strong_verified_evidence_reaches_d4(self):
        value = self.strong_value()
        performance = {"summary": {"reassign_candidates": 0}}
        strength, evidence = proof_strength(value, performance)
        self.assertEqual(strength, 100)
        self.assertTrue(evidence)

        report = build(self.catalog(), value, performance, {})
        bridge = report["bridges"][0]
        self.assertEqual(bridge["revenue_distance"], "D5 -> D4")
        self.assertIn(bridge["named_prospect"], {"A", "B", "C"})
        self.assertEqual(report["real_revenue_yen"], 0)
        self.assertFalse(bridge["real_revenue"])

    def test_weak_evidence_does_not_invent_revenue(self):
        report = build(
            self.catalog(),
            {"pillars": {}, "manager": {"unresolved": 2}},
            {"summary": {"reassign_candidates": 1}},
            {},
        )
        bridge = report["bridges"][0]
        self.assertEqual(bridge["revenue_distance"], "D6 hold")
        self.assertIn("verified payment", bridge["commercial_claim_rule"])
        self.assertEqual(report["real_revenue_yen"], 0)

    def test_prospect_rotation(self):
        report = build(self.catalog(), {}, {}, {"prospect_cursor": 0})
        self.assertEqual(report["bridges"][0]["named_prospect"], "B")

    def test_verified_payment_is_d0_real_revenue(self):
        events = {"events": [{
            "product_id": "p",
            "prospect": "A",
            "stage": "payment",
            "amount_yen": 80000,
            "verified": True,
            "occurred_at": "2026-08-29T12:00:00Z",
        }]}
        report = build(self.catalog(), self.strong_value(), {"summary": {}}, {}, events)
        bridge = report["bridges"][0]
        self.assertEqual(bridge["named_prospect"], "A")
        self.assertEqual(bridge["revenue_distance"], "D0")
        self.assertTrue(bridge["real_revenue"])
        self.assertEqual(bridge["booked_cash_yen"], 80000)
        self.assertEqual(report["real_revenue_yen"], 80000)

    def test_verified_contract_is_d1_but_not_cash(self):
        events = {"events": [{
            "product_id": "p",
            "prospect": "A",
            "stage": "contract",
            "amount_yen": 80000,
            "verified": True,
            "occurred_at": "2026-08-29T12:00:00Z",
        }]}
        report = build(self.catalog(), self.strong_value(), {"summary": {}}, {}, events)
        bridge = report["bridges"][0]
        self.assertEqual(bridge["revenue_distance"], "D1")
        self.assertFalse(bridge["real_revenue"])
        self.assertEqual(bridge["booked_cash_yen"], 0)
        self.assertEqual(report["real_revenue_yen"], 0)

    def test_unverified_payment_is_ignored(self):
        events = {"events": [{
            "product_id": "p",
            "prospect": "A",
            "stage": "payment",
            "amount_yen": 80000,
            "verified": False,
            "occurred_at": "2026-08-29T12:00:00Z",
        }]}
        report = build(self.catalog(), self.strong_value(), {"summary": {}}, {}, events)
        bridge = report["bridges"][0]
        self.assertFalse(bridge["real_revenue"])
        self.assertEqual(report["real_revenue_yen"], 0)
        self.assertNotEqual(bridge["revenue_distance"], "D0")


if __name__ == "__main__":
    unittest.main()
