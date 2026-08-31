"""Owner-approved external-host promotion port for adversary systems.

Adversary components may submit an exact HTTPS target, ask peer agents for advisory
votes, and turn an explicit owner promotion ticket into a short-lived read-only
capability lease. The resulting lease is compatible with the shared Authority Context
pipeline added in PR #473.

This module deliberately does not perform network I/O, mint credentials, infer owner
approval from agent votes, or widen a ticket beyond exact host + GET/HEAD + scan/probe.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

REQUEST_SCHEMA = "senju-adversary-egress-request/v1"
VOTE_SCHEMA = "senju-adversary-egress-vote/v1"
TICKET_SCHEMA = "senju-owner-external-host-promotion-ticket/v1"
PROMOTED_LEASE_SCHEMA = "senju-adversary-owner-promoted-leases/v1"
DECISION_SCHEMA = "senju-adversary-egress-decision/v1"

READ_ONLY_CAPABILITIES = frozenset({"scan", "probe"})
READ_ONLY_METHODS = frozenset({"GET", "HEAD"})
VALID_VOTES = frozenset({"allow", "deny", "abstain", "hard_deny"})
DEFAULT_VOTERS = frozenset({"META", "X", "SENJU", "CHILD"})
DEFAULT_SHARED_WITH = ("AI", "CHILD", "META", "SENJU", "X")
MAX_REQUEST_TTL_SECONDS = 6 * 60 * 60
MAX_PROMOTION_TTL_SECONDS = 6 * 60 * 60


class AdversaryEgressError(RuntimeError):
    """Raised when an egress request or promotion violates the contract."""


def _canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest(value: object, prefix: str) -> str:
    return hashlib.sha256((prefix + _canonical(value)).encode("utf-8")).hexdigest()


def _normalize_host(raw: object) -> str:
    value = str(raw).strip().lower().rstrip(".")
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise AdversaryEgressError(f"invalid exact host: {raw!r}")
    try:
        return value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise AdversaryEgressError(f"invalid exact host: {raw!r}") from exc


def _normalize_url(raw: object) -> tuple[str, str]:
    try:
        parsed = urllib.parse.urlsplit(str(raw).strip())
        port = parsed.port
    except ValueError as exc:
        raise AdversaryEgressError("invalid target URL") from exc
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise AdversaryEgressError("adversary egress promotion requires HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise AdversaryEgressError("credentials in target URLs are forbidden")
    if port not in (None, 443):
        raise AdversaryEgressError("non-default HTTPS ports are outside this promotion port")
    host = _normalize_host(parsed.hostname)
    url = urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
    return url, host


def _capabilities(values: Iterable[object]) -> tuple[str, ...]:
    requested = tuple(sorted({str(item).strip().lower() for item in values if str(item).strip()}))
    if not requested:
        raise AdversaryEgressError("at least one capability is required")
    if not set(requested).issubset(READ_ONLY_CAPABILITIES):
        raise AdversaryEgressError("adversary external-host promotion is read-only scan/probe only")
    return requested


def _methods(values: Iterable[object]) -> tuple[str, ...]:
    requested = tuple(sorted({str(item).strip().upper() for item in values if str(item).strip()}))
    if not requested:
        raise AdversaryEgressError("at least one method is required")
    if not set(requested).issubset(READ_ONLY_METHODS):
        raise AdversaryEgressError("adversary external-host promotion is GET/HEAD only")
    return requested


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@dataclass(frozen=True)
class PromotionRequest:
    schema: str
    request_id: str
    source_actor: str
    url: str
    host: str
    reason: str
    capabilities: tuple[str, ...]
    methods: tuple[str, ...]
    created_at: int
    expires_at: int

    def active(self, now: int | None = None) -> bool:
        current = int(time.time()) if now is None else int(now)
        return current < self.expires_at

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(frozen=True)
class AgentVote:
    schema: str
    request_id: str
    agent: str
    effect: str
    reason: str
    recorded_at: int

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(frozen=True)
class OwnerPromotionTicket:
    schema: str
    ticket_id: str
    request_id: str
    host: str
    authorization_reference: str
    owner_approval_reference: str
    capabilities: tuple[str, ...]
    methods: tuple[str, ...]
    issued_at: int
    expires_at: int

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "OwnerPromotionTicket":
        schema = str(raw.get("schema", TICKET_SCHEMA)).strip()
        if schema != TICKET_SCHEMA:
            raise AdversaryEgressError("unexpected owner promotion ticket schema")
        ticket_id = str(raw.get("ticket_id", "")).strip()
        request_id = str(raw.get("request_id", "")).strip()
        reference = str(raw.get("authorization_reference", "")).strip()
        owner_reference = str(raw.get("owner_approval_reference", "")).strip()
        if not all((ticket_id, request_id, reference, owner_reference)):
            raise AdversaryEgressError("owner promotion ticket is missing required references")
        try:
            issued_at = int(raw.get("issued_at", 0))
            expires_at = int(raw.get("expires_at", 0))
        except (TypeError, ValueError) as exc:
            raise AdversaryEgressError("owner promotion ticket has invalid timestamps") from exc
        return cls(
            schema=schema,
            ticket_id=ticket_id,
            request_id=request_id,
            host=_normalize_host(raw.get("host", "")),
            authorization_reference=reference,
            owner_approval_reference=owner_reference,
            capabilities=_capabilities(raw.get("capabilities", ("scan", "probe"))),
            methods=_methods(raw.get("methods", ("GET", "HEAD"))),
            issued_at=issued_at,
            expires_at=expires_at,
        )

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(frozen=True)
class EgressDecision:
    schema: str
    status: str
    request_id: str
    host: str
    reason: str
    allow_voters: tuple[str, ...]
    lease: Mapping[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


class AdversaryEgressRequestPort:
    """Persistent request/vote/promotion port for adversary components."""

    def __init__(
        self,
        state_dir: str | Path,
        *,
        min_allow_votes: int = 2,
        permitted_voters: Iterable[str] = DEFAULT_VOTERS,
    ) -> None:
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.min_allow_votes = max(1, int(min_allow_votes))
        self.permitted_voters = frozenset(str(item).strip().upper() for item in permitted_voters if str(item).strip())
        if not self.permitted_voters:
            raise AdversaryEgressError("at least one permitted voter is required")

    @property
    def request_path(self) -> Path:
        return self.state_dir / "adversary_external_host_requests.json"

    @property
    def vote_path(self) -> Path:
        return self.state_dir / "adversary_external_host_votes.json"

    @property
    def promoted_path(self) -> Path:
        return self.state_dir / "adversary_owner_promoted_leases.json"

    def request(
        self,
        url: str,
        *,
        source_actor: str,
        reason: str,
        capabilities: Sequence[str] = ("scan", "probe"),
        methods: Sequence[str] = ("GET", "HEAD"),
        existing_leases: Sequence[Mapping[str, Any]] = (),
        request_ttl_seconds: int = 60 * 60,
        now: int | None = None,
    ) -> EgressDecision:
        current = int(time.time()) if now is None else int(now)
        normalized_url, host = _normalize_url(url)
        caps = _capabilities(capabilities)
        meths = _methods(methods)
        actor = str(source_actor).strip()
        why = str(reason).strip()
        if not actor or not why:
            raise AdversaryEgressError("source_actor and reason are required")

        for raw in existing_leases:
            if self._existing_lease_allows(raw, host=host, capabilities=caps, now=current):
                return EgressDecision(
                    schema=DECISION_SCHEMA,
                    status="ready_existing_authority",
                    request_id=str(raw.get("lease_id", "existing-authority")),
                    host=host,
                    reason="exact host already has active same-or-broader read-only authority",
                    allow_voters=(),
                    lease=dict(raw),
                )

        ttl = max(300, min(int(request_ttl_seconds), MAX_REQUEST_TTL_SECONDS))
        material = {
            "source_actor": actor,
            "url": normalized_url,
            "reason": why,
            "capabilities": caps,
            "methods": meths,
            "created_at": current,
        }
        request_id = f"adversary-egress:{_digest(material, 'request-v1:')[:24]}"
        request = PromotionRequest(
            schema=REQUEST_SCHEMA,
            request_id=request_id,
            source_actor=actor,
            url=normalized_url,
            host=host,
            reason=why[:1000],
            capabilities=caps,
            methods=meths,
            created_at=current,
            expires_at=current + ttl,
        )
        self._upsert_request(request)
        return EgressDecision(
            schema=DECISION_SCHEMA,
            status="promotion_required",
            request_id=request_id,
            host=host,
            reason="no active exact-host authority; peer votes and explicit owner promotion ticket required",
            allow_voters=(),
            lease=None,
        )

    def vote(
        self,
        request_id: str,
        *,
        agent: str,
        effect: str,
        reason: str,
        now: int | None = None,
    ) -> AgentVote:
        request = self.get_request(request_id)
        current = int(time.time()) if now is None else int(now)
        if not request.active(current):
            raise AdversaryEgressError("promotion request is expired")
        voter = str(agent).strip().upper()
        normalized_effect = str(effect).strip().lower()
        if voter not in self.permitted_voters:
            raise AdversaryEgressError(f"agent is not a permitted advisory voter: {voter}")
        if normalized_effect not in VALID_VOTES:
            raise AdversaryEgressError(f"invalid advisory vote: {normalized_effect}")
        vote = AgentVote(
            schema=VOTE_SCHEMA,
            request_id=request.request_id,
            agent=voter,
            effect=normalized_effect,
            reason=str(reason).strip()[:1000] or normalized_effect,
            recorded_at=current,
        )
        self._upsert_vote(vote)
        return vote

    def promote(
        self,
        request_id: str,
        *,
        ticket: OwnerPromotionTicket | Mapping[str, Any],
        now: int | None = None,
    ) -> EgressDecision:
        current = int(time.time()) if now is None else int(now)
        request = self.get_request(request_id)
        if not request.active(current):
            raise AdversaryEgressError("promotion request is expired")
        owner_ticket = ticket if isinstance(ticket, OwnerPromotionTicket) else OwnerPromotionTicket.from_mapping(ticket)
        self._validate_ticket(request, owner_ticket, current)

        votes = self.votes_for(request.request_id)
        hard = tuple(sorted(vote.agent for vote in votes if vote.effect == "hard_deny"))
        if hard:
            return EgressDecision(
                schema=DECISION_SCHEMA,
                status="blocked",
                request_id=request.request_id,
                host=request.host,
                reason="hard deny from advisory authority evaluator",
                allow_voters=(),
                lease=None,
            )
        allow_voters = tuple(sorted({vote.agent for vote in votes if vote.effect == "allow"}))
        if len(allow_voters) < self.min_allow_votes:
            return EgressDecision(
                schema=DECISION_SCHEMA,
                status="waiting_for_agent_quorum",
                request_id=request.request_id,
                host=request.host,
                reason=f"need {self.min_allow_votes} distinct ALLOW votes; have {len(allow_voters)}",
                allow_voters=allow_voters,
                lease=None,
            )

        expires_at = min(request.expires_at, owner_ticket.expires_at, current + MAX_PROMOTION_TTL_SECONDS)
        effective_caps = tuple(sorted(set(request.capabilities).intersection(owner_ticket.capabilities)))
        effective_methods = tuple(sorted(set(request.methods).intersection(owner_ticket.methods)))
        if not effective_caps or not effective_methods:
            raise AdversaryEgressError("owner ticket grants no usable requested read-only authority")
        fingerprint_material = {
            "request": request.to_dict(),
            "ticket": owner_ticket.to_dict(),
            "allow_voters": allow_voters,
            "effective_capabilities": effective_caps,
            "effective_methods": effective_methods,
        }
        fingerprint = _digest(fingerprint_material, "promoted-lease-v1:")
        lease = {
            "lease_id": f"owner-promotion:{request.host}:{fingerprint[:12]}:{current}",
            "target": request.host,
            "url": request.url,
            "authorization_reference": owner_ticket.authorization_reference,
            "authorization_basis": "explicit_owner_external_host_promotion",
            "capability_authorization_profile": "adversary-read-only-owner-promotion/v1",
            "capability_inherited_from_owner_root": False,
            "capabilities": list(effective_caps),
            "allowed_methods": list(effective_methods),
            "credential_scope": "none",
            "shared_with": list(DEFAULT_SHARED_WITH),
            "issued_at": current,
            "expires_at": expires_at,
            "source_action_fingerprint": fingerprint,
            "status": "active",
            "owner_approval_reference": owner_ticket.owner_approval_reference,
            "source_request_id": request.request_id,
            "advisory_allow_voters": list(allow_voters),
        }
        self._upsert_promoted_lease(lease, generated_at=current)
        return EgressDecision(
            schema=DECISION_SCHEMA,
            status="promoted",
            request_id=request.request_id,
            host=request.host,
            reason="explicit owner ticket + advisory quorum produced a bounded read-only capability lease",
            allow_voters=allow_voters,
            lease=lease,
        )

    def get_request(self, request_id: str) -> PromotionRequest:
        payload = _load(self.request_path, {})
        rows = payload.get("requests", []) if isinstance(payload, dict) else []
        for raw in rows if isinstance(rows, list) else []:
            if isinstance(raw, dict) and str(raw.get("request_id")) == str(request_id):
                try:
                    return PromotionRequest(
                        schema=str(raw["schema"]),
                        request_id=str(raw["request_id"]),
                        source_actor=str(raw["source_actor"]),
                        url=str(raw["url"]),
                        host=_normalize_host(raw["host"]),
                        reason=str(raw["reason"]),
                        capabilities=_capabilities(raw["capabilities"]),
                        methods=_methods(raw["methods"]),
                        created_at=int(raw["created_at"]),
                        expires_at=int(raw["expires_at"]),
                    )
                except (KeyError, TypeError, ValueError) as exc:
                    raise AdversaryEgressError("stored promotion request is malformed") from exc
        raise AdversaryEgressError(f"unknown promotion request: {request_id}")

    def votes_for(self, request_id: str) -> tuple[AgentVote, ...]:
        payload = _load(self.vote_path, {})
        rows = payload.get("votes", []) if isinstance(payload, dict) else []
        latest: dict[str, AgentVote] = {}
        for raw in rows if isinstance(rows, list) else []:
            if not isinstance(raw, dict) or str(raw.get("request_id")) != str(request_id):
                continue
            try:
                vote = AgentVote(
                    schema=str(raw["schema"]),
                    request_id=str(raw["request_id"]),
                    agent=str(raw["agent"]).upper(),
                    effect=str(raw["effect"]).lower(),
                    reason=str(raw.get("reason", "")),
                    recorded_at=int(raw["recorded_at"]),
                )
            except (KeyError, TypeError, ValueError):
                continue
            if vote.effect in VALID_VOTES:
                latest[vote.agent] = vote
        return tuple(sorted(latest.values(), key=lambda item: item.agent))

    @staticmethod
    def _existing_lease_allows(
        raw: Mapping[str, Any],
        *,
        host: str,
        capabilities: Sequence[str],
        now: int,
    ) -> bool:
        try:
            target = _normalize_host(raw.get("target", ""))
            expires_at = int(raw.get("expires_at", 0))
        except (AdversaryEgressError, TypeError, ValueError):
            return False
        if target != host or expires_at <= now or str(raw.get("status", "active")) != "active":
            return False
        if str(raw.get("credential_scope", "none")) != "none":
            return False
        existing = {str(item).strip().lower() for item in raw.get("capabilities", ())}
        return set(capabilities).issubset(existing)

    def _validate_ticket(self, request: PromotionRequest, ticket: OwnerPromotionTicket, now: int) -> None:
        if ticket.request_id != request.request_id:
            raise AdversaryEgressError("owner ticket request_id does not match")
        if ticket.host != request.host:
            raise AdversaryEgressError("owner ticket host does not match exact requested host")
        if ticket.issued_at > now or ticket.expires_at <= now:
            raise AdversaryEgressError("owner promotion ticket is not currently active")
        if ticket.expires_at - ticket.issued_at > MAX_PROMOTION_TTL_SECONDS:
            raise AdversaryEgressError("owner promotion ticket TTL exceeds the read-only promotion ceiling")
        if not set(ticket.capabilities).issubset(set(request.capabilities)):
            raise AdversaryEgressError("owner ticket attempted capability widening")
        if not set(ticket.methods).issubset(set(request.methods)):
            raise AdversaryEgressError("owner ticket attempted method widening")

    def _upsert_request(self, request: PromotionRequest) -> None:
        payload = _load(self.request_path, {})
        rows = payload.get("requests", []) if isinstance(payload, dict) else []
        current = [row for row in rows if isinstance(row, dict) and row.get("request_id") != request.request_id] if isinstance(rows, list) else []
        current.append(request.to_dict())
        current.sort(key=lambda row: str(row.get("request_id", "")))
        _write(self.request_path, {"schema": REQUEST_SCHEMA, "requests": current})

    def _upsert_vote(self, vote: AgentVote) -> None:
        payload = _load(self.vote_path, {})
        rows = payload.get("votes", []) if isinstance(payload, dict) else []
        current = [
            row for row in rows
            if isinstance(row, dict)
            and not (row.get("request_id") == vote.request_id and str(row.get("agent", "")).upper() == vote.agent)
        ] if isinstance(rows, list) else []
        current.append(vote.to_dict())
        current.sort(key=lambda row: (str(row.get("request_id", "")), str(row.get("agent", ""))))
        _write(self.vote_path, {"schema": VOTE_SCHEMA, "votes": current})

    def _upsert_promoted_lease(self, lease: Mapping[str, Any], *, generated_at: int) -> None:
        payload = _load(self.promoted_path, {})
        rows = payload.get("leases", []) if isinstance(payload, dict) else []
        current = [
            row for row in rows
            if isinstance(row, dict) and str(row.get("target", "")) != str(lease.get("target", ""))
        ] if isinstance(rows, list) else []
        current.append(dict(lease))
        current.sort(key=lambda row: str(row.get("target", "")))
        _write(
            self.promoted_path,
            {
                "schema": PROMOTED_LEASE_SCHEMA,
                "generated_at": int(generated_at),
                "semantics": "explicit_owner_ticket_plus_agent_quorum_read_only_external_host_promotion",
                "leases": current,
            },
        )
