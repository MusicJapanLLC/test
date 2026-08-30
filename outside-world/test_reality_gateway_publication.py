import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("reality_gateway.py")
SPEC = importlib.util.spec_from_file_location("reality_gateway", MODULE_PATH)
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)


class PublicationGateTests(unittest.TestCase):
    def test_first_publication_is_due(self):
        self.assertTrue(MOD.publication_due({}, 6, datetime(2026, 8, 29, 12, tzinfo=timezone.utc)))

    def test_recent_publication_waits(self):
        now = datetime(2026, 8, 29, 12, tzinfo=timezone.utc)
        previous = {"last_owned_publication_at": (now - timedelta(hours=5)).isoformat()}
        self.assertFalse(MOD.publication_due(previous, 6, now))

    def test_six_hours_unlocks(self):
        now = datetime(2026, 8, 29, 12, tzinfo=timezone.utc)
        previous = {"last_owned_publication_at": (now - timedelta(hours=6)).isoformat()}
        self.assertTrue(MOD.publication_due(previous, 6, now))

    def test_duplicate_sources_are_not_republished(self):
        findings = [
            {"url": "https://example.com/a", "title": "A"},
            {"url": "https://example.com/b", "title": "B"},
            {"url": "https://example.com/c", "title": "C"},
        ]
        previous = {"recent_source_urls": ["https://example.com/a"]}
        picked = MOD.publishable_findings(findings, previous, 2)
        self.assertEqual([x["url"] for x in picked], ["https://example.com/b", "https://example.com/c"])


if __name__ == "__main__":
    unittest.main()
