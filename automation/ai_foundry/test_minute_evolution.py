import json
import tempfile
import unittest
from pathlib import Path

from automation.ai_foundry.minute_evolution import (
    FOCUS_ORDER,
    build_hourly_summary,
    evolve_once,
    initial_state,
    normalize_focus_bias,
    quality_vector,
    run_rounds,
)


class MinuteEvolutionTests(unittest.TestCase):
    def test_initial_state_has_bounded_strategy(self):
        state = initial_state()
        self.assertEqual(state["generation"], 0)
        self.assertIn("verification_depth", state["champion"]["params"])
        self.assertEqual(set(state["champion"]["quality_proxy"]), set(FOCUS_ORDER))

    def test_one_round_never_regresses_core_proxy_materially(self):
        before = initial_state()
        after = evolve_once(before, "unit-test")
        for key in ("correctness", "reliability", "security"):
            self.assertGreaterEqual(after["champion"]["quality_proxy"][key], before["champion"]["quality_proxy"][key] - 1.0)

    def test_rounds_are_deterministic_for_same_seed(self):
        start = initial_state()
        a = run_rounds(start, rounds=20, sleep_seconds=0, seed="same-seed")
        b = run_rounds(start, rounds=20, sleep_seconds=0, seed="same-seed")
        self.assertEqual(a["champion"]["params"], b["champion"]["params"])
        self.assertEqual(a["champion"]["quality_proxy"], b["champion"]["quality_proxy"])
        self.assertEqual(a["promotions"], b["promotions"])

    def test_security_assist_is_bounded_and_real(self):
        start = initial_state()
        after = run_rounds(start, rounds=9, sleep_seconds=0, seed="assist", focus_bias="security")
        assisted = [e for e in after["recent"] if e.get("assist_applied")]
        self.assertEqual(len(assisted), 3)
        self.assertTrue(all(e["focus"] == "security" for e in assisted))
        non_assisted = [e for e in after["recent"] if not e.get("assist_applied")]
        self.assertGreater(len(non_assisted), 0)

    def test_invalid_assist_focus_is_ignored(self):
        self.assertIsNone(normalize_focus_bias("not-a-focus"))
        after = evolve_once(initial_state(), "invalid", focus_bias="not-a-focus")
        self.assertFalse(after["recent"][-1]["assist_applied"])

    def test_hourly_summary_records_security_assist(self):
        start = initial_state()
        after = run_rounds(start, rounds=6, sleep_seconds=0, seed="summary-assist", focus_bias="reliability")
        summary = build_hourly_summary(start, after)
        self.assertEqual(summary["rounds"], 6)
        self.assertEqual(summary["security_assist_rounds"], 2)
        self.assertEqual(summary["security_assist_focuses"], ["reliability"])
        self.assertIn("report_fingerprint", summary)

    def test_hourly_summary_excludes_generation_from_fingerprint(self):
        start = initial_state()
        after = run_rounds(start, rounds=10, sleep_seconds=0, seed="summary")
        summary = build_hourly_summary(start, after)
        self.assertEqual(summary["rounds"], 10)
        self.assertIn("weakest_next_focus", summary)
        self.assertIn("Minute evolution changes engineering strategy state", summary["limitations"][0])

    def test_history_is_append_only_jsonl(self):
        with tempfile.TemporaryDirectory() as td:
            history = Path(td) / "history.jsonl"
            state = run_rounds(initial_state(), rounds=5, sleep_seconds=0, seed="history", history_path=history)
            rows = [json.loads(line) for line in history.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(rows), 5)
            self.assertEqual(rows[-1]["generation"], state["generation"])

    def test_quality_vector_stays_bounded(self):
        vector = quality_vector({
            "verification_depth": 5, "test_budget": 5, "adversarial_review": 4,
            "observability_depth": 5, "memory_reuse": 5, "artifact_priority": 5,
            "parallel_research": 5, "change_scope": 1, "exploration_rate": 0.05,
        })
        self.assertTrue(all(0 <= v <= 100 for v in vector.values()))


if __name__ == "__main__":
    unittest.main()
