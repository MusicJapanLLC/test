import unittest

from senju_bridge import build_directive, build_exchange, choose_research


class SenjuBridgeTests(unittest.TestCase):
    def test_highest_priority_valid_research_wins(self):
        q = {"active": [
            {"research_id":"R1","title":"one","problem":"p","hypothesis":"h","focus":"learning","priority":1,"candidate_count":5,"success":{},"commercial_bridge":"technical evidence only"},
            {"research_id":"R2","title":"two","problem":"p","hypothesis":"h","focus":"robustness","priority":9,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only"},
        ]}
        self.assertEqual(choose_research(q)["research_id"], "R2")

    def test_directive_is_bounded(self):
        d = build_directive({"research_id":"R","focus":"robustness","candidate_count":99,"hypothesis":"h"})
        self.assertEqual(d["candidate_count"], 9)
        self.assertEqual(set(d), {"schema","research_id","focus","candidate_count","hypothesis"})

    def test_exchange_never_turns_technical_score_into_revenue(self):
        q = {"active": [{
            "research_id":"R","title":"robust","problem":"p","hypothesis":"h","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        senju = {"selected":{"safe":True,"score":999}}
        shadow = {"stable":True,"safe":True,"mean_score":300,"worst_score":200,"score_stdev":4,"worst_balance":0.9,"worst_learning_signal":1.0}
        report = build_exchange(q, senju, shadow)
        self.assertEqual(report["market_truth"]["real_revenue_yen"], 0)
        self.assertFalse(report["market_truth"]["market_validated"])
        self.assertEqual(report["technical_evidence_from_senju"]["senju_score"], 999.0)

    def test_shadow_failure_becomes_counterevidence(self):
        q = {"active": [{
            "research_id":"R","title":"robust","problem":"p","hypothesis":"h","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        report = build_exchange(q, {}, {"stable":False,"safe":True,"worst_balance":0.2,"worst_learning_signal":0.4})
        self.assertTrue(report["counterevidence"])


if __name__ == "__main__":
    unittest.main()
