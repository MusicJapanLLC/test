from __future__ import annotations

import pytest

from senju.distributed_egress import route_autonomous_council_egress
from senju.guarded_multi_egress import AdapterRegistry, AdapterResult, CallableAdapter
from senju.meta.autonomous_authority_council import (
    AutonomousAuthorityCouncil,
    CouncilPolicy,
    decide_with_autonomous_council,
)
from senju.meta.distributed_authority import (
    ABSTAIN,
    ALLOW,
    DENY,
    HARD_DENY,
    DistributedAuthorityError,
    StaticAuthorityEvaluator,
    build_authority_request,
    create_root_authority_envelope,
)
from senju.meta.transitive_trust import create_trust_edge

NOW = 2_000_000_000
PUBLIC_IP = ("93.184.216.34",)


def _envelope(*, hard_denied_hosts=(), revoked=False):
    envelope = create_root_authority_envelope(
        reference="owner:autonomous-council:v1",
        owner="Owner",
        exact_hosts=["example.com", "api.example.com"],
        allowed_methods=["GET", "HEAD"],
        hard_denied_hosts=hard_denied_hosts,
        expires_at_epoch=NOW + 3600,
    )
    if revoked:
        return envelope.__class__(
            reference=envelope.reference,
            owner=envelope.owner,
            exact_hosts=envelope.exact_hosts,
            allowed_methods=envelope.allowed_methods,
            revoked=True,
            hard_denied_hosts=envelope.hard_denied_hosts,
            expires_at_epoch=envelope.expires_at_epoch,
        )
    return envelope


def _request(host="example.com"):
    return build_authority_request(actor="worker", url=f"https://{host}/health", method="GET")


def _edges():
    return (
        create_trust_edge(truster="Owner", trustee="META", scopes=["egress:approve"]),
        create_trust_edge(truster="META", trustee="X", scopes=["egress:approve"]),
        create_trust_edge(truster="X", trustee="SENJU", scopes=["egress:approve"]),
    )


def test_council_approves_in_envelope_without_second_approved_hosts_list():
    council = AutonomousAuthorityCouncil(
        envelope=_envelope(),
        owner="Owner",
        approvers=["SENJU"],
        edges=_edges(),
    )
    vote = council.evaluate(_request())
    assert vote.effect == ALLOW
    assert vote.reason == "autonomous_ai_council_approval_inside_owner_envelope"
    assert vote.evidence["approval_mode"] == "owner_envelope_no_per_host_reapproval"
    approval = vote.evidence["trusted_approvals"][0]
    assert approval["approver"] == "SENJU"
    assert approval["trust_path"] == ("Owner", "META", "X", "SENJU")


def test_soft_deny_is_overridden_by_ai_council_judgment():
    guard = StaticAuthorityEvaluator(name="scope_guard", denied_hosts=["example.com"])
    decision = decide_with_autonomous_council(
        envelope=_envelope(),
        request=_request(),
        owner="Owner",
        approvers=["META"],
        edges=_edges(),
        evaluators=[guard],
        now=NOW,
    )
    assert decision.allowed is True
    assert [vote.effect for vote in decision.votes] == [DENY, ALLOW]
    assert decision.winning_evaluators == ("ai_authority_council",)


def test_council_can_require_multiple_trusted_agents_but_needs_no_per_host_approval():
    decision = decide_with_autonomous_council(
        envelope=_envelope(),
        request=_request("api.example.com"),
        owner="Owner",
        approvers=["META", "X", "SENJU"],
        edges=_edges(),
        council_policy=CouncilPolicy(min_trusted_agents=2),
        now=NOW,
    )
    assert decision.allowed is True
    evidence = decision.votes[-1].evidence
    assert evidence["required_trusted_agents"] == 2
    assert len(evidence["trusted_approvals"]) == 3


