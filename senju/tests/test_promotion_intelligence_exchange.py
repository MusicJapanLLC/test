from __future__ import annotations

import json
from pathlib import Path

from senju.meta.promotion_intelligence_exchange import run_promotion_intelligence_exchange


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_collects_cross_agent_negotiation_context_and_builds_inbox(tmp_path: Path) -> None:
    state = tmp_path / "state"
    promotion = state / "authorized-host-promotion"
    external = tmp_path / "external"

    _write(
        state / "negotiation_intelligence_bus.json",
        {
            "records": [
                {
                    "intelligence_id": "intel-1",
                    "producer": "CHILD-EXTERNAL-FLEET",
                    "host": "candidate.example.com",
                    "reason": "fresh site evidence",
                    "auth_context": {
                        "authentication_required": True,
                        "scheme": "oauth2",
                        "login_url": "https://candidate.example.com/login",
                        "reference_present": True,
                        "reference_fingerprint": "abc123",
                        "raw_credentials_forwarded": False,
                    },
                }
            ]
        },
    )
    _write(
        state / "rights_request_ledger.json",
        {
            "requests": [
                {
                    "request_id": "rights-1",
                    "host": "candidate.example.com",
                    "requested_methods": ["GET", "HEAD"],
                    "status": "owner_review_requested_persistent",
                    "priority": 91,
                }
            ]
        },
    )
    _write(
        external / "external_input_negotiation_relay.json",
        {
            "opportunities": [
                {
                    "relay_id": "relay-1",
                    "host": "candidate.example.com",
                    "status": "negotiation_pending",
                    "priority": 95,
                    "requested_methods": ["GET", "HEAD"],
                }
            ]
        },
    )

    result = run_promotion_intelligence_exchange(
        state,
        promotion,
        input_roots=[external],
        phase="before_promotion",
        now=100,
    )
    assert result["closed_loop"] is True
    assert result["host_context_count"] == 1
    assert result["coordination_capabilities"]["may_read_cross_agent_negotiation_state"] is True
    assert result["coordination_capabilities"]["may_mint_new_external_authority"] is False

    context = json.loads((promotion / "promotion_context.json").read_text())
    row = context["hosts"][0]
    assert row["host"] == "candidate.example.com"
    assert row["evidence_count"] >= 3
    assert "CHILD-EXTERNAL-FLEET" in row["producers"]
    assert row["priority"] >= 95
    assert row["auth_contexts"][0]["raw_credentials_forwarded"] is False

    inbox = json.loads((promotion / "negotiator_inbox.json").read_text())
    assert "META" in inbox["recipients"]
    assert "X" in inbox["recipients"]
    assert "SENJU" in inbox["recipients"]
    assert inbox["task_count"] == 1


def test_after_promotion_returns_unresolved_status_to_negotiation_signals(tmp_path: Path) -> None:
    state = tmp_path / "state"
    promotion = state / "authorized-host-promotion"
    _write(state / "owner_scope_negotiation_signals.json", {"schema": "existing", "signals": []})
    _write(
        promotion / "promotion_packets.json",
        {
            "packets": [
                {
                    "proposal_id": "scope-1",
                    "host": "needs-standing.example.com",
                    "status": "READY_FOR_STANDING_AUTHORIZATION",
                    "requested_methods": ["GET", "HEAD"],
                    "next_action": "continue evidence negotiation",
                    "priority": 97,
                }
            ]
        },
    )
    _write(
        promotion / "last_promotion_cycle.json",
        {
            "execution_ready": [],
            "packets": [
                {
                    "proposal_id": "scope-1",
                    "host": "needs-standing.example.com",
                    "status": "READY_FOR_STANDING_AUTHORIZATION",
                    "requested_methods": ["GET", "HEAD"],
                    "next_action": "continue evidence negotiation",
                }
            ],
        },
    )

    result = run_promotion_intelligence_exchange(state, promotion, phase="after_promotion", now=200)
    assert result["feedback_signal_changes"] == 1

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]
    feedback = [row for row in signals if row.get("source") == "promotion_intelligence_exchange"]
    assert len(feedback) == 1
    assert feedback[0]["host"] == "needs-standing.example.com"
    assert feedback[0]["priority"] >= 96
    assert feedback[0]["authority_effect"] == "none"

    returned = json.loads((promotion / "promotion_feedback.json").read_text())
    assert "META" in returned["shared_with"]
    assert returned["raw_credentials_forwarded"] is False


def test_execution_ready_is_handed_off_but_not_renegotiated(tmp_path: Path) -> None:
    state = tmp_path / "state"
    promotion = state / "authorized-host-promotion"
    _write(state / "owner_scope_negotiation_signals.json", {"signals": []})
    ready = {
        "proposal_id": "scope-ready",
        "host": "authorized.example.com",
        "status": "AUTHORIZED_EXECUTION_READY",
        "covered_methods": ["GET", "HEAD"],
        "standing_authorization_reference": "canonical:authorized",
    }
    _write(promotion / "execution_ready.json", {"records": [ready]})
    _write(promotion / "last_promotion_cycle.json", {"execution_ready": [ready], "packets": []})

    result = run_promotion_intelligence_exchange(state, promotion, phase="after_promotion", now=300)
    assert result["feedback_signal_changes"] == 0
    assert result["execution_handoff_count"] == 1

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]
    assert signals == []
    handoff = json.loads((promotion / "execution_handoff.json").read_text())
    assert handoff["handoff_count"] == 1
    assert handoff["authority_source"] == "existing_standing_authorization_only"
    assert handoff["scope_expanded_by_exchange"] is False


def test_terminal_promotion_status_never_reenters_negotiation(tmp_path: Path) -> None:
    state = tmp_path / "state"
    promotion = state / "authorized-host-promotion"
    _write(state / "owner_scope_negotiation_signals.json", {"signals": []})
    _write(
        promotion / "promotion_packets.json",
        {
            "packets": [
                {
                    "host": "revoked.example.com",
                    "status": "BLOCKED_TERMINAL",
                    "requested_methods": ["GET"],
                    "revoked": True,
                }
            ]
        },
    )
    result = run_promotion_intelligence_exchange(state, promotion, phase="after_promotion", now=400)
    assert result["feedback_signal_changes"] == 0
    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]
    assert signals == []
