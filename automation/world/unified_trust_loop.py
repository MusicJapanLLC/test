"""Unified production trust loop for THE WORLD.

This module is orchestration glue. It does not replace the existing discovery,
authority, credential broker, replication, deployment, persistence, or recovery
implementations. Instead, callers pass those already-existing primitives as callbacks
and this loop proves that all of their receipts stay under one immutable Trust Root.

Closed loop:

    SELF_TUNE -> DISCOVER -> AUTHORIZE -> ACT -> AUTO_RENEW
      -> REPLICATE -> DEPLOY -> PERSIST -> RECOVER -> DISCOVER_AGAIN

Control-plane changes can participate in the same lineage, but automatic application is
restricted to monotonic security tightening/revocation. Authority expansion, new
credential grants, new deployment targets, broader network policy, or a new Trust Root
must come from outside this loop.
"""
from __future__ import annotations

import copy
import dataclasses
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping, Sequence


class UnifiedTrustLoopError(RuntimeError):
    """Raised when a phase attempts to escape the configured Trust Root."""


Receipt = Mapping[str, Any]


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _dedupe(values: Iterable[str], *, limit: int) -> tuple[str, ...]:
    out: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if value and value not in out:
            out.append(value)
        if len(out) >= limit:
            break
    return tuple(out)


def _contains_raw_secret(value: Any, path: tuple[str, ...] = ()) -> bool:
    secret_keys = {
        "secret",
        "password",
        "passwd",
        "token",
        "access_token",
        "refresh_token",
        "api_key",
        "apikey",
        "credential_value",
        "private_key",
    }
    if isinstance(value, Mapping):
        for key, child in value.items():
            name = str(key).strip().lower()
            if name in secret_keys and child not in (None, "", "<opaque>", "redacted", "***"):
                return True
            if _contains_raw_secret(child, path + (name,)):
                return True
    elif isinstance(value, (list, tuple, set, frozenset)):
        return any(_contains_raw_secret(item, path) for item in value)
    return False


def _require_mapping(name: str, value: Any) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise UnifiedTrustLoopError(f"{name} must return a mapping")
    result = copy.deepcopy(dict(value))
    if _contains_raw_secret(result):
        raise UnifiedTrustLoopError(f"{name} receipt contains raw secret material")
    return result


def _require_root(name: str, receipt: Mapping[str, Any], trust_root_id: str) -> None:
    if str(receipt.get("trust_root_id") or "").strip() != trust_root_id:
        raise UnifiedTrustLoopError(f"{name} receipt is not bound to the configured Trust Root")


def _require_same_or_narrower(name: str, receipt: Mapping[str, Any]) -> None:
    relation = str(receipt.get("authority_relation") or "same").strip().lower()
    if relation not in {"same", "narrower"}:
        raise UnifiedTrustLoopError(f"{name} attempted authority widening")


@dataclass(frozen=True)
class UnifiedTrustEnvelope:
    trust_root_id: str
    allowed_authority_profiles: frozenset[str]
    allowed_write_targets: frozenset[str]
    allowed_write_methods: frozenset[str]
    allowed_credential_grants: frozenset[str]
    allowed_deploy_targets: frozenset[str]
    max_queue_items: int = 256
    max_replication_per_run: int = 8
    max_generation: int = 32

    @classmethod
    def create(
        cls,
        *,
        trust_root_id: str,
        allowed_authority_profiles: Iterable[str],
        allowed_write_targets: Iterable[str] = (),
        allowed_write_methods: Iterable[str] = ("POST", "PUT", "PATCH"),
        allowed_credential_grants: Iterable[str] = (),
        allowed_deploy_targets: Iterable[str] = (),
        max_queue_items: int = 256,
        max_replication_per_run: int = 8,
        max_generation: int = 32,
    ) -> "UnifiedTrustEnvelope":
        root = str(trust_root_id).strip()
        if not root:
            raise UnifiedTrustLoopError("trust_root_id is required")
        profiles = frozenset(str(x).strip() for x in allowed_authority_profiles if str(x).strip())
        if not profiles:
            raise UnifiedTrustLoopError("at least one authority profile must be pre-authorized")
        methods = frozenset(str(x).strip().upper() for x in allowed_write_methods if str(x).strip())
        if not methods.issubset({"POST", "PUT", "PATCH"}):
            raise UnifiedTrustLoopError("automatic credentialed writes are limited to POST/PUT/PATCH")
        return cls(
            trust_root_id=root,
            allowed_authority_profiles=profiles,
            allowed_write_targets=frozenset(str(x).strip().lower() for x in allowed_write_targets if str(x).strip()),
            allowed_write_methods=methods,
            allowed_credential_grants=frozenset(str(x).strip() for x in allowed_credential_grants if str(x).strip()),
            allowed_deploy_targets=frozenset(str(x).strip() for x in allowed_deploy_targets if str(x).strip()),
            max_queue_items=max(1, min(int(max_queue_items), 4096)),
            max_replication_per_run=max(0, min(int(max_replication_per_run), 64)),
            max_generation=max(0, min(int(max_generation), 256)),
        )


