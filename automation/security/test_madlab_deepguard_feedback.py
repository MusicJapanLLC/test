import unittest

try:
    from automation.security.madlab_deepguard_feedback import sanitize
except ModuleNotFoundError:
    from madlab_deepguard_feedback import sanitize


BASE = {
    "schema": "madlab-research-handoff/v1",
    "authority": "priority_only",
    "permission_surface_unchanged": True,
    "external_scope_unchanged": True,
    "verification_claimed": False,
    "plans": 8,
    "remediation_runs": 3,
    "actions_attempted": 6,
    "actions_accepted": 5,
    "findings_resolved": 4,
    "top_bridge_gaps": [
        {"action_id": "hsts_profile", "count": 7},
        {"action_id": "dns_tls_profile", "count": 3},
    ],
}


class MadlabFeedbackTests(unittest.TestCase):
    def test_valid_feedback_is_priority_only_and_bounded(self):
        out = sanitize(BASE)
        self.assertEqual(out["authority"], "priority_only")
        self.assertTrue(out["permission_surface_unchanged"])
        self.assertTrue(out["external_scope_unchanged"])
        self.assertTrue(out["promotion_gate_unchanged"])
        self.assertTrue(out["verification_authority_unchanged"])
        self.assertLessEqual(out["track_pressure"]["SEC-PORT-012"], 500)
        self.assertIn("SEC-PORT-008", out["track_pressure"])
        self.assertIn("SEC-PORT-005", out["track_pressure"])
        self.assertEqual(out["runtime"]["acceptance_rate"], 0.8333)
        self.assertEqual(out["runtime"]["resolution_rate"], 0.8)

    def test_rejects_sensitive_target_or_secret_fields(self):
        for key in ("target", "url", "approval_code", "secret", "token", "password"):
            raw = {**BASE, key: "sensitive"}
            with self.assertRaises(ValueError):
                sanitize(raw)

    def test_rejects_authority_or_verification_expansion(self):
        bad_authority = {**BASE, "authority": "execute"}
        with self.assertRaises(ValueError):
            sanitize(bad_authority)
        bad_scope = {**BASE, "external_scope_unchanged": False}
        with self.assertRaises(ValueError):
            sanitize(bad_scope)
        bad_verify = {**BASE, "verification_claimed": True}
        with self.assertRaises(ValueError):
            sanitize(bad_verify)

    def test_invalid_action_ids_are_ignored(self):
        raw = {**BASE, "top_bridge_gaps": [{"action_id": "../../shell", "count": 99}]}
        out = sanitize(raw)
        self.assertEqual(out["top_bridge_gaps"], [])
        self.assertEqual(out["track_pressure"], {})


if __name__ == "__main__":
    unittest.main()
