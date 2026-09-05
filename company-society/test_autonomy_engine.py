import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("autonomy_engine", HERE / "autonomy_engine.py")
ENGINE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(ENGINE)


class AutonomyEngineTests(unittest.TestCase):
    def test_repeated_failure_enters_sanctuary(self):
        mode, reason = ENGINE.choose_mode({"conclusion": "failure", "run_attempt": 2})
        self.assertEqual(mode, "SANCTUARY")
        self.assertIn("repeated failure", reason)

    def test_unverified_success_requests_verification(self):
        mode, _ = ENGINE.choose_mode({"conclusion": "success", "verified_signal": False})
        self.assertEqual(mode, "VERIFY")

    def test_weak_report_pairs(self):
        mode, _ = ENGINE.choose_mode({"report_quality": "BAD"})
        self.assertEqual(mode, "PAIR")

    def test_verified_worker_can_act(self):
        mode, _ = ENGINE.choose_mode({"verified_signal": True})
        self.assertEqual(mode, "ACT")

    def test_build_creates_fellowship_request(self):
        snapshot = {
            "workers": [
                {"id": "tomoki-skeptic", "conclusion": "success", "verified_signal": False}
            ],
            "unresolved": [],
        }
        registry = {
            "workers": [
                {"id": "tomoki-skeptic", "faith_duty": "truth_before_comfort"}
            ]
        }
        report = ENGINE.build(snapshot, registry)
        self.assertEqual(report["plans"][0]["mode"], "VERIFY")
        self.assertEqual(report["fellowship_requests"][0]["to"], "tomoki-hound")


if __name__ == "__main__":
    unittest.main()
