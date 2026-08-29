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
                "promotion_gate": {"human_inspectable_artifact_required": True},
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
        }
        item = portfolio_rnd.build_senju_item(selected)
        allowed = {
            "research_id", "title", "problem", "hypothesis", "focus", "priority",
            "candidate_count", "success", "commercial_bridge",
        }
        self.assertEqual(set(item), allowed)
        self.assertLessEqual(item["candidate_count"], 9)

    def test_slack_report_contains_mandatory_delta_fields(self):
        report = {
            "report_key": "SEC-PORT-001:BUILDING:67:0",
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
        }
        text = portfolio_rnd.render(report)
        for label in (
            "何が変わった？",
            "実物は何？",
            "検証結果",
            "何に使える？",
            "前回との違い",
            "失敗・反証",
            "現在ステータス",
            "次に自動でやること",
            "Owner action",
        ):
            self.assertIn(label, text)


if __name__ == "__main__":
    unittest.main()
