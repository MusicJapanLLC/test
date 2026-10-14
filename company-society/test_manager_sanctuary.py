from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tomoki-agents" / "manager.py"
spec = importlib.util.spec_from_file_location("tomoki_manager_for_covenant_test", MODULE_PATH)
manager = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = manager
spec.loader.exec_module(manager)


class ManagerSanctuaryTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            "workers": [
                {"agent": "HOUND", "workflow": "tomoki-hound.yml", "run_id": 11, "manager_action": "NONE"},
                {"agent": "SKEPTIC", "workflow": "tomoki-skeptic.yml", "run_id": 22, "manager_action": "NONE"},
            ]
        }
        self.council = {
            "rest": [
                {"agent": "HOUND", "reason": "連続失敗", "reentry": "仮説変更後"}
            ]
        }

    def test_direct_dispatch_to_resting_worker_is_blocked(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-hound.yml", "reason": "wake"}]}
        self.assertEqual(manager._validate_plan(plan, self.snapshot, self.council), [])

    def test_rerun_of_resting_worker_is_blocked(self):
        plan = {"actions": [{"action": "rerun_failed", "run_id": 11, "reason": "again"}]}
        self.assertEqual(manager._validate_plan(plan, self.snapshot, self.council), [])

    def test_distinct_companion_is_allowed(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-skeptic.yml", "reason": "verify for resting HOUND"}]}
        accepted = manager._validate_plan(plan, self.snapshot, self.council)
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0]["workflow"], "tomoki-skeptic.yml")

    def test_no_council_preserves_existing_behavior(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-hound.yml", "reason": "normal"}]}
        accepted = manager._validate_plan(plan, self.snapshot, {})
        self.assertEqual(len(accepted), 1)


if __name__ == "__main__":
    unittest.main()
