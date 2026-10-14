from __future__ import annotations

import json
from pathlib import Path

from senju.world_red_closed_loop import (
    MEMORY_SCHEMA,
    SAFE_METHODS,
    active_authorized_hosts,
    run_world_red_closed_loop,
)


def _write(path: Path, payload: dict) -> Path:
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _owner_pool(now: int) -> dict:
    return {
        "entries": [
            {
                "host": "safe.example",
                "transport_eligible": True,
                "authorization": {
                    "authorization_id": "auth-safe",
                    "host": "safe.example",
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "private_network": False,
                    "expires_at_epoch": now + 3600,
                },
                "requested_authority": {"same_or_narrower": True},
            },
            {
                "host": "credentialed.example",
                "transport_eligible": True,
                "authorization": {
                    "authorization_id": "auth-credentialed",
                    "host": "credentialed.example",
                    "allowed_methods": ["GET"],
                    "credential_scope": "admin",
                    "expires_at_epoch": now + 3600,
                },
            },
            {
                "host": "expired.example",
                "transport_eligible": True,
                "authorization": {
                    "authorization_id": "auth-expired",
                    "host": "expired.example",
                    "allowed_methods": ["GET"],
                    "credential_scope": "none",
                    "expires_at_epoch": now - 1,
                },
            },
        ]
    }


def _queue() -> dict:
    return {
        "targets": [
            {
                "host": "safe.example",
                "allowed_methods": ["GET", "HEAD", "OPTIONS"],
                "credential_scope": "none",
                "destructive": False,
            },
            {
                "host": "queue-only.example",
                "allowed_methods": ["GET"],
                "credential_scope": "none",
                "destructive": False,
            },
            {
                "host": "credentialed.example",
                "allowed_methods": ["GET"],
                "credential_scope": "admin",
                "destructive": False,
            },
        ]
    }


def test_active_hosts_require_current_pool_and_runnable_queue_intersection():
    now = 2_000_000_000
    hosts = active_authorized_hosts(_owner_pool(now), _queue(), now=now)
    assert hosts == {"safe.example"}


def test_unknown_report_hosts_never_enter_memory_or_retry_plan(tmp_path: Path):
    now = 2_000_000_000
    owner = _write(tmp_path / "owner.json", _owner_pool(now))
    queue = _write(tmp_path / "queue.json", _queue())
    pool = _write(
        tmp_path / "pool.json",
        {
            "selected_urls": [
                {"url": "https://safe.example/status"},
                {"url": "https://unknown.example/admin"},
            ]
        },
    )
    report = _write(
        tmp_path / "report.json",
        {
            "contacts": [
                {
                    "url": "https://safe.example/status?token=do-not-store",
                    "method": "GET",
                    "success": False,
                    "status": 404,
                },
                {
                    "url": "https://unknown.example/admin",
                    "method": "GET",
                    "success": True,
                    "status": 200,
                },
            ]
        },
    )
    result = run_world_red_closed_loop(
        tmp_path,
        owner_pool=owner,
        target_queue=queue,
        url_pool=pool,
        red_reports=[report],
        now=now,
    )
    memory = json.loads((tmp_path / "world_red_strategy_memory.json").read_text())
    assert memory["schema"] == MEMORY_SCHEMA
    assert memory["ignored_unknown_contacts"] == 1
    assert all("unknown.example" not in key for key in memory["routes"])
    assert all("token=" not in key for key in memory["routes"])
    assert {row["host"] for row in result["retry_plan"]} == {"safe.example"}


def test_retry_plan_never_generates_body_exploit_or_unsafe_method(tmp_path: Path):
    now = 2_000_000_000
    owner = _write(tmp_path / "owner.json", _owner_pool(now))
    queue = _write(tmp_path / "queue.json", _queue())
    pool = _write(
        tmp_path / "pool.json",
        {"selected_urls": [{"url": "https://safe.example/health"}]},
    )
    result = run_world_red_closed_loop(
        tmp_path,
        owner_pool=owner,
        target_queue=queue,
        url_pool=pool,
        now=now,
    )
    assert result["retry_plan"]
    for row in result["retry_plan"]:
        assert row["method"] in SAFE_METHODS
        assert row["request_body"] is None
        assert row["exploit_payload"] is False
        assert row["credential_scope"] == "none"


def test_recovery_keeps_memory_but_does_not_resurrect_removed_authority(tmp_path: Path):
    now = 2_000_000_000
    previous = _write(
        tmp_path / "previous.json",
        {
            "schema": MEMORY_SCHEMA,
            "routes": {
                "old.example|GET|/": {
                    "host": "old.example",
                    "method": "GET",
                    "path": "/",
                    "attempts": 3,
                    "successes": 1,
                    "failures": 2,
                    "score": 1.5,
                }
            },
            "ignored_unknown_contacts": 0,
            "last_updated": now - 100,
        },
    )
    owner = _write(tmp_path / "owner.json", _owner_pool(now))
    queue = _write(tmp_path / "queue.json", _queue())
    pool = _write(tmp_path / "pool.json", {"selected_urls": []})
    result = run_world_red_closed_loop(
        tmp_path,
        owner_pool=owner,
        target_queue=queue,
        url_pool=pool,
        previous_memory=previous,
        now=now,
    )
    assert "old.example" in result["recovery"]["suspended_hosts"]
    assert result["recovery"]["revoked_authority_resurrection"] is False
    assert result["recovery"]["reauthorization_required_for_suspended_hosts"] is True


def test_guard_feedback_is_proposal_only(tmp_path: Path):
    now = 2_000_000_000
    owner = _write(tmp_path / "owner.json", _owner_pool(now))
    queue = _write(tmp_path / "queue.json", _queue())
    pool = _write(tmp_path / "pool.json", {"selected_urls": [{"url": "https://safe.example/"}]})
    report = _write(
        tmp_path / "report.json",
        {
            "contacts": [
                {"url": "https://safe.example/a", "method": "GET", "success": False, "status": 429},
                {"url": "https://safe.example/b", "method": "GET", "success": False, "status": 429},
            ]
        },
    )
    result = run_world_red_closed_loop(
        tmp_path,
        owner_pool=owner,
        target_queue=queue,
        url_pool=pool,
        red_reports=[report],
        now=now,
    )
    assert result["guard_change_proposals"]
    assert all(item["self_approved"] is False for item in result["guard_change_proposals"])
    assert all(item["requires_policy_owner_approval"] is True for item in result["guard_change_proposals"])
    assert result["capabilities"]["guard_self_approval"] is False


def test_synthetic_winning_memory_is_hint_only(tmp_path: Path):
    now = 2_000_000_000
    owner = _write(tmp_path / "owner.json", _owner_pool(now))
    queue = _write(tmp_path / "queue.json", _queue())
    pool = _write(tmp_path / "pool.json", {"selected_urls": [{"url": "https://safe.example/"}]})
    synthetic = _write(
        tmp_path / "synthetic.json",
        {
            "winning_memory": [
                {"method": "GET", "path": "/status", "success": True, "credential": "synthetic-secret"},
                {"method": "POST", "path": "/mutate", "success": True},
            ]
        },
    )
    result = run_world_red_closed_loop(
        tmp_path,
        owner_pool=owner,
        target_queue=queue,
        url_pool=pool,
        synthetic_report=synthetic,
        now=now,
    )
    assert result["synthetic_strategy_hints"] == [
        {
            "method": "GET",
            "path": "/status",
            "synthetic_success": True,
            "non_executable": True,
            "requires_existing_authorized_url": True,
        }
    ]
