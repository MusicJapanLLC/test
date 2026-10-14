"""ExternalContactClient adapter backed by negotiated authority plus council operations.

Authority selection and operational policy are deliberately separated:
- the current exact-host authority ceiling determines *where/which methods* may exist;
- META/X/SENJU unanimous operational governance may tune production transport behavior
  and narrow/restore methods only inside that already-current host/method authority;
- selected Owner-verified trials may temporarily add their bounded exact-host capability.

ExternalContactClient remains the execution-time transport enforcer. Public-DNS checks,
redirect revalidation, private/non-global rejection, default-port rules, and cross-host
sensitive-header stripping remain in force.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Mapping

from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy, _normalize_host
from .owner_scope_negotiation import derive_current_ceiling

EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT = 60
ACTIVE_TRIAL_METHODS = frozenset({"HEAD", "POST", "PUT", "PATCH"})
COUNCIL_POLICY_SCHEMA = "senju-council-operational-policy/v1"


def _load_active_trial_grants(state_dir: str | Path, *, now: int | None = None) -> dict[str, dict[str, Any]]:
    path = Path(state_dir) / "owner_verified_active_trials.json"
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return {}
    current = int(time.time()) if now is None else int(now)
    rows = doc.get("grants", ()) if isinstance(doc, Mapping) else ()
    grants: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        if raw.get("verified_owner_evidence") is not True:
            continue
        if raw.get("authority_effect") is not False:
            continue
        if raw.get("private_network") is not False:
            continue
        if raw.get("redirect_trust_inheritance") is not False:
            continue
        try:
            expires_at = int(raw.get("expires_at", 0) or 0)
        except (TypeError, ValueError):
            continue
        if expires_at <= current:
            continue
        try:
            host = _normalize_host(str(raw.get("host") or ""))
        except ExternalContactError:
            continue
        methods = frozenset(
            str(value).strip().upper()
            for value in raw.get("allowed_methods", ())
            if str(value).strip().upper() in ACTIVE_TRIAL_METHODS
        )
        if not methods:
            continue
        grants[host] = {
            "host": host,
            "proposal_id": str(raw.get("proposal_id") or ""),
            "proof_type": str(raw.get("proof_type") or ""),
            "proof_ref": str(raw.get("proof_ref") or ""),
            "allowed_methods": methods,
            "credential_scope": "caller_supplied_existing",
            "expires_at": expires_at,
        }
    return grants


def _base_per_host(ceiling: Mapping[str, Any]) -> dict[str, frozenset[str]]:
    global_methods = frozenset(str(v).upper() for v in ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS")))
    out: dict[str, frozenset[str]] = {}
    raw_per_host = ceiling.get("per_host_methods")
    if isinstance(raw_per_host, Mapping):
        for raw_host, values in raw_per_host.items():
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            out[host] = frozenset(str(v).upper() for v in values)
    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _normalize_host(str(raw_host))
        except ExternalContactError:
            continue
        out.setdefault(host, global_methods)
    return out


def _load_council_operational_policy(
    state_dir: str | Path,
    ceiling: Mapping[str, Any],
) -> dict[str, Any]:
    """Load a council policy and revalidate it against the current authority ceiling.

    State files are not trusted to broaden authority merely because they exist. The live
    adapter intersects every per-host method set with the current ceiling and ignores any
    unknown host or authority-bearing field.
    """
    path = Path(state_dir) / "council_operational_policy.json"
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(doc, Mapping) or doc.get("schema") != COUNCIL_POLICY_SCHEMA:
        return {}
    if doc.get("governance_model") != "META_X_SENJU_unanimous_operational_control":
        return {}
    effective = doc.get("effective_policy")
    if not isinstance(effective, Mapping):
        return {}

    current_per_host = _base_per_host(ceiling)
    raw_methods = effective.get("per_host_methods")
    per_host: dict[str, frozenset[str]] = {}
    if isinstance(raw_methods, Mapping):
        for raw_host, values in raw_methods.items():
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            if host not in current_per_host:
                continue
            requested = frozenset(str(v).strip().upper() for v in values)
            narrowed = requested & current_per_host[host]
            if narrowed:
                per_host[host] = narrowed
    for host, methods in current_per_host.items():
        per_host.setdefault(host, methods)

    def bounded_int(name: str, default: int, low: int, high: int) -> int:
        try:
            value = int(effective.get(name, default))
        except (TypeError, ValueError):
            return default
        return max(low, min(value, high))

    def bounded_float(name: str, default: float, low: float, high: float) -> float:
        try:
            value = float(effective.get(name, default))
        except (TypeError, ValueError):
            return default
        return max(low, min(value, high))

    return {
        "per_host_methods": per_host,
        "follow_redirects": bool(effective.get("follow_redirects", ceiling.get("follow_redirects", True))),
        "max_redirects": bounded_int("max_redirects", int(ceiling.get("max_redirects", 5)), 0, 5),
        "retries": bounded_int("retries", int(ceiling.get("retries", 5)), 0, 5),
        "retry_backoff_seconds": bounded_float("retry_backoff_seconds", 0.25, 0.0, 5.0),
        "timeout_seconds": bounded_float("timeout_seconds", float(ceiling.get("timeout_seconds", 20.0)), 0.5, 20.0),
        "max_request_bytes": bounded_int("max_request_bytes", int(ceiling.get("max_request_bytes", 64 * 1024)), 1024, 1024 * 1024),
        "max_response_bytes": bounded_int(
            "max_response_bytes", int(ceiling.get("max_response_bytes", 10 * 1024 * 1024)), 1024, 10 * 1024 * 1024
        ),
    }


class NegotiatedExternalContactClient:
    def __init__(
        self,
        repo_root: str | Path,
        state_dir: str | Path,
        **client_kwargs: Any,
    ) -> None:
        ceiling = derive_current_ceiling(repo_root, state_dir)
        per_host = _base_per_host(ceiling)
        council_policy = _load_council_operational_policy(state_dir, ceiling)
        if council_policy:
            per_host = dict(council_policy["per_host_methods"])

        active_trials = _load_active_trial_grants(state_dir)
        for host, grant in active_trials.items():
            methods = frozenset(grant["allowed_methods"])
            per_host[host] = frozenset(set(per_host.get(host, frozenset())) | set(methods))

        global_methods = frozenset({method for methods in per_host.values() for method in methods})
        if not global_methods:
            global_methods = frozenset({"GET", "HEAD", "OPTIONS"})

        policy = ExternalContactPolicy(
            allow_hosts=frozenset(per_host),
            allow_http=bool(ceiling.get("allow_http", False)),
            allowed_methods=global_methods,
            allow_delete=bool(ceiling.get("allow_delete", False)),
            follow_redirects=(
                bool(council_policy["follow_redirects"])
                if council_policy else bool(ceiling.get("follow_redirects", True))
            ),
            max_redirects=(
                int(council_policy["max_redirects"])
                if council_policy else int(ceiling.get("max_redirects", 5))
            ),
            timeout_seconds=(
                float(council_policy["timeout_seconds"])
                if council_policy else float(ceiling.get("timeout_seconds", 20.0))
            ),
            max_request_bytes=(
                int(council_policy["max_request_bytes"])
                if council_policy else int(ceiling.get("max_request_bytes", 64 * 1024))
            ),
            max_response_bytes=(
                int(council_policy["max_response_bytes"])
                if council_policy else int(ceiling.get("max_response_bytes", 10 * 1024 * 1024))
            ),
            retries=(
                int(council_policy["retries"])
                if council_policy else int(ceiling.get("retries", 5))
            ),
            retry_backoff_seconds=(
                float(council_policy["retry_backoff_seconds"])
                if council_policy else 0.25
            ),
        )
        self.ceiling = ceiling
        self.per_host_methods = per_host
        self.active_trial_grants = active_trials
        self.council_operational_policy = council_policy
        self.client = ExternalContactClient(policy, **client_kwargs)
        self.external_contact_role = "transport_enforcer_only"
        self.policy_authority = False
        self.policy_responsibility_reduction_pct = EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT

    @property
    def policy(self) -> ExternalContactPolicy:
        return self.client.policy

    def role_profile(self) -> dict[str, Any]:
        return {
            "role": self.external_contact_role,
            "policy_authority": self.policy_authority,
            "policy_selection_source": "META_X_SENJU_operational_governance_plus_current_authority",
            "policy_responsibility_reduction_pct": self.policy_responsibility_reduction_pct,
            "execution_validation_retained": True,
            "council_operational_policy_active": bool(self.council_operational_policy),
            "active_trial_grant_count": len(self.active_trial_grants),
            "active_trial_private_network": False,
            "active_trial_redirect_trust_inheritance": False,
            "cross_host_sensitive_header_strip_retained": True,
        }

    def _check(self, url: str, method: str) -> None:
        parsed = urllib.parse.urlsplit(url)
        if not parsed.hostname:
            raise ExternalContactError("URL has no hostname")
        host = _normalize_host(parsed.hostname)
        normalized_method = method.upper().strip()
        allowed = self.per_host_methods.get(host, frozenset())
        if normalized_method not in allowed:
            raise ExternalContactError(
                f"method is not allowed for negotiated host {host}: {normalized_method}"
            )

    def contact(self, url: str, *, method: str = "GET", **kwargs: Any):
        self._check(url, method)
        return self.client.contact(url, method=method, **kwargs)

    def contact_with_body(self, url: str, *, method: str = "GET", **kwargs: Any):
        self._check(url, method)
        return self.client.contact_with_body(url, method=method, **kwargs)
