import json
import tempfile
import unittest
from pathlib import Path

from citizen_registry import build_registry, load_json, relationship_score


class CitizenRegistryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = load_json("company-society/citizen_registry.json")
        cls.psychology = load_json("company-society/psychology.json")

    def test_core_registry_is_always_present(self):
        snapshot = build_registry(self.config, self.psychology)
        self.assertEqual(snapshot["source_counts"]["CORE_SOCIETY"], 5)
        self.assertGreaterEqual(snapshot["population"], 5)
        self.assertTrue(snapshot["invariants"]["personality_never_grants_authority"])
        self.assertTrue(snapshot["invariants"]["standing_requires_verified_events"])

    def test_standing_starts_unrated_by_evidence(self):
        snapshot = build_registry(self.config, self.psychology)
        citizen = snapshot["citizens"][0]
        self.assertEqual(citizen["standing"]["evidence_count"], 0)
        self.assertEqual(citizen["standing"]["basis"], "neutral_prior_until_verified_events")
        self.assertFalse(citizen["social_profile"]["authority_from_personality"])

    def test_optional_sources_federate_without_copying_ownership(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "core.json").write_text(json.dumps({"members": [{"id": "A", "name": "Alpha"}]}), encoding="utf-8")
            (root / "guild.json").write_text(json.dumps({"guild_id": "G", "members": [{"id": "B", "name": "Beta"}]}), encoding="utf-8")
            config = {
                **self.config,
                "sources": [
                    {"id": "CORE", "path": "core.json", "required": True, "population_class": "core", "default_group": "CORE", "faith_mode": "none"},
                    {"id": "GUILD", "path": "guild.json", "required": False, "population_class": "guild", "default_group": "G", "faith_mode": "optional"},
                ],
            }
            snapshot = build_registry(config, self.psychology, root)
            self.assertEqual(snapshot["population"], 2)
            self.assertEqual(snapshot["source_counts"], {"CORE": 1, "GUILD": 1})
            self.assertEqual(snapshot["missing_optional_sources"], [])

    def test_relationship_is_social_hypothesis_not_authority(self):
        snapshot = build_registry(self.config, self.psychology)
        a, b = snapshot["citizens"][:2]
        score = relationship_score(a, b)
        self.assertIn(score["relation_type"], {"ALLY", "RIVAL_COLLABORATOR", "WITNESS_CHALLENGE", "PEER"})
        self.assertGreaterEqual(score["alliance_score"], 0)
        self.assertLessEqual(score["alliance_score"], 100)
        self.assertGreaterEqual(score["rivalry_score"], 0)
        self.assertLessEqual(score["rivalry_score"], 100)


if __name__ == "__main__":
    unittest.main()
