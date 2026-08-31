"""Execute discovery-derived external actions from a live execution contract.

The discovery capability lease is the operational authority object. Upstream issuance
already binds a normalized exact target, an authorization reference, a capability
profile, a TTL, and an optional credential scope. This executor therefore does not
re-read the canonical target registry immediately before transport.

Execution requires only:

- an active exact-target discovery capability lease;
- an explicit owner action profile for that exact lease target;
- a POST/PUT/PATCH action declared by that profile for a capability on the lease.

Credentialed execution can be combined with write/mutation when the same lease also
contains ``credentialed_action`` and a non-``none`` credential scope. Secret material is
never discovered here: a caller may provide a credential-header resolver that binds an
already provisioned credential to the exact execution contract. The resolver is not
allowed to change the host, method, path, body, or capability.

Boundary denials stop execution. Transport/service failures may use the HTTP client's
bounded retry under the same host/method/authority only. This module never explores an
alternate host, path, credential, or authority after a failure.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Mapping

from .discovery_authorization import _load_json
from .discovery_capability_leases import DiscoveryCapabilityLease, load_discovery_capability_leases

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.external import ExternalContactClient, ExternalContactError, ExternalContactPolicy  # noqa: E402

ACTION_RECEIPT_SCHEMA = "meta-discovery-external-actions/v2"
DENIAL_EVENT_SCHEMA = "meta-discovery-external-action-denial/v2"
EXECUTION_CONTRACT_SCHEMA = "meta-discovery-external-action-contract/v1"
SUPPORTED_ACTION_CAPABILITIES = ("write", "mutation", "credentialed_action")
SUPPORTED_METHODS = frozenset({"POST", "PUT", "PATCH"})
MAX_ACTIONS_PER_CYCLE = 12
MAX_BODY_BYTES = 16 * 1024

CredentialHeadersResolver = Callable[
    [DiscoveryCapabilityLease, Mapping[str, Any]],
    Mapping[str, str],
]


class DiscoveryExternalActionError(RuntimeError):
    """Raised when a discovery-derived external action is not authorized by its contract."""


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_ndjson(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(payload), ensure_ascii=False, sort_keys=True) + "\n")


def _profile(state: Path, host: str) -> dict[str, Any] | None:
    """Return the explicit exact-host action profile bound to the lease target."""
    policy = _load_json(state / "discovery_policy.json", {})
    profiles = policy.get("action_profiles", {}) if isinstance(policy, dict) else {}
    raw = profiles.get(host) if isinstance(profiles, dict) else None
    if not isinstance(raw, dict) or raw.get("owner_authorization") != "explicit":
        return None
    return raw


def _action_rows(profile: Mapping[str, Any], capability: str) -> tuple[dict[str, Any], ...]:
    external = profile.get("external_actions", {})
    rows = external.get(capability, []) if isinstance(external, Mapping) else []
    if not isinstance(rows, list):
        return ()
    out: list[dict[str, Any]] = []
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        method = str(raw.get("method", "")).strip().upper()
        path = str(raw.get("path", "")).strip()
        action_id = str(raw.get("id", "")).strip()
        if method not in SUPPORTED_METHODS or not path.startswith("/") or not action_id:
            continue
        body = raw.get("body")
        if body is not None and not isinstance(body, str):
            continue
        if body is not None and len(body.encode("utf-8")) > MAX_BODY_BYTES:
            continue
        out.append(
            {
                "id": action_id,
                "method": method,
                "path": path,
                "content_type": str(raw.get("content_type", "application/json")),
                "body": body,
                "requires_credential": bool(
                    raw.get("requires_credential", capability == "credentialed_action")
                ),
            }
        )
    return tuple(out)


def _contract(lease: DiscoveryCapabilityLease, capability: str, action: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "schema": EXECUTION_CONTRACT_SCHEMA,
        "lease_id": lease.lease_id,
        "target": lease.target,
        "capability": capability,
        "action_id": str(action["id"]),
        "method": str(action["method"]),
        "path": str(action["path"]),
        "authorization_reference": lease.authorization_reference,
        "authorization_basis": lease.authorization_basis,
        "credential_scope": lease.credential_scope,
        "capability_authorization_profile": lease.capability_authorization_profile,
        "expires_at": lease.expires_at,
    }


def _classify_failure(exc: Exception) -> str:
    text = str(exc).lower()
    boundary_markers = (
        "not explicitly allowlisted",
        "non-public address blocked",
        "method is not allowed",
        "credentials in url",
        "outside",
        "unauthorized",
        "forbidden",
    )
    if any(marker in text for marker in boundary_markers):
        return "boundary_denial"
    transient_markers = ("dns", "timeout", "timed out", "connection", "temporar", "reset", "unavailable")
    if any(marker in text for marker in transient_markers):
        return "transient_transport_failure"
    return "external_action_failure"


def _denial_row(
    lease: DiscoveryCapabilityLease,
    capability: str,
    action: Mapping[str, Any],
    *,
    reason: str,
) -> dict[str, Any]:
    return {
        "schema": DENIAL_EVENT_SCHEMA,
        "ts": int(time.time()),
        "target": lease.target,
        "capability": capability,
        "action_id": action["id"],
        "method": action["method"],
        "classification": "boundary_denial",
        "reason": reason,
        "decision": "stop_same_contract",
        "authorization_reference": lease.authorization_reference,
        "credential_scope": lease.credential_scope,
        "contract": _contract(lease, capability, action),
    }


def run_discovery_external_actions(
    state_dir: str | Path,
    *,
    repo_root: str | Path,
    max_actions: int = MAX_ACTIONS_PER_CYCLE,
    credential_headers_resolver: CredentialHeadersResolver | None = None,
) -> dict[str, Any]:
    """Execute declared POST/PUT/PATCH actions from active discovery capability leases.

    ``repo_root`` is retained for call-site compatibility; authorization is represented
    by the live lease rather than independently re-derived from repository files here.
    A credential resolver, when supplied, may only return HTTP headers. It cannot alter
    the execution contract.
    """
    del repo_root
    state = Path(state_dir)
    limit = max(1, min(int(max_actions), MAX_ACTIONS_PER_CYCLE))
    leases = load_discovery_capability_leases(state)
    receipts: list[dict[str, Any]] = []
    attempted = 0
    succeeded = 0
    failed = 0
    denied = 0

    for lease in leases:
        if attempted >= limit:
            break
        if not lease.is_active():
            continue
        profile = _profile(state, lease.target)
        if profile is None:
            continue

        for capability in SUPPORTED_ACTION_CAPABILITIES:
            if attempted >= limit:
                break
            if capability not in lease.capabilities:
                continue
            for action in _action_rows(profile, capability):
                if attempted >= limit:
                    break

                requires_credential = bool(action["requires_credential"])
                if requires_credential:
                    if "credentialed_action" not in lease.capabilities or lease.credential_scope == "none":
                        denied += 1
                        row = _denial_row(
                            lease,
                            capability,
                            action,
                            reason="credential_not_present_on_live_execution_contract",
                        )
                        receipts.append(row)
                        _append_ndjson(state / "external_action_denials.ndjson", row)
                        continue
                    if credential_headers_resolver is None:
                        denied += 1
                        row = _denial_row(
                            lease,
                            capability,
                            action,
                            reason="credential_binding_adapter_unavailable",
                        )
                        receipts.append(row)
                        _append_ndjson(state / "external_action_denials.ndjson", row)
                        continue

                url = urllib.parse.urlunsplit(("https", lease.target, action["path"], "", ""))
                body = action["body"].encode("utf-8") if action["body"] is not None else None
                headers: dict[str, str] = {"X-Senju-Test": "discovery-authority-execution-contract"}
                if body is not None:
                    headers["Content-Type"] = action["content_type"]
                if requires_credential:
                    try:
                        resolved = credential_headers_resolver(lease, action)
                        for key, value in resolved.items():
                            name = str(key).strip()
                            header_value = str(value)
                            if not name or "\n" in name or "\r" in name or "\n" in header_value or "\r" in header_value:
                                raise DiscoveryExternalActionError("invalid credential header material")
                            headers[name] = header_value
                    except Exception as exc:
                        denied += 1
                        row = _denial_row(
                            lease,
                            capability,
                            action,
                            reason=f"credential_binding_failed:{type(exc).__name__}",
                        )
                        receipts.append(row)
                        _append_ndjson(state / "external_action_denials.ndjson", row)
                        continue

                method = action["method"]
                policy = ExternalContactPolicy.from_hosts(
                    [lease.target],
                    allow_http=False,
                    allow_delete=False,
                    follow_redirects=False,
                    timeout_seconds=8.0,
                    max_response_bytes=256 * 1024,
                    retries=1,
                )
                attempted += 1
                started = time.monotonic()
                try:
                    result = ExternalContactClient(policy).contact_with_body(
                        url,
                        method=method,
                        body=body,
                        headers=headers,
                    )
                except (ExternalContactError, OSError, TimeoutError) as exc:
                    failed += 1
                    classification = _classify_failure(exc)
                    row = {
                        "schema": ACTION_RECEIPT_SCHEMA,
                        "ts": int(time.time()),
                        "target": lease.target,
                        "url": url,
                        "capability": capability,
                        "action_id": action["id"],
                        "method": method,
                        "status": "failed",
                        "classification": classification,
                        "decision": (
                            "stop_same_contract"
                            if classification == "boundary_denial"
                            else "bounded_retry_same_contract"
                        ),
                        "error": str(exc)[:300],
                        "elapsed_ms": round((time.monotonic() - started) * 1000, 2),
                        "authorization_reference": lease.authorization_reference,
                        "credential_scope": lease.credential_scope,
                        "credential_bound": requires_credential,
                        "contract": _contract(lease, capability, action),
                    }
                    receipts.append(row)
                    _append_ndjson(state / "external_action_denials.ndjson", row)
                    continue

                succeeded += 1
                receipts.append(
                    {
                        "schema": ACTION_RECEIPT_SCHEMA,
                        "ts": int(time.time()),
                        "target": lease.target,
                        "url": url,
                        "capability": capability,
                        "action_id": action["id"],
                        "method": method,
                        "status": "success",
                        "http_status": int(result.receipt.status),
                        "final_url": result.receipt.final_url,
                        "response_bytes": len(result.body),
                        "response_sha256": result.receipt.response_sha256,
                        "elapsed_ms": round((time.monotonic() - started) * 1000, 2),
                        "authorization_reference": lease.authorization_reference,
                        "credential_scope": lease.credential_scope,
                        "credential_bound": requires_credential,
                        "contract": _contract(lease, capability, action),
                    }
                )

    payload = {
        "schema": ACTION_RECEIPT_SCHEMA,
        "generated_at": int(time.time()),
        "execution_contract": "active_lease_plus_exact_host_action_profile",
        "canonical_registry_recheck": False,
        "alternate_host_path_or_credential_exploration": False,
        "attempted": attempted,
        "succeeded": succeeded,
        "failed": failed,
        "denied_before_execution": denied,
        "receipts": receipts,
    }
    _write_json(state / "discovery_external_action_receipts.json", payload)
    return payload
