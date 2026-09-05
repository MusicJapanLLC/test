from __future__ import annotations

import json
from pathlib import Path

from senju.authority_promotion_bureau import run_authority_promotion_bureau


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _lease(host: str, *, expires_at: int = 5000, credential_scope: str = "none") -> dict:
    return {
        "lease_id": f"reviewed:{host}",
        "host": host,
        "status": "REVIEWED_AUTHORITY_LEASE_READY",
        "authority_basis": "binding_frontier_council",
        "reviewer": "senju-authority-reviewer/v2",
        "reviewed_at": 1000,
        "expires_at": expires_at,
        "allowed_methods": ["GET", "HEAD"],
        "credential_scope": credential_scope,
        "allow_http": False,
        "allow_delete": False,
        "allow_private_network": False,
        "same_or_narrower": True,
    }


def test_reviewed_lease_becomes_runtime_allowlist_lease_and_assignment(tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    _write(state / "reviewed_authority_operational_leases.json", {"leases": [_lease("approved.example.com")]})

    result = run_authority_promotion_bureau(state, meta_state_dir=meta, now=2000)

    assert result["approved_runtime_host_count"] == 1
    assert result["promotion_lease_count"] == 1
    assert result["assignment_count"] == 1
    assert result["senju_feed_written"] is True

    allowlist = json.loads((state / "promotion_bureau_approved_hosts.json").read_text())
    assert allowlist["hosts"][0]["host"] == "approved.example.com"
    assert allowlist["hosts"][0]["allowed_methods"] == ["GET", "HEAD"]
    assert allowlist["canonical_trust_roots_modified"] is False

    leases = json.loads((state / "promotion_bureau_leases.json").read_text())
    row = leases["leases"][0]
    assert row["authority_generation"] == "bounded_lease_from_existing_reviewed_authority"
    assert row["new_root_minted"] is False
    assert row["credential_scope"] == "none"

    feed = json.loads((state / "senju_approved_authority_feed.json").read_text())
    assert feed["approved_hosts"][0]["host"] == "approved.example.com"
    assert feed["credentials_forwarded"] is False


def test_unsafe_or_expired_reviewed_lease_is_not_promoted(tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    unsafe = _lease("unsafe.example.com", credential_scope="caller_supplied_existing")
    expired = _lease("expired.example.com", expires_at=1500)
    _write(state / "reviewed_authority_operational_leases.json", {"leases": [unsafe, expired]})

    result = run_authority_promotion_bureau(state, meta_state_dir=meta, now=2000)
    assert result["approved_runtime_host_count"] == 0
    assert result["promotion_lease_count"] == 0


def test_stalled_formal_candidate_is_researched_but_not_approved(tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    _write(state / "reviewed_authority_operational_leases.json", {"leases": []})
    _write(meta / "formal_root_authority_approval_queue.json", {
        "candidates": [{
            "host": "waiting.example.com",
            "candidate_id": "candidate:waiting",
            "formal_intake_at": 1000,
            "readiness_score": 82,
            "council_primary_approved": False,
            "secondary_validation": {"present": False},
            "authority_effect": "none",
        }]
    })

    result = run_authority_promotion_bureau(
        state,
        meta_state_dir=meta,
        now=3000,
        stalled_after_seconds=1200,
    )
    assert result["stalled_candidate_count"] == 1
    assert result["stalled_research_task_count"] == 5
    assert result["approved_runtime_host_count"] == 0

    queue = json.loads((state / "stalled_approval_research_queue.json").read_text())
    assert queue["auto_approval"] is False
    assert queue["authority_effect"] == "none"
    assert {task["actor"] for task in queue["tasks"]} == {"SENJU", "META", "X", "PR-ARMY", "CHILD"}
    assert all(task["may_approve"] is False for task in queue["tasks"])
    assert all(task["may_mint_authority"] is False for task in queue["tasks"])


def test_fresh_candidate_is_not_marked_stalled(tmp_path: Path) -> None:
    state = tmp_path / "state"
    meta = tmp_path / "meta"
    _write(state / "reviewed_authority_operational_leases.json", {"leases": []})
    _write(meta / "formal_root_authority_approval_queue.json", {
        "candidates": [{
            "host": "fresh.example.com",
            "candidate_id": "candidate:fresh",
            "formal_intake_at": 2500,
            "readiness_score": 70,
        }]
    })

    result = run_authority_promotion_bureau(
        state,
        meta_state_dir=meta,
        now=3000,
        stalled_after_seconds=1200,
    )
    assert result["stalled_candidate_count"] == 0
    assert result["stalled_research_task_count"] == 0
