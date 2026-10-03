import unittest

from monitoring.owned_site_drift import build_learning


def audit(body_hash: str, finding_type: str = "missing_security_header") -> dict:
    return {
        "schema": "owned-test-site-defensive-audit/v3",
        "targets": [
            {
                "origin": "https://example.test",
                "pages_checked": 1,
                "pages": [
                    {
                        "url": "https://example.test/",
                        "status": 200,
                        "body_sha256": body_hash,
                        "content_type": "text/html",
                        "title": "Example",
                        "technology_hints": [],
                        "findings": [
                            {"severity": "low", "type": finding_type, "detail": "x-frame-options"}
                        ],
                    }
                ],
            }
        ],
    }


class OwnedSiteDriftTests(unittest.TestCase):
    def test_first_run_uses_live_current_evidence(self) -> None:
        packet = build_learning(audit("a"), None)
        self.assertTrue(packet["live_evidence"])
        self.assertFalse(packet["simulation"])
        self.assertFalse(packet["previous_evidence_available"])
        self.assertEqual(packet["adaptive_follow_up_ranking"][0]["current_count"], 1)

    def test_detects_page_change_and_recurring_finding(self) -> None:
        packet = build_learning(audit("b"), audit("a"))
        target = packet["targets"][0]
        self.assertEqual(target["page_changes"][0]["change"], "modified")
        self.assertEqual(target["recurring_findings"][0]["type"], "missing_security_header")
        self.assertGreater(packet["adaptive_follow_up_ranking"][0]["follow_up_score"], 1)

    def test_detects_resolved_finding(self) -> None:
        current = audit("a")
        current["targets"][0]["pages"][0]["findings"] = []
        packet = build_learning(current, audit("a"))
        self.assertEqual(
            packet["targets"][0]["resolved_findings"][0]["type"],
            "missing_security_header",
        )


if __name__ == "__main__":
    unittest.main()
