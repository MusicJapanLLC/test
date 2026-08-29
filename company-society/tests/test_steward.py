from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "steward.py"
spec = importlib.util.spec_from_file_location("covenant_steward", MODULE_PATH)
steward = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(steward)


def inherited(worker_id: str) -> dict:
    return {
        "id": worker_id,
        "faith_duty": "truth_before_comfort",
        "vocation": "do useful work",
        "help_offered": ["evidence"],
        "help_wanted": ["specialist"],
        "recovery_protocol": "stop and narrow",
        "teach_back": "share one lesson",
    }


class StewardTests(unittest.TestCase):
    def test_faith_coverage_detects_missing_inheritance(self):
        registry = {
            "workers": [
                inherited("a"),
                {"id": "b", "faith_duty": "truth_before_comfort"},
            ]
        }
        result = steward.faith_coverage(registry)
        self.assertEqual(result["coverage_percent"], 50)
        self.assertEqual(result["missing_workers"], ["b"])
        self.assertIn("vocation", result["missing_inheritance"]["b"])
        self.assertEqual(result["status"], "MISSION_REQUIRED")

    def test_repeated_failure_enters_sabbath(self):
        state, reason = steward.sanctuary_state({
            "conclusion": "failure",
            "run_attempt": 2,
            "report_quality": "OK",
        })
        self.assertEqual(state, "SABBATH")
        self.assertIn("retry", reason)

    def test_worker_can_request_sabbath_conservatively(self):
        state, reason = steward.sanctuary_state({
            "conclusion": "success",
            "run_attempt": 1,
            "report_quality": "OK",
            "sanctuary_signal": "SABBATH",
        })
        self.assertEqual(state, "SABBATH")
        self.assertIn("worker", reason)

    def test_missing_report_enters_reflection(self):
        state, _ = steward.sanctuary_state({
            "conclusion": "success",
            "run_attempt": 1,
            "report_quality": "MISSING",
        })
        self.assertEqual(state, "REFLECTION")

    def test_verified_success_is_ready_and_teaches_back(self):
        worker = {
            "agent": "FORGE",
            "conclusion": "success",
            "run_attempt": 1,
            "report_quality": "OK",
            "verified_signal": True,
        }
        state, _ = steward.sanctuary_state(worker)
        self.assertEqual(state, "READY")
        self.assertIn("SKEPTIC", steward.teach_back(worker))

    def test_declared_verified_teach_back_is_preserved(self):
        worker = {
            "agent": "SKEPTIC",
            "conclusion": "success",
            "verified_signal": True,
            "teach_back": "Reuse this exact verification lesson",
        }
        self.assertEqual(steward.teach_back(worker), "Reuse this exact verification lesson")

    def test_bad_evidence_calls_truth_council(self):
        council = steward.council_for({
            "conclusion": "success",
            "report_quality": "BAD",
            "material_signal": True,
            "verified_signal": False,
            "run_attempt": 1,
        })
        self.assertIn("MANAGER", council["members"])
        self.assertIn("SKEPTIC", council["members"])

    def test_worker_help_request_is_added_to_council(self):
        council = steward.council_for({
            "conclusion": "success",
            "report_quality": "OK",
            "material_signal": False,
            "verified_signal": False,
            "run_attempt": 1,
            "help_request": "HOUND",
        })
        self.assertIn("HOUND", council["members"])
        self.assertEqual(council["requested_help"], "HOUND")

    def test_failure_calls_memory_and_repair_council(self):
        council = steward.council_for({
            "conclusion": "failure",
            "report_quality": "OK",
            "material_signal": True,
            "verified_signal": False,
            "run_attempt": 1,
        })
        self.assertIn("HOUND", council["members"])
        self.assertIn("FORGE", council["members"])


if __name__ == "__main__":
    unittest.main()
