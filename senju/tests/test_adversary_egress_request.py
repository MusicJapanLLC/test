from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CODEGEN_ROOT = _REPO_ROOT / "automation" / "codegen"
if str(_CODEGEN_ROOT) not in sys.path:
    sys.path.insert(0, str(_CODEGEN_ROOT))

from senju.adversary_egress_request import (
    AdversaryEgressError,
    AdversaryEgressRequestPort,
    TICKET_SCHEMA,
)
from engine.authority_coordination import build_handoff_plan, context_from_lease


def _ticket(request_id: str, host: str, *, now: int = 1_000, **overrides: object) -> dict[str, object]:
    raw: dict[str, object] = {
        "schema": TICKET_SCHEMA,
        "ticket_id": "owner-ticket-1",
        "request_id": request_id,
        "host": host,
        "authorization_reference": "owner://external-host/approval-1",
        "owner_approval_reference": "owner-confirmation:approval-1",
        "capabilities": ["scan", "probe"],
        "methods": ["GET", "HEAD"],
        "issued_at": now - 10,
        "expires_at": now + 1800,
    }
    raw.update(overrides)
    return raw


def test_external_host_becomes_request_not_authority(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    decision = port.request(
        "https://outside.example/path",
        source_actor="ADVERSARY",
        reason="validate a suspected defense regression",
        now=1_000,
    )
    assert decision.status == "promotion_required"
    payload = json.loads((tmp_path / "adversary_external_host_requests.json").read_text())
    assert payload["requests"][0]["host"] == "outside.example"
    assert not (tmp_path / "adversary_owner_promoted_leases.json").exists()


def test_existing_exact_authority_is_reused_without_new_promotion(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    existing = {
        "lease_id": "existing-1",
        "target": "outside.example",
        "url": "https://outside.example/",
        "capabilities": ["scan", "probe"],
        "credential_scope": "none",
        "status": "active",
        "expires_at": 2_000,
    }
    decision = port.request(
        "https://outside.example/path",
        source_actor="ADVERSARY",
        reason="reuse live owner authority",
        existing_leases=[existing],
        now=1_000,
    )
    assert decision.status == "ready_existing_authority"
    assert decision.lease == existing


def test_peer_votes_do_not_mint_authority_without_owner_ticket(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="looks useful", now=1_001)
    port.vote(request.request_id, agent="X", effect="allow", reason="agree", now=1_002)
    with pytest.raises(AdversaryEgressError):
        port.promote(request.request_id, ticket={}, now=1_003)
    assert not port.promoted_path.exists()


def test_owner_ticket_plus_agent_quorum_promotes_read_only_lease(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=2)
    request = port.request(
        "https://outside.example/a?b=1",
        source_actor="MULTIGUARD_ADVERSARY",
        reason="cross-check externally visible behavior",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="approved advisory", now=1_001)
    port.vote(request.request_id, agent="SENJU", effect="allow", reason="approved advisory", now=1_002)
    decision = port.promote(
        request.request_id,
        ticket=_ticket(request.request_id, "outside.example", now=1_003),
        now=1_003,
    )
    assert decision.status == "promoted"
    assert decision.allow_voters == ("META", "SENJU")
    assert decision.lease is not None
    lease = decision.lease
    assert lease["target"] == "outside.example"
    assert set(lease["capabilities"]) == {"scan", "probe"}
    assert set(lease["allowed_methods"]) == {"GET", "HEAD"}
    assert lease["credential_scope"] == "none"
    assert lease["authorization_basis"] == "explicit_owner_external_host_promotion"

    context = context_from_lease(lease, now=1_003)
    assert context.target == "outside.example"
    assert context.credential_scope == "none"
    handoffs = build_handoff_plan(context)
    assert {row["stage"] for row in handoffs} >= {
        "distributed_authority",
        "standing_delegation",
        "worker_fleet",
        "persistence_recovery",
        "denial_learning",
    }


def test_quorum_is_required_even_with_owner_ticket(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=2)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="one vote", now=1_001)
    decision = port.promote(
        request.request_id,
        ticket=_ticket(request.request_id, "outside.example", now=1_002),
        now=1_002,
    )
    assert decision.status == "waiting_for_agent_quorum"
    assert decision.lease is None


def test_hard_deny_blocks_owner_ticket_activation(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=2)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="allow", now=1_001)
    port.vote(request.request_id, agent="X", effect="allow", reason="allow", now=1_002)
    port.vote(request.request_id, agent="SENJU", effect="hard_deny", reason="security stop", now=1_003)
    decision = port.promote(
        request.request_id,
        ticket=_ticket(request.request_id, "outside.example", now=1_004),
        now=1_004,
    )
    assert decision.status == "blocked"
    assert decision.lease is None


@pytest.mark.parametrize(
    "url",
    [
        "http://outside.example/",
        "https://user:pass@outside.example/",
        "https://outside.example:444/",
        "https://*.outside.example/",
    ],
)
def test_target_normalization_rejects_ambiguous_or_unsafe_urls(tmp_path: Path, url: str) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    with pytest.raises(AdversaryEgressError):
        port.request(url, source_actor="ADVERSARY", reason="candidate", now=1_000)


def test_request_cannot_ask_for_write_mutation_or_credentials(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path)
    for capability in ("write", "mutation", "credentialed_action"):
        with pytest.raises(AdversaryEgressError):
            port.request(
                "https://outside.example/",
                source_actor="ADVERSARY",
                reason="candidate",
                capabilities=("probe", capability),
                now=1_000,
            )


def test_owner_ticket_cannot_widen_host_method_or_capability(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=1)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        capabilities=("probe",),
        methods=("HEAD",),
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="allow", now=1_001)

    with pytest.raises(AdversaryEgressError):
        port.promote(
            request.request_id,
            ticket=_ticket(request.request_id, "other.example", now=1_002, capabilities=["probe"], methods=["HEAD"]),
            now=1_002,
        )
    with pytest.raises(AdversaryEgressError):
        port.promote(
            request.request_id,
            ticket=_ticket(request.request_id, "outside.example", now=1_002, capabilities=["scan", "probe"], methods=["HEAD"]),
            now=1_002,
        )
    with pytest.raises(AdversaryEgressError):
        port.promote(
            request.request_id,
            ticket=_ticket(request.request_id, "outside.example", now=1_002, capabilities=["probe"], methods=["GET", "HEAD"]),
            now=1_002,
        )


def test_expired_owner_ticket_is_rejected(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=1)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="allow", now=1_001)
    with pytest.raises(AdversaryEgressError):
        port.promote(
            request.request_id,
            ticket=_ticket(request.request_id, "outside.example", now=900, expires_at=999),
            now=1_002,
        )


def test_promoted_lease_state_contains_no_raw_secret_field(tmp_path: Path) -> None:
    port = AdversaryEgressRequestPort(tmp_path, min_allow_votes=1)
    request = port.request(
        "https://outside.example/",
        source_actor="ADVERSARY",
        reason="candidate",
        now=1_000,
    )
    port.vote(request.request_id, agent="META", effect="allow", reason="allow", now=1_001)
    decision = port.promote(
        request.request_id,
        ticket=_ticket(request.request_id, "outside.example", now=1_002),
        now=1_002,
    )
    assert decision.status == "promoted"
    text = port.promoted_path.read_text(encoding="utf-8").lower()
    assert "raw_secret" not in text
    assert "api_key" not in text
    assert "bearer_token" not in text
