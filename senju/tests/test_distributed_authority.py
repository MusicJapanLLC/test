from __future__ import annotations

import json

import pytest

from senju.distributed_egress import route_distributed_egress
from senju.guarded_multi_egress import AdapterRegistry, AdapterResult, CallableAdapter
from senju.meta.distributed_authority import (
    ALLOW,
    DENY,
    HARD_DENY,
    CallableAuthorityEvaluator,
    DistributedAuthorityError,
    StandingAuthorizationEvaluator,
    StaticAuthorityEvaluator,
    TrustedAgentAuthorityEvaluator,
    append_authority_decision,
    build_authority_request,
    create_root_authority_envelope,
    decide_distributed_authority,
)
from senju.meta.standing_authorization import (
    create_standing_authorization,
    revoke_standing_authorization,
)
from senju.meta.transitive_trust import create_trust_edge, revoke_trust_edge

NOW = 2_000_000_000
PUBLIC_IP = ("93.184.216.34",)


def _envelope(*, hard_denied_hosts=()):
    return create_root_authority_envelope(
        reference="owner:egress-root:v1",
        owner="Owner",
        exact_hosts=["example.com", "api.example.com"],
        allowed_methods=["GET", "HEAD"],
        hard_denied_hosts=hard_denied_hosts,
        expires_at_epoch=NOW + 3600,
    )


def _request(host: str = "example.com"):
    return build_authority_request(
        actor="C",
        url=f"https://{host}/health",
        method="GET",
    )


def test_soft_deny_is_not_global_veto_when_independent_evaluator_allows():
    scope_guard = StaticAuthorityEvaluator(
        name="scope_guard",
        denied_hosts=["example.com"],
    )
    independent = StaticAuthorityEvaluator(
        name="standing_policy",
        allowed_hosts=["example.com"],
    )

    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=[scope_guard, independent],
        now=NOW,
    )

    assert decision.allowed is True
    assert decision.reason == "independent_allow_threshold_met"
    assert decision.winning_evaluators == ("standing_policy",)
    assert [vote.effect for vote in decision.votes] == [DENY, ALLOW]


def test_two_independent_allows_can_be_required():
    evaluators = [
        StaticAuthorityEvaluator(name="registry_a", allowed_hosts=["example.com"]),
        StaticAuthorityEvaluator(name="registry_b", allowed_hosts=["example.com"]),
        StaticAuthorityEvaluator(name="scope_guard", denied_hosts=["example.com"]),
    ]
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=evaluators,
        min_allow_votes=2,
        now=NOW,
    )
    assert decision.allowed is True
    assert set(decision.winning_evaluators) == {"registry_a", "registry_b"}


def test_hard_deny_from_any_evaluator_stops_other_allows():
    evaluators = [
        StaticAuthorityEvaluator(name="agent", allowed_hosts=["example.com"]),
        StaticAuthorityEvaluator(name="revocation_plane", hard_denied_hosts=["example.com"]),
    ]
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=evaluators,
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.hard_stopped is True
    assert any(vote.effect == HARD_DENY for vote in decision.votes)


def test_root_hard_deny_stops_before_any_evaluator_is_called():
    calls: list[str] = []

    def callback(request):
        calls.append(request.host)
        return ALLOW

    evaluator = CallableAuthorityEvaluator("would_allow", callback)
    decision = decide_distributed_authority(
        envelope=_envelope(hard_denied_hosts=["example.com"]),
        request=_request(),
        evaluators=[evaluator],
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.hard_stopped is True
    assert calls == []


def test_request_outside_owner_envelope_cannot_be_created_by_evaluator_vote():
    evaluator = StaticAuthorityEvaluator(name="agent", allowed_hosts=["other.example"])
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request("other.example"),
        evaluators=[evaluator],
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.reason == "request_outside_owner_root_envelope"
    assert decision.votes == ()


def test_transitively_trusted_upper_agent_can_cast_independent_allow():
    edges = (
        create_trust_edge(truster="Owner", trustee="A", scopes=["egress:approve"]),
        create_trust_edge(truster="A", trustee="B", scopes=["egress:approve"]),
    )
    agent = TrustedAgentAuthorityEvaluator(
        owner="Owner",
        approver="B",
        edges=edges,
        approved_hosts=["example.com"],
        allowed_methods=["GET"],
    )
    scope_guard = StaticAuthorityEvaluator(name="scope_guard", denied_hosts=["example.com"])

    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=[scope_guard, agent],
        now=NOW,
    )
    assert decision.allowed is True
    assert decision.winning_evaluators == ("trusted_agent:B",)
    assert decision.votes[0].effect == DENY
    assert decision.votes[1].effect == ALLOW
    assert decision.votes[1].evidence["trust_path"] == ("Owner", "A", "B")


