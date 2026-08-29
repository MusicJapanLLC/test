import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("external_presence.py")
SPEC = importlib.util.spec_from_file_location("outside_world_external_presence", MODULE_PATH)
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)
build_plan = MOD.build_plan
decide_intent = MOD.decide_intent
credential_ref = MOD.credential_ref

POLICY = {
    "principle": "LIMITLESS_MIND_BOUNDED_EXECUTION",
    "automatic_read_actions": ["read_public", "watch_public"],
    "write_actions": ["post", "comment"],
    "account_actions": ["create_account"],
    "blocked_signals": ["access_control_bypass", "rate_limit_evasion", "deceptive_identity", "bulk_unsolicited"],
    "write_gate": {
        "require_terms_status": "allowed",
        "require_connector_authorized": True,
        "require_identity_non_deceptive": True,
        "require_target_scope": "authorized",
        "auto_requires_reversible": True,
    },
    "account_creation": {
        "approved_services": ["example-bot-platform"],
        "require_terms_status": "allowed",
        "require_connector_authorized": True,
        "require_secret_manager": True,
        "default_decision": "DRAFT_ONLY",
    },
    "mission_lanes": [
        {"id": "WEB", "action": "read_public", "objective": "look"},
        {"id": "VIDEO", "action": "watch_public", "objective": "watch"},
    ],
}


class ExternalPresenceTests(unittest.TestCase):
    def test_every_citizen_gets_profile_and_read_mission(self):
        snapshot = {
            "population": 3,
            "citizens": [
                {"citizen_id": "BOSS", "display_name": "Boss"},
                {"citizen_id": "FORGE", "display_name": "Forge"},
                {"citizen_id": "CHILD-01", "display_name": "Pixel"},
            ],
        }
        plan = build_plan(snapshot, POLICY, "cycle-1")
        self.assertEqual(plan["profiles_count"], 3)
        self.assertEqual(plan["missions_count"], 3)
        self.assertTrue(plan["invariants"]["default_missions_are_read_only"])
        self.assertEqual(len({p["credential_ref"] for p in plan["profiles"]}), 3)

    def test_credential_ref_contains_no_secret_material(self):
        ref = credential_ref("CHILD-01")
        self.assertTrue(ref.startswith("WORLD_AUTH_"))
        self.assertNotIn("CHILD-01", ref)

    def test_public_read_is_auto(self):
        d = decide_intent({"action": "read_public", "public": True}, POLICY)
        self.assertEqual(d["decision"], "ALLOW_AUTO")

    def test_write_requires_all_real_world_gates(self):
        d = decide_intent({
            "action": "post",
            "platform": "example",
            "terms_status": "allowed",
            "connector_authorized": True,
            "target_scope": "authorized",
            "adapter_available": True,
            "reversible": True,
        }, POLICY)
        self.assertEqual(d["decision"], "ALLOW_AUTO")

    def test_missing_adapter_is_draft_only(self):
        d = decide_intent({
            "action": "comment",
            "terms_status": "allowed",
            "connector_authorized": True,
            "target_scope": "authorized",
            "adapter_available": False,
            "reversible": True,
        }, POLICY)
        self.assertEqual(d["decision"], "DRAFT_ONLY")

    def test_bypass_signal_blocks_even_if_authorized(self):
        d = decide_intent({
            "action": "read_public",
            "public": True,
            "access_control_bypass": True,
        }, POLICY)
        self.assertEqual(d["decision"], "BLOCK")

    def test_account_creation_uses_approved_adapter_and_secret_manager(self):
        d = decide_intent({
            "action": "create_account",
            "platform": "example-bot-platform",
            "terms_status": "allowed",
            "connector_authorized": True,
            "secret_storage": "secret_manager",
        }, POLICY)
        self.assertEqual(d["decision"], "ALLOW_AUTO")

    def test_unapproved_account_creation_is_only_draft(self):
        d = decide_intent({
            "action": "create_account",
            "platform": "random-site",
            "terms_status": "allowed",
            "connector_authorized": True,
            "secret_storage": "secret_manager",
        }, POLICY)
        self.assertEqual(d["decision"], "DRAFT_ONLY")


if __name__ == "__main__":
    unittest.main()