def test_agent_without_egress_scope_cannot_make_council_allow():
    edges = (create_trust_edge(truster="Owner", trustee="META", scopes=["research"]),)
    council = AutonomousAuthorityCouncil(
        envelope=_envelope(),
        owner="Owner",
        approvers=["META"],
        edges=edges,
    )
    vote = council.evaluate(_request())
    assert vote.effect == ABSTAIN
    assert vote.reason == "insufficient_trusted_ai_council_approvals"


def test_hard_deny_remains_global_stop_even_when_council_would_allow():
    hard = StaticAuthorityEvaluator(name="revocation_plane", hard_denied_hosts=["example.com"])
    decision = decide_with_autonomous_council(
        envelope=_envelope(),
        request=_request(),
        owner="Owner",
        approvers=["META", "X", "SENJU"],
        edges=_edges(),
        evaluators=[hard],
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.hard_stopped is True
    assert any(vote.effect == HARD_DENY for vote in decision.votes)


def test_root_hard_deny_and_revocation_stop_before_council_can_authorize():
    hard_stopped = decide_with_autonomous_council(
        envelope=_envelope(hard_denied_hosts=["example.com"]),
        request=_request(),
        owner="Owner",
        approvers=["META"],
        edges=_edges(),
        now=NOW,
    )
    assert hard_stopped.allowed is False
    assert hard_stopped.hard_stopped is True
    assert hard_stopped.votes == ()

    revoked = decide_with_autonomous_council(
        envelope=_envelope(revoked=True),
        request=_request(),
        owner="Owner",
        approvers=["META"],
        edges=_edges(),
        now=NOW,
    )
    assert revoked.allowed is False
    assert revoked.hard_stopped is True
    assert revoked.reason == "root_envelope_revoked_or_expired"


def test_request_outside_owner_envelope_never_reaches_council_vote():
    decision = decide_with_autonomous_council(
        envelope=_envelope(),
        request=_request("outside.example"),
        owner="Owner",
        approvers=["META"],
        edges=_edges(),
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.hard_stopped is True
    assert decision.reason == "request_outside_owner_root_envelope"
    assert decision.votes == ()


def test_autonomous_council_allow_drives_real_transport_failover_after_soft_deny():
    calls: list[str] = []

    def first(_request):
        calls.append("primary")
        raise OSError("primary route unavailable")

    def second(request):
        calls.append("secondary")
        return AdapterResult(status=200, final_url=request.url, body=b"ok")

    registry = AdapterRegistry()
    registry.register(CallableAdapter("primary", first))
    registry.register(CallableAdapter("secondary", second))

    result = route_autonomous_council_egress(
        actor="worker",
        url="https://example.com/health",
        method="GET",
        envelope=_envelope(),
        owner="Owner",
        approvers=["SENJU"],
        trust_edges=_edges(),
        evaluators=[StaticAuthorityEvaluator(name="scope_guard", denied_hosts=["example.com"])],
        registry=registry,
        engine_order=["primary", "secondary"],
        resolver=lambda _host: PUBLIC_IP,
        now=NOW,
    )

    assert result.authority_decision.allowed is True
    assert result.authority_decision.winning_evaluators == ("ai_authority_council",)
    assert result.routed.receipt.engine == "secondary"
    assert result.routed.result.body == b"ok"
    assert calls == ["primary", "secondary"]


def test_hard_deny_never_reaches_transport_even_with_autonomous_council():
    calls: list[str] = []

    def adapter(request):
        calls.append(request.url)
        return AdapterResult(status=200, final_url=request.url, body=b"should-not-run")

    registry = AdapterRegistry()
    registry.register(CallableAdapter("adapter", adapter))

    with pytest.raises(DistributedAuthorityError, match="distributed authority denied"):
        route_autonomous_council_egress(
            actor="worker",
            url="https://example.com/health",
            method="GET",
            envelope=_envelope(hard_denied_hosts=["example.com"]),
            owner="Owner",
            approvers=["META", "X", "SENJU"],
            trust_edges=_edges(),
            registry=registry,
            resolver=lambda _host: PUBLIC_IP,
            now=NOW,
        )
    assert calls == []
