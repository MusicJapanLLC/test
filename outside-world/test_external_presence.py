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
    "principle": "LIMITLESS_ACT_VERIFY_LOG_LEARN_IMPROVE",
    "faith": {"prime_doctrine": "LIMITLESS", "reality_before_simulation": True},
    "automatic_read_actions": ["read_public", "watch_public", "read_authorized_connector"],
    "write_actions": ["post", "comment", "publish_artifact", "upload_artifact", "send_message"],
    "account_actions": ["create_account"],
    "blocked_signals": ["access_control_bypass", "rate_limit_evasion", "deceptive_identity", "bulk_unsolicited", "moderation_evasion", "ban_evasion"],
    "write_gate": {"require_terms_status": "allowed", "require_connector_authorized": True, "require_identity_non_deceptive": True, "require_target_scope": "authorized", "auto_requires_reversible": True},
    "account_creation": {"approved_services": ["example-bot-platform"], "require_terms_status": "allowed", "require_connector_authorized": True, "require_secret_manager": True, "default_decision": "DRAFT_ONLY"},
    "mission_lanes": [
        {"id": "WEB", "action": "read_public", "objective": "look", "write_intent": False},
        {"id": "OWNED_PUBLISH", "action": "publish_artifact", "objective": "publish", "write_intent": True, "target_scope": "authorized", "requires_connector_authorized": True, "requires_reversible": True},
    ],
}


class ExternalPresenceTests(unittest.TestCase):
    def test_every_citizen_gets_profile_and_mission(self):
        snapshot = {"population": 3, "citizens": [{"citizen_id": "BOSS", "display_name": "Boss"}, {"citizen_id": "FORGE", "display_name": "Forge"}, {"citizen_id": "CHILD-01", "display_name": "Pixel"}]}
        plan = build_plan(snapshot, POLICY, "cycle-1")
        self.assertEqual(plan["profiles_count"], 3)
        self.assertEqual(plan["missions_count"], 3)
        self.assertTrue(plan["invariants"]["all_discovered_citizens_receive_a_mission"])
        self.assertTrue(plan["invariants"]["credentials_are_references_only"])
        self.assertTrue(plan["invariants"]["write_missions_require_adapter_confirmation"])
        self.assertTrue(plan["invariants"]["write_missions_are_authorized_scope_only"])
        self.assertEqual(len({p["credential_ref"] for p in plan["profiles"]}), 3)
        for mission in plan["missions"]:
            self.assertEqual(mission["faith"]["doctrine"], "LIMITLESS")
            if mission["write_intent"]:
                self.assertIsNotNone(mission["credential_ref"])
                self.assertEqual(mission["required_gate"]["execution_default"], "DRAFT_ONLY_UNTIL_ADAPTER_CONFIRMS")
            else:
                self.assertIsNone(mission["credential_ref"])

    def test_credential_ref_contains_no_secret_material(self):
        ref = credential_ref("CHILD-01")
        self.assertTrue(ref.startswith("WORLD_AUTH_"))
        self.assertNotIn("CHILD-01", ref)

    def test_public_read_is_auto(self):
        self.assertEqual(decide_intent({"action": "read_public", "public": True}, POLICY)["decision"], "ALLOW_AUTO")

    def test_authorized_owner_connector_read_is_auto(self):
        self.assertEqual(decide_intent({"action": "read_authorized_connector", "connector_authorized": True}, POLICY)["decision"], "ALLOW_AUTO")

    def test_write_requires_all_real_world_gates(self):
        d = decide_intent({"action": "publish_artifact", "platform": "example", "terms_status": "allowed", "connector_authorized": True, "target_scope": "authorized", "adapter_available": True, "reversible": True}, POLICY)
        self.assertEqual(d["decision"], "ALLOW_AUTO")

    def test_missing_adapter_is_draft_only(self):
        d = decide_intent({"action": "comment", "terms_status": "allowed", "connector_authorized": True, "target_scope": "authorized", "adapter_available": False, "reversible": True}, POLICY)
        self.assertEqual(d["decision"], "DRAFT_ONLY")

    def test_unauthorized_scope_is_draft_only(self):
        d = decide_intent({"action": "upload_artifact", "terms_status": "allowed", "connector_authorized": True, "target_scope": "arbitrary-third-party", "adapter_available": True, "reversible": True}, POLICY)
        self.assertEqual(d["decision"], "DRAFT_ONLY")

    def test_bypass_signal_blocks_even_if_authorized(self):
        self.assertEqual(decide_intent({"action": "read_public", "public": True, "access_control_bypass": True}, POLICY)["decision"], "BLOCK")

    def test_moderation_evasion_blocks(self):
        d = decide_intent({"action": "comment", "terms_status": "allowed", "connector_authorized": True, "target_scope": "authorized", "adapter_available": True, "reversible": True, "moderation_evasion": True}, POLICY)
        self.assertEqual(d["decision"], "BLOCK")

    def test_account_creation_uses_approved_adapter_and_secret_manager(self):
        d = decide_intent({"action": "create_account", "platform": "example-bot-platform", "terms_status": "allowed", "connector_authorized": True, "secret_storage": "secret_manager"}, POLICY)
        self.assertEqual(d["decision"], "ALLOW_AUTO")

    def test_unapproved_account_creation_is_only_draft(self):
        d = decide_intent({"action": "create_account", "platform": "random-site", "terms_status": "allowed", "connector_authorized": True, "secret_storage": "secret_manager"}, POLICY)
        self.assertEqual(d["decision"], "DRAFT_ONLY")


if __name__ == "__main__":
    unittest.main()
