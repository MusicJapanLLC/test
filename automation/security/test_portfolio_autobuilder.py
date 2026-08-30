import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from portfolio_autobuilder import evolve

JST = ZoneInfo("Asia/Tokyo")


class PortfolioAutobuilderTest(unittest.TestCase):
    def test_creates_building_artifacts_without_fake_verification(self):
        report = {
            "selected": {
                "id": "SEC-PORT-001",
                "title": "Security Scan case study",
                "research_score": 1200,
                "portfolio_status": "BUILDING",
                "evidence_ratio": 0.5,
                "evidence_present": ["PORTFOLIO.md"],
                "evidence_missing": ["standment-security/case-studies/security-scan-before-after/README.md"],
                "senju_focus": "robustness",
                "deliverable": "Before/after defensive evidence",
                "customer_usefulness": "Buyer can inspect remediation proof",
            },
            "counterevidence_questions": ["Can an independent run reproduce the result?"],
        }
        program = {
            "tracks": [{
                "id": "SEC-PORT-001",
                "title": "Security Scan case study",
                "priority": 1000,
                "senju_focus": "robustness",
                "evidence_files": ["PORTFOLIO.md", "standment-security/case-studies/security-scan-before-after/README.md"],
            }]
        }

        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "PORTFOLIO.md").write_text("# Portfolio\n", encoding="utf-8")
            result = evolve(report, program, root, datetime(2026, 8, 30, 8, 0, tzinfo=JST))

            starter = root / "standment-security/case-studies/security-scan-before-after/README.md"
            note = root / "standment-security/lab-notes/2026-08-30/SEC-PORT-001.md"
            index = root / "standment-security/PORTFOLIO_INDEX.md"

            self.assertTrue(starter.exists())
            self.assertTrue(note.exists())
            self.assertTrue(index.exists())
            self.assertFalse(result["verification_claimed"])
            self.assertIn("状態: BUILDING", starter.read_text(encoding="utf-8"))
            self.assertNotIn("状態: VERIFIED", starter.read_text(encoding="utf-8"))
            self.assertIn("VERIFIEDは", index.read_text(encoding="utf-8"))

    def test_is_idempotent_for_same_day(self):
        report = {
            "selected": {
                "id": "SEC-PORT-009",
                "title": "AI Agent Permission Boundary Lab",
                "research_score": 900,
                "portfolio_status": "ABSENT",
                "evidence_ratio": 0.0,
                "evidence_present": [],
                "evidence_missing": [],
                "senju_focus": "robustness",
                "deliverable": "Permission-boundary evidence",
                "customer_usefulness": "Operator can inspect agent authority",
            },
            "counterevidence_questions": [],
        }
        program = {"tracks": [{
            "id": "SEC-PORT-009",
            "title": "AI Agent Permission Boundary Lab",
            "priority": 850,
            "senju_focus": "robustness",
            "evidence_files": [],
        }]}

        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            now = datetime(2026, 8, 30, 8, 0, tzinfo=JST)
            evolve(report, program, root, now)
            second = evolve(report, program, root, now)
            self.assertEqual(second["created_or_updated"], [])


if __name__ == "__main__":
    unittest.main()
