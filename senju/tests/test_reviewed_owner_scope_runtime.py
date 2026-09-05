from __future__ import annotations

import json
from pathlib import Path

from senju.reviewed_owner_scope_runtime import run_reviewed_production_scope_negotiation_cycle


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(tmp_path: Path) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    state.mkdir(parents=True)
    _write(repo / "senju" / "config" / "owner-expansion-envelope.json", {
        "envelope_id": "test-envelope",
        "proof_types": ["existing_standing_authorization", "owner_verified_domain", "owner_exact_link"],
        "auto_apply_proof_types": ["existing_standing_authorization"],
        "new_host_methods": ["GET", "HEAD", "OPTIONS"],
        "existing_host_method_ceiling": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "allow_http": False,
        "allow_delete": False,
        "allow_private_network": False,
        "credential_scope": "none",
        "min_confidence": 70,
        "negotiation_intensity": 60,
    })
    _write(state / "standing_authorizations.json", {"records": []})
    return repo, state


def test_admitted_case_is_only_case_that_starts_formal_owner_discussion(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": "reviewed.example",
            "signal_id": "sig-reviewed",
            "reason": "bounded review request",
            "requested_methods": ["GET"],
            "authority_effect": "none",
        }]
    })
    result = run_reviewed_production_scope_negotiation_cycle(repo, state, now=1000)
    assert result["intake_review"]["admitted_count"] == 1
    assert result["formal_discussion_started_case_count"] == 1
    assert result["campaign"]["proposal_count"] == 1
    assert result["result"]["auto_applied_count"] == 0


def test_held_case_does_not_start_owner_formal_discussion(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "negotiation_intelligence_bus.json", {
        "records": [{
            "host": "held.example",
            "intelligence_id": "intel-held",
            "reason": "contains unsafe pre-grant metadata",
            "raw_credentials_forwarded": True,
            "authority_effect": "granted",
        }]
    })
    result = run_reviewed_production_scope_negotiation_cycle(repo, state, now=1000)
    assert result["intake_review"]["held_count"] == 1
    assert result["formal_discussion_started_case_count"] == 0
    assert result["campaign"]["proposal_count"] == 0
    assert result["campaign"]["task_count"] == 0
