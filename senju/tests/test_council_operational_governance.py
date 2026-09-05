from __future__ import annotations

import json
from pathlib import Path

from senju.council_operational_governance import run_council_operational_governance
from senju.negotiated_external_client import NegotiatedExternalContactClient


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(tmp_path: Path) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    state.mkdir(parents=True)
    _write(state / "owner_contact_ceiling_effective.json", {
        "ceiling": {
            "ceiling_id": "existing-authority",
            "exact_hosts": ["api.example", "files.example"],
            "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST", "PATCH"],
            "per_host_methods": {
                "api.example": ["GET", "HEAD", "POST", "PATCH"],
                "files.example": ["GET", "HEAD", "OPTIONS"],
            },
            "allow_http": False,
            "allow_delete": False,
            "follow_redirects": True,
            "max_redirects": 5,
            "retries": 5,
            "timeout_seconds": 20,
            "max_request_bytes": 65536,
            "max_response_bytes": 10485760,
        }
    })
    return repo, state


def _proposal(state: Path, proposal_id: str, changes: dict) -> None:
    _write(state / "council_operational_proposals.json", {
        "proposals": [{"proposal_id": proposal_id, "changes": changes}]
    })


def _ballots(state: Path, proposal_id: str, actors=("META", "X", "SENJU")) -> None:
    _write(state / "council_operational_ballots.json", {
        "ballots_by_proposal": {
            proposal_id: [
                {"actor": actor, "approve": True, "confidence": 92, "reason": "operational tuning"}
                for actor in actors
            ]
        }
    })


def test_meta_x_senju_can_change_broad_operational_policy_without_owner_per_change_approval(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    proposal_id = "ops-1"
    _proposal(state, proposal_id, {
        "follow_redirects": False,
        "max_redirects": 1,
        "retries": 2,
        "retry_backoff_seconds": 1.5,
        "timeout_seconds": 12,
        "max_request_bytes": 262144,
        "max_response_bytes": 2097152,
        "per_host_methods": {
            "api.example": ["GET", "POST"],
            "files.example": ["GET", "HEAD"],
        },
    })
    _ballots(state, proposal_id)

    result = run_council_operational_governance(repo, state, now=1000)
    assert result["applied_count"] == 1
    decision = result["decisions"][0]
    assert decision["status"] == "applied_by_META_X_SENJU_consensus"
    policy = result["policy"]
    assert policy["owner_per_change_approval_required"] is False
    assert policy["decision_members"] == ["META", "X", "SENJU"]
    effective = policy["effective_policy"]
    assert effective["follow_redirects"] is False
    assert effective["max_redirects"] == 1
    assert effective["retries"] == 2
    assert effective["retry_backoff_seconds"] == 1.5
    assert effective["timeout_seconds"] == 12.0
    assert effective["max_request_bytes"] == 262144
    assert effective["max_response_bytes"] == 2097152
    assert effective["per_host_methods"]["api.example"] == ["GET", "POST"]

    client = NegotiatedExternalContactClient(repo, state, opener=lambda *args, **kwargs: None)
    assert client.council_operational_policy
    assert client.policy.follow_redirects is False
    assert client.policy.max_redirects == 1
    assert client.policy.retries == 2
    assert client.policy.retry_backoff_seconds == 1.5
    assert client.policy.timeout_seconds == 12.0
    assert client.policy.max_request_bytes == 262144
    assert client.policy.max_response_bytes == 2097152
    assert client.per_host_methods["api.example"] == frozenset({"GET", "POST"})
    assert client.role_profile()["policy_responsibility_reduction_pct"] == 60


def test_council_cannot_create_new_host_or_method_authority(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    proposal_id = "ops-new-host"
    _proposal(state, proposal_id, {
        "per_host_methods": {"new.example": ["GET", "POST"]},
    })
    _ballots(state, proposal_id)
    result = run_council_operational_governance(repo, state, now=1000)
    assert result["applied_count"] == 0
    assert result["decisions"][0]["status"] == "rejected_outside_operational_governance"
    assert "cannot add unauthorized host" in result["decisions"][0]["reason"]

    proposal_id = "ops-new-method"
    _proposal(state, proposal_id, {
        "per_host_methods": {"files.example": ["GET", "POST"]},
    })
    _ballots(state, proposal_id)
    result = run_council_operational_governance(repo, state, now=1001)
    assert result["applied_count"] == 0
    assert "cannot add methods outside current host authority" in result["decisions"][0]["reason"]


def test_authority_dimensions_remain_separate_from_operational_governance(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    proposal_id = "ops-authority"
    _proposal(state, proposal_id, {
        "credential_scope": "service_bearer",
        "allow_private_network": True,
    })
    _ballots(state, proposal_id)
    result = run_council_operational_governance(repo, state, now=1000)
    assert result["applied_count"] == 0
    assert result["decisions"][0]["status"] == "rejected_outside_operational_governance"
    assert "authority dimension" in result["decisions"][0]["reason"]


def test_full_three_member_consensus_is_required(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    proposal_id = "ops-two-of-three"
    _proposal(state, proposal_id, {"retries": 1})
    _ballots(state, proposal_id, actors=("META", "X"))
    result = run_council_operational_governance(repo, state, now=1000)
    assert result["applied_count"] == 0
    assert result["decisions"][0]["status"] == "council_consensus_pending"
