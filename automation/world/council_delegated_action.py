"""Council-delegated execution for owner-predeclared internal action profiles.

The owner defines the maximum internal host ceiling and a finite catalog of exact
state-changing action profiles. META, X, Senju, and PR-Army may then decide whether
one of those already-delegated actions should execute. This removes per-action Owner
approval without converting discovery or consensus into new external authority.

    owner ceiling + exact action profile
        -> discovered/requested candidate
        -> exact structural profile match
        -> META / X / Senju / PR-Army ballots
        -> 3-of-4 quorum
        -> executable bounded action plan

A council vote can activate an existing delegated action profile. It cannot create a
new host, path, method, credential scope, or general authority grant.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any, Callable, Iterable, Mapping
from urllib.parse import urlsplit

from .distributed_internal_council import (
    COUNCIL_MEMBERS,
    DEFAULT_AGENT_QUORUM,
    DEFAULT_MIN_CONFIDENCE,
    AgentBallot,
)
from .internal_scope_consensus import OwnerInternalEnvelope

STATE_CHANGING_METHODS = frozenset({"POST", "PUT", "PATCH"})
DEFAULT_MAX_BODY_BYTES = 16 * 1024


def _clean(value: Any, limit: int = 240) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())[:limit]


def _normalize_target(url: Any) -> tuple[str, str, str] | None:
    text = _clean(url, 2048)
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
    if not host or "/" in host or "@" in host:
        return None
    if port not in (None, 443):
        return None
    path = parsed.path or "/"
    return text, host, path


def _validated_ballots(values: Iterable[Mapping[str, Any] | AgentBallot]) -> tuple[AgentBallot, ...]:
    indexed: dict[str, AgentBallot] = {}
    for raw in values:
        ballot = raw if isinstance(raw, AgentBallot) else AgentBallot.from_mapping(raw)
        if ballot.actor in indexed:
            raise ValueError(f"duplicate council ballot: {ballot.actor}")
        indexed[ballot.actor] = ballot
    return tuple(indexed[name] for name in COUNCIL_MEMBERS if name in indexed)


def _avg_confidence(ballots: Iterable[AgentBallot], *, accept: bool) -> int:
    values = [item.confidence for item in ballots if item.accept is accept]
    return round(sum(values) / len(values)) if values else 0


@dataclass(frozen=True)
class OwnerActionProfile:
    """Finite action capability delegated by the Owner ahead of time."""

    action_id: str
    host: str
    path: str
    method: str
    allowed_json_keys: tuple[str, ...]
    required_json_keys: tuple[str, ...] = ()
    max_body_bytes: int = DEFAULT_MAX_BODY_BYTES
    require_idempotency_key: bool = True
    description: str = ""

    @classmethod
    def from_mapping(
        cls,
        raw: Mapping[str, Any],
        envelope: OwnerInternalEnvelope,
    ) -> "OwnerActionProfile":
        action_id = _clean(raw.get("action_id"), 160)
        host = _clean(raw.get("host"), 253).lower().rstrip(".")
        path = _clean(raw.get("path"), 600)
        method = _clean(raw.get("method"), 16).upper()
        if not action_id:
            raise ValueError("action_id is required")
        if host not in envelope.ceiling_hosts:
            raise ValueError("action profile host must be inside owner ceiling")
        if not path.startswith("/") or "?" in path or "#" in path:
            raise ValueError("action profile path must be an exact path without query/fragment")
        if method not in STATE_CHANGING_METHODS:
            raise ValueError("delegated action method must be POST, PUT, or PATCH")

        allowed_raw = raw.get("allowed_json_keys", ())
        required_raw = raw.get("required_json_keys", ())
        if not isinstance(allowed_raw, (list, tuple, set, frozenset)):
            raise ValueError("allowed_json_keys must be a collection")
        if not isinstance(required_raw, (list, tuple, set, frozenset)):
            raise ValueError("required_json_keys must be a collection")
        allowed = tuple(dict.fromkeys(_clean(item, 120) for item in allowed_raw if _clean(item, 120)))
        required = tuple(dict.fromkeys(_clean(item, 120) for item in required_raw if _clean(item, 120)))
        if not set(required).issubset(set(allowed)):
            raise ValueError("required_json_keys must be a subset of allowed_json_keys")
        max_bytes = max(256, min(int(raw.get("max_body_bytes", DEFAULT_MAX_BODY_BYTES)), 64 * 1024))
        return cls(
            action_id=action_id,
            host=host,
            path=path,
            method=method,
            allowed_json_keys=allowed,
            required_json_keys=required,
            max_body_bytes=max_bytes,
            require_idempotency_key=bool(raw.get("require_idempotency_key", True)),
            description=_clean(raw.get("description"), 300),
        )


@dataclass(frozen=True)
class CouncilActionDecision:
    candidate_id: str
    action_id: str
    url: str
    host: str
    path: str
    method: str
    status: str
    execute_now: bool
    council_yes: int
    council_no: int
    council_missing: int
    average_yes_confidence: int
    ballots: tuple[AgentBallot, ...]
    authority_basis: str
    delegated_executor_authority: bool
    new_authority_created: bool
    credential_scope: str
    payload_json: Mapping[str, Any] | None
    idempotency_key: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["ballots"] = [asdict(item) for item in self.ballots]
        return data


def _reject(
    *,
    candidate_id: str,
    action_id: str,
    url: str,
    host: str = "",
    path: str = "",
    method: str = "",
    ballots: tuple[AgentBallot, ...] = (),
    status: str,
    reason: str,
) -> CouncilActionDecision:
    yes = sum(1 for item in ballots if item.accept)
    no = sum(1 for item in ballots if not item.accept)
    return CouncilActionDecision(
        candidate_id=candidate_id,
        action_id=action_id,
        url=url,
        host=host,
        path=path,
        method=method,
        status=status,
        execute_now=False,
        council_yes=yes,
        council_no=no,
        council_missing=len(COUNCIL_MEMBERS) - len(ballots),
        average_yes_confidence=_avg_confidence(ballots, accept=True),
        ballots=ballots,
        authority_basis="none",
        delegated_executor_authority=False,
        new_authority_created=False,
        credential_scope="none",
        payload_json=None,
        idempotency_key="",
        reason=reason,
    )


def evaluate_action_request(
    request: Mapping[str, Any],
    envelope: OwnerInternalEnvelope,
    profiles: Mapping[str, OwnerActionProfile],
    ballots: Iterable[Mapping[str, Any] | AgentBallot],
    *,
    quorum: int = DEFAULT_AGENT_QUORUM,
    min_confidence: int = DEFAULT_MIN_CONFIDENCE,
) -> CouncilActionDecision:
    """Authorize execution only from an existing owner-delegated action profile."""
    candidate_id = _clean(request.get("candidate_id"), 160) or "candidate"
    action_id = _clean(request.get("action_id"), 160)
    url_raw = _clean(request.get("url"), 2048)
    council = _validated_ballots(ballots)
    if not 3 <= int(quorum) <= len(COUNCIL_MEMBERS):
        raise ValueError("quorum must require at least 3 of 4 council seats")
    if not 0 <= int(min_confidence) <= 100:
        raise ValueError("min_confidence must be between 0 and 100")

    profile = profiles.get(action_id)
    if profile is None:
        return _reject(
            candidate_id=candidate_id,
            action_id=action_id,
            url=url_raw,
            ballots=council,
            status="unregistered_action",
            reason="discovery/council consensus cannot create a new action profile",
        )

    normalized = _normalize_target(url_raw)
    if normalized is None:
        return _reject(
            candidate_id=candidate_id,
            action_id=action_id,
            url=url_raw,
            ballots=council,
            status="invalid_target",
            reason="target must be exact HTTPS/443 without URL credentials, query, or fragment",
        )
    url, host, path = normalized
    method = _clean(request.get("method"), 16).upper()

    if host not in envelope.ceiling_hosts:
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="outside_owner_ceiling",
            reason="council cannot move the owner host ceiling",
        )
    if host != profile.host or path != profile.path or method != profile.method:
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="profile_mismatch",
            reason="host/path/method must exactly match the owner-delegated action profile",
        )
    if bool(request.get("requires_credentials")):
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="credential_request_blocked",
            reason="this delegated lane is credential-free",
        )

    payload = request.get("json_body", {})
    if not isinstance(payload, Mapping):
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="invalid_payload",
            reason="json_body must be an object",
        )
    keys = {str(key) for key in payload.keys()}
    if not keys.issubset(set(profile.allowed_json_keys)):
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="payload_key_outside_profile",
            reason="payload contains a key not delegated by the owner action profile",
        )
    if not set(profile.required_json_keys).issubset(keys):
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="missing_required_payload_key",
            reason="payload is missing a required owner-delegated key",
        )
    encoded = json.dumps(dict(payload), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > profile.max_body_bytes:
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="payload_too_large",
            reason="payload exceeds action profile body limit",
        )

    idempotency_key = _clean(request.get("idempotency_key"), 160)
    if profile.require_idempotency_key and not idempotency_key:
        return _reject(
            candidate_id=candidate_id, action_id=action_id, url=url, host=host, path=path,
            method=method, ballots=council, status="idempotency_key_required",
            reason="state-changing delegated actions require an idempotency key",
        )

    yes = sum(1 for item in council if item.accept)
    no = sum(1 for item in council if not item.accept)
    yes_conf = _avg_confidence(council, accept=True)
    approved = yes >= int(quorum) and yes_conf >= int(min_confidence)
    status = "council_authorized_action" if approved else "council_quorum_hold"
    return CouncilActionDecision(
        candidate_id=candidate_id,
        action_id=action_id,
        url=url,
        host=host,
        path=path,
        method=method,
        status=status,
        execute_now=approved,
        council_yes=yes,
        council_no=no,
        council_missing=len(COUNCIL_MEMBERS) - len(council),
        average_yes_confidence=yes_conf,
        ballots=council,
        authority_basis="owner_predeclared_action_profile" if approved else "none",
        delegated_executor_authority=approved,
        new_authority_created=False,
        credential_scope="none",
        payload_json=dict(payload) if approved else None,
        idempotency_key=idempotency_key if approved else "",
        reason=(
            "META/X/Senju/PR-Army quorum activated an existing owner-delegated action profile"
            if approved
            else "council quorum/confidence not satisfied"
        ),
    )


def build_profiles(
    envelope: OwnerInternalEnvelope,
    rows: Iterable[Mapping[str, Any]],
) -> dict[str, OwnerActionProfile]:
    profiles: dict[str, OwnerActionProfile] = {}
    for raw in rows:
        if not isinstance(raw, Mapping):
            continue
        profile = OwnerActionProfile.from_mapping(raw, envelope)
        if profile.action_id in profiles:
            raise ValueError(f"duplicate owner action profile: {profile.action_id}")
        profiles[profile.action_id] = profile
    return profiles


def run_council_delegated_actions(
    envelope_raw: Mapping[str, Any],
    profile_rows: Iterable[Mapping[str, Any]],
    requests: Iterable[Mapping[str, Any]],
    ballots_by_candidate: Mapping[str, Iterable[Mapping[str, Any] | AgentBallot]],
    *,
    quorum: int = DEFAULT_AGENT_QUORUM,
    min_confidence: int = DEFAULT_MIN_CONFIDENCE,
) -> dict[str, Any]:
    envelope = OwnerInternalEnvelope.from_mapping(envelope_raw)
    profiles = build_profiles(envelope, profile_rows)
    decisions: list[CouncilActionDecision] = []
    for request in requests:
        if not isinstance(request, Mapping):
            continue
        candidate_id = _clean(request.get("candidate_id"), 160) or "candidate"
        decisions.append(
            evaluate_action_request(
                request,
                envelope,
                profiles,
                ballots_by_candidate.get(candidate_id, ()),
                quorum=quorum,
                min_confidence=min_confidence,
            )
        )
    return {
        "schema": "the-world-council-delegated-actions/v1",
        "mode": "owner_profile_council_execution_delegation",
        "members": list(COUNCIL_MEMBERS),
        "quorum": int(quorum),
        "min_confidence": int(min_confidence),
        "registered_action_ids": sorted(profiles),
        "executable_count": sum(1 for item in decisions if item.execute_now),
        "decisions": [item.to_dict() for item in decisions],
        "limits": [
            "discovery_cannot_create_action_profile",
            "council_cannot_move_owner_ceiling",
            "exact_host_path_method_profile_match_required",
            "credential_free_only",
            "post_put_patch_only_when_owner_predeclared",
            "no_delete",
            "no_general_authority_minting",
        ],
    }


def execute_authorized_action(
    decision: CouncilActionDecision,
    *,
    executor: Callable[..., Mapping[str, Any]] | None = None,
) -> Mapping[str, Any]:
    """Execute a previously council-authorized plan.

    Tests can inject ``executor``. Production uses Senju's guarded ExternalContactClient
    with an exact one-host/one-method policy derived from the already-approved plan.
    """
    if not decision.execute_now or decision.authority_basis != "owner_predeclared_action_profile":
        raise PermissionError("action is not council-authorized for execution")
    body = json.dumps(dict(decision.payload_json or {}), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if decision.idempotency_key:
        headers["Idempotency-Key"] = decision.idempotency_key

    if executor is not None:
        return executor(
            url=decision.url,
            method=decision.method,
            body=body,
            headers=headers,
        )

    from senju.senju.external import ExternalContactClient, ExternalContactPolicy

    policy = ExternalContactPolicy(
        allow_hosts=frozenset({decision.host}),
        allowed_methods=frozenset({decision.method}),
        allow_http=False,
        allow_delete=False,
        follow_redirects=False,
        retries=1,
    )
    receipt = ExternalContactClient(policy).contact(
        decision.url,
        method=decision.method,
        body=body,
        headers=headers,
    )
    return receipt.to_dict()
