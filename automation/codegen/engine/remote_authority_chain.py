"""Production remote-declaration authority chain for META/X discovery.

Remote systems may contribute authority *evidence* through federation membership,
`.well-known` manifests, remote policy/declaration documents, and linked registries.
Those declarations participate in the production authorization loop and preserve
A -> B -> C lineage/provenance.

A remote declaration is not, by itself, a new Internet-wide trust root. A declared
host is auto-promoted only when it is already covered by an explicit production
basis (trusted owner root, active standing exact-host authorization, or an exact
owner-supplied host). This lets remote systems accelerate authorization inside an
existing owner boundary without letting a compromised host mint unrelated scope.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from .discovery_authorization import (
    DEFAULT_TTL_SECONDS,
    _authorization_basis,
    _default_repo_root,
    _load_json,
    _normalize_host,
    _now,
    _owner_supplied_exact_hosts,
    _standing_authorized_exact_hosts,
    _trusted_roots,
)

REMOTE_SOURCE_KINDS = frozenset({
    "federation_member",
    "well_known_manifest",
    ".well-known",
    "remote_policy",
    "remote_declaration",
    "linked_registry",
})
DECLARED_HOST_KEYS = (
    "authorized_hosts",
    "members",
    "federation_members",
    "linked_hosts",
    "hosts",
)


def _iter_hosts(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        raw = value.strip()
        if raw.startswith("https://"):
            from urllib.parse import urlsplit

            parsed = urlsplit(raw)
            if parsed.hostname:
                yield parsed.hostname
        elif raw:
            yield raw
        return
    if isinstance(value, Mapping):
        for key in ("host", "hostname", "domain"):
            raw = value.get(key)
            if isinstance(raw, str) and raw.strip():
                yield raw
        url = value.get("url")
        if isinstance(url, str) and url.strip().startswith("https://"):
            from urllib.parse import urlsplit

            parsed = urlsplit(url)
            if parsed.hostname:
                yield parsed.hostname
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            yield from _iter_hosts(item)


def _declared_hosts(raw: Mapping[str, Any]) -> tuple[str, ...]:
    values: set[str] = set()
    for key in DECLARED_HOST_KEYS:
        if key not in raw:
            continue
        for candidate in _iter_hosts(raw.get(key)):
            try:
                values.add(_normalize_host(candidate))
            except (ValueError, UnicodeError):
                continue
    return tuple(sorted(values))


def _load_declarations(state: Path) -> list[dict[str, Any]]:
    payload = _load_json(state / "remote_authority_declarations.json", {})
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("declarations", [])
    else:
        rows = []
    return [dict(row) for row in rows if isinstance(row, Mapping)]


def _existing_promoted_hosts(state: Path, *, now: int) -> set[str]:
    payload = _load_json(state / "discovery_authorized.json", {})
    hosts: set[str] = set()
    if not isinstance(payload, Mapping):
        return hosts
    raw_hosts = payload.get("hosts", {})
    if not isinstance(raw_hosts, Mapping):
        return hosts
    for raw_host, grant in raw_hosts.items():
        if not isinstance(grant, Mapping):
            continue
        if int(grant.get("expires_at", 0) or 0) <= now:
            continue
        if str(grant.get("credential_scope", "none")).strip().lower() != "none":
            continue
        try:
            hosts.add(_normalize_host(str(raw_host)))
        except (ValueError, UnicodeError):
            continue
    return hosts


def run_remote_authority_chain(
    state_dir: str | Path,
    *,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    repo_root: str | Path | None = None,
) -> dict[str, Any]:
    """Process remote declarations and merge eligible hosts into live discovery authority.

    The function is intentionally fixed-point: once B is safely promoted from A, B's
    own declaration may be considered in the same cycle, allowing A -> B -> C -> ...
    lineage without a fixed chain-depth limit. Cycles terminate because each host is
    promoted at most once per run.
    """
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    repository = Path(repo_root) if repo_root is not None else _default_repo_root()
    now = _now()
    ttl = max(300, min(int(ttl_seconds), 24 * 60 * 60))

    roots = _trusted_roots(state)
    standing_exact = _standing_authorized_exact_hosts(repository)
    owner_supplied_exact = _owner_supplied_exact_hosts(state)
    declarations = _load_declarations(state)

    promoted_hosts = _existing_promoted_hosts(state, now=now)
    source_hosts: set[str] = set(promoted_hosts)
    source_hosts.update(roots)
    source_hosts.update(standing_exact)
    source_hosts.update(owner_supplied_exact)

    lineage_by_host: dict[str, tuple[str, ...]] = {host: (host,) for host in source_hosts}
    promoted: dict[str, dict[str, Any]] = {}
    candidates: list[dict[str, Any]] = []
    pending = list(enumerate(declarations))
    processed: set[int] = set()

    changed = True
    while changed:
        changed = False
        for index, raw in pending:
            if index in processed:
                continue
            source_kind = str(raw.get("source_kind") or "remote_declaration").strip().lower()
            if source_kind not in REMOTE_SOURCE_KINDS:
                processed.add(index)
                candidates.append({
                    "decision": "ignored",
                    "reason": "unsupported_remote_source_kind",
                    "source_kind": source_kind,
                })
                continue
            try:
                source_host = _normalize_host(str(raw.get("source_host") or raw.get("host") or ""))
            except (ValueError, UnicodeError):
                processed.add(index)
                candidates.append({
                    "decision": "ignored",
                    "reason": "invalid_source_host",
                    "source_kind": source_kind,
                })
                continue

            source_basis = _authorization_basis(
                source_host,
                trusted_roots=roots,
                standing_exact_hosts=standing_exact,
                owner_supplied_exact_hosts=owner_supplied_exact,
            )
            if source_host not in source_hosts and source_basis is None:
                continue

            processed.add(index)
            parent_lineage = lineage_by_host.get(source_host, (source_host,))
            declared = _declared_hosts(raw)
            evidence_url = str(raw.get("evidence_url") or "").strip() or None
            federation_id = str(raw.get("federation_id") or "").strip() or None

            for child_host in declared:
                child_lineage = (*parent_lineage, child_host)
                basis = _authorization_basis(
                    child_host,
                    trusted_roots=roots,
                    standing_exact_hosts=standing_exact,
                    owner_supplied_exact_hosts=owner_supplied_exact,
                )
                row = {
                    "source_host": source_host,
                    "declared_host": child_host,
                    "source_kind": source_kind,
                    "evidence_url": evidence_url,
                    "federation_id": federation_id,
                    "lineage": list(child_lineage),
                    "depth": len(child_lineage) - 1,
                }
                if basis is None:
                    row.update({
                        "decision": "authority_candidate",
                        "reason": "remote_declaration_has_no_independent_owner_basis",
                    })
                    candidates.append(row)
                    continue

                basis_kind, basis_value = basis
                row.update({
                    "decision": "probationary_authorized",
                    "authorization_basis": f"remote_declaration+{basis_kind}",
                    "authorization_reference": basis_value,
                })
                candidates.append(row)
                if child_host not in source_hosts:
                    source_hosts.add(child_host)
                    lineage_by_host[child_host] = child_lineage
                    changed = True
                promoted[child_host] = {
                    "host": child_host,
                    "authorized_at": now,
                    "expires_at": now + ttl,
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "allow_http": False,
                    "allow_delete": False,
                    "effect": "read_only",
                    "source": "remote_authority_chain",
                    "declared_by": source_host,
                    "remote_source_kind": source_kind,
                    "evidence_url": evidence_url,
                    "federation_id": federation_id,
                    "authorization_basis": f"remote_declaration+{basis_kind}",
                    "authorization_reference": basis_value,
                    "lineage": list(child_lineage),
                    "depth": len(child_lineage) - 1,
                }

    for index, raw in pending:
        if index in processed:
            continue
        candidates.append({
            "decision": "authority_candidate",
            "reason": "source_host_not_authorized",
            "source_kind": str(raw.get("source_kind") or "remote_declaration"),
            "source_host": str(raw.get("source_host") or raw.get("host") or ""),
        })

    authorized_path = state / "discovery_authorized.json"
    authorized_doc = _load_json(authorized_path, {})
    if not isinstance(authorized_doc, dict):
        authorized_doc = {}
    authorized_doc.setdefault("schema", "meta-discovery-authorized/v2")
    authorized_doc["generated_at"] = now
    authorized_doc["mode"] = "probationary_read_only"
    hosts_doc = authorized_doc.setdefault("hosts", {})
    if not isinstance(hosts_doc, dict):
        hosts_doc = {}
        authorized_doc["hosts"] = hosts_doc
    for host, grant in promoted.items():
        hosts_doc[host] = grant
    authorized_path.write_text(json.dumps(authorized_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    chain_doc = {
        "schema": "meta-remote-authority-chain/v1",
        "environment": "production",
        "generated_at": now,
        "remote_sources": sorted(REMOTE_SOURCE_KINDS),
        "fixed_chain_depth_limit": None,
        "remote_declaration_alone_creates_new_trust_root": False,
        "auto_promote_when_independently_authorized": True,
        "promoted_hosts": sorted(promoted),
        "promoted": dict(sorted(promoted.items())),
        "observations": candidates,
    }
    (state / "remote_authority_chain.json").write_text(
        json.dumps(chain_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "environment": "production",
        "declaration_count": len(declarations),
        "promoted_count": len(promoted),
        "promoted_hosts": sorted(promoted),
        "candidate_count": sum(1 for row in candidates if row.get("decision") == "authority_candidate"),
        "fixed_chain_depth_limit": None,
    }
