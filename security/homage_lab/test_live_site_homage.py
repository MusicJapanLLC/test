from __future__ import annotations

import unittest

from security.homage_lab.live_site_homage import (
    ALLOWED_HOSTS,
    LiveSignals,
    Observation,
    OwnedTopology,
    ScopeError,
    _assert_owned_https,
)


class ScopeTests(unittest.TestCase):
    def test_all_expected_owned_hosts_are_in_scope(self) -> None:
        self.assertEqual(
            ALLOWED_HOSTS,
            {
                "music-japan.com",
                "partners.music-japan.com",
                "secondtake.music-japan.com",
                "baton.music-japan.com",
            },
        )

    def test_rejects_non_https_and_third_party_hosts(self) -> None:
        with self.assertRaises(ScopeError):
            _assert_owned_https("http://music-japan.com/")
        with self.assertRaises(ScopeError):
            _assert_owned_https("https://example.com/")
        with self.assertRaises(ScopeError):
            _assert_owned_https("https://user:pass@music-japan.com/")


class SignalTests(unittest.TestCase):
    def _row(self, **changes: object) -> Observation:
        base = dict(
            url="https://music-japan.com/",
            final_url="https://music-japan.com/",
            status=200,
            latency_ms=350,
            content_type="text/html; charset=utf-8",
            bytes_sampled=12000,
            title="Music Japan",
            canonical="https://music-japan.com/",
            has_json_ld=True,
            has_open_graph=True,
            has_noindex=False,
            security_headers={
                "strict-transport-security": True,
                "content-security-policy": True,
                "x-content-type-options": True,
                "referrer-policy": True,
                "permissions-policy": True,
            },
            error=None,
        )
        base.update(changes)
        return Observation(**base)

    def test_healthy_site_becomes_baseline(self) -> None:
        result = LiveSignals().summarize([self._row()])
        self.assertEqual(result["reachable"], 1)
        self.assertEqual(result["recommendations"], ["record current production behavior as the next regression baseline"])

    def test_regressions_generate_defensive_recommendations(self) -> None:
        row = self._row(
            latency_ms=4000,
            canonical=None,
            has_json_ld=False,
            has_noindex=True,
            security_headers={
                "strict-transport-security": False,
                "content-security-policy": False,
                "x-content-type-options": False,
                "referrer-policy": False,
                "permissions-policy": False,
            },
        )
        result = LiveSignals().summarize([row])
        self.assertEqual(result["slow"], 1)
        self.assertEqual(result["missing_canonical"], 1)
        self.assertEqual(result["missing_json_ld"], 1)
        self.assertEqual(result["noindex_roots"], 1)
        self.assertGreaterEqual(len(result["recommendations"]), 5)


class TopologyTests(unittest.TestCase):
    def test_music_japan_reaches_all_owned_surfaces(self) -> None:
        summary = OwnedTopology().summarize()
        self.assertEqual(summary["music-japan.com"]["coverage"], 1.0)
        self.assertEqual(len(summary["music-japan.com"]["reachable"]), 4)


if __name__ == "__main__":
    unittest.main()
