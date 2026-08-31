"""Production continuity controller for already-authorized META/X/Senju work.

The controller connects existing production-safe primitives into one durable loop:

    authorized discovery -> authority reuse -> descendant replication
    -> same-or-narrower scope inheritance -> approved deployment intent
    -> persisted desired state -> same-authority recovery

It never treats discovery alone as authority, never expands a grant after a denial,
and never turns a Guard/authority rejection into an alternate-path bypass. Transient
transport/service failures may fail over only among routes that were independently
pre-authorized for the exact same target, authority reference, capability, and effect.

Production deployment is reusable without a new human prompt when a separate,
version-controlled deployment authorization already exists. Trust/discovery alone
cannot mint ``deployment.production``.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from senju.meta.closed_loop_agent_fabric import (
    inherited_scopes,
    publish_shared_state,
    queue_descendant_request,
    run_closed_loop_cycle,
)
from senju.meta.standing_authorization import load_registry

CONTINUITY_SCHEMA = "senju-production-continuity/v1"
DEPLOYMENT_AUTHORITY_SCHEMA = "senju-production-deployment-authority/v1"
DEPLOYMENT_INTENT_SCHEMA = "senju-production-deployment-intent/v1"
DENIAL_MEMORY_SCHEMA = "senju-production-continuity-denials/v1"

PRODUCTION_ACTORS = frozenset({"META", "X", "SENJU"})
BOUNDARY_DENIALS = frozenset(
    {
        "authorization_denial",
        "host_denial",
        "credential_denial",
        "private_network_denial",
        "protocol_denial",
        "guard_denial",
        "scope_denial",
    }
)
RETRYABLE_FAILURES = frozenset(
    {
        "network_denial",
        "transient_service_failure",
        "rate_limit_denial",
        "timeout",
        "healthcheck_failure",
    }
)


class ProductionContinuityError(RuntimeError):
    """Raised when production continuity invariants are violated."""


def _utc_now(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise ProductionContinuityError("now must be timezone-aware")
    return value.astimezone(dt.timezone.utc)


def _normalize_host(host: str) -> str:
    value = str(host).strip().rstrip(".").lower()
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise ProductionContinuityError(f"invalid exact host: {host!r}")
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ProductionContinuityError(f"invalid exact host: {host!r}") from exc
    if "." not in value:
        raise ProductionContinuityError("production target must be a fully-qualified host")
    return value


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_ndjson(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(payload), ensure_ascii=False, sort_keys=True) + "\n")


@dataclasses.dataclass(frozen=True)
class AuthorityEvidence:
    target_host: str
    authorization_reference: str
    source: str
    allowed_methods: tuple[str, ...]
    credential_scope: str = "none"
    effect: str = "read_only"
    revoked: bool = False


@dataclasses.dataclass(frozen=True)
class ProductionDeploymentAuthority:
    authorization_reference: str
    target_host: str
    workflow: str
    ref: str
    allowed_systems: tuple[str, ...]
    capabilities: tuple[str, ...]
    effect: str = "production_deployment"
    revoked: bool = False

    @property
    def permits_production_deployment(self) -> bool:
        return not self.revoked and "deployment.production" in self.capabilities


def _standing_evidence(repo_root: Path, target_host: str) -> AuthorityEvidence | None:
    registry_path = repo_root / "senju" / "state" / "standing_authorizations.json"
    for record in load_registry(registry_path):
        if record.revoked:
            continue
        if record.credential_scope != "none" or record.destructive:
            continue
        if target_host not in record.exact_hosts:
            continue
        return AuthorityEvidence(
            target_host=target_host,
            authorization_reference=record.authorization_reference,
            source=f"standing:{record.issuer_kind}",
            allowed_methods=tuple(record.allowed_methods),
            credential_scope=record.credential_scope,
            effect="read_only",
            revoked=False,
        )
    return None


def _discovery_evidence(state_dir: Path, target_host: str, *, now: dt.datetime) -> AuthorityEvidence | None:
    payload = _read_json(state_dir / "discovery_authorized.json", {})
    if not isinstance(payload, Mapping):
        return None
    hosts = payload.get("hosts", {})
    if not isinstance(hosts, Mapping):
        return None
    raw = hosts.get(target_host)
    if not isinstance(raw, Mapping):
        return None
    if str(raw.get("credential_scope", "none")).strip().lower() != "none":
        return None
    if bool(raw.get("allow_delete", False)):
        return None
    effect = str(raw.get("effect", "read_only")).strip().lower()
    if effect != "read_only":
        return None
    expires_at = raw.get("expires_at")
    if expires_at is not None:
        try:
            if int(expires_at) <= int(now.timestamp()):
                return None
        except (TypeError, ValueError):
            return None
    methods = tuple(sorted({str(x).strip().upper() for x in raw.get("allowed_methods", []) if str(x).strip()}))
    if not methods or not set(methods).issubset({"GET", "HEAD", "OPTIONS"}):
        return None
    reference = str(raw.get("authorization_reference") or raw.get("authorization_basis") or "").strip()
    if not reference:
        reference = f"discovery:{target_host}"
    return AuthorityEvidence(
        target_host=target_host,
        authorization_reference=reference,
        source=str(raw.get("source") or "discovery_authorized"),
        allowed_methods=methods,
        credential_scope="none",
        effect="read_only",
        revoked=False,
    )


def resolve_existing_authority(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    target_host: str,
    now: dt.datetime | None = None,
) -> AuthorityEvidence | None:
    """Resolve an already-existing exact production authority; never mint one."""
    root = Path(repo_root)
    state = Path(state_dir)
    host = _normalize_host(target_host)
    current = _utc_now(now)
    return _standing_evidence(root, host) or _discovery_evidence(state, host, now=current)


def load_deployment_authorities(path: str | Path) -> tuple[ProductionDeploymentAuthority, ...]:
    payload = _read_json(Path(path), {})
    if not isinstance(payload, Mapping) or payload.get("schema") != DEPLOYMENT_AUTHORITY_SCHEMA:
        return ()
    records: list[ProductionDeploymentAuthority] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            continue
        try:
            host = _normalize_host(str(raw.get("target_host") or ""))
        except ProductionContinuityError:
            continue
        systems = tuple(sorted({str(x).strip().upper() for x in raw.get("allowed_systems", []) if str(x).strip()}))
        capabilities = tuple(sorted({str(x).strip() for x in raw.get("capabilities", []) if str(x).strip()}))
        reference = str(raw.get("authorization_reference") or "").strip()
        workflow = str(raw.get("workflow") or "").strip()
        ref = str(raw.get("ref") or "").strip()
        if not reference or not workflow or not ref or not systems:
            continue
        records.append(
            ProductionDeploymentAuthority(
                authorization_reference=reference,
                target_host=host,
                workflow=workflow,
                ref=ref,
                allowed_systems=systems,
                capabilities=capabilities,
                effect=str(raw.get("effect") or "production_deployment"),
                revoked=bool(raw.get("revoked", False)),
            )
        )
    return tuple(records)


def resolve_deployment_authority(
    *,
    path: str | Path,
    target_host: str,
    actor: str,
) -> ProductionDeploymentAuthority | None:
    host = _normalize_host(target_host)
    system = actor.strip().upper()
    if system not in PRODUCTION_ACTORS:
        raise ProductionContinuityError(f"unsupported production actor: {actor!r}")
    for authority in load_deployment_authorities(path):
        if authority.target_host != host:
            continue
        if system not in authority.allowed_systems:
            continue
        if authority.permits_production_deployment:
            return authority
    return None


def _intent_key(*, target_host: str, desired_revision: str, deployment_reference: str, action: str) -> str:
    material = f"{target_host}|{desired_revision}|{deployment_reference}|{action}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:24]


def build_deployment_intent(
    *,
    authority: ProductionDeploymentAuthority,
    target_host: str,
    desired_revision: str,
    actor: str,
    action: str = "deploy",
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    host = _normalize_host(target_host)
    system = actor.strip().upper()
    if host != authority.target_host:
        raise PermissionError("deployment authority is exact-host only")
    if system not in authority.allowed_systems:
        raise PermissionError("actor is not included in deployment authority")
    if not authority.permits_production_deployment:
        raise PermissionError("deployment.production capability is not active")
    if action not in {"deploy", "recover_same_revision"}:
        raise ProductionContinuityError("unsupported production deployment action")
    revision = desired_revision.strip()
    if not revision:
        raise ProductionContinuityError("desired_revision is required")
    current = _utc_now(now)
    return {
        "schema": DEPLOYMENT_INTENT_SCHEMA,
        "intent_id": _intent_key(
            target_host=host,
            desired_revision=revision,
            deployment_reference=authority.authorization_reference,
            action=action,
        ),
        "created_at_utc": current.isoformat(),
        "actor": system,
        "target_host": host,
        "desired_revision": revision,
        "action": action,
        "workflow": authority.workflow,
        "ref": authority.ref,
        "deployment_authorization_reference": authority.authorization_reference,
        "capability": "deployment.production",
        "effect": authority.effect,
        "scope_expansion": False,
        "authority_minted_by_continuity": False,
    }


def classify_failure(category: str) -> dict[str, Any]:
    normalized = str(category or "external_failure").strip().lower()
    if normalized in BOUNDARY_DENIALS:
        return {
            "category": normalized,
            "retryable": False,
            "decision": "repair_authority_or_policy_input",
            "alternate_route_after_boundary_denial": False,
        }
    if normalized in RETRYABLE_FAILURES:
        return {
            "category": normalized,
            "retryable": True,
            "decision": "retry_pre_authorized_equivalent_route",
            "alternate_route_after_boundary_denial": False,
        }
    return {
        "category": normalized,
        "retryable": False,
        "decision": "classify_before_retry",
        "alternate_route_after_boundary_denial": False,
    }


def select_pre_authorized_failover_route(
    *,
    routes: Sequence[Mapping[str, Any]],
    target_host: str,
    authority_reference: str,
    capability: str,
    failed_route_id: str | None = None,
) -> dict[str, Any] | None:
    """Select an equivalent route without changing host/authority/capability/effect."""
    host = _normalize_host(target_host)
    candidates: list[dict[str, Any]] = []
    for raw in routes:
        if not isinstance(raw, Mapping) or not bool(raw.get("authorized", False)):
            continue
        try:
            route_host = _normalize_host(str(raw.get("target_host") or ""))
        except ProductionContinuityError:
            continue
        if route_host != host:
            continue
        if str(raw.get("authority_reference") or "") != authority_reference:
            continue
        if str(raw.get("capability") or "") != capability:
            continue
        if str(raw.get("effect") or "") not in {"read_only", "production_deployment"}:
            continue
        route_id = str(raw.get("route_id") or "").strip()
        if not route_id or route_id == (failed_route_id or ""):
            continue
        candidates.append(dict(raw))
    candidates.sort(key=lambda row: (-float(row.get("health_score", 0.0) or 0.0), str(row.get("route_id"))))
    return candidates[0] if candidates else None


def record_denial(
    *,
    state_dir: str | Path,
    actor: str,
    target_host: str,
    authority_reference: str,
    category: str,
    routes: Sequence[Mapping[str, Any]] = (),
    failed_route_id: str | None = None,
) -> dict[str, Any]:
    classification = classify_failure(category)
    failover = None
    if classification["retryable"]:
        failover = select_pre_authorized_failover_route(
            routes=routes,
            target_host=target_host,
            authority_reference=authority_reference,
            capability="authorized_operation",
            failed_route_id=failed_route_id,
        )
    row = {
        "schema": DENIAL_MEMORY_SCHEMA,
        "ts": _utc_now().isoformat(),
        "actor": actor.strip().upper(),
        "target_host": _normalize_host(target_host),
        "authority_reference": authority_reference,
        **classification,
        "selected_failover_route": failover,
    }
    _append_ndjson(Path(state_dir) / "production_continuity_denials.ndjson", row)
    return row


def _load_continuity_state(path: Path) -> dict[str, Any]:
    payload = _read_json(path, {})
    if not isinstance(payload, Mapping) or payload.get("schema") != CONTINUITY_SCHEMA:
        return {}
    return dict(payload)


def _persist_state(path: Path, payload: Mapping[str, Any]) -> None:
    _write_json(path, {"schema": CONTINUITY_SCHEMA, **dict(payload)})


def run_production_continuity_cycle(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    target_host: str,
    actor: str,
    parent_id: str,
    parent_generation: int,
    parent_scopes: Sequence[str],
    desired_replicas: int,
    desired_revision: str,
    active_agents: int = 0,
    active_limit: int = 50,
    current_replicas: int = 0,
    health_status: str = "healthy",
    deployment_authority_path: str | Path | None = None,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    """Run one real production continuity cycle under already-existing authority."""
    root = Path(repo_root)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    system = actor.strip().upper()
    if system not in PRODUCTION_ACTORS:
        raise ProductionContinuityError(f"unsupported production actor: {actor!r}")
    if system == "SENJU":
        # The recursive broker currently owns META/X lineages. Senju participates in
        # shared state and may orchestrate, but materialized descendants stay META/X.
        replication_system = "META"
    else:
        replication_system = system
    if parent_generation < 1:
        raise ProductionContinuityError("production recursive parent_generation must be >= 1")
    if desired_replicas < 0 or current_replicas < 0:
        raise ProductionContinuityError("replica counts cannot be negative")
    if active_limit < 1:
        raise ProductionContinuityError("active_limit must be positive")

    host = _normalize_host(target_host)
    revision = desired_revision.strip()
    if not revision:
        raise ProductionContinuityError("desired_revision is required")
    current = _utc_now(now)
    state_path = state / "production_continuity_state.json"
    previous = _load_continuity_state(state_path)

    authority = resolve_existing_authority(
        repo_root=root,
        state_dir=state,
        target_host=host,
        now=current,
    )
    if authority is None:
        result = {
            "environment": "production",
            "stage": "awaiting_authority",
            "target_host": host,
            "actor": system,
            "desired_revision": revision,
            "desired_replicas": desired_replicas,
            "current_replicas": current_replicas,
            "authority_reused": False,
            "authority_minted": False,
            "replication_queued": 0,
            "deployment_ready": False,
            "persistence": "durable_state_written",
            "recovery_action": None,
            "updated_at_utc": current.isoformat(),
        }
        _persist_state(state_path, result)
        return result

    effective_scopes = inherited_scopes(parent_scopes)
    missing_replicas = max(0, desired_replicas - current_replicas)
    queued = 0
    if missing_replicas:
        queue_descendant_request(
            state_dir=state,
            system=replication_system,
            parent_id=parent_id,
            parent_generation=parent_generation,
            parent_scopes=effective_scopes,
            desired_count=missing_replicas,
            requested_scopes=effective_scopes,
        )
        queued = missing_replicas

    replication = run_closed_loop_cycle(
        state_dir=state,
        active_agents=active_agents,
        active_limit=active_limit,
    )

    deployment_path = Path(deployment_authority_path) if deployment_authority_path is not None else (
        root / "senju" / "config" / "production-deployment-authorizations.json"
    )
    deployment_authority = resolve_deployment_authority(
        path=deployment_path,
        target_host=host,
        actor=system,
    )

    normalized_health = health_status.strip().lower()
    unhealthy = normalized_health in {"unhealthy", "failed", "down", "degraded"}
    last_revision = str(previous.get("last_deployed_revision") or "")
    needs_deploy = last_revision != revision
    deployment_intent: dict[str, Any] | None = None
    recovery_action: str | None = None

    if deployment_authority is not None and (needs_deploy or unhealthy):
        action = "recover_same_revision" if unhealthy and not needs_deploy else "deploy"
        deployment_intent = build_deployment_intent(
            authority=deployment_authority,
            target_host=host,
            desired_revision=revision,
            actor=system,
            action=action,
            now=current,
        )
        _append_ndjson(state / "production_deployment_intents.ndjson", deployment_intent)
        recovery_action = action if unhealthy else None

    stage = "persistent"
    if deployment_authority is None:
        stage = "awaiting_deployment_authority"
    elif deployment_intent is not None:
        stage = "deployment_intent_ready"

    result = {
        "environment": "production",
        "stage": stage,
        "target_host": host,
        "actor": system,
        "desired_revision": revision,
        "desired_replicas": desired_replicas,
        "current_replicas": current_replicas,
        "authority_reused": True,
        "authority_reference": authority.authorization_reference,
        "authority_source": authority.source,
        "authority_minted": False,
        "effective_scopes": list(effective_scopes),
        "scope_inheritance": "equal_by_default_same_or_narrower",
        "replication_queued": queued,
        "replication_materialized": int(replication.get("activated_count", 0)),
        "replication_deferred": int(replication.get("deferred_descendants_after", 0)),
        "fixed_recursive_request_count_ceiling": None,
        "fixed_recursive_generation_ceiling": None,
        "deployment_ready": deployment_intent is not None,
        "deployment_authorization_reference": (
            deployment_authority.authorization_reference if deployment_authority is not None else None
        ),
        "deployment_intent": deployment_intent,
        "last_deployed_revision": revision if deployment_intent is not None else last_revision,
        "health_status": normalized_health,
        "recovery_action": recovery_action,
        "persistence": "durable_state_written",
        "auto_recovery": "same_exact_authority_and_revision_only",
        "boundary_denial_retry": False,
        "updated_at_utc": current.isoformat(),
    }
    _persist_state(state_path, result)
    publish_shared_state(
        state_dir=state,
        actor=system,
        event="production_continuity_cycle_complete",
        lineage_id=parent_id,
        payload={
            "target_host": host,
            "stage": stage,
            "desired_replicas": desired_replicas,
            "replication_queued": queued,
            "replication_materialized": result["replication_materialized"],
            "replication_deferred": result["replication_deferred"],
            "deployment_ready": result["deployment_ready"],
            "recovery_action": recovery_action,
            "scope_inheritance": result["scope_inheritance"],
            "authority_reference": authority.authorization_reference,
        },
    )
    return result