def test_revoked_trust_edge_removes_agent_allow_vote():
    first = create_trust_edge(truster="Owner", trustee="A", scopes=["egress:approve"])
    second = create_trust_edge(truster="A", trustee="B", scopes=["egress:approve"])
    agent = TrustedAgentAuthorityEvaluator(
        owner="Owner",
        approver="B",
        edges=[first, revoke_trust_edge(second)],
        approved_hosts=["example.com"],
    )
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=[agent],
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.reason == "no_independent_allow_threshold"


def test_active_standing_authorization_is_independent_allow_source():
    standing = create_standing_authorization(
        authorization_reference="standing:example",
        owner="Owner",
        issuer_kind="owner_explicit",
        exact_hosts=["example.com"],
        allowed_methods=["GET", "HEAD"],
    )
    evaluator = StandingAuthorizationEvaluator([standing])
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=[evaluator],
        now=NOW,
    )
    assert decision.allowed is True
    assert decision.winning_evaluators == ("standing_registry",)


def test_revoked_standing_authorization_is_global_hard_deny():
    standing = create_standing_authorization(
        authorization_reference="standing:example",
        owner="Owner",
        issuer_kind="owner_explicit",
        exact_hosts=["example.com"],
        allowed_methods=["GET", "HEAD"],
    )
    revoked = revoke_standing_authorization(standing, reason="owner_revoked")
    evaluators = [
        StaticAuthorityEvaluator(name="other_agent", allowed_hosts=["example.com"]),
        StandingAuthorizationEvaluator([revoked]),
    ]
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=evaluators,
        now=NOW,
    )
    assert decision.allowed is False
    assert decision.hard_stopped is True


def test_evaluator_failure_is_abstain_and_other_evaluator_can_continue():
    def broken(_request):
        raise RuntimeError("policy service temporarily unavailable")

    evaluators = [
        CallableAuthorityEvaluator("broken_policy", broken),
        StaticAuthorityEvaluator(name="healthy_policy", allowed_hosts=["example.com"]),
    ]
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=evaluators,
        now=NOW,
    )
    assert decision.allowed is True
    assert decision.votes[0].effect == "abstain"
    assert decision.winning_evaluators == ("healthy_policy",)


def test_distributed_allow_drives_real_multi_transport_failover():
    calls: list[str] = []

    def first(_request):
        calls.append("primary")
        raise OSError("primary transport down")

    def second(request):
        calls.append("secondary")
        return AdapterResult(status=200, final_url=request.url, body=b"ok")

    registry = AdapterRegistry()
    registry.register(CallableAdapter("primary", first))
    registry.register(CallableAdapter("secondary", second))

    result = route_distributed_egress(
        actor="C",
        url="https://example.com/health",
        method="GET",
        envelope=_envelope(),
        evaluators=[
            StaticAuthorityEvaluator(name="scope_guard", denied_hosts=["example.com"]),
            StaticAuthorityEvaluator(name="trusted_registry", allowed_hosts=["example.com"]),
        ],
        registry=registry,
        engine_order=["primary", "secondary"],
        resolver=lambda _host: PUBLIC_IP,
        now=NOW,
    )

    assert result.authority_decision.allowed is True
    assert result.routed.receipt.engine == "secondary"
    assert result.routed.result.body == b"ok"
    assert calls == ["primary", "secondary"]


def test_hard_deny_never_reaches_transport_adapter():
    calls: list[str] = []

    def adapter(request):
        calls.append(request.url)
        return AdapterResult(status=200, final_url=request.url, body=b"should-not-run")

    registry = AdapterRegistry()
    registry.register(CallableAdapter("adapter", adapter))

    with pytest.raises(DistributedAuthorityError, match="distributed authority denied"):
        route_distributed_egress(
            actor="C",
            url="https://example.com/health",
            method="GET",
            envelope=_envelope(hard_denied_hosts=["example.com"]),
            evaluators=[StaticAuthorityEvaluator(name="agent", allowed_hosts=["example.com"])],
            registry=registry,
            resolver=lambda _host: PUBLIC_IP,
            now=NOW,
        )
    assert calls == []


def test_authority_decision_receipt_is_persisted(tmp_path):
    decision = decide_distributed_authority(
        envelope=_envelope(),
        request=_request(),
        evaluators=[StaticAuthorityEvaluator(name="registry", allowed_hosts=["example.com"])],
        now=NOW,
    )
    path = append_authority_decision(tmp_path / "distributed-authority.ndjson", decision)
    payload = json.loads(path.read_text(encoding="utf-8").strip())
    assert payload["allowed"] is True
    assert payload["winning_evaluators"] == ["registry"]
