import unittest

from security.homage_lab.authorized_range_probe import (
    ALLOWED_HOST,
    _same_origin_path,
    _state_for_status,
)


class AuthorizedRangeProbeTests(unittest.TestCase):
    def test_exact_host_is_fixed(self) -> None:
        self.assertEqual(ALLOWED_HOST, "kabeya-authorized-test-range.onrender.com")

    def test_same_origin_links_are_allowed(self) -> None:
        self.assertEqual(
            _same_origin_path("/scope.json", "https://kabeya-authorized-test-range.onrender.com/"),
            "/scope.json",
        )

    def test_external_hosts_are_rejected(self) -> None:
        self.assertIsNone(
            _same_origin_path("https://example.com/", "https://kabeya-authorized-test-range.onrender.com/")
        )

    def test_http_downgrade_is_rejected(self) -> None:
        self.assertIsNone(
            _same_origin_path("http://kabeya-authorized-test-range.onrender.com/", "https://kabeya-authorized-test-range.onrender.com/")
        )

    def test_status_signal_mapping(self) -> None:
        self.assertEqual(_state_for_status(200), "ok")
        self.assertEqual(_state_for_status(403), "blocked")
        self.assertEqual(_state_for_status(503), "error")


if __name__ == "__main__":
    unittest.main()
