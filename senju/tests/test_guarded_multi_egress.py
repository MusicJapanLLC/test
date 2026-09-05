from __future__ import annotations

import subprocess

import pytest

from senju.guarded_multi_egress import (
    AdapterRegistry,
    AdapterResult,
    CallableAdapter,
    CurlAdapter,
    GuardedEgressError,
    RouteScore,
    authorize_request,
    route_guarded_request,
    run_guarded_egress_experiment,
)
from senju.transport_lab import ReviewedAuthority


NOW = 2_000_000_000


def _authority(*hosts: str) -> ReviewedAuthority:
    return ReviewedAuthority(
        hosts=frozenset(hosts),
        expires_at={host: NOW + 3600 for host in hosts},
    )


def _public_resolver(_host: str) -> tuple[str, ...]:
    return ("93.184.216.34",)


def test_denied_target_never_reaches_any_adapter():
    called = []
    registry = AdapterRegistry()
    registry.register(
        CallableAdapter(
            "browser",
            lambda request: called.append(request) or AdapterResult(200, request.url, b"ok"),
        )
    )

    with pytest.raises(Exception, match="authority|grant"):
        route_guarded_request(
            url="https://not-authorized.example/path",
            authority=_authority("allowed.example"),
            registry=registry,
            resolver=_public_resolver,
            now=NOW,
        )

    assert called == []


def test_independent_engines_fail_over_after_authority_preflight():
    calls = []
    registry = AdapterRegistry()

    def broken(request):
        calls.append(("broken", request.host))
        raise OSError("engine down")

    def working(request):
        calls.append(("working", request.host))
        return AdapterResult(200, request.url, b"hello", {"engine": "custom"})

    registry.register(CallableAdapter("websocket", broken))
    registry.register(CallableAdapter("connector", working))

    result = route_guarded_request(
        url="https://allowed.example/health",
        authority=_authority("allowed.example"),
        registry=registry,
        resolver=_public_resolver,
        now=NOW,
    )

    assert result.receipt.engine == "connector"
    assert result.receipt.authority_enforced is True
    assert result.receipt.guard_bypass is False
    assert [attempt.outcome for attempt in result.attempts] == ["failure", "success"]
    assert calls == [("broken", "allowed.example"), ("working", "allowed.example")]


def test_postflight_blocks_adapter_redirect_to_unapproved_host():
    registry = AdapterRegistry()
    registry.register(
        CallableAdapter(
            "browser",
            lambda _request: AdapterResult(
                200,
                "https://evil.example/redirected",
                b"should not be accepted",
            ),
        )
    )

    with pytest.raises(GuardedEgressError, match="all guarded transport engines failed"):
        route_guarded_request(
            url="https://allowed.example/start",
            authority=_authority("allowed.example"),
            registry=registry,
            resolver=_public_resolver,
            now=NOW,
        )


def test_non_public_resolution_is_blocked_before_adapter_execution():
    called = []
    registry = AdapterRegistry()
    registry.register(
        CallableAdapter(
            "plugin",
            lambda request: called.append(request) or AdapterResult(200, request.url, b"ok"),
        )
    )

    with pytest.raises(GuardedEgressError, match="non-public address blocked"):
        route_guarded_request(
            url="https://allowed.example/",
            authority=_authority("allowed.example"),
            registry=registry,
            resolver=lambda _host: ("127.0.0.1",),
            now=NOW,
        )
    assert called == []


def test_curl_engine_is_dns_pinned_and_redirects_are_disabled():
    captured = {}

    def fake_runner(command, **kwargs):
        captured["command"] = list(command)
        captured["kwargs"] = kwargs
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=b"body\n__SENJU_STATUS__:200\n__SENJU_URL__:https://allowed.example/x",
            stderr=b"",
        )

    adapter = CurlAdapter(runner=fake_runner)
    request = authorize_request(
        url="https://allowed.example/x",
        authority=_authority("allowed.example"),
        resolver=_public_resolver,
        now=NOW,
    )
    result = adapter.send(request)

    command = captured["command"]
    assert "--resolve" in command
    assert "allowed.example:443:93.184.216.34" in command
    assert "--max-redirs" in command
    assert command[command.index("--max-redirs") + 1] == "0"
    assert result.status == 200
    assert result.body == b"body"


def test_engine_scoring_promotes_reliable_route_across_experiment():
    first_calls = {"count": 0}
    registry = AdapterRegistry()

    def flaky(request):
        first_calls["count"] += 1
        raise TimeoutError("flaky")

    def stable(request):
        return AdapterResult(204, request.url, b"")

    registry.register(CallableAdapter("browser", flaky))
    registry.register(CallableAdapter("connector", stable))

    doc = run_guarded_egress_experiment(
        url="https://allowed.example/health",
        authority=_authority("allowed.example"),
        registry=registry,
        rounds=3,
        resolver=_public_resolver,
        now=NOW,
    )

    assert doc["winner"] == "connector"
    assert doc["authority_enforced"] is True
    assert doc["guard_bypass"] is False
    assert doc["scores"]["connector"]["successes"] == 3


def test_route_scores_can_be_reused_for_adaptive_selection():
    registry = AdapterRegistry()
    registry.register(CallableAdapter("a", lambda request: AdapterResult(200, request.url, b"a")))
    registry.register(CallableAdapter("b", lambda request: AdapterResult(200, request.url, b"b")))
    scores = {"a": RouteScore(score=-10), "b": RouteScore(score=5)}

    result = route_guarded_request(
        url="https://allowed.example/",
        authority=_authority("allowed.example"),
        registry=registry,
        resolver=_public_resolver,
        scores=scores,
        now=NOW,
    )

    assert result.receipt.engine == "b"
