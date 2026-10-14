from __future__ import annotations

import json
from pathlib import Path

from senju.red_negotiation_bridge import CYCLE_PROFILES, run_red_negotiation_bridge


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_bridge_only_emits_runnable_scopes_for_authorized_hosts(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    standing = state / "standing_authorizations.json"
    _write(canonical, {
        "targets": [{
            "host": "owned.example",
            "base_url": "https://owned.example/",
            "owner_authorization": "explicit",
            "allowed_interactions": ["GET", "HEAD", "POST"],
            "rate_limit_rps": 5,
        }]
    })
    _write(standing, {"records": []})
    _write(state / "formal_approval_intake.json", {
        "cases": [{
            "case_id": "pending-1",
            "host": "pending.example",
            "source_score": 99,
            "requested_methods": ["GET", "POST"],
            "intake_status": "approved_for_formal_discussion",
        }]
    })

    result = run_red_negotiation_bridge(
        state,
        canonical_targets=canonical,
        standing_authorizations=standing,
        rotation=0,
        now=100,
    )

    assert result["authorized_target_count"] == 1
    assert result["selected_host"] == "owned.example"
    assert result["selected_scope"]["allowed_hosts"] == ["owned.example"]
    assert set(result["selected_scope"].keys()) >= {"cycle_profile", "max_contacts", "discovery_depth"}
    exchange = json.loads((state / "red_negotiation_exchange.json").read_text())
    assert exchange["pending_candidates_for_red_planning"][0]["host"] == "pending.example"
    assert exchange["pending_candidates_for_red_planning"][0]["transport_allowed"] is False


def test_negotiation_handoff_becomes_same_cycle_red_target(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    standing = state / "standing_authorizations.json"
    _write(canonical, {"targets": []})
    _write(standing, {"records": []})
    _write(state / "negotiation_authorization_handoffs.json", {
        "handoffs": [{
            "authorization": {
                "host": "granted.example",
                "allowed_methods": ["GET", "HEAD", "PUT"],
                "credential_scope": "none",
                "expires_at_epoch": 9999,
            },
            "requested_authority": {"host": "granted.example", "methods": ["GET", "HEAD"]},
        }]
    })

    result = run_red_negotiation_bridge(
        state,
        canonical_targets=canonical,
        standing_authorizations=standing,
        rotation=3,
        now=100,
    )
    assert result["authorized_target_count"] == 1
    assert result["selected_host"] == "granted.example"
    queue = json.loads((state / "red_authorized_target_queue.json").read_text())
    target = queue["targets"][0]
    assert target["sources"] == ["negotiation_authorization_handoff"]
    assert set(target["allowed_methods"]) <= {"GET", "HEAD", "OPTIONS"}
    assert result["selected_profile"] in CYCLE_PROFILES


def test_public_lab_standing_grant_is_runnable_but_rate_bounded(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    standing = state / "standing_authorizations.json"
    _write(canonical, {"targets": []})
    _write(standing, {
        "records": [{
            "issuer_kind": "operator_public_security_lab",
            "exact_hosts": ["lab.example"],
            "allowed_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "destructive": False,
            "revoked": False,
            "shared_instance": True,
            "rate_limit_rps": 1,
        }]
    })

    result = run_red_negotiation_bridge(
        state,
        canonical_targets=canonical,
        standing_authorizations=standing,
        now=100,
    )
    assert result["selected_scope"]["max_contacts"] == 8
    assert result["selected_scope"]["allow_http"] is False


def test_red_report_is_sanitized_into_negotiation_exchange(tmp_path: Path) -> None:
    state = tmp_path / "state"
    canonical = tmp_path / "AUTHORIZED_TEST_TARGETS.json"
    standing = state / "standing_authorizations.json"
    report = tmp_path / "red-report.json"
    _write(canonical, {"targets": [{
        "host": "owned.example",
        "base_url": "https://owned.example/",
        "owner_authorization": "explicit",
        "allowed_interactions": ["GET", "HEAD"],
    }]})
    _write(standing, {"records": []})
    _write(report, {
        "cycle_profile": "route_depth",
        "contacts": [{
            "url": "https://owned.example/a",
            "final_url": "https://owned.example/a",
            "status": 200,
            "response_bytes": 1234,
            "response_sha256": "deadbeef",
            "body": "must-not-forward",
            "headers": {"authorization": "must-not-forward"},
        }],
    })

    result = run_red_negotiation_bridge(
        state,
        canonical_targets=canonical,
        standing_authorizations=standing,
        red_reports=[report],
        now=100,
    )
    assert result["red_observation_count"] == 1
    exchange = json.loads((state / "red_negotiation_exchange.json").read_text())
    row = exchange["records"][0]
    assert row["host"] == "owned.example"
    assert row["response_sha256"] == "deadbeef"
    assert "body" not in row
    assert "headers" not in row
    assert row["raw_credentials_forwarded"] is False
