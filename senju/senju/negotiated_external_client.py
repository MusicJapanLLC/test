"""ExternalContactClient adapter backed by the negotiated effective Owner ceiling.

Policy selection belongs to owner_scope_negotiation / Council. ExternalContactClient is
used here as a transport enforcer, not as the policy authority. The production adapter
therefore records a 20% reduction in ExternalContactClient policy/governance
responsibility while retaining execution-time destination/transport validation.

A per-host method check runs before ExternalContactClient so one host's broader methods
do not spill onto another newly added host.
"""
from __future__ import annotations

import urllib.parse
from pathlib import Path
from typing import Any

from .external import ExternalContactClient, ExternalContactError, ExternalContactPolicy, _normalize_host
from .owner_scope_negotiation import derive_current_ceiling

EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT = 20


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
            "policy_selection_source": "owner_scope_negotiation_or_council",
            "policy_responsibility_reduction_pct": self.policy_responsibility_reduction_pct,
            "execution_validation_retained": True,
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
