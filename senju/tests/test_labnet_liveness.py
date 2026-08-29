import json
from unittest.mock import patch

from senju.targets.labnet import LabNetTarget, _is_allowed_liveness_host


def _target(tmp_path, host):
    manifest = tmp_path / "lab.json"
    manifest.write_text(json.dumps({"host": host, "surfaces": []}), encoding="utf-8")
    return LabNetTarget("test", manifest)


def test_allowed_host_predicate_accepts_only_literal_non_public_ips():
    assert _is_allowed_liveness_host("127.0.0.1")
    assert _is_allowed_liveness_host("10.13.0.5")
    assert _is_allowed_liveness_host("169.254.10.20")
    assert not _is_allowed_liveness_host("example.com")
    assert not _is_allowed_liveness_host("8.8.8.8")


def test_rejected_hostname_never_calls_urlopen(tmp_path):
    target = _target(tmp_path, "example.com")
    with patch("urllib.request.urlopen") as urlopen:
        assert target.liveness() is False
        urlopen.assert_not_called()


def test_rejected_public_ip_never_calls_urlopen(tmp_path):
    target = _target(tmp_path, "8.8.8.8")
    with patch("urllib.request.urlopen") as urlopen:
        assert target.liveness() is False
        urlopen.assert_not_called()
