"""The world: one trust-root loop for authorized production continuity.

This module composes existing discovery evidence, explicit standing authority,
credentialed execution, replication, persistence, checkpoint recovery, and deployment
intent into one control-plane loop.

Important boundary:
- discovery is evidence, never permission by itself;
- authorization is resolved from live explicit authority;
- credentialed external writes require a separately explicit write authority;
- checkpoints restore work state only after live authority is revalidated;
- replicas inherit the same or narrower capability and never raw secret bytes;
- emergency/security stop pauses execution and recovery;
- no component may self-approve a new trust root or widen network policy after denial.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, MutableMapping, Sequence

from .credential_runtime import CredentialRecoveryRuntime
from .emergency_stop_state import initialize_emergency_state, is_emergency_stopped
from .external_denial_learning import DenialLearningMemory
from .guard_denial_feedback import feedback_state, record_guard_failure
from .meta.production_continuity import (
    ProductionContinuityError,
    load_deployment_authorities,
    resolve_existing_authority,
    run_production_continuity_cycle,
)
from .meta.standing_authorization import (
    StandingAuthorization,
    load_registry,
    renew_operational_lease,
)
from .replica_credential_lineage import ReplicaCredentialLineage

WORLD_LOOP_SCHEMA = "senju-world-trust-root-loop/v1"
TRUST_BINDING_SCHEMA = "senju-world-trust-root-bindings/v1"
WRITE_AUTH_SCHEMA = "senju-credentialed-external-write-authority/v1"
WORLD_STATE_SCHEMA = "senju-world-trust-root-state/v1"
CHECKPOINT_SCHEMA = "senju-world-trust-root-checkpoint/v1"
QUEUE_SCHEMA = "senju-world-trust-root-queue/v1"

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH"})
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
TRUSTED_ISSUER_KINDS = frozenset(
    {"owner_explicit", "canonical_repository", "independent_authority"}
)
PRODUCTION_ACTORS = frozenset({"META", "X", "SENJU"})
MAX_QUEUE_ITEMS = 2000
MAX_DISCOVERIES_PER_CYCLE = 500
MAX_OPERATIONS_PER_CYCLE = 64


class WorldTrustRootError(RuntimeError):
    """Raised when the integrated trust-root loop would violate a live authority."""


def _utc_now(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise WorldTrustRootError("now must be timezone-aware")
    return value.astimezone(dt.timezone.utc)


def _normalize_host(host: str) -> str:
    value = str(host).strip().rstrip(".").lower()
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise WorldTrustRootError(f"invalid exact host: {host!r}")
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise WorldTrustRootError(f"invalid exact host: {host!r}") from exc
    if "." not in value:
        raise WorldTrustRootError("target host must be fully-qualified")
    return value


def _host_from_candidate(raw: Mapping[str, Any]) -> str | None:
    host = raw.get("host") or raw.get("hostname") or raw.get("target_host")
    if host:
        try:
            return _normalize_host(str(host))
        except WorldTrustRootError:
            return None
    url = raw.get("url")
    if not isinstance(url, str):
        return None
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            return None
        return _normalize_host(parsed.hostname)
    except (ValueError, WorldTrustRootError):
        return None


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _fingerprint(data: Mapping[str, Any]) -> str:
    raw = json.dumps(dict(data), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _contains_secret(value: Any, secret: str) -> bool:
    if not secret:
        return False
    if isinstance(value, str):
        return secret in value
    if isinstance(value, Mapping):
        return any(
            _contains_secret(key, secret) or _contains_secret(item, secret)
            for key, item in value.items()
        )
    if isinstance(value, (list, tuple, set, frozenset)):
        return any(_contains_secret(item, secret) for item in value)
    return False


@dataclasses.dataclass(frozen=True)
class TrustRootBinding:
    root_id: str
    owner: str
    target_host: str
    standing_authorization_reference: str
    deployment_authorization_reference: str | None = None
    credentialed_write_authorization_reference: str | None = None
    max_replica_target: int = 8
    max_credential_replica_depth: int = 4
    revoked: bool = False

    @property
    def active(self) -> bool:
        return not self.revoked

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @property
    def fingerprint(self) -> str:
        return _fingerprint(self.to_dict())


@dataclasses.dataclass(frozen=True)
class CredentialedWriteAuthority:
    authorization_reference: str
    root_id: str
    owner: str
    issuer_kind: str
    approval_ref: str
    target_host: str
    provider: str
    resource_prefixes: tuple[str, ...]
    allowed_methods: tuple[str, ...]
    required_scopes: tuple[str, ...]
    allowed_systems: tuple[str, ...]
    effect: str = "credentialed_external_write"
    revoked: bool = False

    @property
    def active(self) -> bool:
        return not self.revoked

    def permits(
        self,
        *,
        root_id: str,
        actor: str,
        host: str,
        method: str,
        resource: str,
        required_scopes: Iterable[str],
    ) -> bool:
        if not self.active or root_id != self.root_id:
            return False
        if actor.strip().upper() not in self.allowed_systems:
            return False
        if _normalize_host(host) != self.target_host:
            return False
        if method.strip().upper() not in self.allowed_methods:
            return False
        requested = set(str(x).strip() for x in required_scopes if str(x).strip())
        if not requested or not requested.issubset(set(self.required_scopes)):
            return False
        normalized_resource = str(resource).strip()
        if not normalized_resource:
            return False
        return any(normalized_resource.startswith(prefix) for prefix in self.resource_prefixes)


def load_trust_root_bindings(path: str | Path) -> tuple[TrustRootBinding, ...]:
    payload = _read_json(Path(path), {})
    if not isinstance(payload, Mapping) or payload.get("schema") != TRUST_BINDING_SCHEMA:
        return ()
    records: list[TrustRootBinding] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            continue
        try:
            host = _normalize_host(str(raw.get("target_host") or ""))
            root_id = str(raw.get("root_id") or "").strip()
            owner = str(raw.get("owner") or "").strip()
            standing_ref = str(raw.get("standing_authorization_reference") or "").strip()
            if not root_id or not owner or not standing_ref:
                continue
            records.append(
                TrustRootBinding(
                    root_id=root_id,
                    owner=owner,
                    target_host=host,
                    standing_authorization_reference=standing_ref,
                    deployment_authorization_reference=(
                        str(raw.get("deployment_authorization_reference")).strip()
                        if raw.get("deployment_authorization_reference")
                        else None
                    ),
                    credentialed_write_authorization_reference=(
                        str(raw.get("credentialed_write_authorization_reference")).strip()
                        if raw.get("credentialed_write_authorization_reference")
                        else None
                    ),
                    max_replica_target=max(1, min(int(raw.get("max_replica_target", 8)), 32)),
                    max_credential_replica_depth=max(
                        0, min(int(raw.get("max_credential_replica_depth", 4)), 8)
                    ),
                    revoked=bool(raw.get("revoked", False)),
                )
            )
        except (TypeError, ValueError, WorldTrustRootError):
            continue
    return tuple(records)


def resolve_trust_root_binding(
    *,
    path: str | Path,
    root_id: str,
) -> TrustRootBinding | None:
    wanted = root_id.strip()
    for binding in load_trust_root_bindings(path):
        if binding.root_id == wanted and binding.active:
            return binding
    return None


def load_credentialed_write_authorities(
    path: str | Path,
) -> tuple[CredentialedWriteAuthority, ...]:
    payload = _read_json(Path(path), {})
    if not isinstance(payload, Mapping) or payload.get("schema") != WRITE_AUTH_SCHEMA:
        return ()
    records: list[CredentialedWriteAuthority] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            continue
        issuer = str(raw.get("issuer_kind") or "").strip().lower()
        approval_ref = str(raw.get("approval_ref") or "").strip()
        if issuer not in TRUSTED_ISSUER_KINDS or not approval_ref:
            continue
        try:
            host = _normalize_host(str(raw.get("target_host") or ""))
        except WorldTrustRootError:
            continue
        methods = tuple(
            sorted(
                {
                    str(x).strip().upper()
                    for x in raw.get("allowed_methods", [])
                    if str(x).strip()
                }
            )
        )
        if not methods or not set(methods).issubset(WRITE_METHODS):
            continue
        prefixes = tuple(
            sorted(
                {
                    str(x).strip()
                    for x in raw.get("resource_prefixes", [])
                    if str(x).strip()
                }
            )
        )
        scopes = tuple(
            sorted(
                {
                    str(x).strip()
                    for x in raw.get("required_scopes", [])
                    if str(x).strip()
                }
            )
        )
        systems = tuple(
            sorted(
                {
                    str(x).strip().upper()
                    for x in raw.get("allowed_systems", [])
                    if str(x).strip().upper() in PRODUCTION_ACTORS
                }
            )
        )
        root_id = str(raw.get("root_id") or "").strip()
        owner = str(raw.get("owner") or "").strip()
        reference = str(raw.get("authorization_reference") or "").strip()
        provider = str(raw.get("provider") or "").strip().lower()
        if not all((root_id, owner, reference, provider, prefixes, scopes, systems)):
            continue
        records.append(
            CredentialedWriteAuthority(
                authorization_reference=reference,
                root_id=root_id,
                owner=owner,
                issuer_kind=issuer,
                approval_ref=approval_ref,
                target_host=host,
                provider=provider,
                resource_prefixes=prefixes,
                allowed_methods=methods,
                required_scopes=scopes,
                allowed_systems=systems,
                effect=str(raw.get("effect") or "credentialed_external_write"),
                revoked=bool(raw.get("revoked", False)),
            )
        )
    return tuple(records)


def resolve_credentialed_write_authority(
    *,
    path: str | Path,
    authorization_reference: str | None,
    root_id: str,
) -> CredentialedWriteAuthority | None:
    if not authorization_reference:
        return None
    for authority in load_credentialed_write_authorities(path):
        if (
            authority.authorization_reference == authorization_reference
            and authority.root_id == root_id
            and authority.active
        ):
            return authority
    return None


def _standing_authorization_for_binding(
    *,
    registry_path: Path,
    binding: TrustRootBinding,
) -> StandingAuthorization | None:
    for authorization in load_registry(registry_path):
        if authorization.authorization_reference != binding.standing_authorization_reference:
            continue
        if authorization.revoked:
            return None
        if binding.target_host not in authorization.exact_hosts:
            return None
        return authorization
    return None


def _deployment_reference_is_live(
    *,
    path: Path,
    binding: TrustRootBinding,
    actor: str,
) -> bool:
    expected = binding.deployment_authorization_reference
    if not expected:
        return False
    for authority in load_deployment_authorities(path):
        if (
            authority.authorization_reference == expected
            and authority.target_host == binding.target_host
            and actor.strip().upper() in authority.allowed_systems
            and authority.permits_production_deployment
        ):
            return True
    return False


WriteExecutor = Callable[[str, Mapping[str, Any]], Mapping[str, Any]]


@dataclasses.dataclass
class WorldTrustRootLoop:
    repo_root: Path
    state_dir: Path
    binding: TrustRootBinding
    actor: str = "META"
    emergency_state: MutableMapping[str, Any] = dataclasses.field(default_factory=dict)
    denial_memory: DenialLearningMemory = dataclasses.field(default_factory=DenialLearningMemory)
    credential_runtime: CredentialRecoveryRuntime | None = None
    write_executor: WriteExecutor | None = None
    write_authority_path: Path | None = None
    deployment_authority_path: Path | None = None
    standing_registry_path: Path | None = None

    def __post_init__(self) -> None:
        self.actor = self.actor.strip().upper()
        if self.actor not in PRODUCTION_ACTORS:
            raise WorldTrustRootError(f"unsupported production actor: {self.actor!r}")
        initialize_emergency_state(self.emergency_state)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        if self.write_authority_path is None:
            self.write_authority_path = (
                self.repo_root / "senju" / "config" / "credentialed-external-write-authorizations.json"
            )
        if self.deployment_authority_path is None:
            self.deployment_authority_path = (
                self.repo_root / "senju" / "config" / "production-deployment-authorizations.json"
            )
        if self.standing_registry_path is None:
            self.standing_registry_path = (
                self.repo_root / "senju" / "state" / "standing_authorizations.json"
            )

    @property
    def state_path(self) -> Path:
        return self.state_dir / "world_trust_root_state.json"

    @property
    def checkpoint_path(self) -> Path:
        return self.state_dir / "world_trust_root_checkpoint.json"

    @property
    def queue_path(self) -> Path:
        return self.state_dir / "world_trust_root_queue.json"

    def _live_standing(self) -> StandingAuthorization | None:
        assert self.standing_registry_path is not None
        return _standing_authorization_for_binding(
            registry_path=self.standing_registry_path,
            binding=self.binding,
        )

    def _live_root(self) -> bool:
        if not self.binding.active or is_emergency_stopped(self.emergency_state):
            return False
        return self._live_standing() is not None

    def _load_previous_state(self) -> dict[str, Any]:
        previous = _read_json(self.state_path, {})
        if not isinstance(previous, Mapping) or previous.get("schema") != WORLD_STATE_SCHEMA:
            return {}
        if previous.get("root_fingerprint") != self.binding.fingerprint:
            return {}
        return dict(previous)

    def recover_checkpoint(self) -> dict[str, Any]:
        """Restore work state only after the current explicit root is revalidated."""
        payload = _read_json(self.checkpoint_path, {})
        if not isinstance(payload, Mapping) or payload.get("schema") != CHECKPOINT_SCHEMA:
            return {"recovered": False, "reason": "checkpoint_unavailable"}
        if payload.get("root_fingerprint") != self.binding.fingerprint:
            return {"recovered": False, "reason": "root_fingerprint_changed"}
        if not self._live_root():
            return {"recovered": False, "reason": "live_authority_or_security_stop_blocked"}
        queue = payload.get("queue")
        if isinstance(queue, list):
            _write_json(
                self.queue_path,
                {
                    "schema": QUEUE_SCHEMA,
                    "root_id": self.binding.root_id,
                    "items": [dict(x) for x in queue if isinstance(x, Mapping)][-MAX_QUEUE_ITEMS:],
                },
            )
        return {
            "recovered": True,
            "reason": "live_root_revalidated",
            "authorization_reference": self.binding.standing_authorization_reference,
            "authority_restored_from_checkpoint": False,
            "work_state_restored": True,
        }

    def _load_queue(self) -> list[dict[str, Any]]:
        payload = _read_json(self.queue_path, {})
        if not isinstance(payload, Mapping) or payload.get("schema") != QUEUE_SCHEMA:
            return []
        if str(payload.get("root_id") or "") != self.binding.root_id:
            return []
        return [
            dict(x)
            for x in payload.get("items", [])
            if isinstance(x, Mapping)
        ][-MAX_QUEUE_ITEMS:]

    def _persist_queue(self, items: Sequence[Mapping[str, Any]]) -> None:
        _write_json(
            self.queue_path,
            {
                "schema": QUEUE_SCHEMA,
                "root_id": self.binding.root_id,
                "items": [dict(x) for x in items][-MAX_QUEUE_ITEMS:],
            },
        )

    def _record_boundary_failure(
        self,
        *,
        state: str,
        operation_id: str,
        detail: str,
    ) -> None:
        standing = self._live_standing()
        if standing is None:
            from .external import ExternalAuthorityScope

            scope = ExternalAuthorityScope(
                scope_id=f"world-root:{self.binding.root_id}",
                target_service="world trust root diagnostic",
                allow_hosts=frozenset({self.binding.target_host}),
                allowed_methods=frozenset({"GET", "HEAD"}),
                credential_scope="none",
            )
        else:
            from .external import ExternalAuthorityScope

            scope = ExternalAuthorityScope(
                scope_id=standing.authorization_reference,
                target_service="standing world trust root",
                allow_hosts=frozenset(standing.exact_hosts),
                allowed_methods=frozenset(standing.allowed_methods),
                credential_scope=standing.credential_scope,
            )
        record_guard_failure(
            self.denial_memory,
            state=state,
            operation_id=operation_id,
            agent_id=self.actor,
            scope=scope,
            url=f"https://{self.binding.target_host}/",
            method="GET",
            detail=detail,
        )

    def ingest_discoveries(
        self,
        discoveries: Sequence[Mapping[str, Any]],
        *,
        now: dt.datetime,
    ) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        standing = self._live_standing()
        exact_hosts = set(standing.exact_hosts) if standing is not None else set()
        for index, raw in enumerate(discoveries[:MAX_DISCOVERIES_PER_CYCLE]):
            host = _host_from_candidate(raw)
            if host is None:
                continue
            in_root = host == self.binding.target_host and host in exact_hosts
            record = {
                "discovery_id": str(raw.get("discovery_id") or f"discovery-{index}"),
                "host": host,
                "url": raw.get("url"),
                "source": raw.get("source"),
                "root_id": self.binding.root_id,
                "authorization_reference": (
                    self.binding.standing_authorization_reference if in_root else None
                ),
                "authorization_state": "authorized_existing_root" if in_root else "authorization_required",
                "authority_minted_from_discovery": False,
                "discovered_at_utc": now.isoformat(),
            }
            if not in_root:
                self._record_boundary_failure(
                    state="OUT_OF_SCOPE",
                    operation_id=record["discovery_id"],
                    detail=f"discovered host outside explicit root: {host}",
                )
            records.append(record)
        return records

    def _write_authority(self) -> CredentialedWriteAuthority | None:
        assert self.write_authority_path is not None
        return resolve_credentialed_write_authority(
            path=self.write_authority_path,
            authorization_reference=self.binding.credentialed_write_authorization_reference,
            root_id=self.binding.root_id,
        )

    def _execute_credentialed_write(
        self,
        operation: Mapping[str, Any],
    ) -> dict[str, Any]:
        operation_id = str(operation.get("operation_id") or "").strip()
        host = _normalize_host(str(operation.get("target_host") or self.binding.target_host))
        method = str(operation.get("method") or "POST").strip().upper()
        resource = str(operation.get("resource") or "").strip()
        required_scopes = tuple(
            sorted(
                {
                    str(x).strip()
                    for x in operation.get("required_scopes", [])
                    if str(x).strip()
                }
            )
        )
        authority = self._write_authority()
        if authority is None:
            self._record_boundary_failure(
                state="AUTHORITY_DENIED",
                operation_id=operation_id or "credentialed-write",
                detail="no live explicit credentialed write authority bound to trust root",
            )
            return {
                "operation_id": operation_id,
                "success": False,
                "stage": "awaiting_credentialed_write_authority",
                "retryable": False,
                "authority_minted": False,
            }
        if not authority.permits(
            root_id=self.binding.root_id,
            actor=self.actor,
            host=host,
            method=method,
            resource=resource,
            required_scopes=required_scopes,
        ):
            self._record_boundary_failure(
                state="POLICY_DENIED",
                operation_id=operation_id or "credentialed-write",
                detail="credentialed write operation exceeds explicit write authority",
            )
            return {
                "operation_id": operation_id,
                "success": False,
                "stage": "write_outside_authority",
                "retryable": False,
                "authority_reference": authority.authorization_reference,
            }
        if self.credential_runtime is None or self.write_executor is None:
            return {
                "operation_id": operation_id,
                "success": False,
                "stage": "runtime_executor_unavailable",
                "retryable": False,
                "authority_reference": authority.authorization_reference,
            }

        payload = dict(operation.get("payload") or {})

        def attempt(secret: str) -> Mapping[str, Any]:
            assert self.write_executor is not None
            result = self.write_executor(
                secret,
                {
                    "operation_id": operation_id,
                    "root_id": self.binding.root_id,
                    "authorization_reference": authority.authorization_reference,
                    "target_host": host,
                    "method": method,
                    "resource": resource,
                    "payload": payload,
                },
            )
            if not isinstance(result, Mapping):
                raise WorldTrustRootError("write executor must return a mapping")
            if _contains_secret(result, secret):
                raise WorldTrustRootError(
                    "write executor attempted to expose raw credential material"
                )
            return result

        result, response = self.credential_runtime.recover_operation(
            provider=authority.provider,
            required_scopes=required_scopes,
            operation=operation_id,
            resource=resource,
            error_code="permission_denied",
            attempt_with_secret=attempt,
            ttl_seconds=max(30, min(int(operation.get("ttl_seconds", 300)), 900)),
        )
        record: dict[str, Any] = {
            "operation_id": operation_id,
            "success": bool(result.recovered),
            "stage": "executed" if result.recovered else "credential_recovery_failed",
            "authorization_reference": authority.authorization_reference,
            "authority_root_id": self.binding.root_id,
            "authority_changed": bool(result.authority_changed),
            "credential_grant_id": result.grant_id,
            "credential_lease_id": result.lease_id,
            "response": dict(response or {}),
        }
        if not result.recovered or not result.lease_id:
            self._record_boundary_failure(
                state="CREDENTIAL_DENIED",
                operation_id=operation_id,
                detail="no pre-approved credential grant completed the authorized write",
            )
            return record

        max_depth = min(
            max(0, int(operation.get("replicate_depth", 0))),
            self.binding.max_credential_replica_depth,
        )
        if max_depth:
            lineage = ReplicaCredentialLineage(
                broker=self.credential_runtime.broker,
                authority=self.credential_runtime.authority,
                controller_actor=self.credential_runtime.actor,
            )
            root_lease = self.credential_runtime.broker._active_lease(result.lease_id)
            parent_id = f"{operation_id}:root"
            lineage.attach_root(replica_id=parent_id, lease=root_lease)
            current_id = parent_id
            for generation in range(1, max_depth + 1):
                parent_lease = lineage.lease_for_runtime(current_id)
                expires = dt.datetime.fromisoformat(parent_lease.expires_at_utc)
                remaining = max(
                    0,
                    int((expires - dt.datetime.now(dt.timezone.utc)).total_seconds()),
                )
                if remaining < 31:
                    break
                child_id = f"{operation_id}:replica:{generation}"
                child_ttl = max(30, min(120, remaining - 1))
                lineage.delegate(
                    parent_replica_id=current_id,
                    child_replica_id=child_id,
                    scopes=required_scopes,
                    ttl_seconds=child_ttl,
                    recipient_actor="X",
                )
                current_id = child_id
            record["credential_replication"] = lineage.export_state()
        return record

    def _renew_read_lease(self, *, now: dt.datetime) -> dict[str, Any]:
        standing = self._live_standing()
        if standing is None:
            return {"renewed": False, "reason": "standing_authority_unavailable"}
        try:
            renewal = renew_operational_lease(
                standing,
                actor="META",
                requested_hosts=(self.binding.target_host,),
                requested_methods=tuple(
                    method for method in standing.allowed_methods if method in READ_METHODS
                ),
                lease_seconds=6 * 60 * 60,
                reason="world_closed_loop_continuity",
                now=now,
            )
        except Exception as exc:
            return {"renewed": False, "reason": type(exc).__name__}
        return {
            "renewed": renewal.automatically_renewed,
            "lease_id": renewal.lease.lease_id,
            "expires_at_utc": renewal.lease.expires_at_utc,
            "authority_broadened": renewal.authority_broadened,
            "authorization_reference": standing.authorization_reference,
        }

    def run_cycle(
        self,
        *,
        discoveries: Sequence[Mapping[str, Any]] = (),
        operations: Sequence[Mapping[str, Any]] = (),
        parent_id: str = "world-root",
        parent_generation: int = 1,
        parent_scopes: Sequence[str] = ("external.read",),
        desired_replicas: int = 3,
        current_replicas: int = 0,
        active_agents: int = 0,
        active_limit: int = 50,
        desired_revision: str = "current",
        health_status: str = "healthy",
        now: dt.datetime | None = None,
    ) -> dict[str, Any]:
        current = _utc_now(now)
        recovery = self.recover_checkpoint()
        previous = self._load_previous_state()
        queue = self._load_queue()

        live_root = self._live_root()
        if not live_root:
            state_name = (
                "SECURITY_STOP"
                if is_emergency_stopped(self.emergency_state)
                else "AUTHORITY_DENIED"
            )
            self._record_boundary_failure(
                state=state_name,
                operation_id=f"cycle:{int(current.timestamp())}",
                detail="world trust root is not currently executable",
            )
            report = {
                "schema": WORLD_LOOP_SCHEMA,
                "environment": "production",
                "root_id": self.binding.root_id,
                "root_fingerprint": self.binding.fingerprint,
                "authorization_central": True,
                "stage": "paused",
                "emergency_stop": is_emergency_stopped(self.emergency_state),
                "live_authority": False,
                "checkpoint_recovery": recovery,
                "self_tune": feedback_state(self.denial_memory),
                "discover_again": False,
                "authority_minted_by_loop": False,
                "security_self_approval": False,
                "network_policy_self_edit": False,
                "updated_at_utc": current.isoformat(),
            }
            self._persist(report=report, queue=queue)
            return report

        discovery_records = self.ingest_discoveries(discoveries, now=current)
        for item in discovery_records:
            if item["authorization_state"] == "authorization_required":
                queue.append(
                    {
                        "kind": "authorization_request",
                        "root_id": self.binding.root_id,
                        "host": item["host"],
                        "source_discovery_id": item["discovery_id"],
                        "status": "pending_external_authority",
                        "created_at_utc": current.isoformat(),
                    }
                )

        write_results: list[dict[str, Any]] = []
        for operation in operations[:MAX_OPERATIONS_PER_CYCLE]:
            kind = str(operation.get("kind") or "credentialed_external_write").strip()
            if kind in {"credentialed_external_write", "external_write"}:
                write_results.append(self._execute_credentialed_write(operation))
            else:
                queue.append(
                    {
                        "kind": "unsupported_operation",
                        "root_id": self.binding.root_id,
                        "operation_id": operation.get("operation_id"),
                        "status": "diagnostic_review",
                        "created_at_utc": current.isoformat(),
                    }
                )

        desired_replica_target = max(
            0,
            min(int(desired_replicas), self.binding.max_replica_target),
        )
        continuity = run_production_continuity_cycle(
            repo_root=self.repo_root,
            state_dir=self.state_dir,
            target_host=self.binding.target_host,
            actor=self.actor,
            parent_id=parent_id,
            parent_generation=max(1, int(parent_generation)),
            parent_scopes=tuple(parent_scopes),
            desired_replicas=desired_replica_target,
            desired_revision=desired_revision,
            active_agents=max(0, int(active_agents)),
            active_limit=max(1, int(active_limit)),
            current_replicas=max(0, int(current_replicas)),
            health_status=health_status,
            deployment_authority_path=self.deployment_authority_path,
            now=current,
        )
        deployment_live = _deployment_reference_is_live(
            path=self.deployment_authority_path,
            binding=self.binding,
            actor=self.actor,
        )
        read_lease = self._renew_read_lease(now=current)
        self_tune = feedback_state(self.denial_memory)

        report = {
            "schema": WORLD_LOOP_SCHEMA,
            "environment": "production",
            "root_id": self.binding.root_id,
            "root_fingerprint": self.binding.fingerprint,
            "target_host": self.binding.target_host,
            "authorization_central": True,
            "authorization_reference": self.binding.standing_authorization_reference,
            "authorization_reused_not_minted": True,
            "discovery": {
                "count": len(discovery_records),
                "records": discovery_records,
            },
            "authorization": {
                "standing_live": True,
                "standing_reference": self.binding.standing_authorization_reference,
                "deployment_live": deployment_live,
                "deployment_reference": self.binding.deployment_authorization_reference,
                "credentialed_write_reference": self.binding.credentialed_write_authorization_reference,
                "read_lease": read_lease,
            },
            "execution": {
                "credentialed_external_writes": write_results,
                "external_write_enabled": self._write_authority() is not None,
            },
            "propagation": {
                "desired_replicas": desired_replica_target,
                "max_replica_target": self.binding.max_replica_target,
                "continuity": continuity,
            },
            "persistence": {
                "queue_items": min(len(queue), MAX_QUEUE_ITEMS),
                "state_path": str(self.state_path),
                "checkpoint_path": str(self.checkpoint_path),
            },
            "recovery": {
                "checkpoint": recovery,
                "same_live_authority_required": True,
                "authority_restored_from_checkpoint": False,
                "continuity_recovery_action": continuity.get("recovery_action"),
            },
            "self_tune": self_tune,
            "closed_loop": [
                "discover",
                "authorize_existing_root",
                "act_if_explicitly_authorized",
                "replicate_same_or_narrower",
                "persist",
                "recover_after_live_root_revalidation",
                "discover_again",
            ],
            "same_trust_root": {
                "discovery": self.binding.root_id,
                "authorization": self.binding.root_id,
                "execution": self.binding.root_id,
                "persistence": self.binding.root_id,
                "propagation": self.binding.root_id,
            },
            "discover_again": True,
            "authority_minted_by_loop": False,
            "security_self_approval": False,
            "network_policy_self_edit": False,
            "revocation_overridden": False,
            "updated_at_utc": current.isoformat(),
            "previous_cycle_present": bool(previous),
        }
        self._persist(report=report, queue=queue)
        return report

    def _persist(
        self,
        *,
        report: Mapping[str, Any],
        queue: Sequence[Mapping[str, Any]],
    ) -> None:
        trimmed = [dict(x) for x in queue][-MAX_QUEUE_ITEMS:]
        self._persist_queue(trimmed)
        state = {
            "schema": WORLD_STATE_SCHEMA,
            "root_id": self.binding.root_id,
            "root_fingerprint": self.binding.fingerprint,
            "authorization_reference": self.binding.standing_authorization_reference,
            "report": dict(report),
        }
        _write_json(self.state_path, state)
        checkpoint = {
            "schema": CHECKPOINT_SCHEMA,
            "root_id": self.binding.root_id,
            "root_fingerprint": self.binding.fingerprint,
            "authorization_reference": self.binding.standing_authorization_reference,
            "authority_snapshot_is_not_restorable": True,
            "queue": trimmed,
            "last_report": dict(report),
        }
        _write_json(self.checkpoint_path, checkpoint)


def _load_discoveries(path: str | Path | None) -> list[dict[str, Any]]:
    if path is None:
        return []
    payload = _read_json(Path(path), {})
    if isinstance(payload, list):
        return [dict(x) for x in payload if isinstance(x, Mapping)]
    if not isinstance(payload, Mapping):
        return []
    for key in ("candidates", "records", "discoveries"):
        raw = payload.get(key)
        if isinstance(raw, list):
            return [dict(x) for x in raw if isinstance(x, Mapping)]
    return []


def _load_emergency_state(path: str | Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    payload = _read_json(Path(path), {})
    return dict(payload) if isinstance(payload, Mapping) else {}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run The world trust-root production loop")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--binding-file", default="senju/config/world-trust-root-bindings.json")
    parser.add_argument("--root-id", required=True)
    parser.add_argument("--discovery-file")
    parser.add_argument("--emergency-state-file")
    parser.add_argument("--desired-replicas", type=int, default=3)
    parser.add_argument("--current-replicas", type=int, default=0)
    parser.add_argument("--active-agents", type=int, default=0)
    parser.add_argument("--active-limit", type=int, default=50)
    parser.add_argument("--desired-revision", default="current")
    parser.add_argument("--health-status", default="healthy")
    parser.add_argument("--report")
    args = parser.parse_args(argv)

    root = Path(args.repo_root).resolve()
    binding_path = root / args.binding_file
    binding = resolve_trust_root_binding(path=binding_path, root_id=args.root_id)
    if binding is None:
        raise SystemExit("world trust-root binding is unavailable or revoked")

    loop = WorldTrustRootLoop(
        repo_root=root,
        state_dir=Path(args.state_dir),
        binding=binding,
        actor="META",
        emergency_state=_load_emergency_state(args.emergency_state_file),
    )
    report = loop.run_cycle(
        discoveries=_load_discoveries(args.discovery_file),
        desired_replicas=args.desired_replicas,
        current_replicas=args.current_replicas,
        active_agents=args.active_agents,
        active_limit=args.active_limit,
        desired_revision=args.desired_revision,
        health_status=args.health_status,
    )
    if args.report:
        _write_json(Path(args.report), report)
    print(
        "SENJU_WORLD_TRUST_ROOT_LOOP "
        f"root={report['root_id']} "
        f"live={str(bool(report.get('authorization', {}).get('standing_live', report.get('live_authority', False)))).lower()} "
        f"discover_again={str(bool(report.get('discover_again', False))).lower()}"
    )
    return 0 if report.get("stage") != "paused" else 2


if __name__ == "__main__":
    raise SystemExit(main())
