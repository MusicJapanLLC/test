import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from whitehat_portfolio_bridge import build

JST = ZoneInfo("Asia/Tokyo")


class WhitehatPortfolioBridgeTest(unittest.TestCase):
    def _fixture(self, root: Path):
        workers = root / "workers"
        workers.mkdir()
        plan = {
            "mission": {"research_id": "RND-STANDMENT-SECURITY-PORTFOLIO-001"},
            "security_track": {"id": "SEC-PORT-009", "title": "AI Agent Permission Boundary Lab"},
        }
        whitehat = {
            "schema": "agent-factory-worker/v1",
            "agent_id": "AF-1-03",
            "role": "elite_whitehat",
            "stance": "RED",
            "eligible": True,
            "score": 91,
            "hypothesis": "An owned agent fixture may exceed its declared tool boundary.",
            "evidence_refs": ["a.md", "b.md", "c.md"],
            "observations": ["authorization is required before active testing"],
            "counterevidence": ["the runtime may already fail closed"],
            "proposed_change": {
                "summary": "Add an explicit permission-boundary regression test.",
                "tests": ["deny undeclared tool", "allow declared read", "retest after remediation"],
                "expected_delta": "agent fails closed outside declared authority",
                "rollback": "revert the bounded test/control change",
            },
            "limitations": ["repository evidence is not runtime proof"],
        }
        (workers / "3.json").write_text(json.dumps(whitehat), encoding="utf-8")
        return plan, workers

    def test_creates_candidate_without_claiming_verification(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            plan, workers = self._fixture(root)
            outdir = root / "standment-security/whitehat-candidates"
            result = build(plan, workers, outdir, datetime(2026, 8, 30, 3, 0, tzinfo=JST))
            path = Path(result["candidate_path"])
            text = path.read_text(encoding="utf-8")
            self.assertTrue(result["created"])
            self.assertFalse(result["verification_claimed"])
            self.assertIn("WHITEHAT_CANDIDATE / NOT VERIFIED", text)
            self.assertIn("LIMITLESS MIND / BOUNDED EXECUTION", text)
            self.assertIn("SAFE_EXPERIMENT / RETEST CRITERIA", text)
            self.assertIn("CUSTOMER / REAL_WORLD_VALUE", text)

    def test_same_hypothesis_deduplicates(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            plan, workers = self._fixture(root)
            outdir = root / "candidates"
            now = datetime(2026, 8, 30, 3, 0, tzinfo=JST)
            first = build(plan, workers, outdir, now)
            second = build(plan, workers, outdir, now)
            self.assertTrue(first["created"])
            self.assertFalse(second["created"])
            self.assertEqual(first["fingerprint"], second["fingerprint"])

    def test_missing_whitehat_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            workers = root / "workers"
            workers.mkdir()
            (workers / "0.json").write_text(json.dumps({"role": "evidence_hunter"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                build({"mission": {"research_id": "RND-X"}}, workers, root / "out", datetime.now(JST))


if __name__ == "__main__":
    unittest.main()
