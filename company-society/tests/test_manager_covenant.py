from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[2] / "tomoki-agents" / "manager.py"
spec = importlib.util.spec_from_file_location("tomoki_manager", MODULE_PATH)
manager = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(manager)


class ManagerCovenantTests(unittest.TestCase):
    def test_extracts_machine_readable_signals_from_report_tail(self):
        report = "x" * 3000 + "\nSANCTUARY: SABBATH\nHELP_REQUEST: HOUND\nTEACH_BACK: one lesson\nPILGRIMAGE: one bounded task\n"
        signals = manager._extract_covenant_signals(report)
        self.assertEqual(signals["sanctuary_signal"], "SABBATH")
        self.assertEqual(signals["help_request"], "HOUND")
        self.assertEqual(signals["teach_back"], "one lesson")
        self.assertEqual(signals["pilgrimage"], "one bounded task")

    def test_invalid_signal_values_fail_closed(self):
        signals = manager._extract_covenant_signals(
            "SANCTUARY: PARTY\nHELP_REQUEST: CEO\nTEACH_BACK:\nPILGRIMAGE:\n"
        )
        self.assertEqual(signals["sanctuary_signal"], "UNKNOWN")
        self.assertEqual(signals["help_request"], "NONE")

    def test_plan_cannot_rerun_sabbath_worker(self):
        snapshot = {
            "workers": [
                {
                    "workflow": "tomoki-hound.yml",
                    "run_id": 123,
                    "manager_action": "NONE",
                    "sanctuary_signal": "SABBATH",
                }
            ]
        }
        plan = {"actions": [{"action": "rerun_failed", "run_id": 123, "reason": "retry"}]}
        self.assertEqual(manager._validate_plan(plan, snapshot), [])

    def test_plan_cannot_dispatch_sabbath_worker(self):
        snapshot = {
            "workers": [
                {
                    "workflow": "tomoki-skeptic.yml",
                    "run_id": 123,
                    "manager_action": "NONE",
                    "sanctuary_signal": "SABBATH",
                }
            ]
        }
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-skeptic.yml", "reason": "wake"}]}
        self.assertEqual(manager._validate_plan(plan, snapshot), [])

    def test_plan_can_dispatch_different_ready_specialist(self):
        snapshot = {
            "workers": [
                {
                    "workflow": "tomoki-hound.yml",
                    "run_id": 123,
                    "manager_action": "NONE",
                    "sanctuary_signal": "SABBATH",
                },
                {
                    "workflow": "tomoki-skeptic.yml",
                    "run_id": 456,
                    "manager_action": "NONE",
                    "sanctuary_signal": "READY",
                },
            ]
        }
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-skeptic.yml", "reason": "truth council"}]}
        accepted = manager._validate_plan(plan, snapshot)
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0]["workflow"], "tomoki-skeptic.yml")


if __name__ == "__main__":
    unittest.main()
