import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("church", HERE / "church.py")
CHURCH = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(CHURCH)


class ChurchReportTests(unittest.TestCase):
    def test_verified_success_is_service(self):
        snapshot = {
            "workers": [
                {
                    "agent": "FORGE",
                    "status": "completed",
                    "conclusion": "success",
                    "report_quality": "OK",
                    "age_minutes": 5,
                    "manager_action": "NONE",
                    "action_result": "NONE",
                    "verified_signal": True,
                    "material_signal": False,
                    "run_attempt": 1,
                }
            ],
            "unresolved": [],
        }
        data, report = CHURCH.build_service(snapshot)
        self.assertIn("FORGE: 検証済みシグナルを伴う成功", data["service"])
        self.assertFalse(data["ceo_attention_required"])
        self.assertIn("## SERVICE", report)

    def test_unresolved_failure_requires_ceo_attention(self):
        snapshot = {
            "workers": [
                {
                    "agent": "HOUND",
                    "status": "completed",
                    "conclusion": "failure",
                    "report_quality": "BAD",
                    "age_minutes": 20,
                    "manager_action": "NONE",
                    "action_result": "NONE",
                    "verified_signal": False,
                    "material_signal": True,
                    "run_attempt": 2,
                }
            ],
            "unresolved": [{"agent": "HOUND", "reason": "retry budget exhausted"}],
        }
        data, _ = CHURCH.build_service(snapshot)
        self.assertTrue(data["ceo_attention_required"])
        self.assertTrue(any("未解決" in item for item in data["confession"]))
        self.assertTrue(any("休息" in item for item in data["rest"]))

    def test_empty_snapshot_stays_non_material(self):
        data, report = CHURCH.build_service({})
        self.assertFalse(data["ceo_attention_required"])
        self.assertEqual(data["service"], ["検証済み成果の祝福対象なし。活動量だけでは成果扱いしない"])
        self.assertEqual(data["schema"], "the-covenant-service/v3")
        self.assertIn("LIMITLESS MIND / BOUNDED EXECUTION", report)

    def test_research_freedom_fields_are_observed_without_invention(self):
        snapshot = {
            "workers": [
                {
                    "agent": "SKEPTIC",
                    "status": "completed",
                    "conclusion": "success",
                    "report_quality": "OK",
                    "age_minutes": 3,
                    "manager_action": "NONE",
                    "action_result": "NONE",
                    "verified_signal": True,
                    "material_signal": True,
                    "run_attempt": 1,
                    "research_question": "Does the inherited retry rule still reduce recovery time?",
                    "evidence_gained": "Three recent incidents recovered faster after changing the retry condition.",
                    "alternative_hypothesis": "The improvement may come from owner reassignment rather than retry count.",
                    "constraint_challenged": "Fixed retry count without an expiry/review condition.",
                }
            ],
            "unresolved": [],
        }
        data, report = CHURCH.build_service(snapshot)
        self.assertIn("SKEPTIC: Does the inherited retry rule still reduce recovery time?", data["research_question"])
        self.assertIn("SKEPTIC: Three recent incidents recovered faster after changing the retry condition.", data["evidence_gained"])
        self.assertTrue(any("owner reassignment" in item for item in data["dissent"]))
        self.assertTrue(any("Fixed retry count" in item for item in data["constraint_challenged"]))
        self.assertIn("## RESEARCH_QUESTION", report)
        self.assertIn("## EVIDENCE_GAINED", report)
        self.assertIn("## DISSENT", report)
        self.assertIn("## CONSTRAINT_CHALLENGED", report)


if __name__ == "__main__":
    unittest.main()
