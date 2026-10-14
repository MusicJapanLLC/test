from __future__ import annotations

import json
from pathlib import Path

from senju.red_authorized_frontier import build_red_authorized_frontier


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _auth(host: str, auth_id: str, expires_at: str) -> dict[str, object]:
    return {
        "authorization_id": auth_id,
        "host": host,
        "expires_at": expires_at,
        "allowed_methods": ["GET", "HEAD"],
        "credential_scope": "none",
        "private_network": False,
        "authorization_basis": "verified_cloud_control:render",
    }


def test_builds_multi_url_frontier_only_from_live_authorized_hosts(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "targets.json"
    _write(
        canonical,
        {
            "targets": [
                {
                    "host": "lab.example.com",
                    "base_url": "https://lab.example.com",
                    "owner_authorization": "explicit",
                    "authorization_authority_root": True,
                    "scope_url": "https://lab.example.com/scope.json",
                }
            ]
        },
    )
    _write(
        state / "owner_authorization_pool.json",
        {
            "entries": [
                {
                    "host": "lab.example.com",
                    "source_kind": "verified_cloud_control",
                    "provider": "render",
                    "proof_ref": "render:srv-1",
                    "transport_eligible": True,
                    "authorization": _auth("lab.example.com", "authz-live", "2030-01-01T00:00:00+00:00"),
                },
                {
                    "host": "cancelled.example.com",
                    "source_kind": "verified_cloud_control",
                    "provider": "vercel",
                    "proof_ref": "vercel:dpl-old",
                    "transport_eligible": False,
                    "authorization": _auth("cancelled.example.com", "authz-cancelled", "2030-01-01T00:00:00+00:00"),
                },
            ]
        },
    )

    result = build_red_authorized_frontier(
        state,
        canonical_targets=canonical,
        now=1_800_000_000,
    )

    assert result["active_target_count"] == 1
    assert result["frontier_url_count"] >= 5
    assert result["targets"][0]["host"] == "lab.example.com"
    assert result["targets"][0]["tier"] == "owner_controlled_live"
    assert all(row["host"] == "lab.example.com" for row in result["urls"])

    leases = json.loads((state / "red_authorized_transport_leases.json").read_text())
    assert leases["lease_count"] == 1
    assert leases["leases"][0]["target"] == "lab.example.com"
    assert leases["leases"][0]["authorization_reference"] == "authz-live"


def test_public_security_lab_is_prioritized_without_widening_methods(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "targets.json"
    _write(
        canonical,
        {
            "targets": [
                {
                    "host": "public-lab.example",
                    "base_url": "https://public-lab.example",
                    "owner_authorization": "explicit",
                    "recommendation_target": "SENJU_RED",
                    "allowed_interactions": ["GET", "HEAD", "OPTIONS", "POST"],
                }
            ]
        },
    )
    _write(
        state / "owner_authorization_pool.json",
        {
            "entries": [
                {
                    "host": "public-lab.example",
                    "source_kind": "canonical",
                    "proof_ref": "official-demo-docs",
                    "transport_eligible": True,
                    "authorization": {
                        **_auth("public-lab.example", "authz-public", "2030-01-01T00:00:00+00:00"),
                        "authorization_basis": "canonical_authorized_host",
                    },
                }
            ]
        },
    )

    result = build_red_authorized_frontier(
        state,
        canonical_targets=canonical,
        now=1_800_000_000,
    )

    target = result["targets"][0]
    assert target["tier"] == "public_security_lab"
    assert target["scheduling_weight"] == 2
    assert set(target["allowed_methods"]) == {"GET", "HEAD"}
    assert "POST" not in target["allowed_methods"]


def test_expired_or_mismatched_authority_never_enters_frontier(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "targets.json"
    _write(canonical, {"targets": []})
    _write(
        state / "owner_authorization_pool.json",
        {
            "entries": [
                {
                    "host": "expired.example.com",
                    "source_kind": "verified_cloud_control",
                    "transport_eligible": True,
                    "authorization": _auth("expired.example.com", "authz-expired", "2025-01-01T00:00:00+00:00"),
                },
                {
                    "host": "mismatch.example.com",
                    "source_kind": "verified_cloud_control",
                    "transport_eligible": True,
                    "authorization": _auth("other.example.com", "authz-mismatch", "2030-01-01T00:00:00+00:00"),
                },
            ]
        },
    )

    result = build_red_authorized_frontier(
        state,
        canonical_targets=canonical,
        now=1_800_000_000,
    )

    assert result["active_target_count"] == 0
    assert result["frontier_url_count"] == 0
