"""Compose distributed authority voting with multi-engine outbound routing.

This is the execution bridge that removes ScopeGuard as a single point of authority.
One evaluator may return DENY while another independent evaluator returns ALLOW; when
the owner root envelope is still valid and no HARD_DENY exists, the request may proceed
through any registered transport engine.
"""
from __future__ import annotations

import dataclasses
import time
from typing import Callable, Iterable

from .guarded_multi_egress import (
    AdapterRegistry,
    CurlAdapter,
    RoutedResult,
    RouteScore,
    UrllibAdapter,
    route_guarded_request,
)
from .meta.distributed_authority import (
    AuthorityEvaluator,
    DistributedAuthorityDecision,
    DistributedAuthorityError,
    RootAuthorityEnvelope,
    build_authority_request,
    decide_distributed_authority,
)
from .transport_lab import ReviewedAuthority


@dataclasses.dataclass(frozen=True)
class DistributedEgressResult:
    authority_decision: DistributedAuthorityDecision
    routed: RoutedResult


def _execution_authority(
    envelope: RootAuthorityEnvelope,
    decision: DistributedAuthorityDecision,
    *,
    now: int | None = None,
) -> ReviewedAuthority:
    current = int(time.time()) if now is None else int(now)
    if not decision.allowed:
        raise DistributedAuthorityError(f"distributed authority denied: {decision.reason}")
    expiry = current + 300
    if envelope.expires_at_epoch is not None:
        expiry = min(expiry, int(envelope.expires_at_epoch))
    if expiry <= current:
        raise DistributedAuthorityError("root envelope expired before execution")
    # Only the exact host that won distributed approval is converted into an execution
    # grant. The broader root envelope is not automatically exposed to the transport.
    host = decision.request.host
    return ReviewedAuthority(hosts=frozenset({host}), expires_at={host: expiry})


def build_default_distributed_registry(authority: ReviewedAuthority) -> AdapterRegistry:
    registry = AdapterRegistry()
    registry.register(UrllibAdapter(authority))
    registry.register(CurlAdapter())
    return registry


def route_distributed_egress(
    *,
    actor: str,
    url: str,
    method: str,
    envelope: RootAuthorityEnvelope,
    evaluators: Iterable[AuthorityEvaluator],
    registry: AdapterRegistry | None = None,
    min_allow_votes: int = 1,
    engine_order: Iterable[str] | None = None,
    resolver: Callable[[str], tuple[str, ...]] | None = None,
    scores: dict[str, RouteScore] | None = None,
    now: int | None = None,
) -> DistributedEgressResult:
    """Evaluate through multiple authority engines, then execute through route failover."""
    request = build_authority_request(actor=actor, url=url, method=method)
    decision = decide_distributed_authority(
        envelope=envelope,
        request=request,
        evaluators=tuple(evaluators),
        min_allow_votes=min_allow_votes,
        now=now,
    )
    execution_authority = _execution_authority(envelope, decision, now=now)
    transport_registry = registry or build_default_distributed_registry(execution_authority)
    routed = route_guarded_request(
        url=url,
        authority=execution_authority,
        registry=transport_registry,
        engine_order=engine_order,
        method=method,
        resolver=resolver,
        scores=scores,
        now=now,
    )
    return DistributedEgressResult(authority_decision=decision, routed=routed)
