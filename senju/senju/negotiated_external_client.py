"""ExternalContactClient adapter backed by negotiated Owner scope plus bounded trials.

Policy selection belongs to owner_scope_negotiation / Council. ExternalContactClient is
used here as a transport enforcer, not as the policy authority.

A selected Owner-verified trial may temporarily add one exact public host and a requested
subset of HEAD/POST/PUT/PATCH to the transport policy. These trial grants never alter the
Owner Authority ceiling, never enable private networks, and never make redirect targets
trusted by inheritance. Existing ExternalContactClient checks still apply to every hop.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Mapping

from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy, _normalize_host
from .owner_scope_negotiation import derive_current_ceiling

EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT = 20
ACTIVE_TRIAL_METHODS = frozenset({"HEAD", "POST", "PUT", "PATCH"})


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


class NegotiatedExternalContactClient:
    def __init__(
        self,
        repo_root: str | Path,
        state_dir: str | Path,
        **client_kwargs: Any,
    ) -> None:
        ceiling = derive_current_ceiling(repo_root, state_dir)
        raw_per_host = ceiling.get("per_host_methods")
        global_methods = frozenset(str(v).upper() for v in ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS")))
        per_host: dict[str, frozenset[str]] = {}
        if isinstance(raw_per_host, dict):
            for raw_host, values in raw_per_host.items():
                per_host[_normalize_host(str(raw_host))] = frozenset(str(v).upper() for v in values)
        for raw_host in ceiling.get("exact_hosts", ()):
            per_host.setdefault(_normalize_host(str(raw_host)), global_methods)

        active_trials = _load_active_trial_grants(state_dir)
        if active_trials:
            global_method_set = set(global_methods)
            for host, grant in active_trials.items():
                methods = frozenset(grant["allowed_methods"])
                per_host[host] = frozenset(set(per_host.get(host, frozenset())) | set(methods))
                global_method_set.update(methods)
            global_methods = frozenset(global_method_set)

        policy = ExternalContactPolicy(
            allow_hosts=frozenset(per_host),
            allow_http=bool(ceiling.get("allow_http", False)),
            allowed_methods=global_methods,
            allow_delete=bool(ceiling.get("allow_delete", False)),
            follow_redirects=bool(ceiling.get("follow_redirects", True)),
            max_redirects=int(ceiling.get("max_redirects", 5)),
            timeout_seconds=float(ceiling.get("timeout_seconds", 20.0)),
            max_response_bytes=int(ceiling.get("max_response_bytes", 10 * 1024 * 1024)),
            retries=int(ceiling.get("retries", 5)),
        )
        self.ceiling = ceiling
        self.per_host_methods = per_host
        self.active_trial_grants = active_trials
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
            "policy_selection_source": "owner_scope_negotiation_or_verified_trial_capability",
            "policy_responsibility_reduction_pct": self.policy_responsibility_reduction_pct,
            "execution_validation_retained": True,
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
