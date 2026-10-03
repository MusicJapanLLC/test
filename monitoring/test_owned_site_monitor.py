import unittest

from monitoring.owned_site_monitor import origin, same_origin


class OwnedSiteMonitorTests(unittest.TestCase):
    def test_origin(self) -> None:
        self.assertEqual(origin("https://example.com/a?b=1"), "https://example.com")

    def test_same_origin_relative_link(self) -> None:
        self.assertEqual(
            same_origin("https://example.com/about/", "/contact"),
            "https://example.com/contact",
        )

    def test_same_origin_rejects_external_host(self) -> None:
        self.assertIsNone(same_origin("https://example.com/", "https://other.example/path"))

    def test_same_origin_rejects_http_downgrade(self) -> None:
        self.assertIsNone(same_origin("https://example.com/", "http://example.com/path"))


if __name__ == "__main__":
    unittest.main()
