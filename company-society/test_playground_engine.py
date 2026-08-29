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

    def test_only_owner_controlled_modes(self):
        allowed = {"slack_message", "slack_reaction", "github_artifact", "email_owner"}
        for seed in [str(i) for i in range(100)]:
            packet = pe.build(self.registry, seed)
            self.assertIn(packet["action"]["kind"], allowed)
            self.assertTrue(packet["constraints"]["owner_controlled_targets_only"])
            self.assertFalse(packet["constraints"]["third_party_contact"])
            self.assertFalse(packet["constraints"]["destructive_actions"])


if __name__ == "__main__":
    unittest.main()
