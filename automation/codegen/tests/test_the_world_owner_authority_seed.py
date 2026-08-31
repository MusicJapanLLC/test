from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from automation.codegen.seed_the_world_owner_authority import seed_explicit_owner_authority
from automation.codegen.engine.discovery_event_bus import load_discovery_events


class OwnerAuthoritySeedTests(unittest.TestCase):
    def test_seeds_only_explicit_authority_roots_and_syncs_policy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            state = Path(tmp) / "state"
            (root / "automation" / "codegen" / "meta_state").mkdir(parents=True)
            (root / "automation" / "codegen" / "meta_state" / "discovery_policy.json").write_text(
                json.dumps({"schema": "policy/test", "trusted_roots": ["owner.example"]}),
                encoding="utf-8",
            )
            (root / "AUTHORIZED_TEST_TARGETS.json").write_text(
                json.dumps(
                    {
                        "targets": [
                            {
                                "id": "owner-root",
                                "owner_authorization": "explicit",
                                "authorization_authority_root": True,
                                "base_url": "https://owner.example/",
                            },
                            {
                                "id": "linked-third-party",
                                "owner_authorization": "explicit",
                                "authorization_authority_root": False,
                                "base_url": "https://third-party.example/",
                            },
                            {
                                "id": "not-explicit",
                                "owner_authorization": "inferred",
                                "authorization_authority_root": True,
                                "base_url": "https://inferred.example/",
                            },
                        ]
                    }
                ),
                encoding="utf-8",
            )

            result = seed_explicit_owner_authority(state, root)
            self.assertEqual(result["seed_count"], 1)
            self.assertFalse(result["new_trust_roots_created"])
            events = load_discovery_events(state)
            self.assertEqual([event["host"] for event in events], ["owner.example"])
            copied = json.loads((state / "discovery_policy.json").read_text(encoding="utf-8"))
            self.assertEqual(copied["trusted_roots"], ["owner.example"])


if __name__ == "__main__":
    unittest.main()
