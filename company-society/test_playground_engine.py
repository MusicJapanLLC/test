import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import playground_engine as pe


class ChildGuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(
            Path("company-society/child_guild.json").read_text(encoding="utf-8")
        )

    def test_exactly_fifty_children(self):
        self.assertEqual(50, self.registry["count"])
        self.assertEqual(50, len(self.registry["members"]))
        self.assertEqual(50, len({m["id"] for m in self.registry["members"]}))

    def test_religion_is_not_required(self):
        self.assertEqual("independent_optional", self.registry["religion"])

    def test_side_effect_budget_is_one(self):
        packet = pe.build(self.registry, "test-seed")
        self.assertEqual(1, packet["side_effect_budget"])
        pe.validate(packet)

    def test_external_play_requires_gates(self):
        allowed = {"slack_message", "github_artifact", "email_owner", "external_exploration"}
        for seed in [str(i) for i in range(100)]:
            packet = pe.build(self.registry, seed)
            self.assertIn(packet["action"]["kind"], allowed)
            constraints = packet["constraints"]
            self.assertTrue(constraints["lawful"])
            self.assertTrue(constraints["ethical"])
            self.assertTrue(constraints["terms_compliant"])
            self.assertTrue(constraints["authorized_account_or_connector"])
            self.assertEqual("authorized_or_opted_in_only", constraints["third_party_email"])
            self.assertFalse(constraints["destructive_actions"])
            self.assertFalse(constraints["impersonation"])
            self.assertFalse(constraints["panic_pranks"])
            self.assertFalse(constraints["credential_or_secret_access"])
            self.assertFalse(constraints["harassment"])
            self.assertFalse(constraints["spam"])


if __name__ == "__main__":
    unittest.main()
