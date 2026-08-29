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
        data, _ = CHURCH.build_service({})
        self.assertFalse(data["ceo_attention_required"])
        self.assertEqual(data["service"], ["検証済み成果の祝福対象なし。活動量だけでは成果扱いしない"])


if __name__ == "__main__":
    unittest.main()
