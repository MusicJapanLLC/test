import json
import tempfile
import unittest
from pathlib import Path

import portfolio_rnd


class PortfolioRndTests(unittest.TestCase):
    def test_prefers_high_priority_unfinished_security_portfolio_work(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "proof.md").write_text("proof", encoding="utf-8")
            portfolio = "## Standment Security Scan v1\n\n**状態: BUILDING**\n"
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
                        "evidence_files": ["proof.md"],
                    },
                    {
                        "id": "SEC-PORT-002",
                        "title": "Pack",
                        "priority": 960,
                        "senju_focus": "efficiency",
                        "hypothesis": "h2",
                        "deliverable": "d2",
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


if __name__ == "__main__":
    unittest.main()
