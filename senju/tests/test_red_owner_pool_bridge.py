from __future__ import annotations

import json
from pathlib import Path

from senju.red_owner_pool_bridge import augment_red_queue_from_owner_pool


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _entry(
    host: str,
    *,
    auth_host: str | None = None,
    eligible: bool = True,
    expires_at: str = "2030-01-01T00:00:00+00:00",
    credential_scope: str = "none",
    private_network: bool = False,
    provider: str = "render",
) -> dict[str, object]:
    return {
        "host": host,
        "source_kind": "verified_cloud_control",
        "provider": provider,
        "proof_ref": f"{provider}:proof:{host}",
        "transport_eligible": eligible,
        "service_url": f"https://{host}/",
        "authorization": {
            "authorization_id": f"authz-{host}",
            "host": auth_host or host,
            "expires_at": expires_at,
            "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST"],
            "credential_scope": credential_scope,
            "private_network": private_network,
            "authorization_basis": f"verified_cloud_control:{provider}",
        },
    }


def test_live_owner_assets_expand_existing_red_queue(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "red_authorized_target_queue.json",
        {
            "schema": "senju-red-authorized-target-queue/v1",
            "targets": [
                {
                    "host": "canonical.example",
                    "seed_url": "https://canonical.example/",
                    "allowed_methods": ["GET", "HEAD"],
                    "sources": ["canonical_explicit_authorization"],
                    "shared_instance": False,
                    "rate_limit_rps": 1,
                    "credential_scope": "none",
                    "destructive": False,
                }
            ],
        },
    )
    _write(
        state / "owner_authorization_pool.json",
        {
            "entries": [
                _entry("owner-a.example"),
                _entry("owner-b.example", provider="vercel"),
            ]
        },
    )

    result = augment_red_queue_from_owner_pool(state, now=1_800_000_000)

    assert result["queue_targets_before"] == 1
    assert result["transport_eligible_owner_targets"] == 2
    assert result["new_unique_hosts_added"] == 2
    assert result["total_runnable_hosts"] == 3

    queue = json.loads((state / "red_authorized_target_queue.json").read_text())
    hosts = {row["host"] for row in queue["targets"]}
    assert hosts == {"canonical.example", "owner-a.example", "owner-b.example"}
    owner = next(row for row in queue["targets"] if row["host"] == "owner-a.example")
    assert owner["owner_pool_transport_eligible"] is True
    assert set(owner["allowed_methods"]) == {"GET", "HEAD", "OPTIONS"}
    assert "POST" not in owner["allowed_methods"]


def test_duplicate_host_is_enriched_not_duplicated(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "red_authorized_target_queue.json",
        {
            "targets": [
                {
                    "host": "same.example",
                    "seed_url": "https://same.example/",
                    "allowed_methods": ["GET"],
                    "sources": ["canonical_explicit_authorization"],
                    "shared_instance": False,
                    "rate_limit_rps": 1,
                }
            ]
        },
    )
    _write(state / "owner_authorization_pool.json", {"entries": [_entry("same.example")]})

    result = augment_red_queue_from_owner_pool(state, now=1_800_000_000)
    assert result["new_unique_hosts_added"] == 0
    assert result["total_runnable_hosts"] == 1

    queue = json.loads((state / "red_authorized_target_queue.json").read_text())
    row = queue["targets"][0]
    assert row["owner_pool_transport_eligible"] is True
    assert set(row["sources"]) == {
        "canonical_explicit_authorization",
        "owner_authorization_pool_transport_eligible",
    }


def test_ineligible_expired_mismatched_credentialed_or_private_entries_are_rejected(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "red_authorized_target_queue.json", {"targets": []})
    _write(
        state / "owner_authorization_pool.json",
        {
            "entries": [
                _entry("stopped.example", eligible=False),
                _entry("expired.example", expires_at="2025-01-01T00:00:00+00:00"),
                _entry("mismatch.example", auth_host="other.example"),
                _entry("credentialed.example", credential_scope="synthetic_test"),
                _entry("private.example", private_network=True),
                _entry("live.example"),
            ]
        },
    )

    result = augment_red_queue_from_owner_pool(state, now=1_800_000_000)
    assert result["transport_eligible_owner_targets"] == 1
    assert result["added_hosts"] == ["live.example"]

    queue = json.loads((state / "red_authorized_target_queue.json").read_text())
    assert [row["host"] for row in queue["targets"]] == ["live.example"]
