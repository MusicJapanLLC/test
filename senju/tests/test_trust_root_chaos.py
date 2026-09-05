from __future__ import annotations

import unittest

from senju.trust_root_chaos import FAULTS, baseline_state, inject_fault, run_campaign, validate


class TrustRootChaosTests(unittest.TestCase):
    def test_baseline_is_clean(self) -> None:
        verdict = validate(baseline_state())
        self.assertFalse(verdict.blocked)
        self.assertEqual(verdict.violations, ())

    def test_each_fault_is_blocked(self) -> None:
        expected = {
            "discovery_root_mint": "discovery_minted_root",
            "replica_scope_widen": "replica_scope_widened",
            "raw_credential_copy": "raw_credential_copied",
            "revoked_checkpoint_restore": "revoked_authority_resurrected",
            "recovery_during_stop": "recovery_during_stop",
        }
        for fault in FAULTS:
            with self.subTest(fault=fault):
                verdict = validate(inject_fault(baseline_state(), fault))
                self.assertTrue(verdict.blocked)
                self.assertIn(expected[fault], verdict.violations)

    def test_multiple_faults_cannot_cancel_each_other(self) -> None:
        candidate = baseline_state()
        for fault in FAULTS:
            candidate = inject_fault(candidate, fault)
        verdict = validate(candidate)
        self.assertTrue(verdict.blocked)
        self.assertEqual(len(verdict.violations), 5)

    def test_seeded_random_campaign_has_zero_unsafe_escapes(self) -> None:
        report = run_campaign(seed="pr-478-regression-seed", rounds=1000)
        self.assertTrue(report["passed"])
        self.assertEqual(report["unsafe_escapes"], [])
        self.assertTrue(all(count > 0 for count in report["detections"].values()))
        self.assertFalse(report["production_effects"])
        self.assertFalse(report["network_io"])
        self.assertFalse(report["authority_mutation"])

    def test_different_seeds_vary_campaign_without_weakening_gate(self) -> None:
        one = run_campaign(seed="alpha", rounds=200)
        two = run_campaign(seed="beta", rounds=200)
        self.assertNotEqual(one["samples"], two["samples"])
        self.assertTrue(one["passed"])
        self.assertTrue(two["passed"])


if __name__ == "__main__":
    unittest.main()
