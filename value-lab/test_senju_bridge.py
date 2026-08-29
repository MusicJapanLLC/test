import unittest

from senju_bridge import build_directive, build_exchange, choose_research


class SenjuBridgeTests(unittest.TestCase):
    def test_highest_priority_valid_research_wins(self):
        q = {"active": [
            {"research_id":"R1","title":"one","problem":"p","hypothesis":"h","focus":"learning","priority":1,"candidate_count":5,"success":{},"commercial_bridge":"technical evidence only"},
            {"research_id":"R2","title":"two","problem":"p","hypothesis":"h","focus":"robustness","priority":9,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only"},
        ]}
        self.assertEqual(choose_research(q)["research_id"], "R2")

    def test_research_prose_can_discuss_boundaries_without_becoming_directive_surface(self):
        q = {"active": [{
            "research_id":"R","title":"scope robustness","problem":"network variance in a simulator description",
            "hypothesis":"keep permission boundaries fixed while testing robustness","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        picked = choose_research(q)
        d = build_directive(picked)
        self.assertEqual(d["research_id"], "R")
        self.assertNotIn("target", d)
        self.assertNotIn("network", d)
        self.assertNotIn("permission", d)

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

    def test_stable_baseline_can_accept_child_challenge(self):
        q = {"active": [{
            "research_id":"R","title":"robust","problem":"p","hypothesis":"h","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        child = {
            "schema":"child-rnd-sparks/v1","fictional_personas":True,"research_id":"R","research_title":"robust",
            "current_focus":"robustness","challenge_focus":"efficiency","candidate_bonus":1,
            "fellows":[{"id":"CHILD-01","name":"Pixel","role":"WHY-KID"}],
            "questions":["why not efficiency?"],"reason":"healthy baseline","guardrail":"ideas only",
        }
        shadow = {"stable":True,"safe":True,"mean_score":200,"worst_score":150,"score_stdev":5,"worst_balance":0.8,"worst_learning_signal":1.0}
        report = build_exchange(q, {}, shadow, child)
        self.assertTrue(report["child_stimulus"]["applied"])
        self.assertEqual(report["directive_to_senju"]["focus"], "efficiency")
        self.assertEqual(report["directive_to_senju"]["candidate_count"], 8)

    def test_unstable_baseline_keeps_adult_rnd_focus(self):
        q = {"active": [{
            "research_id":"R","title":"robust","problem":"p","hypothesis":"h","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        child = {
            "schema":"child-rnd-sparks/v1","fictional_personas":True,"research_id":"R","research_title":"robust",
            "current_focus":"robustness","challenge_focus":"efficiency","candidate_bonus":1,
            "fellows":[],"questions":[],"reason":"try weird thing","guardrail":"ideas only",
        }
        report = build_exchange(q, {}, {"stable":False,"safe":True}, child)
        self.assertFalse(report["child_stimulus"]["applied"])
        self.assertEqual(report["directive_to_senju"]["focus"], "robustness")

    def test_child_cannot_smuggle_execution_surface(self):
        q = {"active": [{
            "research_id":"R","title":"robust","problem":"p","hypothesis":"h","focus":"robustness",
            "priority":10,"candidate_count":7,"success":{},"commercial_bridge":"technical evidence only",
        }]}
        child = {
            "schema":"child-rnd-sparks/v1","fictional_personas":True,"research_id":"R","challenge_focus":"efficiency",
            "candidate_bonus":1,"url":"https://example.com",
        }
        report = build_exchange(q, {}, {"stable":True,"safe":True}, child)
        self.assertFalse(report["child_stimulus"]["valid"])
        self.assertFalse(report["child_stimulus"]["applied"])
        self.assertNotIn("url", report["directive_to_senju"])


if __name__ == "__main__":
    unittest.main()
