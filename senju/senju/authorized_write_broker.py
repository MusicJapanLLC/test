"""Credentialed POST/PUT/PATCH broker for explicitly owner-authorized test hosts.

This is a reusable Senju capability rather than a new Authority source.  It derives the
write ceiling from AUTHORIZED_TEST_TARGETS.json, accepts exact-host write requests, and
executes them with the existing guarded ExternalContactClient.

Credential values are never stored in repository/state/artifacts.  Grant metadata may
name one of the runtime environment slots exported by the workflow; the value is resolved
only in memory immediately before the request.

Hard boundaries:
- exact HTTPS host must have owner_authorization=explicit;
- requested method must already be listed on that target;
- POST/PUT/PATCH only (DELETE deliberately excluded from this broker);
- no external-link authority inheritance;
- no private-network/non-public DNS access (enforced again by ExternalContactClient);
- no redirects for credentialed writes;
- request body is bounded JSON and intended only for synthetic/disposable test data;
- each request_id is consumed once and recorded by secret-free receipt metadata.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from .credential_runtime import RuntimeGrant
from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy, _normalize_host

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH"})
WRITE_QUEUE_SCHEMA = "senju-owner-authorized-write-requests/v1"
WRITE_LEASE_SCHEMA = "senju-owner-authorized-write-leases/v1"
WRITE_RECEIPT_SCHEMA = "senju-owner-authorized-write-receipts/v1"
MAX_REQUESTS_PER_CYCLE = 8
MAX_REQUEST_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PROCESSED_IDS = 2048
ALLOWED_CREDENTIAL_HEADERS = frozenset({"authorization", "x-api-key"})
ALLOWED_SECRET_ENV_SLOTS = frozenset({"SENJU_WRITE_TOKEN_1", "SENJU_WRITE_TOKEN_2", "SENJU_WRITE_TOKEN_3"})


class AuthorizedWriteBrokerError(RuntimeError):
    """Raised when a write request exceeds the explicit owner-authorized ceiling."""


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _owner_authorized_write_targets(repo_root: Path) -> dict[str, dict[str, Any]]:
    doc = _load(repo_root / "AUTHORIZED_TEST_TARGETS.json", {})
    rows = doc.get("targets", ()) if isinstance(doc, Mapping) else ()
    targets: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        if str(raw.get("owner_authorization") or "").strip().lower() != "explicit":
            continue
        if str(raw.get("scheme") or "https").strip().lower() != "https":
            continue
        try:
            host = _normalize_host(str(raw.get("host") or ""))
        except ExternalContactError:
            continue
        methods = frozenset(
            str(value).strip().upper()
            for value in raw.get("allowed_interactions", ())
            if str(value).strip().upper() in WRITE_METHODS
        )
        if not methods:
            continue
        try:
            rate_limit_rps = max(1, min(int(raw.get("rate_limit_rps", 1) or 1), 10))
        except (TypeError, ValueError):
            rate_limit_rps = 1
        targets[host] = {
            "host": host,
            "target_id": str(raw.get("id") or host),
            "allowed_methods": methods,
            "rate_limit_rps": rate_limit_rps,
            "path_scope": str(raw.get("path_scope") or "/**"),
            "synthetic_data_only": True,
        }
    return targets


@dataclass(frozen=True)
class WriteCredentialGrant:
    grant_id: str
    provider: str
    env_var: str
    allowed_scopes: frozenset[str]
    host: str
    allowed_methods: frozenset[str]
    header: str = "Authorization"
    prefix: str = "Bearer "
    max_ttl_seconds: int = 300

    @classmethod
    def from_mapping(
        cls,
        value: Mapping[str, Any],
        *,
        authorized_targets: Mapping[str, Mapping[str, Any]],
    ) -> "WriteCredentialGrant":
        base = RuntimeGrant.from_mapping({
            "grant_id": value.get("grant_id"),
            "provider": value.get("provider"),
            "env_var": value.get("env_var"),
            "allowed_scopes": value.get("allowed_scopes", ()),
            "required_authority_scope": value.get("required_authority_scope", "service_bearer"),
            "max_ttl_seconds": value.get("max_ttl_seconds", 300),
        })
        if base.env_var not in ALLOWED_SECRET_ENV_SLOTS:
            raise AuthorizedWriteBrokerError(
                f"credential env_var must use a dedicated Senju write slot: {base.env_var}"
            )
        try:
            host = _normalize_host(str(value.get("host") or ""))
        except ExternalContactError as exc:
            raise AuthorizedWriteBrokerError("credential grant host is invalid") from exc
        target = authorized_targets.get(host)
        if target is None:
            raise AuthorizedWriteBrokerError("credential grant host is not an explicit owner-authorized write target")
        methods = frozenset(
            str(v).strip().upper()
            for v in value.get("allowed_methods", ())
            if str(v).strip().upper() in WRITE_METHODS
        )
        methods &= frozenset(target.get("allowed_methods", ()))
        if not methods:
            raise AuthorizedWriteBrokerError("credential grant has no owner-authorized write methods")
        header = str(value.get("header") or "Authorization").strip()
        if header.lower() not in ALLOWED_CREDENTIAL_HEADERS:
            raise AuthorizedWriteBrokerError("credential header must be Authorization or X-API-Key")
        prefix = str(value.get("prefix") if value.get("prefix") is not None else "Bearer ")
        if "\r" in prefix or "\n" in prefix or len(prefix) > 32:
            raise AuthorizedWriteBrokerError("credential prefix is invalid")
        return cls(
            grant_id=base.grant_id,
            provider=base.provider,
            env_var=base.env_var,
            allowed_scopes=base.allowed_scopes,
            host=host,
            allowed_methods=methods,
            header=header,
            prefix=prefix,
            max_ttl_seconds=min(base.max_ttl_seconds, 900),
        )


def _credential_grants(
    authorized_targets: Mapping[str, Mapping[str, Any]],
    environ: Mapping[str, str],
) -> dict[str, WriteCredentialGrant]:
    raw = str(environ.get("SENJU_WRITE_CREDENTIAL_GRANTS_JSON", "") or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AuthorizedWriteBrokerError("SENJU_WRITE_CREDENTIAL_GRANTS_JSON is invalid JSON") from exc
    if not isinstance(parsed, list):
        raise AuthorizedWriteBrokerError("SENJU_WRITE_CREDENTIAL_GRANTS_JSON must be a list")
    out: dict[str, WriteCredentialGrant] = {}
    for item in parsed:
        if not isinstance(item, Mapping):
            raise AuthorizedWriteBrokerError("each write credential grant must be an object")
        grant = WriteCredentialGrant.from_mapping(item, authorized_targets=authorized_targets)
        out[grant.grant_id] = grant
    return out


def _safe_relative_path(raw: object) -> str:
    value = str(raw or "/").strip()
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
        raise AuthorizedWriteBrokerError("write path must be an absolute path on the authorized host")
    if any(part == ".." for part in parsed.path.split("/")):
        raise AuthorizedWriteBrokerError("write path traversal is not allowed")
    if parsed.fragment:
        raise AuthorizedWriteBrokerError("fragments are not sent in write requests")
    return urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))


def _request_body(raw: Mapping[str, Any]) -> bytes:
    if "json_body" not in raw:
        raise AuthorizedWriteBrokerError("write request requires json_body")
    body = json.dumps(raw.get("json_body"), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_REQUEST_BYTES:
        raise AuthorizedWriteBrokerError("write request body exceeds 64 KiB")
    return body


def _request_fingerprint(request_id: str, host: str, method: str, path: str, body: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(request_id.encode("utf-8"))
    digest.update(b"\0")
    digest.update(host.encode("utf-8"))
    digest.update(b"\0")
    digest.update(method.encode("ascii"))
    digest.update(b"\0")
    digest.update(path.encode("utf-8"))
    digest.update(b"\0")
    digest.update(body)
    return digest.hexdigest()


def _make_client(host: str, method: str) -> ExternalContactClient:
    return ExternalContactClient(
        ExternalContactPolicy(
            allow_hosts=frozenset({host}),
            allow_http=False,
            allowed_methods=frozenset({method}),
            allow_delete=False,
            follow_redirects=False,
            max_redirects=0,
            timeout_seconds=10.0,
            max_request_bytes=MAX_REQUEST_BYTES,
            max_response_bytes=MAX_RESPONSE_BYTES,
            retries=1,
            retry_backoff_seconds=0.25,
        )
    )


def execute_authorized_write_queue(
    repo_root: str | Path,
    state_dir: str | Path,
    *,
    max_requests: int = MAX_REQUESTS_PER_CYCLE,
    now: int | None = None,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Consume bounded write requests and emit secret-free leases/receipts.

    Queue file: ``senju/state/reviewed_write_requests.json``

    Example request object::

        {
          "request_id": "synthetic-profile-update-001",
          "host": "kabeya-authorized-test-range.onrender.com",
          "method": "PATCH",
          "path": "/api/test/profile/1",
          "json_body": {"synthetic": true, "nickname": "senju"},
          "credential_grant_id": "kabeya-test-bearer",
          "required_scopes": ["synthetic:write"]
        }

    ``credential_grant_id`` is optional.  When present, the matching metadata grant must
    be supplied through SENJU_WRITE_CREDENTIAL_GRANTS_JSON and the actual secret through
    one of SENJU_WRITE_TOKEN_1..3.  Raw secret material is never persisted.
    """
    repo = Path(repo_root)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    env = dict(os.environ if environ is None else environ)
    targets = _owner_authorized_write_targets(repo)
    grants = _credential_grants(targets, env)

    queue_path = state / "reviewed_write_requests.json"
    queue_doc = _load(queue_path, {"schema": WRITE_QUEUE_SCHEMA, "requests": []})
    rows = queue_doc.get("requests", ()) if isinstance(queue_doc, Mapping) else ()
    requests = [dict(row) for row in rows if isinstance(row, Mapping)]

    prior = _load(state / "reviewed_write_execution_receipts.json", {})
    prior_receipts = [dict(row) for row in prior.get("receipts", ()) if isinstance(row, Mapping)] if isinstance(prior, Mapping) else []
    prior_ids = [str(v) for v in prior.get("processed_request_ids", ()) if str(v)] if isinstance(prior, Mapping) else []
    processed_ids = set(prior_ids)

    leases: list[dict[str, Any]] = []
    cycle_receipts: list[dict[str, Any]] = []
    limit = max(0, min(int(max_requests), MAX_REQUESTS_PER_CYCLE))

    for raw in requests:
        if len(cycle_receipts) >= limit:
            break
        request_id = str(raw.get("request_id") or "").strip()
        if not request_id or len(request_id) > 160:
            cycle_receipts.append({"request_id": request_id or None, "status": "rejected", "reason": "invalid_request_id"})
            continue
        if request_id in processed_ids:
            continue

        lease: dict[str, Any] | None = None
        try:
            host = _normalize_host(str(raw.get("host") or ""))
            target = targets.get(host)
            if target is None:
                raise AuthorizedWriteBrokerError("host is not an explicit owner-authorized write target")
            method = str(raw.get("method") or "").strip().upper()
            if method not in WRITE_METHODS or method not in target["allowed_methods"]:
                raise AuthorizedWriteBrokerError("method is outside the target's explicit write authorization")
            path = _safe_relative_path(raw.get("path"))
            body = _request_body(raw)
            required_scopes = frozenset(str(v).strip() for v in raw.get("required_scopes", ()) if str(v).strip())

            headers: dict[str, str] = {
                "Content-Type": "application/json",
                "Accept": "application/json, */*;q=0.1",
                "X-Senju-Synthetic-Test": "1",
                "X-Senju-Request-Id": request_id,
            }
            credential_grant_id = str(raw.get("credential_grant_id") or "").strip()
            credential_scope = "none"
            credential_provider = None
            credential_env = None
            if credential_grant_id:
                grant = grants.get(credential_grant_id)
                if grant is None:
                    raise AuthorizedWriteBrokerError("requested credential grant is not pre-provisioned")
                if grant.host != host or method not in grant.allowed_methods:
                    raise AuthorizedWriteBrokerError("credential grant does not cover this exact host/method")
                if required_scopes and not required_scopes.issubset(grant.allowed_scopes):
                    raise AuthorizedWriteBrokerError("requested credential scopes exceed the pre-provisioned grant")
                secret = str(env.get(grant.env_var, "") or "")
                if not secret:
                    raise AuthorizedWriteBrokerError("credential secret slot is not provisioned in this runtime")
                headers[grant.header] = f"{grant.prefix}{secret}"
                credential_scope = "preprovisioned_runtime"
                credential_provider = grant.provider
                credential_env = grant.env_var

            expires_at = current + 300
            fingerprint = _request_fingerprint(request_id, host, method, path, body)
            lease_id = f"owner-write:{fingerprint[:20]}"
            lease = {
                "schema": WRITE_LEASE_SCHEMA,
                "lease_id": lease_id,
                "request_id": request_id,
                "issued_at": current,
                "expires_at": expires_at,
                "host": host,
                "target_id": target["target_id"],
                "method": method,
                "path": path,
                "credential_scope": credential_scope,
                "credential_provider": credential_provider,
                "credential_ref": f"env://{credential_env}" if credential_env else None,
                "request_sha256": hashlib.sha256(body).hexdigest(),
                "exact_host_only": True,
                "owner_authorization": "explicit",
                "synthetic_data_only": True,
                "allow_http": False,
                "allow_delete": False,
                "follow_redirects": False,
                "private_network": False,
            }
            leases.append(lease)

            url = f"https://{host}{path}"
            result = _make_client(host, method).contact_with_body(
                url,
                method=method,
                body=body,
                headers=headers,
            )
            receipt = result.receipt.to_dict()
            cycle_receipts.append({
                "request_id": request_id,
                "lease_id": lease_id,
                "executed_at": current,
                "status": "contacted",
                "host": host,
                "method": method,
                "path": path,
                "credential_scope": credential_scope,
                "credential_provider": credential_provider,
                "provider_acknowledged": bool(result.receipt.provider_acknowledged),
                "http_status": result.receipt.status,
                "response_bytes": len(result.body),
                "response_sha256": hashlib.sha256(result.body).hexdigest(),
                "transport_receipt": receipt,
            })
        except (AuthorizedWriteBrokerError, ExternalContactError) as exc:
            cycle_receipts.append({
                "request_id": request_id,
                "lease_id": lease.get("lease_id") if lease else None,
                "executed_at": current,
                "status": "rejected_or_transport_error",
                "reason": str(exc)[:500],
            })
        except Exception as exc:  # provider/network errors are recorded, never used to widen authority
            cycle_receipts.append({
                "request_id": request_id,
                "lease_id": lease.get("lease_id") if lease else None,
                "executed_at": current,
                "status": "provider_error",
                "reason": type(exc).__name__,
            })
        processed_ids.add(request_id)

    ordered_processed = (prior_ids + [str(row.get("request_id")) for row in cycle_receipts if row.get("request_id")])[-MAX_PROCESSED_IDS:]
    deduped_processed = list(dict.fromkeys(ordered_processed))[-MAX_PROCESSED_IDS:]
    merged_receipts = (prior_receipts + cycle_receipts)[-512:]

    lease_doc = {
        "schema": WRITE_LEASE_SCHEMA,
        "generated_at": current,
        "lease_count": len(leases),
        "leases": leases,
        "credential_values_persisted": False,
        "authority_source": "AUTHORIZED_TEST_TARGETS.json explicit owner authorization",
    }
    receipt_doc = {
        "schema": WRITE_RECEIPT_SCHEMA,
        "generated_at": current,
        "cycle_receipt_count": len(cycle_receipts),
        "receipt_count": len(merged_receipts),
        "processed_request_ids": deduped_processed,
        "receipts": merged_receipts,
        "hard_limits": [
            "explicit_owner_authorized_exact_host_only",
            "POST_PUT_PATCH_only",
            "credential_values_runtime_memory_only",
            "dedicated_SENJU_WRITE_TOKEN_slots_only",
            "HTTPS_only",
            "redirects_disabled",
            "private_network_blocked_by_transport",
            "DELETE_disabled",
            "synthetic_disposable_test_data_only",
        ],
    }
    _write(state / "reviewed_write_operational_leases.json", lease_doc)
    _write(state / "reviewed_write_execution_receipts.json", receipt_doc)

    return {
        "schema": "senju-owner-authorized-write-broker/v1",
        "generated_at": current,
        "enabled": True,
        "authorized_write_host_count": len(targets),
        "credential_grant_count": len(grants),
        "queued_request_count": len(requests),
        "cycle_attempt_count": len(cycle_receipts),
        "contacted_count": sum(1 for row in cycle_receipts if row.get("status") == "contacted"),
        "credentialed_attempt_count": sum(1 for row in cycle_receipts if row.get("credential_scope") == "preprovisioned_runtime"),
        "leases": leases,
        "receipts": cycle_receipts,
        "queue_file": str(queue_path),
        "lease_file": str(state / "reviewed_write_operational_leases.json"),
        "receipt_file": str(state / "reviewed_write_execution_receipts.json"),
    }
