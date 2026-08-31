"""Transitive trust graph with scope-preserving delegation.

Rule implemented:

    Owner trusts A
    A trusts B
    B trusts C
    therefore Owner trusts C

Trust is transitive only across explicit delegable trust edges. Effective scope can only
stay the same or narrow as the chain grows. Trust resolution never creates network,
credential, secret, deployment, or destructive authority by itself; those remain
separate authorization decisions.
"""
from __future__ import annotations

import dataclasses
import json
from collections import deque
from pathlib import Path
from typing import Iterable, Mapping

TRUST_SCHEMA = "senju-transitive-trust/v1"
MAX_TRUST_DEPTH = 16


class TrustError(RuntimeError):
    """Raised when a trust edge or trust registry is invalid."""


def _principal(value: str) -> str:
    principal = str(value).strip()
    if not principal:
        raise TrustError("trust principal is required")
    return principal


def _scopes(values: Iterable[str]) -> tuple[str, ...]:
    scopes = tuple(sorted({str(value).strip() for value in values if str(value).strip()}))
    if not scopes:
        raise TrustError("at least one trust scope is required")
    return scopes


@dataclasses.dataclass(frozen=True)
class TrustEdge:
    truster: str
    trustee: str
    scopes: tuple[str, ...]
    transitive: bool = True
    revoked: bool = False


@dataclasses.dataclass(frozen=True)
class TrustResolution:
    owner: str
    subject: str
    trusted: bool
    effective_scopes: tuple[str, ...]
    path: tuple[str, ...]
    depth: int


def create_trust_edge(
    *,
    truster: str,
    trustee: str,
    scopes: Iterable[str],
    transitive: bool = True,
) -> TrustEdge:
    source = _principal(truster)
    target = _principal(trustee)
    if source == target:
        raise TrustError("self-trust edges are not allowed")
    return TrustEdge(
        truster=source,
        trustee=target,
        scopes=_scopes(scopes),
        transitive=bool(transitive),
        revoked=False,
    )


def revoke_trust_edge(edge: TrustEdge) -> TrustEdge:
    return dataclasses.replace(edge, revoked=True)


def _intersect_scope(parent: frozenset[str], edge: TrustEdge) -> frozenset[str]:
    edge_scope = frozenset(edge.scopes)
    if "*" in parent and "*" in edge_scope:
        return frozenset({"*"})
    if "*" in parent:
        return edge_scope
    if "*" in edge_scope:
        return parent
    return parent & edge_scope


def resolve_trust(
    *,
    owner: str,
    subject: str,
    edges: Iterable[TrustEdge],
    required_scope: str | None = None,
    max_depth: int = MAX_TRUST_DEPTH,
) -> TrustResolution:
    """Resolve whether trust flows from owner to subject through explicit edges.

    Each hop must be active and transitive. Scope is intersected across the entire
    path, so a downstream trustee can never inherit a broader trust scope than the
    owner granted upstream.
    """
    root = _principal(owner)
    target = _principal(subject)
    if max_depth < 1 or max_depth > MAX_TRUST_DEPTH:
        raise TrustError(f"max_depth must be between 1 and {MAX_TRUST_DEPTH}")

    if root == target:
        return TrustResolution(
            owner=root,
            subject=target,
            trusted=True,
            effective_scopes=("*",),
            path=(root,),
            depth=0,
        )

    graph: dict[str, list[TrustEdge]] = {}
    for edge in edges:
        if edge.revoked:
            continue
        graph.setdefault(edge.truster, []).append(edge)

    # Start with unrestricted root scope; the first explicit edge establishes the
    # actual trust scope. States are keyed by principal + effective scope to support
    # multiple paths without allowing cycles to grant new privilege.
    queue = deque([(root, frozenset({"*"}), (root,), 0)])
    visited: set[tuple[str, frozenset[str]]] = {(root, frozenset({"*"}))}

    while queue:
        principal, inherited_scope, path, depth = queue.popleft()
        if depth >= max_depth:
            continue

        for edge in graph.get(principal, ()):  # only declarations from trusted principals matter
            effective = _intersect_scope(inherited_scope, edge)
            if not effective:
                continue

            next_path = (*path, edge.trustee)
            next_depth = depth + 1
            if edge.trustee == target:
                scope_tuple = tuple(sorted(effective))
                trusted = required_scope is None or "*" in effective or required_scope in effective
                if trusted:
                    return TrustResolution(
                        owner=root,
                        subject=target,
                        trusted=True,
                        effective_scopes=scope_tuple,
                        path=next_path,
                        depth=next_depth,
                    )

            # A non-transitive edge establishes trust in the immediate trustee but
            # deliberately stops delegation beyond that trustee.
            if not edge.transitive:
                continue

            state = (edge.trustee, effective)
            if state in visited:
                continue
            visited.add(state)
            queue.append((edge.trustee, effective, next_path, next_depth))

    return TrustResolution(
        owner=root,
        subject=target,
        trusted=False,
        effective_scopes=(),
        path=(),
        depth=0,
    )


def owner_trusts(
    owner: str,
    subject: str,
    edges: Iterable[TrustEdge],
    *,
    required_scope: str | None = None,
) -> bool:
    return resolve_trust(
        owner=owner,
        subject=subject,
        edges=edges,
        required_scope=required_scope,
    ).trusted


def save_trust_registry(path: str | Path, edges: Iterable[TrustEdge]) -> Path:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": TRUST_SCHEMA,
        "semantics": "explicit_scope_preserving_transitive_trust",
        "trust_is_authority": False,
        "records": [dataclasses.asdict(edge) for edge in edges],
    }
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def load_trust_registry(path: str | Path) -> tuple[TrustEdge, ...]:
    source = Path(path)
    if not source.exists():
        return ()
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TrustError("trust registry is invalid") from exc
    if not isinstance(payload, Mapping) or payload.get("schema") != TRUST_SCHEMA:
        raise TrustError("trust registry schema is invalid")

    records: list[TrustEdge] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            raise TrustError("trust registry record is invalid")
        edge = create_trust_edge(
            truster=str(raw.get("truster", "")),
            trustee=str(raw.get("trustee", "")),
            scopes=raw.get("scopes", []),
            transitive=bool(raw.get("transitive", True)),
        )
        records.append(dataclasses.replace(edge, revoked=bool(raw.get("revoked", False))))
    return tuple(records)
