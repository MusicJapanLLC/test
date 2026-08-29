import unittest
from unittest.mock import patch

from cyber_lab.core import assert_local_target, build_plan_only_report, plan_hypotheses


class PolicyTests(unittest.TestCase):
    def test_loopback_allowed(self):
        parsed = assert_local_target("http://127.0.0.1:3000")
        self.assertEqual(parsed.hostname, "127.0.0.1")

    def test_private_allowed(self):
        parsed = assert_local_target("http://10.10.0.5")
        self.assertEqual(parsed.hostname, "10.10.0.5")

    def test_public_ip_blocked(self):
        with self.assertRaises(ValueError):
            assert_local_target("https://8.8.8.8")

    def test_public_hostname_blocked(self):
        with patch("cyber_lab.core.socket.getaddrinfo") as gai:
            gai.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            with self.assertRaises(ValueError):
                assert_local_target("https://example.com")

    def test_graphql_hypotheses(self):
        hypotheses = plan_hypotheses([{"title": "GraphQL endpoint", "path": "/graphql"}])
        self.assertTrue(any("GraphQL" in hypothesis.title for hypothesis in hypotheses))

    def test_plan_only_never_uses_network(self):
        report = build_plan_only_report(
            [
                {"title": "GraphQL endpoint", "path": "/graphql"},
                {"title": "Permissions-Policy未設定"},
            ]
        )
        self.assertEqual(report["mode"], "plan-only")
        self.assertEqual(report["network_requests"], 0)
        self.assertFalse(report["policy"]["active_testing"])
        self.assertEqual(report["probe_results"], [])
        self.assertGreaterEqual(report["analysis"]["hypothesis_count"], 2)


if __name__ == "__main__":
    unittest.main()
