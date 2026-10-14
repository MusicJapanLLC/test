import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import scout
import rnd_seed


class OutsideWorldScoutTests(unittest.TestCase):
    def test_child_selection_is_bounded(self):
        child_id, name = scout.choose_child("abc")
        self.assertTrue(child_id.startswith("CHILD-"))
        self.assertTrue(name)
        self.assertGreaterEqual(int(child_id.split("-")[1]), 1)
        self.assertLessEqual(int(child_id.split("-")[1]), 50)

    def test_rnd_seed_never_transfers_external_scope(self):
        state = {
            "picked": {
                "id": "x",
                "title": "Tiny autonomous browser experiment",
                "url": "https://example.com/post",
                "source_id": "public-feed",
                "category": "engineering",
            }
        }
        result = rnd_seed.build(state)
        directive = result["candidate_directive"]
        self.assertEqual("robustness", directive["focus"])
        self.assertNotIn("url", directive)
        self.assertNotIn("host", directive)
        self.assertNotIn("target", directive)
        self.assertNotIn("network_scope", directive)
        self.assertEqual("R&D_REVIEW_ONLY", result["activation"])

    def test_config_is_read_only(self):
        config = json.loads(Path("outside-world/sources.json").read_text(encoding="utf-8"))
        rules = config["rules"]
        self.assertTrue(rules["public_only"])
        self.assertFalse(rules["login_bypass"])
        self.assertFalse(rules["robots_or_access_control_bypass"])
        self.assertFalse(rules["comments_or_posts_from_feed_scout"])
        self.assertFalse(rules["third_party_email"])
        self.assertTrue(rules["allow_fun_without_utility"])


if __name__ == "__main__":
    unittest.main()