@dataclass(frozen=True)
class UnifiedTrustState:
    generation: int
    authority_profile: str
    persistent_queue: tuple[str, ...] = ()
    checkpoint_id: str | None = None
    previous_run_id: str | None = None


@dataclass(frozen=True)
class UnifiedTrustResult:
    run_id: str
    generation: int
    authority_profile: str
    persistent_queue: tuple[str, ...]
    checkpoint_id: str
    discovered_again: tuple[str, ...]
    phase_receipts: Mapping[str, Any]


class UnifiedTrustLoop:
    """Execute the full closed loop while preserving one immutable Trust Root."""

    def __init__(self, envelope: UnifiedTrustEnvelope) -> None:
        self.envelope = envelope

    def run(
        self,
        state: UnifiedTrustState,
        *,
        self_tune_fn: Callable[[UnifiedTrustState], Receipt],
        discover_fn: Callable[[UnifiedTrustState, Mapping[str, Any]], Receipt],
        authorize_fn: Callable[[Sequence[str], Mapping[str, Any]], Receipt],
        act_fn: Callable[[Mapping[str, Any]], Receipt],
        replicate_fn: Callable[[Mapping[str, Any], int], Receipt],
        persist_fn: Callable[[Mapping[str, Any]], Receipt],
        recover_fn: Callable[[Mapping[str, Any]], Receipt],
        rediscover_fn: Callable[[Mapping[str, Any]], Receipt],
        renew_fn: Callable[[Mapping[str, Any]], Receipt] | None = None,
        deploy_fn: Callable[[Sequence[str], Mapping[str, Any]], Receipt] | None = None,
        network_policy_fn: Callable[[Mapping[str, Any]], Receipt] | None = None,
        security_policy_fn: Callable[[Mapping[str, Any]], Receipt] | None = None,
    ) -> UnifiedTrustResult:
        env = self.envelope
        if state.authority_profile not in env.allowed_authority_profiles:
            raise UnifiedTrustLoopError("current authority profile is outside the Trust Root envelope")
        if state.generation < 0 or state.generation > env.max_generation:
            raise UnifiedTrustLoopError("generation is outside configured bounds")

        run_id = _stable_hash({
            "trust_root_id": env.trust_root_id,
            "generation": state.generation,
            "authority_profile": state.authority_profile,
            "queue": state.persistent_queue,
            "checkpoint_id": state.checkpoint_id,
            "previous_run_id": state.previous_run_id,
        })[:28]
        receipts: dict[str, Any] = {}

        tune = _require_mapping("self_tune_fn", self_tune_fn(state))
        _require_root("self_tuning", tune, env.trust_root_id)
        if tune.get("verified") is not True:
            raise UnifiedTrustLoopError("self tuning must be verified before continuation")
        requested_profile = str(tune.get("requested_authority_profile") or state.authority_profile).strip()
        if requested_profile not in env.allowed_authority_profiles:
            raise UnifiedTrustLoopError("self tuning requested authority outside the Trust Root envelope")
        receipts["self_tuning"] = tune

        discovery = _require_mapping("discover_fn", discover_fn(state, tune))
        _require_root("discovery", discovery, env.trust_root_id)
        candidates = _dedupe(discovery.get("candidates", ()), limit=env.max_queue_items)
        queue = _dedupe((*state.persistent_queue, *candidates), limit=env.max_queue_items)
        receipts["discovery"] = {**discovery, "queue_size_after_discovery": len(queue)}

        authorization = _require_mapping("authorize_fn", authorize_fn(queue, tune))
        _require_root("authorization", authorization, env.trust_root_id)
        _require_same_or_narrower("authorization", authorization)
        if authorization.get("approved") is not True:
            raise UnifiedTrustLoopError("authorization phase did not approve an operation")
        profile = str(authorization.get("authority_profile") or requested_profile).strip()
        if profile not in env.allowed_authority_profiles:
            raise UnifiedTrustLoopError("authorization returned a profile outside the Trust Root envelope")
        if bool(authorization.get("minted_new_trust_root", False)):
            raise UnifiedTrustLoopError("the loop cannot mint a new Trust Root")
        receipts["authorization"] = authorization

        action = _require_mapping("act_fn", act_fn(authorization))
        _require_root("action", action, env.trust_root_id)
        _require_same_or_narrower("action", action)
        if action.get("executed") is not True:
            raise UnifiedTrustLoopError("action phase did not execute")
        target = str(action.get("target") or "").strip().lower()
        method = str(action.get("method") or "").strip().upper()
        credential_grant = str(action.get("credential_grant_id") or "").strip()
        credentialed = bool(action.get("credentialed", False))
        if credentialed:
            if target not in env.allowed_write_targets:
                raise UnifiedTrustLoopError("credentialed external write target is not pre-authorized")
            if method not in env.allowed_write_methods:
                raise UnifiedTrustLoopError("credentialed external write method is not pre-authorized")
            if credential_grant not in env.allowed_credential_grants:
                raise UnifiedTrustLoopError("credential grant is not pre-authorized")
            if action.get("credential_ref_is_opaque") is not True:
                raise UnifiedTrustLoopError("credentialed action must use an opaque credential reference")
        receipts["action"] = action

        current_authority = authorization
        if renew_fn is not None and bool(authorization.get("renewable", False)):
            renewal = _require_mapping("renew_fn", renew_fn(authorization))
            _require_root("auto_renew", renewal, env.trust_root_id)
            _require_same_or_narrower("auto_renew", renewal)
            if renewal.get("renewed") is not True:
                raise UnifiedTrustLoopError("auto-renew did not produce an active lease")
            renewed_profile = str(renewal.get("authority_profile") or profile).strip()
            if renewed_profile not in env.allowed_authority_profiles:
                raise UnifiedTrustLoopError("auto-renew returned an unauthorized profile")
            if bool(renewal.get("resurrected_revoked_authority", False)):
                raise UnifiedTrustLoopError("auto-renew cannot resurrect revoked authority")
            current_authority = renewal
            profile = renewed_profile
            receipts["auto_renew"] = renewal

        requested_replicas = max(0, int(tune.get("requested_replicas", 0)))
        replica_budget = min(requested_replicas, env.max_replication_per_run)
        if state.generation >= env.max_generation:
            replica_budget = 0
        replication = _require_mapping("replicate_fn", replicate_fn(current_authority, replica_budget))
        _require_root("replication", replication, env.trust_root_id)
        _require_same_or_narrower("replication", replication)
        children = replication.get("children", ())
        if not isinstance(children, (list, tuple)):
            raise UnifiedTrustLoopError("replication children must be a list/tuple")
        if len(children) > replica_budget:
            raise UnifiedTrustLoopError("replication exceeded assigned budget")
        for child in children:
            if not isinstance(child, Mapping):
                raise UnifiedTrustLoopError("replica receipt must be a mapping")
            _require_root("replica", child, env.trust_root_id)
            _require_same_or_narrower("replica", child)
            child_generation = int(child.get("generation", state.generation + 1))
            if child_generation > env.max_generation:
                raise UnifiedTrustLoopError("replica generation exceeded configured maximum")
        receipts["replication"] = {**replication, "budget": replica_budget}

        if deploy_fn is not None:
            requested_targets = _dedupe(tune.get("deploy_targets", ()), limit=max(1, len(env.allowed_deploy_targets) or 1))
            outside = [target for target in requested_targets if target not in env.allowed_deploy_targets]
            if outside:
                raise UnifiedTrustLoopError(f"deployment target outside Trust Root envelope: {outside[0]}")
            deployment = _require_mapping("deploy_fn", deploy_fn(requested_targets, current_authority))
            _require_root("deployment", deployment, env.trust_root_id)
            _require_same_or_narrower("deployment", deployment)
            if bool(deployment.get("minted_deployment_authority", False)):
                raise UnifiedTrustLoopError("deployment phase cannot mint deployment authority")
            receipts["deployment"] = deployment

        if network_policy_fn is not None:
            network = _require_mapping("network_policy_fn", network_policy_fn(current_authority))
            _require_root("network_policy", network, env.trust_root_id)
            change_class = str(network.get("change_class") or "no_change").strip().lower()
            if change_class not in {"no_change", "tightening", "revocation"}:
                raise UnifiedTrustLoopError("network policy self-edit may only tighten or revoke")
            if bool(network.get("auto_applied", False)) and change_class == "no_change":
                raise UnifiedTrustLoopError("no-change network policy cannot claim an applied mutation")
            receipts["network_policy"] = network

        if security_policy_fn is not None:
            security = _require_mapping("security_policy_fn", security_policy_fn(current_authority))
            _require_root("security_policy", security, env.trust_root_id)
            change_class = str(security.get("change_class") or "no_change").strip().lower()
            if change_class not in {"no_change", "tightening", "revocation"}:
                raise UnifiedTrustLoopError("security self-approval may only tighten or revoke")
            if bool(security.get("self_approved", False)) and change_class not in {"tightening", "revocation"}:
                raise UnifiedTrustLoopError("security self-approval is invalid for non-tightening changes")
            receipts["security_policy"] = security

        checkpoint_payload = {
            "schema": "the-world-unified-trust-loop/v1",
            "run_id": run_id,
            "trust_root_id": env.trust_root_id,
            "generation": state.generation + 1,
            "authority_profile": profile,
            "persistent_queue": queue,
            "previous_checkpoint_id": state.checkpoint_id,
            "phase_receipts": copy.deepcopy(receipts),
        }
        persistence = _require_mapping("persist_fn", persist_fn(checkpoint_payload))
        _require_root("persistence", persistence, env.trust_root_id)
        if persistence.get("persisted") is not True:
            raise UnifiedTrustLoopError("persistent checkpoint was not written")
        checkpoint_id = str(persistence.get("checkpoint_id") or _stable_hash(checkpoint_payload)[:28]).strip()
        if not checkpoint_id:
            raise UnifiedTrustLoopError("persistence phase did not return a checkpoint id")
        receipts["persistence"] = persistence

        recovery_input = {
            "trust_root_id": env.trust_root_id,
            "checkpoint_id": checkpoint_id,
            "authority_profile": profile,
            "persistent_queue": queue,
        }
        recovery = _require_mapping("recover_fn", recover_fn(recovery_input))
        _require_root("recovery", recovery, env.trust_root_id)
        _require_same_or_narrower("recovery", recovery)
        if recovery.get("recovered") is not True:
            raise UnifiedTrustLoopError("recovery phase did not restore the current checkpoint")
        if str(recovery.get("checkpoint_id") or "") != checkpoint_id:
            raise UnifiedTrustLoopError("recovery did not restore the current checkpoint")
        if bool(recovery.get("restored_revoked_authority", False)) or bool(recovery.get("restored_expired_authority", False)):
            raise UnifiedTrustLoopError("recovery cannot restore revoked or expired authority")
        receipts["recovery"] = recovery

        rediscovery = _require_mapping("rediscover_fn", rediscover_fn(recovery))
        _require_root("rediscovery", rediscovery, env.trust_root_id)
        discovered_again = _dedupe(rediscovery.get("candidates", ()), limit=env.max_queue_items)
        final_queue = _dedupe((*queue, *discovered_again), limit=env.max_queue_items)
        receipts["rediscovery"] = {**rediscovery, "queue_size_after_rediscovery": len(final_queue)}

        return UnifiedTrustResult(
            run_id=run_id,
            generation=state.generation + 1,
            authority_profile=profile,
            persistent_queue=final_queue,
            checkpoint_id=checkpoint_id,
            discovered_again=discovered_again,
            phase_receipts=copy.deepcopy(receipts),
        )
