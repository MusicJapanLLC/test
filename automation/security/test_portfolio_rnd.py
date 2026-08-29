import tempfile
import unittest
from pathlib import Path

import portfolio_rnd


class PortfolioRndTests(unittest.TestCase):
    def test_prefers_high_priority_unfinished_security_portfolio_work(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "proof.md").write_text("proof", encoding="utf-8")
            portfolio = "## 3. Standment Security Scan v1\n\n**状態: BUILDING**\n"
            program = {
                "mission": "test",
                "portfolio_first": True,
                "promotion_gate": {
                    "human_inspectable_artifact_required": True,
                    "verification_evidence_required": True,
                    "counterevidence_required": True,
                    "reproducibility_required": True,
                },
                "tracks": [
                    {
                        "id": "SEC-PORT-001",
                        "title": "Scan",
                        "priority": 1000,
                        "senju_focus": "robustness",
                        "hypothesis": "h",
                        "deliverable": "d",
                        "customer_usefulness": "customer can inspect the result",
                        "evidence_files": ["proof.md"],
                    },
                    {
                        "id": "SEC-PORT-002",
                        "title": "Pack",
                        "priority": 960,
                        "senju_focus": "efficiency",
                        "hypothesis": "h2",
                        "deliverable": "d2",
                        "customer_usefulness": "customer can receive evidence",
                        "evidence_files": ["missing.md"],
                    },
                ],
            }
            report = portfolio_rnd.build_report(program, root, portfolio)
            self.assertIn(report["selected"]["id"], {"SEC-PORT-001", "SEC-PORT-002"})
            self.assertTrue(report["portfolio_first"])
            self.assertFalse(report["promotion_ready"])
            self.assertIn(report["next_research"]["focus"], portfolio_rnd.ALLOWED_SENJU_FOCUS)
            self.assertNotIn("target", report["next_research"])
            self.assertNotIn("credential", report["next_research"])
            self.assertTrue(report["report_key"])
            self.assertEqual(report["delta"]["kind"], "BASELINE_CAPTURED")
            self.assertEqual(report["stagnation_streak"], 0)

    def test_status_does_not_bleed_from_neighboring_verified_section(self):
        portfolio = (
            "## 3. Standment Security Scan v1\n\n"
            "**状態: BUILDING**\n\n"
            "Scan is not verified yet.\n\n"
            "## 4. Another Artifact\n\n"
            "**状態: VERIFIED**\n"
        )
        self.assertEqual(
            portfolio_rnd.section_status(portfolio, "## 3. Standment Security Scan v1"),
            "BUILDING",
        )

    def test_missing_dedicated_section_stays_absent_despite_incidental_mention(self):
        portfolio = (
            "## 1. Existing Artifact\n\n"
            "**状態: VERIFIED**\n"
            "Next we may create a Standment Security Evidence Pack later.\n"
        )
        self.assertEqual(
            portfolio_rnd.section_status(portfolio, "## Standment Security Evidence Pack"),
            "ABSENT",
        )

    def test_rejects_unbounded_senju_focus(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            track = {
                "id": "SEC-X",
                "title": "bad",
                "priority": 1,
                "senju_focus": "exploit",
                "hypothesis": "x",
                "deliverable": "x",
                "customer_usefulness": "x",
                "evidence_files": [],
            }
            with self.assertRaises(ValueError):
                portfolio_rnd.inspect_track(root, "", track)

    def test_generated_research_item_is_bridge_compatible(self):
        selected = {
            "id": "SEC-PORT-001",
            "title": "Security Scan",
            "priority": 1000,
            "portfolio_status": "BUILDING",
            "evidence_missing": [],
            "senju_focus": "robustness",
            "hypothesis": "Improve reproducibility",
            "research_mode": "REFRAME_AND_COUNTEREVIDENCE",
        }
        item = portfolio_rnd.build_senju_item(selected)
        allowed = {
            "research_id", "title", "problem", "hypothesis", "focus", "priority",
            "candidate_count", "success", "commercial_bridge",
        }
        self.assertEqual(set(item), allowed)
        self.assertLessEqual(item["candidate_count"], 9)
        self.assertIn("REFRAME_AND_COUNTEREVIDENCE", item["problem"])

    def test_previous_run_creates_verified_evidence_delta(self):
        previous = {
            "selected": {
                "id": "SEC-PORT-001",
                "portfolio_status": "BUILDING",
                "evidence_ratio": 0.5,
                "evidence_present": ["a.md"],
            },
            "promotion_ready": False,
            "stagnation_streak": 0,
        }
        current = {
            "id": "SEC-PORT-001",
            "portfolio_status": "BUILDING",
            "evidence_ratio": 1.0,
            "evidence_present": ["a.md", "b.md"],
        }
        delta = portfolio_rnd.compare_previous(previous, current, False)
        self.assertEqual(delta["kind"], "VERIFIED_PORTFOLIO_DELTA")
        self.assertEqual(delta["new_evidence"], ["b.md"])
        self.assertEqual(delta["evidence_delta"], 0.5)
        self.assertEqual(delta["stagnation_streak"], 0)

    def test_stagnation_changes_research_mode_instead_of_repeating_claim(self):
        previous = {
            "selected": {
                "id": "SEC-PORT-001",
                "portfolio_status": "BUILDING",
                "evidence_ratio": 0.5,
                "evidence_present": ["a.md"],
            },
            "promotion_ready": False,
            "stagnation_streak": 2,
        }
        current = {
            "id": "SEC-PORT-001",
            "portfolio_status": "BUILDING",
            "evidence_ratio": 0.5,
            "evidence_present": ["a.md"],
        }
        delta = portfolio_rnd.compare_previous(previous, current, False)
        self.assertEqual(delta["kind"], "NO_VERIFIED_DELTA")
        self.assertEqual(delta["stagnation_streak"], 3)
        self.assertEqual(delta["research_mode"], "SWITCH_EVIDENCE_PATH")

    def test_north_star_counts_verified_and_inspectable_tracks(self):
        rows = [
            {"portfolio_status": "VERIFIED", "evidence_ratio": 1.0},
            {"portfolio_status": "BUILDING", "evidence_ratio": 0.5},
            {"portfolio_status": "ABSENT", "evidence_ratio": 0.0},
        ]
        ns = portfolio_rnd.build_north_star(rows)
        self.assertEqual(ns["tracks_total"], 3)
        self.assertEqual(ns["tracks_inspectable"], 2)
        self.assertEqual(ns["tracks_verified"], 1)
        self.assertEqual(ns["tracks_full_evidence"], 1)
        self.assertEqual(ns["unfinished_tracks"], 2)

    def test_slack_report_contains_mandatory_delta_fields(self):
        report = {
            "report_key": "SEC-PORT-001:BUILDING:67:0:1",
            "selected": {
                "id": "SEC-PORT-001",
                "title": "Security Scan",
                "portfolio_status": "BUILDING",
                "evidence_ratio": 0.67,
                "evidence_missing": ["proof.md"],
                "senju_focus": "robustness",
                "deliverable": "Before/After evidence pack",
                "customer_usefulness": "Buyer can inspect the result",
            },
            "promotion_ready": False,
            "counterevidence_questions": ["falsify?", "reproduce?", "readable?"],
            "delta": {
                "kind": "NO_VERIFIED_DELTA",
                "research_mode": "VERIFY_NEXT_MISSING_EVIDENCE",
                "before": {"track_id": "SEC-PORT-001", "status": "BUILDING", "evidence_ratio": 0.67, "promotion_ready": False},
                "after": {"track_id": "SEC-PORT-001", "status": "BUILDING", "evidence_ratio": 0.67, "promotion_ready": False},
                "evidence_delta": 0.0,
                "new_evidence": [],
                "lost_evidence": [],
            },
            "north_star": {
                "tracks_total": 8,
                "tracks_inspectable": 2,
                "tracks_verified": 0,
                "tracks_full_evidence": 1,
                "average_evidence_ratio": 0.42,
            },
            "stagnation_streak": 1,
            "capability_gain": "No new portfolio capability was proven in this cycle.",
            "owner_benefit": "Owner sees real movement.",
            "business_effect": "Buyer can inspect the result.",
        }
        text = portfolio_rnd.render(report)
        for label in (
            "Before → After",
            "何が変わった？",
            "実物は何？",
            "検証結果",
            "North Star",
            "何に使える？",
            "Owner benefit",
            "失敗・反証",
            "現在ステータス",
            "次に自動でやること",
            "Success criteria",
            "Owner action",
        ):
            self.assertIn(label, text)


if __name__ == "__main__":
    unittest.main()
