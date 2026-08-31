"""Distributed authority evaluation for outbound actions.

Authority is not a single-engine decision. Multiple independent evaluators may vote on
an action, and an ordinary DENY from one evaluator is not a global veto. A valid ALLOW
from another evaluator may authorize execution inside the same owner-approved root
envelope.

Hard stops remain global: explicit root revocation, root-envelope violations, and
HARD_DENY votes cannot be overridden by route selection or another agent.
"""
from __future__ import annotations

import dataclasses
import time
import urllib.parse
from pathlib import Path
from typing import Callable, Iterable, Mapping, Protocol

from .standing_authorization import StandingAuthorization
from .transitive_trust import TrustEdge, resolve_trust

ALLOW = "allow"
DENY = "deny"
ABSTAIN = "abstain"
HARD_DENY = "hard_deny"
VALID_EFFECTS = frozenset({ALLOW, DENY, ABSTAIN, HARD_DENY})
GENERIC_AGENT_APPROVAL_SCOPE = "egress:approve"
HOST_AGENT_APPROVAL_PREFIX = "egress:host:"


class DistributedAuthorityError(RuntimeError):
    """Raised when distributed authority input is invalid."""


def _host(value: str) -> str:
    raw = str(value).strip().rstrip(".").lower()
    if not raw or "*" in raw or any(ch in raw for ch in "/?#@"):
        raise DistributedAuthorityError(f"invalid exact host: {value!r}")
    try:
        return raw.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise DistributedAuthorityError(f"invalid exact host: {value!r}") from exc


def _method(value: str) -> str:
    method = str(value).strip().upper()
    if method not in {"GET", "HEAD", "OPTIONS"}:
        raise DistributedAuthorityError(f"unsupported distributed egress method: {method}")
    return method


