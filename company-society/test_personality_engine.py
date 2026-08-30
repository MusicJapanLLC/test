import json
import unittest
from pathlib import Path

from personality_engine import directive, moral_tension, profile_for


class PersonalityEngineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads(Path("company-society/psychology.json").read_text(encoding="utf-8"))

    def test_profiles_are_stable(self):
        self.assertEqual(profile_for("tomoki-forge", self.config), profile_for("tomoki-forge", self.config))

    def test_named_maverick_keeps_solo_glory(self):
        profile = profile_for("tomoki-forge", self.config)
        self.assertEqual(profile["archetype"], "MAVERICK")
        self.assertGreaterEqual(profile["solo_glory"], 80)

    def test_missionist_has_moral_tension(self):
        profile = profile_for("red-research-agent", self.config)
        self.assertEqual(profile["archetype"], "MISSIONIST")
        self.assertIn(moral_tension(profile), {"MEDIUM", "HIGH"})

    def test_directive_never_waives_gates(self):
        profile = dict(self.config["archetypes"]["MISSIONIST"])
        text = directive(profile)
        self.assertIn("never waive", text)


if __name__ == "__main__":
    unittest.main()
