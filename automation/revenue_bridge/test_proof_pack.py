import unittest

from automation.revenue_bridge.proof_pack import classify, render


class ProofPackTests(unittest.TestCase):
    def test_strong_pack_is_sell_ready(self):
        bridge = {
            "proof_strength": 90,
            "buyer_proof": [{"claim": "A", "state": "guarded"}, {"claim": "B", "state": "stable"}],
            "evidence": ["e1", "e2", "e3"],
        }
        status, reasons = classify(bridge)
        self.assertEqual(status, "SELL_READY")
        self.assertEqual(reasons, [])

    def test_weak_pack_is_held(self):
        status, reasons = classify({"proof_strength": 50, "buyer_proof": [], "evidence": []})
        self.assertEqual(status, "HOLD_FOR_EVIDENCE")
        self.assertTrue(reasons)

    def test_truth_guard_never_turns_contract_into_cash(self):
        report = {
            "real_revenue_yen": 0,
            "bridges": [{
                "product": "Product",
                "named_prospect": "A",
                "proof_strength": 90,
                "revenue_distance": "D1",
                "verified_commercial_stage": "contract",
                "buyer_outcomes": ["Outcome"],
                "buyer_proof": [{"claim": "A", "state": "guarded"}, {"claim": "B", "state": "stable"}],
                "evidence": ["e1", "e2", "e3"],
                "next_action": "collect payment",
            }],
        }
        text = render(report)
        self.assertIn("現実売上: **¥0**", text)
        self.assertIn("contract", text)
        self.assertNotIn("現実売上: **¥80,000**", text)


if __name__ == "__main__":
    unittest.main()