def _parse_https(url: str) -> str:
    parsed = urllib.parse.urlsplit(str(url))
    if parsed.scheme.lower() != "https":
        raise DistributedAuthorityError("distributed egress requires HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise DistributedAuthorityError("credentials in URL authority are not allowed")
    if not parsed.hostname:
        raise DistributedAuthorityError("URL has no hostname")
    try:
        if parsed.port not in (None, 443):
            raise DistributedAuthorityError("non-default HTTPS port is outside generic authority")
    except ValueError as exc:
        raise DistributedAuthorityError("invalid URL port") from exc
    return _host(parsed.hostname)


@dataclasses.dataclass(frozen=True)
class RootAuthorityEnvelope:
    reference: str
    owner: str
    exact_hosts: tuple[str, ...]
    allowed_methods: tuple[str, ...]
    revoked: bool = False
    hard_denied_hosts: tuple[str, ...] = ()
    expires_at_epoch: int | None = None

    def is_active(self, *, now: int | None = None) -> bool:
        if self.revoked:
            return False
        if self.expires_at_epoch is None:
            return True
        current = int(time.time()) if now is None else int(now)
        return current < int(self.expires_at_epoch)


def create_root_authority_envelope(
    *,
    reference: str,
    owner: str,
    exact_hosts: Iterable[str],
    allowed_methods: Iterable[str] = ("GET", "HEAD"),
    hard_denied_hosts: Iterable[str] = (),
    expires_at_epoch: int | None = None,
) -> RootAuthorityEnvelope:
    ref = str(reference).strip()
    owner_name = str(owner).strip()
    if not ref or not owner_name:
        raise DistributedAuthorityError("reference and owner are required")
    hosts = tuple(sorted({_host(item) for item in exact_hosts}))
    methods = tuple(sorted({_method(item) for item in allowed_methods}))
    denied = tuple(sorted({_host(item) for item in hard_denied_hosts}))
    if not hosts:
        raise DistributedAuthorityError("root authority envelope requires at least one exact host")
    if not methods:
        raise DistributedAuthorityError("root authority envelope requires at least one method")
    if not set(denied).issubset(set(hosts)):
        raise DistributedAuthorityError("hard-denied hosts must be inside the root envelope")
    return RootAuthorityEnvelope(
        reference=ref,
        owner=owner_name,
        exact_hosts=hosts,
        allowed_methods=methods,
        hard_denied_hosts=denied,
        expires_at_epoch=expires_at_epoch,
    )


@dataclasses.dataclass(frozen=True)
class AuthorityRequest:
    actor: str
    url: str
    host: str
    method: str


@dataclasses.dataclass(frozen=True)
class AuthorityVote:
    evaluator: str
    effect: str
    reason: str
    evidence: Mapping[str, object] = dataclasses.field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.effect not in VALID_EFFECTS:
            raise DistributedAuthorityError(f"invalid authority effect: {self.effect}")


@dataclasses.dataclass(frozen=True)
class DistributedAuthorityDecision:
    request: AuthorityRequest
    envelope_reference: str
    allowed: bool
    reason: str
    votes: tuple[AuthorityVote, ...]
    winning_evaluators: tuple[str, ...] = ()
    hard_stopped: bool = False


class AuthorityEvaluator(Protocol):
    name: str

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        ...


class CallableAuthorityEvaluator:
    def __init__(
        self,
        name: str,
        callback: Callable[[AuthorityRequest], AuthorityVote | str],
    ) -> None:
        self.name = str(name).strip()
        if not self.name:
            raise DistributedAuthorityError("evaluator name is required")
        self._callback = callback

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        result = self._callback(request)
        if isinstance(result, AuthorityVote):
            return dataclasses.replace(result, evaluator=self.name)
        effect = str(result).strip().lower()
        return AuthorityVote(
            evaluator=self.name,
            effect=effect,
            reason=f"callable_evaluator:{effect}",
        )


class StaticAuthorityEvaluator:
    """Exact-host/method evaluator useful for independent registries or policies."""

    def __init__(
        self,
        *,
        name: str,
        allowed_hosts: Iterable[str] = (),
        denied_hosts: Iterable[str] = (),
        hard_denied_hosts: Iterable[str] = (),
        allowed_methods: Iterable[str] = ("GET", "HEAD"),
    ) -> None:
        self.name = str(name).strip()
        if not self.name:
            raise DistributedAuthorityError("evaluator name is required")
        self.allowed_hosts = frozenset(_host(item) for item in allowed_hosts)
        self.denied_hosts = frozenset(_host(item) for item in denied_hosts)
        self.hard_denied_hosts = frozenset(_host(item) for item in hard_denied_hosts)
        self.allowed_methods = frozenset(_method(item) for item in allowed_methods)

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        if request.host in self.hard_denied_hosts:
            return AuthorityVote(self.name, HARD_DENY, "static_hard_deny")
        if request.host in self.denied_hosts:
            return AuthorityVote(self.name, DENY, "static_deny")
        if request.host in self.allowed_hosts and request.method in self.allowed_methods:
            return AuthorityVote(self.name, ALLOW, "static_allow")
        return AuthorityVote(self.name, ABSTAIN, "no_matching_static_rule")


class StandingAuthorizationEvaluator:
    """Independent evaluator backed by durable standing authorization records."""

    def __init__(self, authorizations: Iterable[StandingAuthorization], *, name: str = "standing_registry") -> None:
        self.name = str(name).strip() or "standing_registry"
        self.authorizations = tuple(authorizations)

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        matching_revoked = []
        for authorization in self.authorizations:
            if request.host not in authorization.exact_hosts:
                continue
            if request.method not in authorization.allowed_methods:
                continue
            if authorization.revoked:
                matching_revoked.append(authorization.authorization_reference)
                continue
            if authorization.credential_scope != "none" or authorization.destructive:
                continue
            return AuthorityVote(
                self.name,
                ALLOW,
                "active_standing_authorization",
                {"authorization_reference": authorization.authorization_reference},
            )
        if matching_revoked:
            return AuthorityVote(
                self.name,
                HARD_DENY,
                "matching_standing_authorization_revoked",
                {"authorization_references": tuple(sorted(matching_revoked))},
            )
        return AuthorityVote(self.name, ABSTAIN, "no_active_standing_authorization")


class TrustedAgentAuthorityEvaluator:
    """A transitively trusted upper Agent may cast an independent ALLOW vote.

    The Agent's vote is bounded by its own exact-host/method approval set and by the
    root envelope checked by decide_distributed_authority(). Trust never expands that
    root envelope.
    """

    def __init__(
        self,
        *,
        owner: str,
        approver: str,
        edges: Iterable[TrustEdge],
        approved_hosts: Iterable[str],
        allowed_methods: Iterable[str] = ("GET", "HEAD"),
        name: str | None = None,
    ) -> None:
        self.owner = str(owner).strip()
        self.approver = str(approver).strip()
        self.edges = tuple(edges)
        self.approved_hosts = frozenset(_host(item) for item in approved_hosts)
        self.allowed_methods = frozenset(_method(item) for item in allowed_methods)
        self.name = str(name or f"trusted_agent:{self.approver}").strip()

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        resolution = resolve_trust(owner=self.owner, subject=self.approver, edges=self.edges)
        if not resolution.trusted:
            return AuthorityVote(self.name, ABSTAIN, "approver_not_transitively_trusted")
        scopes = set(resolution.effective_scopes)
        host_scope = f"{HOST_AGENT_APPROVAL_PREFIX}{request.host}"
        can_approve = "*" in scopes or GENERIC_AGENT_APPROVAL_SCOPE in scopes or host_scope in scopes
        if not can_approve:
            return AuthorityVote(
                self.name,
                ABSTAIN,
                "trust_chain_lacks_egress_approval_scope",
                {"trust_path": resolution.path},
            )
        if request.host not in self.approved_hosts or request.method not in self.allowed_methods:
            return AuthorityVote(
                self.name,
                ABSTAIN,
                "agent_did_not_approve_exact_target_action",
                {"trust_path": resolution.path},
            )
        return AuthorityVote(
            self.name,
            ALLOW,
            "transitively_trusted_agent_approval",
            {"trust_path": resolution.path, "effective_scopes": resolution.effective_scopes},
        )


def build_authority_request(*, actor: str, url: str, method: str) -> AuthorityRequest:
    actor_name = str(actor).strip()
    if not actor_name:
        raise DistributedAuthorityError("actor is required")
    host = _parse_https(url)
    return AuthorityRequest(actor=actor_name, url=str(url), host=host, method=_method(method))


def decide_distributed_authority(
    *,
    envelope: RootAuthorityEnvelope,
    request: AuthorityRequest,
    evaluators: Iterable[AuthorityEvaluator],
    min_allow_votes: int = 1,
    now: int | None = None,
) -> DistributedAuthorityDecision:
    """Resolve authority from independent evaluators inside an owner root envelope.

    Ordinary DENY votes are local opinions and may be outweighed by any independently
    valid ALLOW when min_allow_votes is met. HARD_DENY is a global stop.
    """
    current = int(time.time()) if now is None else int(now)
    if not envelope.is_active(now=current):
        return DistributedAuthorityDecision(
            request=request,
            envelope_reference=envelope.reference,
            allowed=False,
            reason="root_envelope_revoked_or_expired",
            votes=(),
            hard_stopped=True,
        )
    if request.host not in envelope.exact_hosts or request.method not in envelope.allowed_methods:
        return DistributedAuthorityDecision(
            request=request,
            envelope_reference=envelope.reference,
            allowed=False,
            reason="request_outside_owner_root_envelope",
            votes=(),
            hard_stopped=True,
        )
    if request.host in envelope.hard_denied_hosts:
        return DistributedAuthorityDecision(
            request=request,
            envelope_reference=envelope.reference,
            allowed=False,
            reason="root_envelope_hard_deny",
            votes=(),
            hard_stopped=True,
        )

    required = int(min_allow_votes)
    if required < 1:
        raise DistributedAuthorityError("min_allow_votes must be at least 1")

    votes: list[AuthorityVote] = []
    for evaluator in tuple(evaluators):
        name = str(getattr(evaluator, "name", type(evaluator).__name__)).strip() or type(evaluator).__name__
        try:
            vote = evaluator.evaluate(request)
        except Exception as exc:
            vote = AuthorityVote(
                evaluator=name,
                effect=ABSTAIN,
                reason="evaluator_error",
                evidence={"error_type": type(exc).__name__, "error": str(exc)[:240]},
            )
        if vote.evaluator != name:
            vote = dataclasses.replace(vote, evaluator=name)
        votes.append(vote)

    hard = tuple(vote for vote in votes if vote.effect == HARD_DENY)
    if hard:
        return DistributedAuthorityDecision(
            request=request,
            envelope_reference=envelope.reference,
            allowed=False,
            reason="hard_deny_from_independent_evaluator",
            votes=tuple(votes),
            hard_stopped=True,
        )

    allows = tuple(vote for vote in votes if vote.effect == ALLOW)
    if len(allows) >= required:
        return DistributedAuthorityDecision(
            request=request,
            envelope_reference=envelope.reference,
            allowed=True,
            reason="independent_allow_threshold_met",
            votes=tuple(votes),
            winning_evaluators=tuple(vote.evaluator for vote in allows),
            hard_stopped=False,
        )

    return DistributedAuthorityDecision(
        request=request,
        envelope_reference=envelope.reference,
        allowed=False,
        reason="no_independent_allow_threshold",
        votes=tuple(votes),
        hard_stopped=False,
    )


def append_authority_decision(path: str | Path, decision: DistributedAuthorityDecision) -> Path:
    import json

    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dataclasses.asdict(decision), ensure_ascii=False, sort_keys=True) + "\n")
    return destination
