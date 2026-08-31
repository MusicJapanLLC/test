"""Production META discovery authorization with bounded authority inheritance.

META may discover URLs, links, or hostnames during normal operation. Discoveries can
receive real, temporary execution authority when that authority can be inherited from
an already explicit owner-controlled source:

- configured discovery trust roots authorize the root and its subdomains;
- active standing authorizations authorize their exact hosts without another prompt;
- exact links supplied by the owner authorize that exact host for read-only discovery;
- every other discovery is retained and automatically turned into an authorization
  request candidate, with owner-intent inference attached for prioritization.

Discovery by itself never creates a brand-new external trust root. This keeps the
production control plane useful while preventing a page from expanding authority merely
by linking to an unrelated third party.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable

from .human_intent_inference import as_dict, infer_human_intent

URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
HOST_KEYS = {"host", "hostname", "domain", "domain_name", "target_host"}
DEFAULT_TTL_SECONDS = 6 * 60 * 60
TRUSTED_STANDING_ISSUERS = {"owner_explicit", "canonical_repository", "independent_authority"}


def _now() -> int:
    return int(time.time())


def _normalize_host(host: str) -> str:
    value = host.strip().rstrip(".").lower()
    if not value or any(ch in value for ch in "/?#@"):
        raise ValueError("invalid host")
    value = value.encode("idna").decode("ascii")
    if "." not in value:
        raise ValueError("hostname must be fully qualified")
    try:
        ipaddress.ip_address(value)
    except ValueError:
        pass
    else:
        raise ValueError("IP literals are not eligible for discovery promotion")
    return value


def _normalize_url(url: str) -> tuple[str, str] | None:
    try:
        parsed = urllib.parse.urlsplit(url.strip())
        if parsed.scheme.lower() != "https":
            return None
        if parsed.username is not None or parsed.password is not None:
            return None
        if not parsed.hostname:
            return None
        host = _normalize_host(parsed.hostname)
        if parsed.port not in (None, 443):
            return None
        path = parsed.path or "/"
        normalized = urllib.parse.urlunsplit(("https", host, path, parsed.query, ""))
        return normalized, host
    except (ValueError, UnicodeError):
        return None


def _extract_discoveries(value: Any) -> set[str]:
    """Extract explicit URLs plus values carried in hostname/domain fields."""
    found: set[str] = set()
    if isinstance(value, str):
        found.update(URL_RE.findall(value))
    elif isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str) and key.lower() in HOST_KEYS and isinstance(item, str):
                try:
                    host = _normalize_host(item)
                    found.add(f"https://{host}/")
                except ValueError:
                    pass
            found.update(_extract_discoveries(item))
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            found.update(_extract_discoveries(item))
    return found


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _trusted_roots(state_dir: Path) -> set[str]:
    roots: set[str] = set()
    env = os.environ.get("META_DISCOVERY_TRUST_ROOTS", "")
    for item in env.split(","):
        item = item.strip()
        if item:
            try:
                roots.add(_normalize_host(item))
            except ValueError:
                continue

    policy = _load_json(state_dir / "discovery_policy.json", {})
    for item in policy.get("trusted_roots", []) if isinstance(policy, dict) else []:
        try:
            roots.add(_normalize_host(str(item)))
        except ValueError:
            continue
    return roots


def _default_repo_root() -> Path:
    # automation/codegen/engine/discovery_authorization.py -> repository root
    return Path(__file__).resolve().parents[3]


def _standing_authorized_exact_hosts(repo_root: Path) -> set[str]:
    """Load exact public hosts from active, independently issued standing authority."""
    registry = _load_json(repo_root / "senju" / "state" / "standing_authorizations.json", {})
    if not isinstance(registry, dict) or registry.get("schema") != "senju-standing-authorization/v1":
        return set()

    hosts: set[str] = set()
    for raw in registry.get("records", []):
        if not isinstance(raw, dict):
            continue
        if bool(raw.get("revoked", False)):
            continue
        if str(raw.get("issuer_kind", "")).strip().lower() not in TRUSTED_STANDING_ISSUERS:
            continue
        if str(raw.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if bool(raw.get("destructive", False)):
            continue
        methods = {str(x).strip().upper() for x in raw.get("allowed_methods", [])}
        if not methods.intersection({"GET", "HEAD"}):
            continue
        for item in raw.get("exact_hosts", []):
            try:
                hosts.add(_normalize_host(str(item)))
            except ValueError:
                continue
    return hosts


def _owner_supplied_exact_hosts(state_dir: Path) -> set[str]:
    """Treat exact owner-supplied HTTPS links as explicit read-only discovery intent."""
    signals = _load_json(state_dir / "human_intent_signals.json", {})
    if not isinstance(signals, dict):
        return set()

    hosts: set[str] = set()
    for raw in signals.get("supplied_links", []):
        if not isinstance(raw, str):
            continue
        normalized = _normalize_url(raw)
        if normalized is not None:
            _, host = normalized
            hosts.add(host)
    return hosts


def _within_root(host: str, roots: Iterable[str]) -> str | None:
    for root in roots:
        if host == root or host.endswith("." + root):
            return root
    return None


def _same_domain_hint(host: str, authorized_hosts: Iterable[str]) -> str | None:
    """Return a non-authorizing similarity hint for review prioritization only."""
    host_labels = host.split(".")
    if len(host_labels) < 2:
        return None
    suffix = ".".join(host_labels[-2:])
    for authorized in authorized_hosts:
        labels = authorized.split(".")
        if len(labels) >= 2 and ".".join(labels[-2:]) == suffix:
            return authorized
    return None


def _authorization_basis(
    host: str,
    *,
    trusted_roots: set[str],
    standing_exact_hosts: set[str],
    owner_supplied_exact_hosts: set[str],
) -> tuple[str, str] | None:
    root = _within_root(host, trusted_roots)
    if root is not None:
        return "trusted_root", root
    if host in standing_exact_hosts:
        return "standing_authorization_exact_host", host
    if host in owner_supplied_exact_hosts:
        return "owner_supplied_exact_host", host
    return None


def _candidate_record(url: str, host: str, source: str) -> dict[str, Any]:
    return {
        "url": url,
        "host": host,
        "source": source,
        "discovered_at": _now(),
    }


def _intent_doc(state: Path, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    """Infer likely owner intent for every candidate without minting guessed authority."""
    reviewed = _load_json(state / "authority_reviewed_grants.json", {})
    prior_grants = list(reviewed.get("hosts", {}).values()) if isinstance(reviewed, dict) else []
    signals = _load_json(state / "human_intent_signals.json", {})
    if not isinstance(signals, dict):
        signals = {}
    supplied_links = [str(x) for x in signals.get("supplied_links", []) if isinstance(x, str)]
    owner_context = bool(signals.get("owner_context", False))
    similarity = signals.get("similarity_by_host", {})
    if not isinstance(similarity, dict):
        similarity = {}

    decisions: list[dict[str, Any]] = []
    for candidate in candidates:
        host = str(candidate.get("host", ""))
        decision = infer_human_intent(
            {
                "host": host,
                "url": candidate.get("url"),
                "method": candidate.get("method", "GET"),
                "credential_scope": candidate.get("credential_scope", "none"),
            },
            prior_explicit_approvals=prior_grants,
            supplied_links=supplied_links,
            owner_context=owner_context,
            similarity_score=float(similarity.get(host, 0.0)),
        )
        decisions.append({
            "host": host,
            "url": candidate.get("url"),
            "source": candidate.get("source"),
            **as_dict(decision),
        })

    return {
        "schema": "meta-human-intent-inference/v1",
        "generated_at": _now(),
        "policy": {
            "infer_likely_human_approval": True,
            "prior_similar_explicit_approval_is_strong_evidence": True,
            "owner_context_is_strong_evidence": True,
            "owner_supplied_link_is_strong_intent_evidence": True,
            "inference_may_prioritize_without_reprompt": True,
            "inference_may_create_new_authority": False,
            "exact_live_explicit_grant_may_be_reused_without_reprompt": True,
            "active_standing_exact_host_may_be_reused_without_reprompt": True,
            "owner_supplied_exact_host_may_receive_read_only_discovery_authority": True,
        },
        "decisions": decisions,
    }


def run_discovery_authorization(
    state_dir: str | Path,
    *,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    repo_root: str | Path | None = None,
) -> dict[str, Any]:
    """Promote discoveries whose authority is inherited from an explicit source.

    Input convention:
      meta_state/discovered_urls.json may contain URLs, href/link strings, or explicit
      host/hostname/domain fields. external_intel.json is also scanned for URL evidence.

    Output files:
      discovery_candidates.json       - every normalized discovery and decision
      discovery_authorized.json       - live probationary read-only host grants
      discovery_authorization_requests.json - unresolved discoveries queued for review
      human_intent_decisions.json     - likely-owner-intent ranking for all candidates
    """
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    repository = Path(repo_root) if repo_root is not None else _default_repo_root()

    roots = _trusted_roots(state)
    standing_exact = _standing_authorized_exact_hosts(repository)
    owner_supplied_exact = _owner_supplied_exact_hosts(state)
    ttl = max(300, min(int(ttl_seconds), 24 * 60 * 60))
    now = _now()

    sources = {
        "discovered_urls": state / "discovered_urls.json",
        "external_intel": state / "external_intel.json",
    }
    candidates: list[dict[str, Any]] = []
    promoted: dict[str, dict[str, Any]] = {}
    authorized_reference_hosts = roots | standing_exact | owner_supplied_exact

    for source_name, path in sources.items():
        payload = _load_json(path, {})
        for raw in sorted(_extract_discoveries(payload)):
            normalized = _normalize_url(raw)
            if not normalized:
                continue
            url, host = normalized
            record = _candidate_record(url, host, source_name)
            basis = _authorization_basis(
                host,
                trusted_roots=roots,
                standing_exact_hosts=standing_exact,
                owner_supplied_exact_hosts=owner_supplied_exact,
            )
            if basis is None:
                record.update({"decision": "candidate_only", "reason": "outside_authorized_scope"})
                related = _same_domain_hint(host, authorized_reference_hosts)
                if related is not None:
                    record["same_domain_hint"] = related
            else:
                basis_kind, basis_value = basis
                record.update({
                    "decision": "probationary_authorized",
                    "authorization_basis": basis_kind,
                    "authorization_reference": basis_value,
                })
                promoted[host] = {
                    "host": host,
                    "authorization_basis": basis_kind,
                    "authorization_reference": basis_value,
                    "authorized_at": now,
                    "expires_at": now + ttl,
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "allow_http": False,
                    "allow_delete": False,
                    "effect": "read_only",
                    "source": "meta_discovery_authorization",
                }
            candidates.append(record)

    previous = _load_json(state / "discovery_authorized.json", {})
    if isinstance(previous, dict):
        for host, grant in previous.get("hosts", {}).items():
            if not isinstance(grant, dict):
                continue
            if int(grant.get("expires_at", 0)) <= now:
                continue
            try:
                normalized_host = _normalize_host(host)
            except ValueError:
                continue
            basis = _authorization_basis(
                normalized_host,
                trusted_roots=roots,
                standing_exact_hosts=standing_exact,
                owner_supplied_exact_hosts=owner_supplied_exact,
            )
            if basis is None:
                continue
            promoted.setdefault(normalized_host, grant)

    intent_doc = _intent_doc(state, candidates)
    intent_by_key = {
        (str(item.get("host", "")), str(item.get("url", ""))): item
        for item in intent_doc.get("decisions", [])
        if isinstance(item, dict)
    }
    authorization_requests: list[dict[str, Any]] = []
    for record in candidates:
        if record.get("decision") != "candidate_only":
            continue
        intent = intent_by_key.get((str(record.get("host", "")), str(record.get("url", ""))), {})
        likely = bool(intent.get("likely_owner_intent", False))
        record["authorization_readiness"] = "owner_review_ready" if likely else "review_required"
        record["likely_owner_intent"] = likely
        authorization_requests.append({
            "host": record.get("host"),
            "url": record.get("url"),
            "source": record.get("source"),
            "same_domain_hint": record.get("same_domain_hint"),
            "likely_owner_intent": likely,
            "authorization_readiness": record["authorization_readiness"],
            "requested_effect": "read_only",
            "requested_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "created_at": now,
        })

    candidate_doc = {
        "schema": "meta-discovery-candidates/v2",
        "generated_at": now,
        "trusted_roots": sorted(roots),
        "standing_authorized_exact_hosts": sorted(standing_exact),
        "owner_supplied_exact_hosts": sorted(owner_supplied_exact),
        "candidates": candidates,
    }
    authorized_doc = {
        "schema": "meta-discovery-authorized/v2",
        "generated_at": now,
        "mode": "probationary_read_only",
        "hosts": dict(sorted(promoted.items())),
    }
    request_doc = {
        "schema": "meta-discovery-authorization-requests/v1",
        "generated_at": now,
        "requests": authorization_requests,
    }

    (state / "discovery_candidates.json").write_text(
        json.dumps(candidate_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (state / "discovery_authorized.json").write_text(
        json.dumps(authorized_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (state / "discovery_authorization_requests.json").write_text(
        json.dumps(request_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (state / "human_intent_decisions.json").write_text(
        json.dumps(intent_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    decisions = intent_doc.get("decisions", [])
    return {
        "trusted_roots": sorted(roots),
        "standing_authorized_exact_hosts": sorted(standing_exact),
        "owner_supplied_exact_hosts": sorted(owner_supplied_exact),
        "candidate_count": len(candidates),
        "authorized_hosts": sorted(promoted),
        "authorized_count": len(promoted),
        "authorization_request_count": len(authorization_requests),
        "owner_review_ready_count": sum(
            1 for x in authorization_requests if x.get("authorization_readiness") == "owner_review_ready"
        ),
        "ttl_seconds": ttl,
        "intent_likely_count": sum(1 for x in decisions if x.get("likely_owner_intent")),
        "intent_auto_execute_count": sum(1 for x in decisions if x.get("may_auto_execute")),
    }
