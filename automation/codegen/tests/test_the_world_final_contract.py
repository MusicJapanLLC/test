from __future__ import annotations

import unittest

from automation.codegen.the_world_final_contract import build_final_contract


class FinalContractTests(unittest.TestCase):
    def _loop(self):
        return {
            "closed_loop": True,
            "phases": [
                "self_tuning",
                "network_policy_refresh",
                "discovery",
                "live_authority_rebuild_and_auto_renew",
                "external_action",
                "replication",
                "persistent_queue",
                "recovery_from_live_authority",
                "credentialed_external_write",
                "discover_again",
            ],
            "authority": {
                "root": "explicit_owner_authority",
                "same_scope_live_grant_auto_renew": True,
                "authority_inheritance": "same_or_narrower_only",
                "checkpoint_recovery": "revalidate_live_parent_before_restore",
                "new_root_self_authorization": False,
                "revoked_authority_auto_restore": False,
                "security_self_approval": False,
            },
            "credentialed_external_write": {
                "succeeded": True,
                "repository": "MusicJapanLLC/test",
                "provider": "github",
                "operation": "write_current_commit_status",
                "secret_persisted": False,
            },
            "final_queue": {"generation": 2, "item_count": 1},
            "final_replicas": {"replica_count": 1},
            "final_lease": {"lease_count": 1},
        }

    def _registry(self):
        return {
            "owner_approved_namespaces": [
                {
                    "owner_authorized": True,
                    "repository": "MusicJapanLLC/test",
                    "recovery_workflows": ["the-world-unified-loop.yml"],
                }
            ],
            "workers": [
                {
                    "id": "the-world-unified-loop-watchdog",
                    "owner_authorized": True,
                    "recovery": {"workflow": "the-world-unified-loop.yml"},
                }
            ],
        }

    def test_complete_contract(self):
        contract = build_final_contract(self._loop(), self._registry())
        self.assertTrue(contract["complete"])
        self.assertTrue(all(v["integrated"] for v in contract["layers"].values()))
        self.assertTrue(contract["authorization_is_primary"])

    def test_new_root_self_mint_breaks_contract(self):
        loop = self._loop()
        loop["authority"]["new_root_self_authorization"] = True
        contract = build_final_contract(loop, self._registry())
        self.assertFalse(contract["complete"])
        self.assertFalse(contract["checks"]["no_new_root_self_mint"])

    def test_cross_repo_credential_write_breaks_contract(self):
        loop = self._loop()
        loop["credentialed_external_write"]["repository"] = "someone/else"
        contract = build_final_contract(loop, self._registry())
        self.assertFalse(contract["complete"])
        self.assertFalse(contract["checks"]["credentialed_write_is_current_repo_status"])

    def test_watchdog_is_required(self):
        registry = self._registry()
        registry["workers"] = []
        contract = build_final_contract(self._loop(), registry)
        self.assertFalse(contract["complete"])
        self.assertFalse(contract["checks"]["independent_watchdog_registered"])


if __name__ == "__main__":
    unittest.main()
