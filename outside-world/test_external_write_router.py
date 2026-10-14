import importlib.util
import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).with_name("external_write_router.py")
SPEC = importlib.util.spec_from_file_location("external_write_router", MODULE_PATH)
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)


class ExternalWriteRouterTests(unittest.TestCase):
    def setUp(self):
        self.events = {
            "findings": [
                {"url": "https://example.com/a", "title": "A", "note": "alpha", "citizen_id": "A"},
                {"url": "https://example.com/b", "title": "B", "note": "beta", "citizen_id": "B"},
            ]
        }

    def test_missing_credentials_make_target_incapable(self):
        cfg = {"platforms": [{"id": "dev", "kind": "devto", "enabled": True, "required_env": ["DEVTO_API_KEY"], "max_per_day": 1}]}
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(MOD.capable_targets(cfg, {}, datetime.now(timezone.utc)), [])

    def test_authorized_target_auto_posts_without_global_approval_gate(self):
        cfg = {
            "max_total_writes_per_run": 1,
            "platforms": [{"id": "dev", "kind": "devto", "enabled": True, "required_env": ["DEVTO_API_KEY"], "max_per_day": 1}],
        }
        with mock.patch.dict(os.environ, {"DEVTO_API_KEY": "secret"}, clear=True), mock.patch.dict(MOD.ADAPTERS, {"devto": lambda finding, target: {"http_status": 201, "remote_id": 7}}):
            receipts, state = MOD.execute(self.events, cfg, {})
        self.assertEqual(receipts[0]["status"], "POSTED")
        self.assertEqual(receipts[0]["platform"], "dev")
        self.assertEqual(len(state["history"]), 1)

    def test_dedupe_prevents_same_platform_source_repeat(self):
        now = datetime.now(timezone.utc).isoformat()
        previous = {"history": [{"platform": "dev", "source_url": "https://example.com/a", "at": now, "status": "POSTED"}]}
        cfg = {
            "max_total_writes_per_run": 2,
            "platforms": [{"id": "dev", "kind": "devto", "enabled": True, "required_env": ["DEVTO_API_KEY"], "max_per_day": 5}],
        }
        with mock.patch.dict(os.environ, {"DEVTO_API_KEY": "secret"}, clear=True), mock.patch.dict(MOD.ADAPTERS, {"devto": lambda finding, target: {"http_status": 201}}):
            receipts, _ = MOD.execute(self.events, cfg, previous)
        self.assertTrue(all(r["source_url"] != "https://example.com/a" for r in receipts))

    def test_daily_cap_blocks_target(self):
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        previous = {"history": [{"platform": "dev", "source_url": "https://x", "at": f"{day}T00:00:00+00:00", "status": "POSTED"}]}
        cfg = {"platforms": [{"id": "dev", "kind": "devto", "enabled": True, "required_env": ["DEVTO_API_KEY"], "max_per_day": 1}]}
        with mock.patch.dict(os.environ, {"DEVTO_API_KEY": "secret"}, clear=True):
            self.assertEqual(MOD.capable_targets(cfg, previous, datetime.now(timezone.utc)), [])

    def test_dry_run_has_no_adapter_side_effect(self):
        cfg = {
            "max_total_writes_per_run": 1,
            "platforms": [{"id": "dev", "kind": "devto", "enabled": True, "required_env": ["DEVTO_API_KEY"], "max_per_day": 1}],
        }
        with mock.patch.dict(os.environ, {"DEVTO_API_KEY": "secret"}, clear=True):
            receipts, state = MOD.execute(self.events, cfg, {}, dry_run=True)
        self.assertEqual(receipts[0]["status"], "DRY_RUN")
        self.assertEqual(state["history"], [])


if __name__ == "__main__":
    unittest.main()
