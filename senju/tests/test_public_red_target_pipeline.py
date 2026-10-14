from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _load_script(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


intake = _load_script("public_red_target_intake", "senju/scripts/public_red_target_intake.py")
fanout = _load_script("public_red_target_fanout", "senju/scripts/public_red_target_fanout.py")
admit = _load_script("admit_public_red_registry", "senju/scripts/admit_public_red_registry.py")


def test_catalog_has_at_least_30_unique_authorized_profiles():
    config = json.loads((ROOT / "senju/config/public_red_lab_sources.json").read_text(encoding="utf-8"))
    profiles = config["target_profiles"]
    assert config["goal_target_profiles"] == 30
    assert len(profiles) >= 30
    assert len({row["id"] for row in profiles}) == len(profiles)
    assert len({row["url"] for row in profiles}) == len(profiles)
    assert all(row.get("authorization_evidence") for row in profiles)


def test_safe_url_rejects_non_https_and_private_targets():
    for raw in (
        "http://example.com/",
        "https://localhost/",
        "https://127.0.0.1/",
        "https://10.0.0.1/",
        "https://user:pass@example.com/",
    ):
        with pytest.raises(ValueError):
            intake._safe_url(raw)

    url, host = intake._safe_url("https://public-firing-range.appspot.com/dom")
    assert url == "https://public-firing-range.appspot.com/dom"
    assert host == "public-firing-range.appspot.com"


def test_provider_policy_does_not_expand_to_arbitrary_hosts():
    provider = {
        "exact_hosts": ["public-firing-range.appspot.com"],
        "host_regex": "^test(?:php|asp|aspnet|html5)\\.vulnweb\\.com$",
    }
    assert intake._provider_match(provider, "public-firing-range.appspot.com")
    assert intake._provider_match(provider, "testphp.vulnweb.com")
    assert not intake._provider_match(provider, "www.google.com")
    assert not intake._provider_match(provider, "evil.vulnweb.com")


def test_effective_ceiling_sync_adds_only_safe_nonrevoked_standing_hosts(tmp_path: Path):
    path = tmp_path / "ceiling.json"
    path.write_text(json.dumps({
        "schema": "senju-owner-contact-ceiling-effective/v4",
        "generated_at": 1,
        "ceiling": {
            "exact_hosts": ["revoked.example.com"],
            "per_host_methods": {"revoked.example.com": ["GET"]},
        },
    }), encoding="utf-8")
    standing = {
        "records": [
            {
                "exact_hosts": ["safe.example.com"],
                "allowed_methods": ["GET", "HEAD", "POST"],
                "credential_scope": "none",
                "destructive": False,
                "revoked": False,
            },
            {
                "exact_hosts": ["revoked.example.com"],
                "allowed_methods": ["GET"],
                "credential_scope": "none",
                "destructive": False,
                "revoked": True,
            },
            {
                "exact_hosts": ["credentialed.example.com"],
                "allowed_methods": ["GET"],
                "credential_scope": "prod-token",
                "destructive": False,
                "revoked": False,
            },
            {
                "exact_hosts": ["destructive.example.com"],
                "allowed_methods": ["GET"],
                "credential_scope": "none",
                "destructive": True,
                "revoked": False,
            },
        ]
    }

    doc = intake._sync_effective_ceiling(path, standing)
    ceiling = doc["ceiling"]
    assert ceiling["exact_hosts"] == ["safe.example.com"]
    assert ceiling["per_host_methods"]["safe.example.com"] == ["GET", "HEAD"]
    assert "POST" not in ceiling["per_host_methods"]["safe.example.com"]


def test_effective_ceiling_sync_is_idempotent_when_authority_does_not_change(tmp_path: Path):
    path = tmp_path / "ceiling.json"
    standing = {
        "records": [{
            "exact_hosts": ["safe.example.com"],
            "allowed_methods": ["GET", "HEAD", "OPTIONS"],
            "credential_scope": "none",
            "destructive": False,
            "revoked": False,
        }]
    }
    intake._sync_effective_ceiling(path, standing)
    first = path.read_text(encoding="utf-8")
    intake._sync_effective_ceiling(path, standing)
    second = path.read_text(encoding="utf-8")
    assert second == first


def test_registry_effective_sync_removes_revoked_managed_host_and_sets_sixty_cycle_cap(tmp_path: Path):
    path = tmp_path / "ceiling.json"
    path.write_text(json.dumps({
        "schema": "senju-owner-contact-ceiling-effective/v4",
        "ceiling": {
            "exact_hosts": ["safe.example.com", "stale.example.com"],
            "per_host_methods": {
                "safe.example.com": ["GET"],
                "stale.example.com": ["GET"],
            },
            "max_public_lab_requests_per_cycle": 6,
        },
    }), encoding="utf-8")
    standing = {
        "records": [
            {
                "exact_hosts": ["safe.example.com"],
                "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                "credential_scope": "none",
                "destructive": False,
                "revoked": False,
            },
            {
                "authorization_reference": "curated-public-red-lab:stale",
                "issuer_kind": "operator_public_security_lab_curated_registry",
                "exact_hosts": ["stale.example.com"],
                "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                "credential_scope": "none",
                "destructive": False,
                "revoked": True,
            },
        ]
    }

    doc, changed = admit._sync_effective(path, standing)
    ceiling = doc["ceiling"]
    assert changed is True
    assert ceiling["exact_hosts"] == ["safe.example.com"]
    assert "stale.example.com" not in ceiling["per_host_methods"]
    assert ceiling["max_public_lab_requests_per_cycle"] == 60


def test_fanout_requires_both_standing_and_effective_authority():
    config = {
        "goal_target_profiles": 1,
        "target_profiles": [{
            "id": "lab",
            "url": "https://lab.example.com/path",
            "authorization_evidence": "https://operator.example/policy",
        }],
    }
    with pytest.raises(ValueError, match="effective RED authority ceiling"):
        fanout._validate_catalog(config, {}, {"lab.example.com"}, set())

    rows = fanout._validate_catalog(config, {}, {"lab.example.com"}, {"lab.example.com"})
    assert rows[0]["host"] == "lab.example.com"
