import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from portfolio_batch_autobuilder import rank_batch, run_batch

JST = ZoneInfo("Asia/Tokyo")


class PortfolioBatchAutobuilderTest(unittest.TestCase):
    def program(self):
        return {
            "tracks": [
                {
                    "id": "SEC-PORT-001",
                    "title": "Generic Security Scan",
                    "priority": 1200,
                    "senju_focus": "robustness",
                    "hypothesis": "scan",
                    "deliverable": "scan",
                    "customer_usefulness": "scan",
                    "evidence_files": [],
                },
                {
                    "id": "SEC-PORT-009",
                    "title": "AI Agent Permission Boundary Lab",
                    "priority": 900,
                    "senju_focus": "robustness",
                    "hypothesis": "permissions",
                    "deliverable": "permission lab",
                    "customer_usefulness": "AI agent security",
                    "evidence_files": [],
                },
                {
                    "id": "SEC-PORT-010",
                    "title": "LLM Security Evaluation Harness",
                    "priority": 880,
                    "senju_focus": "learning",
                    "hypothesis": "eval",
                    "deliverable": "eval harness",
                    "customer_usefulness": "LLM security",
                    "evidence_files": [],
                },
                {
                    "id": "SEC-PORT-011",
                    "title": "Security Evidence Dashboard",
                    "priority": 850,
                    "senju_focus": "efficiency",
                    "hypothesis": "dashboard",
                    "deliverable": "dashboard",
                    "customer_usefulness": "evidence visibility",
                    "evidence_files": [],
                },
            ]
        }

    def test_ai_security_bias_moves_ai_tracks_to_front(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            rows = rank_batch(self.program(), root, "# Portfolio\n", 3)
            ids = [row["id"] for row in rows]
            self.assertEqual(ids[0], "SEC-PORT-009")
            self.assertIn("SEC-PORT-010", ids)
            self.assertEqual(len(ids), 3)

    def test_batch_builds_up_to_three_without_claiming_verified(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            result = run_batch(
                self.program(),
                root,
                "# Portfolio\n",
                datetime(2026, 8, 30, 8, 0, tzinfo=JST),
                3,
            )
            self.assertEqual(len(result["tracks"]), 3)
            self.assertFalse(result["verification_claimed"])
            self.assertTrue((root / "standment-security/PORTFOLIO_INDEX.md").exists())
            self.assertTrue((root / "standment-security/ai-security/agent-permission-boundary-lab.md").exists())
            self.assertTrue((root / "standment-security/ai-security/llm-security-eval-harness.md").exists())


if __name__ == "__main__":
    unittest.main()
