import unittest

import portfolio_daily_report as report


class PortfolioDailyReportTests(unittest.TestCase):
    def _plan(self, *, status="BUILDING", ratio=0.5, missing=None):
        return {
            "promotion_ready": False,
            "selected": {
                "id": "SEC-PORT-001",
                "title": "Security Scan",
                "research_score": 1100,
                "portfolio_status": status,
                "evidence_ratio": ratio,
                "evidence_missing": missing if missing is not None else ["proof-b.md"],
                "senju_focus": "robustness",
                "hypothesis": "Repeated dogfood should improve evidence quality.",
                "deliverable": "Before/after case study",
                "customer_problem": "Buyers cannot judge security claims without evidence.",
                "customer_value": "A readable before/after pack makes remediation verifiable.",
                "commercial_use": "Use as proof in a bounded security baseline engagement.",
                "success_criteria": "Readable artifact and repeatable verification.",
            },
        }

    def test_first_run_establishes_baseline_without_fake_delta(self):
        out = report.build_report(
            self._plan(),
            {"focus": "robustness"},
            {"selected": False, "reason": "no stable preliminary candidate", "candidate_count": 9, "holdout": None},
            {},
            {},
        )
        self.assertEqual(out["delta_type"], "FIRST_BASELINE")
        self.assertEqual(out["experiment_outcome"], "REJECTED_BY_SENJU")
        self.assertFalse(out["verified_delta"]["portfolio_maturity_changed"])
        self.assertIn("no stable preliminary candidate", out["negative_evidence"])

    def test_evidence_gain_is_reported_as_real_before_after(self):
        previous = self._plan(ratio=0.5, missing=["proof-a.md", "proof-b.md"])
        current = self._plan(ratio=1.0, missing=[])
        out = report.build_report(
            current,
            {"focus": "robustness"},
            {
                "selected": True,
                "reason": "stable preliminary winner passed unseen holdout",
                "candidate_count": 9,
                "holdout": {
                    "safe": True,
                    "stable": True,
                    "robust_score": 42.2,
                    "worst_score": 20.0,
                    "mean_score": 40.0,
                    "score_stdev": 3.0,
                    "worst_balance": 0.6,
                    "worst_learning_signal": 0.2,
                },
            },
            previous,
            {},
        )
        self.assertEqual(out["delta_type"], "EVIDENCE_GAIN")
        self.assertEqual(out["verified_delta"]["evidence_added"], ["proof-a.md", "proof-b.md"])
        self.assertTrue(out["verified_delta"]["portfolio_maturity_changed"])
        self.assertIn("50% -> 100%", out["executive_summary"])

    def test_regression_is_never_hidden(self):
        previous = self._plan(status="VERIFIED", ratio=1.0, missing=[])
        current = self._plan(status="BUILDING", ratio=0.5, missing=["proof.md"])
        out = report.build_report(current, {}, {}, previous, {})
        self.assertEqual(out["delta_type"], "REGRESSION")
        self.assertIn("regressed", out["executive_summary"])

    def test_render_contains_owner_reading_order(self):
        out = report.build_report(
            self._plan(),
            {"focus": "robustness"},
            {"selected": False, "reason": "rejected", "candidate_count": 9},
            {},
            {},
            run_url="https://example.test/run/1",
        )
        text = report.render(out)
        for marker in (
            "本日の結論",
            "何を研究したか",
            "BEFORE -> AFTER",
            "千寿でどう検証したか",
            "ポートフォリオに何が増えたか",
            "顧客・事業にどう効くか",
            "失敗・却下したもの",
            "まだ証明できていないこと",
            "次の24h",
            "Evidence",
        ):
            self.assertIn(marker, text)


if __name__ == "__main__":
    unittest.main()
