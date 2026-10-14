import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import workstation_lab as wl


class WorkstationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(Path('company-society/child_workstations.json').read_text(encoding='utf-8'))

    def test_all_fifty_children_assigned(self):
        kids = self.registry['assigned_children']
        self.assertEqual(50, len(kids))
        self.assertEqual(50, len(set(kids)))
        self.assertEqual('CHILD-01', kids[0])
        self.assertEqual('CHILD-50', kids[-1])

    def test_target_profile(self):
        self.assertEqual(360, self.registry['target_profile']['ram_gb'])
        self.assertEqual(128, self.registry['target_profile']['vram_gb'])
        self.assertTrue(self.registry['target_profile']['local_code_execution'])

    def test_privacy_curtain(self):
        p = self.registry['privacy']
        self.assertFalse(p['routine_scratch_content_reporting'])
        self.assertFalse(p['routine_manager_content_inspection'])
        self.assertTrue(p['health_metadata_visible'])
        self.assertTrue(p['external_side_effects_visible'])

    def test_no_extra_fictional_child_filter(self):
        mode = self.registry['content_mode']
        self.assertFalse(mode['additional_child_filter'])
        self.assertEqual('not_applicable', mode['fictional_persona_youth_restrictions'])
        self.assertEqual('inherited', mode['external_platform_policy'])

    def test_registry_loader_enforces_count(self):
        loaded = wl.load_registry('company-society/child_workstations.json')
        self.assertEqual(50, len(loaded['assigned_children']))


if __name__ == '__main__':
    unittest.main()
