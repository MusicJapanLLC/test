import json
import tempfile
import unittest
from pathlib import Path

from automation.ai_foundry.minute_evolution import (
    FOCUS_ORDER,
    behavioral_gate,
    build_hourly_summary,
    evaluate_strategy,
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
        self.assertIn("strategy_eval", state["champion"])
        self.assertGreater(state["champion"]["strategy_eval"]["holdout"]["total"], 0)

    def test_one_round_never_regresses_core_proxy_materially(self):
        before = initial_state()
        after = evolve_once(before, "unit-test")
        for key in ("correctness", "reliability", "security"):
            self.assertGreaterEqual(
                after["champion"]["quality_proxy"][key],
                before["champion"]["quality_proxy"][key] - 1.0,
            )

    def test_rounds_are_deterministic_for_same_seed(self):
        start = initial_state()
        a = run_rounds(start, rounds=20, sleep_seconds=0, seed="same-seed")
        b = run_rounds(start, rounds=20, sleep_seconds=0, seed="same-seed")
        self.assertEqual(a["champion"]["params"], b["champion"]["params"])
        self.assertEqual(a["champion"]["quality_proxy"], b["champion"]["quality_proxy"])
        self.assertEqual(a["champion"]["strategy_eval"], b["champion"]["strategy_eval"])
        self.assertEqual(a["promotions"], b["promotions"])

    def test_strategy_eval_is_deterministic_and_split(self):
        params = initial_state()["champion"]["params"]
        a = evaluate_strategy(params)
        b = evaluate_strategy(params)
        self.assertEqual(a["fingerprint"], b["fingerprint"])
        self.assertEqual(a["visible"], b["visible"])
        self.assertEqual(a["holdout"], b["holdout"])
        self.assertEqual(a["visible"]["total"], 3)
        self.assertEqual(a["holdout"]["total"], 4)
        self.assertIn("not model capability", a["claim_boundary"])

    def test_proxy_improvement_cannot_trade_away_holdout_evidence(self):
        current = initial_state()["champion"]["params"]
        candidate = dict(current)
        # This candidate improves the weighted local proxy by increasing memory and
        # parallelism, but drops artifact priority. The holdout must veto it.
        candidate.update({"artifact_priority": 3, "memory_reuse": 4, "parallel_research": 4})
        self.assertGreater(
            sum(quality_vector(candidate).values()),
            sum(quality_vector(current).values()),
        )
        ok, reason, evidence = behavioral_gate(current, candidate)
        self.assertFalse(ok)
        self.assertEqual(reason, "behavioral_fixture_regression")
        self.assertIn("HOLDOUT-ARTIFACT-DISCIPLINE", evidence["regression_cases"])
        self.assertLess(evidence["holdout_delta"], 0)

    def test_behavioral_gate_accepts_non_regressing_strategy(self):
        current = initial_state()["champion"]["params"]
        candidate = dict(current)
        candidate["parallel_research"] = 4
        ok, reason, evidence = behavioral_gate(current, candidate)
        self.assertTrue(ok)
        self.assertEqual(reason, "behavioral_gate_pass")
        self.assertEqual(evidence["regression_cases"], [])
        self.assertGreaterEqual(evidence["holdout_delta"], 0)

    def test_priority_assist_is_exactly_one_of_three_rounds(self):
        start = initial_state()
        after = run_rounds(start, rounds=9, sleep_seconds=0, seed="assist", focus_bias="security")
        assisted = [e for e in after["recent"] if e.get("assist_applied")]
        self.assertEqual(len(assisted), 3)
        self.assertTrue(all(e["focus"] == "security" for e in assisted))
        self.assertTrue(all(e["assist_focus"] == "security" for e in assisted))
        self.assertGreater(len([e for e in after["recent"] if not e.get("assist_applied")]), 0)

    def test_assist_never_relaxes_core_or_holdout_regression_gates(self):
        before = initial_state()
        after = run_rounds(before, rounds=12, sleep_seconds=0, seed="gate-test", focus_bias="productization")
        for key in ("correctness", "reliability", "security"):
            self.assertGreaterEqual(
                after["champion"]["quality_proxy"][key],
                before["champion"]["quality_proxy"][key] - 1.0,
            )
        before_eval = evaluate_strategy(before["champion"]["params"])
        after_eval = evaluate_strategy(after["champion"]["params"])
        self.assertGreaterEqual(after_eval["visible"]["passed"], before_eval["visible"]["passed"])
        self.assertGreaterEqual(after_eval["holdout"]["passed"], before_eval["holdout"]["passed"])

    def test_invalid_assist_focus_is_ignored(self):
        self.assertIsNone(normalize_focus_bias("permission_override"))
        after = evolve_once(initial_state(), "invalid", focus_bias="permission_override")
        self.assertFalse(after["recent"][-1]["assist_applied"])

    def test_hourly_summary_records_assist_evidence(self):
        start = initial_state()
        after = run_rounds(start, rounds=6, sleep_seconds=0, seed="summary-assist", focus_bias="reliability")
        summary = build_hourly_summary(start, after)
        self.assertEqual(summary["security_assist_rounds"], 2)
        self.assertEqual(summary["security_assist_focuses"], ["reliability"])
        self.assertIn("priority-only", summary["limitations"][1])

    def test_hourly_summary_contains_stable_contract_and_holdout_evidence(self):
        start = initial_state()
        after = run_rounds(start, rounds=10, sleep_seconds=0, seed="summary")
        summary = build_hourly_summary(start, after)
        self.assertEqual(summary["rounds"], 10)
        self.assertIn("report_fingerprint", summary)
        self.assertIn("weakest_next_focus", summary)
        self.assertIn("strategy_fixture_delta", summary)
        self.assertIn("holdout", summary["strategy_fixture_summary"])
        self.assertEqual(summary["strategy_fixture_delta"]["regressed_cases"], [])
        self.assertIn("strategy state", summary["limitations"][0])
        self.assertIn("do not establish general model capability", summary["limitations"][2])

    def test_history_is_append_only_jsonl(self):
        with tempfile.TemporaryDirectory() as td:
            history = Path(td) / "history.jsonl"
            state = run_rounds(initial_state(), rounds=5, sleep_seconds=0, seed="history", history_path=history)
            rows = [json.loads(line) for line in history.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(rows), 5)
            self.assertEqual(rows[-1]["generation"], state["generation"])

    def test_quality_vector_stays_bounded(self):
        vector = quality_vector({
            "verification_depth": 5,
            "test_budget": 5,
            "adversarial_review": 4,
            "observability_depth": 5,
            "memory_reuse": 5,
            "artifact_priority": 5,
            "parallel_research": 5,
            "change_scope": 1,
            "exploration_rate": 0.05,
        })
        self.assertTrue(all(0 <= v <= 100 for v in vector.values()))


if __name__ == "__main__":
    unittest.main()
