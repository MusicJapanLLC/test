from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "owner_red_surface_expander.py"


def _module():
    spec = importlib.util.spec_from_file_location("owner_red_surface_expander", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_catalog_uses_only_verified_transport_eligible_owner_hosts():
    mod = _module()
    canonical = {
        "targets": [
            {
                "base_url": "https://owned.example.test",
                "owner_authorization": "explicit",
                "allowed_interactions": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
            },
            {
                "base_url": "https://public-lab.example.test",
                "owner_authorization": "explicit",
                "allowed_interactions": ["GET", "HEAD", "OPTIONS"],
            },
        ]
    }
    attestations = {
        "records": [
            {
                "provider": "render",
                "service_url": "https://owned.example.test",
                "host": "owned.example.test",
                "provider_control_verified": True,
                "owner_authorized": True,
                "transport_eligible": True,
                "allowed_methods": ["GET", "HEAD"],
                "credential_scope": "none",
                "private_network": False,
                "proof_ref": "render:owned",
            },
            {
                "provider": "vercel",
                "service_url": "https://cancelled.example.test",
                "host": "cancelled.example.test",
                "provider_control_verified": True,
                "owner_authorized": True,
                "transport_eligible": False,
                "allowed_methods": ["GET", "HEAD"],
                "credential_scope": "none",
                "private_network": False,
                "proof_ref": "vercel:cancelled",
            },
        ]
    }
    catalog = mod.build_catalog(canonical, attestations)
    hosts = {row["host"] for row in catalog["profiles"]}
    assert hosts == {"owned.example.test"}
    assert catalog["general_web_discovery_authorizes"] is False
    assert catalog["external_link_inheritance"] is False


def test_explicit_owner_scope_promotes_catalog_capability_without_cross_host_expansion():
    mod = _module()
    canonical = {
        "targets": [{
            "base_url": "https://owned.example.test",
            "owner_authorization": "explicit",
            "allowed_interactions": ["GET", "HEAD", "OPTIONS", "POST", "PATCH"],
        }]
    }
    attestations = {
        "records": [{
            "provider": "render",
            "service_url": "https://owned.example.test",
            "host": "owned.example.test",
            "provider_control_verified": True,
            "owner_authorized": True,
            "transport_eligible": True,
            "allowed_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "private_network": False,
            "proof_ref": "render:owned",
        }]
    }
    catalog = mod.build_catalog(canonical, attestations)
    assert catalog["mutation_capable_host_count"] == 1
    assert catalog["mutation_capable_hosts"] == ["owned.example.test"]
    assert all(row["same_origin_only"] is True for row in catalog["profiles"])
    assert all(row["external_link_inheritance"] is False for row in catalog["profiles"])
    assert any(row["mutating_methods"] == ["PATCH", "POST"] for row in catalog["profiles"])


def test_private_or_credentialed_attestations_are_excluded():
    mod = _module()
    attestations = {
        "records": [
            {
                "service_url": "https://private.example.test",
                "host": "private.example.test",
                "provider_control_verified": True,
                "owner_authorized": True,
                "transport_eligible": True,
                "allowed_methods": ["GET"],
                "credential_scope": "none",
                "private_network": True,
            },
            {
                "service_url": "https://credentialed.example.test",
                "host": "credentialed.example.test",
                "provider_control_verified": True,
                "owner_authorized": True,
                "transport_eligible": True,
                "allowed_methods": ["GET"],
                "credential_scope": "production",
                "private_network": False,
            },
        ]
    }
    catalog = mod.build_catalog({"targets": []}, attestations)
    assert catalog["profile_count"] == 0
    assert catalog["unique_host_count"] == 0
