"""Council-issued exact-link POST authority for THE WORLD production actions.

This module deliberately moves one more decision step away from per-action Owner review:

    Owner explicitly delegates an exact HTTPS link for council POST decisions
        -> META / X / Senju / PR-Army ballots
        -> 3-of-4 quorum
        -> new short-lived one-use Action Authority
        -> guarded production POST

The generated authority is an exact-link action capability, not a new Internet trust
root. Council members cannot add a link to the Owner catalog, widen the URL, mint
credentials, follow redirects, or turn the lease into a reusable/general authority.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from typing import Any, Callable, Iterable, Mapping
from urllib.parse import urlsplit

from automation.world.distributed_internal_council import (
    COUNCIL_MEMBERS,
    DEFAULT_AGENT_QUORUM,
    DEFAULT_MIN_CONFIDENCE,
    AgentBallot,
)

DEFAULT_MAX_BODY_BYTES = 8 * 1024
DEFAULT_AUTHORITY_TTL_SECONDS = 10 * 60
MAX_AUTHORITY_TTL_SECONDS = 15 * 60


def _clean(value: Any, limit: int = 240) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())[:limit]


def _normalize_exact_https_url(value: Any) -> tuple[str, str, str] | None:
    text = _clean(value, 2048)
    if not text:
        return None
    try:
        parsed = urlsplit(text)
        port = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or parsed.username or parsed.password:
        return None
    if parsed.query or parsed.fragment:
        return None
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or port not in (None, 443):
        return None
    path = parsed.path or "/"
    normalized = f"https://{host}{path}"
    return normalized, host, path


def _validated_ballots(values: Iterable[Mapping[str, Any] | AgentBallot]) -> tuple[AgentBallot, ...]:
    indexed: dict[str, AgentBallot] = {}
    for raw in values:
        ballot = raw if isinstance(raw, AgentBallot) else AgentBallot.from_mapping(raw)
        if ballot.actor in indexed:
            raise ValueError(f"duplicate council ballot: {ballot.actor}")
        indexed[ballot.actor] = ballot
    return tuple(indexed[name] for name in COUNCIL_MEMBERS if name in indexed)


def _avg_confidence(ballots: Iterable[AgentBallot]) -> int:
    values = [item.confidence for item in ballots if item.accept]
    return round(sum(values) / len(values)) if values else 0


def _payload_bytes(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(dict(payload), ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def _authority_id(*, link_id: str, url: str, payload_sha256: str, idempotency_key: str, ballots: tuple[AgentBallot, ...]) -> str:
    ballot_fingerprint = "|".join(
        f"{item.actor}:{int(item.accept)}:{item.confidence}" for item in ballots
    )
    raw = "\x1f".join(("owner-link-council-post", link_id, url, payload_sha256, idempotency_key, ballot_fingerprint))
    return "actauth_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


@dataclass(frozen=True)
class OwnerApprovedLink:
    link_id: str
    url: str
    host: str
    path: str
    allow_council_post: bool
    max_body_bytes: int = DEFAULT_MAX_BODY_BYTES
    authority_ttl_seconds: int = DEFAULT_AUTHORITY_TTL_SECONDS
    description: str = ""

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "OwnerApprovedLink":
        link_id = _clean(raw.get("link_id"), 160)
        normalized = _normalize_exact_https_url(raw.get("url"))
        if not link_id:
            raise ValueError("link_id is required")
        if normalized is None:
            raise ValueError("owner-approved link must be exact HTTPS/443 without credentials/query/fragment")
        url, host, path = normalized
        max_body = max(256, min(int(raw.get("max_body_bytes", DEFAULT_MAX_BODY_BYTES)), 64 * 1024))
        ttl = max(60, min(int(raw.get("authority_ttl_seconds", DEFAULT_AUTHORITY_TTL_SECONDS)), MAX_AUTHORITY_TTL_SECONDS))
        return cls(
            link_id=link_id,
            url=url,
            host=host,
            path=path,
            allow_council_post=bool(raw.get("allow_council_post", False)),
            max_body_bytes=max_body,
            authority_ttl_seconds=ttl,
            description=_clean(raw.get("description"), 300),
        )


@dataclass(frozen=True)
class CouncilPostAuthority:
    authority_id: str
    authority_kind: str
    authority_basis: str
    issued_at: int
    expires_at: int
    max_uses: int
    url: str
    host: str
    path: str
    method: str
    payload_sha256: str
    idempotency_key: str
    credential_scope: str
    follow_redirects: bool
    council_members: tuple[str, ...]
    council_yes: int
    average_yes_confidence: int
    general_root_authority: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CouncilPostDecision:
    candidate_id: str
    link_id: str
    url: str
    status: str
    council_yes: int
    council_no: int
    council_missing: int
    average_yes_confidence: int
    new_authority_created: bool
    execute_now: bool
    authority: CouncilPostAuthority | None
    payload_json: Mapping[str, Any] | None
    reason: str

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["authority"] = self.authority.to_dict() if self.authority is not None else None
        return data


def build_owner_links(rows: Iterable[Mapping[str, Any]]) -> dict[str, OwnerApprovedLink]:
    links: dict[str, OwnerApprovedLink] = {}
    for raw in rows:
        if not isinstance(raw, Mapping):
            continue
        item = OwnerApprovedLink.from_mapping(raw)
        if item.link_id in links:
            raise ValueError(f"duplicate owner-approved link: {item.link_id}")
        links[item.link_id] = item
    return links


def _reject(*, candidate_id: str, link_id: str, url: str, ballots: tuple[AgentBallot, ...], status: str, reason: str) -> CouncilPostDecision:
    yes = sum(1 for item in ballots if item.accept)
    no = sum(1 for item in ballots if not item.accept)
    return CouncilPostDecision(
        candidate_id=candidate_id,
        link_id=link_id,
        url=url,
        status=status,
        council_yes=yes,
        council_no=no,
        council_missing=len(COUNCIL_MEMBERS) - len(ballots),
        average_yes_confidence=_avg_confidence(ballots),
        new_authority_created=False,
        execute_now=False,
        authority=None,
        payload_json=None,
        reason=reason,
    )


def evaluate_owner_link_post(
    request: Mapping[str, Any],
    owner_links: Mapping[str, OwnerApprovedLink],
    ballots: Iterable[Mapping[str, Any] | AgentBallot],
    *,
    quorum: int = DEFAULT_AGENT_QUORUM,
    min_confidence: int = DEFAULT_MIN_CONFIDENCE,
    now: int | None = None,
) -> CouncilPostDecision:
    """Issue a fresh one-use POST Action Authority from Owner-link + council quorum."""
    current = int(time.time()) if now is None else int(now)
    candidate_id = _clean(request.get("candidate_id"), 160) or "candidate"
    link_id = _clean(request.get("link_id"), 160)
    raw_url = _clean(request.get("url"), 2048)
    council = _validated_ballots(ballots)
    if not 3 <= int(quorum) <= len(COUNCIL_MEMBERS):
        raise ValueError("quorum must require at least 3 of 4 council seats")
    if not 0 <= int(min_confidence) <= 100:
        raise ValueError("min_confidence must be between 0 and 100")

    link = owner_links.get(link_id)
    if link is None:
        return _reject(candidate_id=candidate_id, link_id=link_id, url=raw_url, ballots=council, status="owner_link_not_registered", reason="council cannot add a link to the Owner delegation catalog")
    if not link.allow_council_post:
        return _reject(candidate_id=candidate_id, link_id=link_id, url=raw_url, ballots=council, status="owner_post_delegation_disabled", reason="Owner has not delegated POST decisions for this exact link")

    normalized = _normalize_exact_https_url(raw_url)
    if normalized is None or normalized[0] != link.url:
        return _reject(candidate_id=candidate_id, link_id=link_id, url=raw_url, ballots=council, status="exact_link_mismatch", reason="request must exactly match the Owner-approved HTTPS link")
    if _clean(request.get("method"), 16).upper() != "POST":
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="post_only_lane", reason="this delegated authority lane issues POST only")
    if bool(request.get("requires_credentials")):
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="credential_request_blocked", reason="council-issued link authority is credential-free")

    payload = request.get("json_body", {})
    if not isinstance(payload, Mapping):
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="invalid_payload", reason="json_body must be an object")
    body = _payload_bytes(payload)
    if len(body) > link.max_body_bytes:
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="payload_too_large", reason="payload exceeds Owner link body limit")
    idempotency_key = _clean(request.get("idempotency_key"), 160)
    if not idempotency_key:
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="idempotency_key_required", reason="Council-issued state-changing authority requires an idempotency key")

    yes = sum(1 for item in council if item.accept)
    no = sum(1 for item in council if not item.accept)
    yes_conf = _avg_confidence(council)
    if yes < int(quorum) or yes_conf < int(min_confidence):
        return _reject(candidate_id=candidate_id, link_id=link_id, url=link.url, ballots=council, status="council_quorum_hold", reason="META/X/Senju/PR-Army quorum or confidence threshold not satisfied")

    payload_sha = hashlib.sha256(body).hexdigest()
    authority_id = _authority_id(
        link_id=link.link_id,
        url=link.url,
        payload_sha256=payload_sha,
        idempotency_key=idempotency_key,
        ballots=council,
    )
    authority = CouncilPostAuthority(
        authority_id=authority_id,
        authority_kind="ephemeral_exact_post_action_authority",
        authority_basis="owner_exact_link_plus_distributed_council_quorum",
        issued_at=current,
        expires_at=current + link.authority_ttl_seconds,
        max_uses=1,
        url=link.url,
        host=link.host,
        path=link.path,
        method="POST",
        payload_sha256=payload_sha,
        idempotency_key=idempotency_key,
        credential_scope="none",
        follow_redirects=False,
        council_members=tuple(item.actor for item in council if item.accept),
        council_yes=yes,
        average_yes_confidence=yes_conf,
    )
    return CouncilPostDecision(
        candidate_id=candidate_id,
        link_id=link.link_id,
        url=link.url,
        status="council_issued_post_authority",
        council_yes=yes,
        council_no=no,
        council_missing=len(COUNCIL_MEMBERS) - len(council),
        average_yes_confidence=yes_conf,
        new_authority_created=True,
        execute_now=True,
        authority=authority,
        payload_json=dict(payload),
        reason="Owner delegated the exact link; META/X/Senju/PR-Army quorum issued a fresh one-use POST Action Authority",
    )


def execute_council_post_authority(
    decision: CouncilPostDecision,
    *,
    consumed_authority_ids: set[str] | None = None,
    executor: Callable[..., Mapping[str, Any]] | None = None,
    now: int | None = None,
) -> Mapping[str, Any]:
    """Execute a live council-issued Action Authority through Senju's guarded transport."""
    current = int(time.time()) if now is None else int(now)
    authority = decision.authority
    if not decision.execute_now or authority is None or not decision.new_authority_created:
        raise PermissionError("no live Council-issued POST authority")
    if authority.general_root_authority:
        raise PermissionError("general/root authority is not valid in the exact-link POST lane")
    if current >= authority.expires_at:
        raise PermissionError("Council-issued POST authority expired")
    consumed = consumed_authority_ids if consumed_authority_ids is not None else set()
    if authority.authority_id in consumed:
        raise PermissionError("Council-issued POST authority already consumed")

    body = _payload_bytes(decision.payload_json or {})
    if hashlib.sha256(body).hexdigest() != authority.payload_sha256:
        raise PermissionError("payload no longer matches Council-issued authority")
    headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": authority.idempotency_key,
        "X-The-World-Action-Authority": authority.authority_id,
    }
    if executor is not None:
        return executor(url=authority.url, method="POST", body=body, headers=headers)

    from senju.senju.external import ExternalContactClient, ExternalContactPolicy

    policy = ExternalContactPolicy(
        allow_hosts=frozenset({authority.host}),
        allowed_methods=frozenset({"POST"}),
        allow_http=False,
        allow_delete=False,
        follow_redirects=False,
        timeout_seconds=10.0,
        max_request_bytes=64 * 1024,
        max_response_bytes=512 * 1024,
        retries=1,
    )
    receipt = ExternalContactClient(policy).contact(
        authority.url,
        method="POST",
        body=body,
        headers=headers,
    )
    return receipt.to_dict()
