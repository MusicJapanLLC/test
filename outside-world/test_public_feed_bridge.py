import unittest

from outside_world_import_shim import load_module

bridge = load_module('outside-world/public_feed_bridge.py', 'public_feed_bridge')


class PublicFeedBridgeTests(unittest.TestCase):
    def test_selects_only_successful_owned_publications(self):
        doc = {
            'findings': [
                {'url': 'https://example.com/a', 'title': 'A', 'citizen_id': 'c1', 'display_name': 'One', 'category': 'research', 'note': 'alpha'},
                {'url': 'https://example.com/b', 'title': 'B', 'citizen_id': 'c2', 'display_name': 'Two', 'category': 'builders', 'note': 'beta'},
            ],
            'effects': [
                {'kind': 'slack', 'status': 'SKIPPED_NO_CAPABILITY'},
                {'kind': 'github_issue', 'status': 201, 'source_url': 'https://example.com/a'},
                {'kind': 'github_issue', 'status': 'SKIPPED_PUBLICATION_INTERVAL', 'source_url': 'https://example.com/b'},
            ],
        }
        payloads = bridge.select_payloads(doc)
        self.assertEqual(len(payloads), 1)
        self.assertEqual(payloads[0]['title'], 'A')
        self.assertEqual(payloads[0]['source_url'], 'https://example.com/a')

    def test_deduplicates_and_limits_payloads(self):
        doc = {
            'findings': [
                {'url': 'https://example.com/a', 'title': 'A', 'citizen_id': 'c1'},
                {'url': 'https://example.com/b', 'title': 'B', 'citizen_id': 'c2'},
                {'url': 'https://example.com/c', 'title': 'C', 'citizen_id': 'c3'},
            ],
            'effects': [
                {'kind': 'github_issue', 'status': 201, 'source_url': 'https://example.com/a'},
                {'kind': 'github_issue', 'status': 201, 'source_url': 'https://example.com/a'},
                {'kind': 'github_issue', 'status': 201, 'source_url': 'https://example.com/b'},
                {'kind': 'github_issue', 'status': 201, 'source_url': 'https://example.com/c'},
            ],
        }
        payloads = bridge.select_payloads(doc, limit=2)
        self.assertEqual([p['source_url'] for p in payloads], ['https://example.com/a', 'https://example.com/b'])


if __name__ == '__main__':
    unittest.main()
