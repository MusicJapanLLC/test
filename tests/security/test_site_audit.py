import unittest

from scripts.security.site_audit import (
    Finding,
    ResponseSnapshot,
    audit_target,
    calculate_score,
    grade_for_score,
    inspect_headers,
)


class SiteAuditScoreTests(unittest.TestCase):
    def test_clean_score_is_100(self):
        self.assertEqual(calculate_score([]), 100)
        self.assertEqual(grade_for_score(100), "A")

    def test_penalties_are_applied_and_clamped(self):
        findings = [
            Finding("HIGH", "x", "x", "x", "x", 15),
            Finding("MEDIUM", "y", "y", "y", "y", 6),
        ]
        self.assertEqual(calculate_score(findings), 79)
        self.assertEqual(grade_for_score(79), "C")

    def test_score_cannot_go_below_zero(self):
        findings = [Finding("CRITICAL", str(i), "x", "x", "x", 30) for i in range(10)]
        self.assertEqual(calculate_score(findings), 0)
        self.assertEqual(grade_for_score(0), "F")

    def test_unauthorized_target_is_refused_before_network_access(self):
        with self.assertRaises(ValueError):
            audit_target({"id": "not-authorized", "url": "https://example.com", "authorized": False})


class SiteAuditHeaderTests(unittest.TestCase):
    def _secure_headers(self):
        return {
            "strict-transport-security": "max-age=31536000",
            "content-security-policy": "default-src 'self'; script-src 'self'; frame-ancestors 'none'",
            "x-content-type-options": "nosniff",
            "referrer-policy": "strict-origin-when-cross-origin",
            "permissions-policy": "camera=()",
            "cross-origin-opener-policy": "same-origin",
        }

    def test_public_wildcard_cors_alone_is_not_scored_as_vulnerability(self):
        headers = self._secure_headers()
        headers["access-control-allow-origin"] = "*"
        findings = []
        inspect_headers(ResponseSnapshot(200, "https://example.com/", headers, [], b""), findings)
        self.assertFalse(any(f.code.startswith("cors.") for f in findings))

    def test_wildcard_cors_with_credentials_is_flagged(self):
        headers = self._secure_headers()
        headers["access-control-allow-origin"] = "*"
        headers["access-control-allow-credentials"] = "true"
        findings = []
        inspect_headers(ResponseSnapshot(200, "https://example.com/", headers, [], b""), findings)
        self.assertTrue(any(f.code == "cors.wildcard-with-credentials" and f.severity == "HIGH" for f in findings))


if __name__ == "__main__":
    unittest.main()
