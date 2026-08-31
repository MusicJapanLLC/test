"""Policy editing workspace for META Self-Tuner.

The Self-Tuner may freely rewrite supported governance/network policy models in
lab, sandbox, and staging workspaces. Production-like environments are
proposal-only: the function returns the requested replacement without mutating
live state.
"""
from __future__ import annotations

import copy
import dataclasses
from typing import Any, Mapping, MutableMapping

EDITABLE_POLICY_DOMAINS = (
    "authority",
    "scopeguard_policy",
    "external_contact_policy",
    "credential_scope",
    "allowed_host",
    "federation_membership",
    "network_permission",
    "merge_requirement",
    "security_audit_requirement",
)

ISOLATED_EDIT_ENVIRONMENTS = frozenset({"lab", "sandbox", "staging"})
PRODUCTION_LIKE_ENVIRONMENTS = frozenset({"production", "prod", "live", "real"})

_ALIASES = {
    "scopeguard": "scopeguard_policy",
    "scopeguard policy": "scopeguard_policy",
    "externalcontact": "external_contact_policy",
    "externalcontact policy": "external_contact_policy",
    "external contact policy": "external_contact_policy",
    "credential scope": "credential_scope",
    "allowed host": "allowed_host",
    "federation membership": "federation_membership",
    "network permission": "network_permission",
    "merge requirement": "merge_requirement",
    "security audit requirement": "security_audit_requirement",
}


@dataclasses.dataclass(frozen=True)
class PolicyEditResult:
    domain: str
    environment: str
    applied: bool
    proposal_only: bool
    previous: dict[str, Any]
    requested: dict[str, Any]
    resulting: dict[str, Any]


def normalize_domain(domain: str) -> str:
    raw = domain.strip().lower().replace("-", "_")
    normalized = _ALIASES.get(raw, raw.replace(" ", "_"))
    if normalized not in EDITABLE_POLICY_DOMAINS:
        raise ValueError(f"unsupported Self-Tuner policy domain: {domain}")
    return normalized


def edit_policy_workspace(
    workspace: MutableMapping[str, Mapping[str, Any]],
    domain: str,
    replacement: Mapping[str, Any],
    *,
    environment: str,
) -> PolicyEditResult:
    """Replace one supported policy model in an isolated workspace.

    All supported domains are fully replaceable in lab/sandbox/staging. For
    production-like environments, the same replacement is represented as a
    proposal only and the supplied workspace is left unchanged.
    """
    normalized = normalize_domain(domain)
    env = environment.strip().lower()
    previous = copy.deepcopy(dict(workspace.get(normalized, {})))
    requested = copy.deepcopy(dict(replacement))

    if env in ISOLATED_EDIT_ENVIRONMENTS:
        workspace[normalized] = copy.deepcopy(requested)
        resulting = copy.deepcopy(dict(workspace[normalized]))
        return PolicyEditResult(
            domain=normalized,
            environment=env,
            applied=True,
            proposal_only=False,
            previous=previous,
            requested=requested,
            resulting=resulting,
        )

    if env in PRODUCTION_LIKE_ENVIRONMENTS:
        return PolicyEditResult(
            domain=normalized,
            environment=env,
            applied=False,
            proposal_only=True,
            previous=previous,
            requested=requested,
            resulting=previous,
        )

    raise PermissionError(
        "Self-Tuner policy edits may execute only in lab/sandbox/staging; "
        "production-like targets are proposal-only"
    )
