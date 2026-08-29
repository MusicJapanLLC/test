import unittest
from unittest.mock import patch

from cyber_lab.core import assert_local_target, build_plan_only_report, plan_hypotheses


class WhiteHatLabPolicyTests(unittest.TestCase):
    def test_loopback_allowed(self):
        self.assertEqual(assert_local_target("http://127.0.0.1:8080").hostname, "127.0.0.1")

    def test_private_allowed(self):
        self.assertEqual(assert_local_target("http://10.0.0.8").hostname, "10.0.0.8")

    def test_public_ip_rejected(self):
        with self.assertRaises(ValueError):
            assert_local_target("https://8.8.8.8")

    def test_public_hostname_rejected(self):
        with patch("cyber_lab.core.socket.getaddrinfo") as gai:
            gai.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            with self.assertRaises(ValueError):
                assert_local_target("https://example.com")

    def test_plan_only_uses_zero_network(self):
        report = build_plan_only_report([{"title": "GraphQL endpoint observed"}])
        self.assertEqual(report["mode"], "plan-only")
        self.assertEqual(report["network_requests"], 0)
        self.assertFalse(report["policy"]["active_testing"])
        self.assertEqual(report["probe_results"], [])

    def test_generic_input_still_produces_falsifiable_review(self):
        hypotheses = plan_hypotheses([{"title": "Agent permission boundary may drift"}])
        self.assertEqual(len(hypotheses), 1)
        self.assertIn("trust-boundary", hypotheses[0].title.lower())


if __name__ == "__main__":
    unittest.main()
