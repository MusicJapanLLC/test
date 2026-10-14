import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("council", HERE / "council.py")
COUNCIL = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(COUNCIL)


class CovenantCouncilTests(unittest.TestCase):
    def test_repeated_failure_creates_rest_and_mutual_aid(self):
        snapshot = {
            "workers": [
                {
                    "agent": "FORGE",
                    "conclusion": "failure",
                    "report_quality": "BAD",
                    "run_attempt": 2,
                    "material_signal": True,
                    "verified_signal": False,
                    "manager_action": "NONE",
                }
            ],
            "unresolved": [{"agent": "FORGE", "reason": "test failed"}],
        }
        data, report = COUNCIL.build_council(snapshot)
        self.assertTrue(any(x["agent"] == "FORGE" for x in data["rest"]))
        self.assertTrue(any(x["helper"] in {"HOUND", "SKEPTIC"} for x in data["mutual_aid"]))
        self.assertTrue(data["ceo_attention_required"])
        self.assertIn("## COMMUNION", report)

    def test_unresolved_after_bounded_recovery_enters_sanctuary(self):
        snapshot = {
            "workers": [
                {
                    "agent": "HOUND",
                    "conclusion": "unresolved",
                    "report_quality": "RUN_EVIDENCE",
                    "run_attempt": 0,
                    "material_signal": True,
                    "verified_signal": False,
                    "manager_action": "DETERMINISTIC_RECOVERY",
                    "action_result": "UNRESOLVED",
                }
            ],
            "unresolved": [{"agent": "HOUND", "reason": "bounded recovery exhausted"}],
        }
        data, _ = COUNCIL.build_council(snapshot)
        rest = next(x for x in data["rest"] if x["agent"] == "HOUND")
        self.assertIn("未解決", rest["reason"])
        self.assertIn("仮説", rest["reentry"])
        self.assertTrue(any(x["helper"] == "SKEPTIC" for x in data["mutual_aid"]))

    def test_verified_healthy_worker_gets_bounded_autonomy(self):
        snapshot = {
            "workers": [
                {
                    "agent": "SKEPTIC",
                    "conclusion": "success",
                    "report_quality": "OK",
                    "run_attempt": 1,
                    "material_signal": False,
                    "verified_signal": True,
                    "manager_action": "NONE",
                }
            ],
            "unresolved": [],
        }
        data, _ = COUNCIL.build_council(snapshot)
        self.assertTrue(any(x["agent"] == "SKEPTIC" for x in data["autonomy"]))
        self.assertEqual(data["recommended_dispatches"], [])
        self.assertFalse(data["ceo_attention_required"])

    def test_missing_report_becomes_education_not_blame(self):
        snapshot = {
            "workers": [
                {
                    "agent": "HOUND",
                    "conclusion": "success",
                    "report_quality": "MISSING",
                    "run_attempt": 1,
                    "material_signal": False,
                    "verified_signal": False,
                    "manager_action": "NONE",
                }
            ],
            "unresolved": [],
        }
        data, _ = COUNCIL.build_council(snapshot)
        lesson = next(x for x in data["education"] if x["agent"] == "HOUND")
        self.assertIn("標準レポート", lesson["lesson"])


if __name__ == "__main__":
    unittest.main()
