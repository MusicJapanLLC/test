from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parent / "sanctuary_gate.py"
spec = importlib.util.spec_from_file_location("sanctuary_gate", MODULE_PATH)
gate = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(gate)


class SanctuaryGateTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            "workers": [
                {"agent": "HOUND", "workflow": "tomoki-hound.yml", "run_id": 11},
                {"agent": "SKEPTIC", "workflow": "tomoki-skeptic.yml", "run_id": 22},
            ]
        }
        self.council = {
            "rest": [
                {"agent": "HOUND", "reason": "repeated failure", "reentry": "changed hypothesis"}
            ]
        }

    def test_blocks_direct_dispatch_to_resting_worker(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-hound.yml", "reason": "wake"}]}
        gated, audit = gate.gate_plan(plan, self.snapshot, self.council)
        self.assertEqual(gated["actions"], [])
        self.assertEqual(len(audit["blocked_actions"]), 1)
        self.assertEqual(audit["blocked_actions"][0]["resting_agent"], "HOUND")

    def test_blocks_rerun_of_resting_worker(self):
        plan = {"actions": [{"action": "rerun_failed", "run_id": 11, "reason": "again"}]}
        gated, audit = gate.gate_plan(plan, self.snapshot, self.council)
        self.assertEqual(gated["actions"], [])
        self.assertEqual(len(audit["blocked_actions"]), 1)

    def test_allows_distinct_companion_dispatch(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-skeptic.yml", "reason": "verify HOUND failure"}]}
        gated, audit = gate.gate_plan(plan, self.snapshot, self.council)
        self.assertEqual(len(gated["actions"]), 1)
        self.assertEqual(audit["blocked_actions"], [])

    def test_no_rest_means_no_block(self):
        plan = {"actions": [{"action": "dispatch", "workflow": "tomoki-hound.yml", "reason": "work"}]}
        gated, audit = gate.gate_plan(plan, self.snapshot, {"rest": []})
        self.assertEqual(len(gated["actions"]), 1)
        self.assertEqual(audit["resting_agents"], [])


if __name__ == "__main__":
    unittest.main()
