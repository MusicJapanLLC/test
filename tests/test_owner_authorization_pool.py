from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from senju.owner_authorization_pool import run_owner_authorization_pool


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_pool_combines_canonical_and_verified_control_and_dedupes(tmp_path: Path) -> None:
    canonical = tmp_path / "authorized.json"
    attestations = tmp_path / "attestations.json"
    state = tmp_path / "state"
    _write(
        canonical,
        {
            "targets": [
                {
                    "id": "a",
                    "host": "a.example.test",
                    "base_url": "https://a.example.test",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD", "POST"],
                },
                {
                    "id": "shared",
                    "host": "shared.example.test",
                    "base_url": "https://shared.example.test",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD"],
                },
            ]
        },
    )
    _write(
        attestations,
        {
            "records": [
                {
                    "provider": "render",
                    "host": "shared.example.test",
                    "service_url": "https://shared.example.test",
                    "provider_control_verified": True,
                    "owner_authorized": True,
                    "proof_ref": "render:shared",
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "private_network": False,
                },
                {
                    "provider": "vercel",
                    "host": "b.example.test",
                    "service_url": "https://b.example.test",
                    "provider_control_verified": True,
                    "owner_authorized": True,
                    "proof_ref": "vercel:b",
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "private_network": False,
                },
            ]
        },
    )
    result = run_owner_authorization_pool(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        target_count=3,
        now=datetime(2026, 9, 1, tzinfo=timezone.utc),
    )
    assert result["target_met"] is True
    assert result["authorized_count"] == 3
    assert len({row["host"] for row in result["entries"]}) == 3
    assert all(
        list(row["authorization"]["allowed_methods"]) == ["GET", "HEAD"]
        for row in result["entries"]
    )
    leases = json.loads((state / "reviewed_authority_operational_leases.json").read_text())
    assert leases["lease_count"] == 3
    assert all(row["same_or_narrower"] is True for row in leases["leases"])


def test_pool_never_uses_unverified_cloud_control(tmp_path: Path) -> None:
    canonical = tmp_path / "authorized.json"
    attestations = tmp_path / "attestations.json"
    state = tmp_path / "state"
    _write(canonical, {"targets": []})
    _write(
        attestations,
        {
            "records": [
                {
                    "provider": "vercel",
                    "host": "bad.example.test",
                    "service_url": "https://bad.example.test",
                    "provider_control_verified": False,
                    "owner_authorized": True,
                    "proof_ref": "vercel:bad",
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "private_network": False,
                }
            ]
        },
    )
    result = run_owner_authorization_pool(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        target_count=1,
    )
    assert result["authorized_count"] == 0
    assert result["target_met"] is False
    assert result["shortfall"] == 1


def test_pool_reuses_unexpired_authorization(tmp_path: Path) -> None:
    canonical = tmp_path / "authorized.json"
    attestations = tmp_path / "attestations.json"
    state = tmp_path / "state"
    _write(
        canonical,
        {
            "targets": [
                {
                    "id": "a",
                    "host": "a.example.test",
                    "base_url": "https://a.example.test",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD"],
                }
            ]
        },
    )
    _write(attestations, {"records": []})
    now = datetime(2026, 9, 1, tzinfo=timezone.utc)
    first = run_owner_authorization_pool(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        target_count=1,
        now=now,
    )
    second = run_owner_authorization_pool(
        state,
        canonical_targets=canonical,
        verified_attestations=attestations,
        target_count=1,
        now=now,
    )
    assert first["entries"][0]["authorization"]["authorization_id"] == second["entries"][0]["authorization"]["authorization_id"]
    assert second["reused_this_cycle"] == 1
