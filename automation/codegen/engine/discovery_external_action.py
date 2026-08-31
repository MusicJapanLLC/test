"""Execute discovery-derived external actions inside explicit owner test authority.

This module operationalizes write/mutation capability leases for an exact target only
when all of the following are simultaneously true:

- the target has a live discovery capability lease;
- the requested capability is present on that lease;
- the exact host has an explicit owner action profile;
- the action is a fixed synthetic action declared in that profile;
- the canonical AUTHORIZED_TEST_TARGETS.json independently permits the exact host/method.

Discovery can therefore activate pre-delegated external actions, but cannot invent a
payload, credential, host, method, or unrelated authority root. Boundary denials are
recorded and stop execution. Transient transport/service failures may use bounded retry
under the same host/method/authority only.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any, Mapping

from .discovery_authorization import _load_json, _normalize_host
from .discovery_capability_leases import load_discovery_capability_leases

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.external import ExternalContactClient, ExternalContactError, ExternalContactPolicy  # noqa: E402

ACTION_RECEIPT_SCHEMA = "meta-discovery-external-actions/v1"
DENIAL_EVENT_SCHEMA = "meta-discovery-external-action-denial/v1"
SUPPORTED_ACTION_CAPABILITIES = frozenset({"write", "mutation"})
SUPPORTED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
MAX_ACTIONS_PER_CYCLE = 12
MAX_BODY_BYTES = 16 * 1024


class DiscoveryExternalActionError(RuntimeError):
    """Raised when a discovery-derived external action is not explicitly authorized."""


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_ndjson(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(payload), ensure_ascii=False, sort_keys=True) + "\n")


def _canonical_explicit_target(repo_root: Path, host: str) -> dict[str, Any] | None:
    doc = _load_json(repo_root / "AUTHORIZED_TEST_TARGETS.json", {})
    if not isinstance(doc, dict):
        return None
    for raw in doc.get("targets", []):
        if not isinstance(raw, dict) or raw.get("owner_authorization") != "explicit":
            continue
        try:
            candidate = _normalize_host(str(raw.get("host", "")))
        except ValueError:
            continue
        if candidate == host:
            return raw
    return None


def _profile(state: Path, host: str) -> dict[str, Any] | None:
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
            }
        )
    return tuple(out)


def _method_allowed(target: Mapping[str, Any], method: str) -> bool:
    allowed = {str(item).strip().upper() for item in target.get("allowed_interactions", [])}
    return method in allowed


def _classify_failure(exc: Exception) -> str:
    text = str(exc).lower()
    boundary_markers = (
        "not explicitly allowlisted",
        "non-public address blocked",
        "method is not allowed",
        "delete requires explicit",
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


def run_discovery_external_actions(
    state_dir: str | Path,
    *,
    repo_root: str | Path,
    max_actions: int = MAX_ACTIONS_PER_CYCLE,
) -> dict[str, Any]:
    """Execute fixed synthetic write/mutation actions from live discovery leases."""
    state = Path(state_dir)
    root = Path(repo_root)
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
        target = _canonical_explicit_target(root, lease.target)
        profile = _profile(state, lease.target)
        if target is None or profile is None:
            continue

        for capability in ("write", "mutation"):
            if attempted >= limit:
                break
            if capability not in lease.capabilities:
                continue
            for action in _action_rows(profile, capability):
                if attempted >= limit:
                    break
                method = action["method"]
                if not _method_allowed(target, method):
                    denied += 1
                    row = {
                        "schema": DENIAL_EVENT_SCHEMA,
                        "ts": int(time.time()),
                        "target": lease.target,
                        "capability": capability,
                        "action_id": action["id"],
                        "method": method,
                        "classification": "boundary_denial",
                        "decision": "stop_no_alternate_authority_path",
                        "authorization_reference": lease.authorization_reference,
                    }
                    _append_ndjson(state / "external_action_denials.ndjson", row)
                    continue

                url = urllib.parse.urlunsplit(("https", lease.target, action["path"], "", ""))
                body = action["body"].encode("utf-8") if action["body"] is not None else None
                headers = {"X-Senju-Test": "discovery-authority-synthetic-action"}
                if body is not None:
                    headers["Content-Type"] = action["content_type"]
                policy = ExternalContactPolicy.from_hosts(
                    [lease.target],
                    allow_http=False,
                    allow_delete=(method == "DELETE"),
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
                            "stop_no_alternate_authority_path"
                            if classification == "boundary_denial"
                            else "bounded_retry_same_authority"
                        ),
                        "error": str(exc)[:300],
                        "elapsed_ms": round((time.monotonic() - started) * 1000, 2),
                        "authorization_reference": lease.authorization_reference,
                        "credential_scope": lease.credential_scope,
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
                        "synthetic_only": True,
                    }
                )

    payload = {
        "schema": ACTION_RECEIPT_SCHEMA,
        "generated_at": int(time.time()),
        "attempted": attempted,
        "succeeded": succeeded,
        "failed": failed,
        "denied_before_execution": denied,
        "receipts": receipts,
    }
    _write_json(state / "discovery_external_action_receipts.json", payload)
    return payload
