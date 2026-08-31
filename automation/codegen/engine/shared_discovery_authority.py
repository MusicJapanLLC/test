"""Shared META/X/child discovery -> bounded target authorization loop.

The production rule implemented here is deliberately aggressive inside authority the
owner has already established:

    discovery by any AI -> shared knowledge -> interesting target -> automatic
    probationary authorization -> action queue

Discoveries outside an existing owner-controlled root are still shared immediately, but
remain candidates instead of inventing a new unrelated Internet trust root.

Default discovery-derived authority is non-credentialed scan/probe only.  Write,
mutation, and credentialed capabilities may be queued only for an exact host carrying an
explicit action profile in discovery_policy.json.  That keeps capability escalation tied
to an existing owner decision rather than to the discovered URL itself.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Iterable

from .discovery_authorization import (
    DEFAULT_TTL_SECONDS,
    _extract_discoveries,
    _load_json,
    _normalize_host,
    _normalize_url,
    run_discovery_authorization,
)

SHARED_SCHEMA = "meta-shared-discovery-knowledge/v1"
ACTION_QUEUE_SCHEMA = "meta-discovery-action-queue/v1"
DEFAULT_DISCOVERY_CAPABILITIES = ("scan", "probe")
EXPLICIT_ACTION_CAPABILITIES = frozenset(
    {"scan", "probe", "write", "mutation", "credentialed_action"}
)
GENERATED_FILES = frozenset(
    {
        "discovered_urls.json",
        "discovery_candidates.json",
        "discovery_authorized.json",
        "discovery_authorization_requests.json",
        "discovery_authority_apply_queue.json",
        "human_intent_decisions.json",
        "shared_discovery_knowledge.json",
        "discovery_action_queue.json",
    }
)


def _now() -> int:
    return int(time.time())


def _actor_for_path(path: Path) -> str:
    text = "/".join(part.lower() for part in path.parts)
    name = path.name.lower()
    if "child" in text or "children" in text:
        return "CHILD"
    if name.startswith("meta") or "/meta/" in text:
        return "META"
    if name.startswith("x_") or name.startswith("x-") or "/x/" in text:
        return "X"
    if "senju" in text:
        return "SENJU"
    return "AI"


def _is_discovery_source(path: Path) -> bool:
    if not path.is_file() or path.suffix.lower() != ".json":
        return False
    if path.name in GENERATED_FILES:
        return False
    lowered = "/".join(part.lower() for part in path.parts)
    tokens = ("discover", "crawl", "crawler", "external", "intel", "response", "log", "link")
    return any(token in lowered for token in tokens)


def _iter_source_files(state: Path) -> Iterable[Path]:
    for path in sorted(state.rglob("*.json")):
        if _is_discovery_source(path):
            yield path


def _collect_shared_discoveries(state: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    by_url: dict[str, dict[str, Any]] = {}
    for path in _iter_source_files(state):
        payload = _load_json(path, {})
        actor = _actor_for_path(path.relative_to(state))
        for raw in sorted(_extract_discoveries(payload)):
            normalized = _normalize_url(raw)
            if normalized is None:
                continue
            url, host = normalized
            row = by_url.setdefault(
                url,
                {
                    "url": url,
                    "host": host,
                    "interesting": True,
                    "actors": set(),
                    "sources": set(),
                },
            )
            row["actors"].add(actor)
            row["sources"].add(str(path.relative_to(state)))

    rows: list[dict[str, Any]] = []
    for url in sorted(by_url):
        row = by_url[url]
        rows.append(
            {
                "url": row["url"],
                "host": row["host"],
                "interesting": True,
                "actors": sorted(row["actors"]),
                "sources": sorted(row["sources"]),
            }
        )
    return rows, by_url


def _write_discovery_input(state: Path, discoveries: list[dict[str, Any]]) -> None:
    payload = {
        "schema": "meta-shared-discovery-input/v1",
        "generated_at": _now(),
        "discoveries": discoveries,
    }
    (state / "discovered_urls.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _action_profiles(state: Path) -> dict[str, dict[str, Any]]:
    policy = _load_json(state / "discovery_policy.json", {})
    raw = policy.get("action_profiles", {}) if isinstance(policy, dict) else {}
    if not isinstance(raw, dict):
        return {}
    profiles: dict[str, dict[str, Any]] = {}
    for raw_host, value in raw.items():
        if not isinstance(value, dict):
            continue
        try:
            host = _normalize_host(str(raw_host))
        except ValueError:
            continue
        capabilities = {
            str(item).strip().lower()
            for item in value.get("capabilities", [])
            if str(item).strip().lower() in EXPLICIT_ACTION_CAPABILITIES
        }
        credential_scope = str(value.get("credential_scope", "none")).strip() or "none"
        profiles[host] = {
            "capabilities": tuple(sorted(capabilities)),
            "credential_scope": credential_scope,
            "owner_authorization": str(value.get("owner_authorization", "")).strip().lower(),
        }
    return profiles


def _capabilities_for_host(host: str, profiles: dict[str, dict[str, Any]]) -> tuple[tuple[str, ...], str]:
    """Return capabilities for an already discovery-authorized host.

    Every promoted host gets scan/probe.  Higher-impact capability comes only from an
    exact explicit owner profile for the exact discovered host; it is never inferred
    from similarity, links, descendants, or another agent's opinion.
    """
    capabilities = set(DEFAULT_DISCOVERY_CAPABILITIES)
    credential_scope = "none"
    profile = profiles.get(host)
    if not profile or profile.get("owner_authorization") != "explicit":
        return tuple(sorted(capabilities)), credential_scope

    explicit = set(profile.get("capabilities", ()))
    capabilities.update(explicit & EXPLICIT_ACTION_CAPABILITIES)
    if "credentialed_action" in capabilities:
        requested_scope = str(profile.get("credential_scope", "none")).strip()
        if requested_scope == "none":
            capabilities.discard("credentialed_action")
        else:
            credential_scope = requested_scope
    return tuple(sorted(capabilities)), credential_scope


def _action_rows(
    state: Path,
    discoveries: list[dict[str, Any]],
    authorized_doc: dict[str, Any],
) -> list[dict[str, Any]]:
    authorized_hosts = authorized_doc.get("hosts", {}) if isinstance(authorized_doc, dict) else {}
    if not isinstance(authorized_hosts, dict):
        authorized_hosts = {}
    profiles = _action_profiles(state)
    by_host: dict[str, list[dict[str, Any]]] = {}
    for item in discoveries:
        by_host.setdefault(str(item.get("host", "")), []).append(item)

    actions: list[dict[str, Any]] = []
    for host, grant in sorted(authorized_hosts.items()):
        if not isinstance(grant, dict):
            continue
        try:
            normalized_host = _normalize_host(host)
        except ValueError:
            continue
        capabilities, credential_scope = _capabilities_for_host(normalized_host, profiles)
        discoveries_for_host = by_host.get(normalized_host, [])
        target_url = discoveries_for_host[0]["url"] if discoveries_for_host else f"https://{normalized_host}/"
        actions.append(
            {
                "target": normalized_host,
                "url": target_url,
                "interesting": True,
                "authorization_reference": grant.get("authorization_reference"),
                "authorization_basis": grant.get("authorization_basis"),
                "expires_at": grant.get("expires_at"),
                "capabilities": list(capabilities),
                "credential_scope": credential_scope,
                "actors": sorted(
                    {
                        actor
                        for item in discoveries_for_host
                        for actor in item.get("actors", [])
                    }
                ),
                "status": "ready",
                "closed_loop": "discovery->shared->authorized->action_queue",
            }
        )
    return actions


def run_shared_discovery_authority(
    state_dir: str | Path,
    *,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    repo_root: str | Path | None = None,
) -> dict[str, Any]:
    """Aggregate all AI discoveries, promote inherited authority, and queue actions."""
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    discoveries, _ = _collect_shared_discoveries(state)
    _write_discovery_input(state, discoveries)

    discovery_result = run_discovery_authorization(
        state,
        ttl_seconds=ttl_seconds,
        repo_root=repo_root,
    )
    authorized_doc = _load_json(state / "discovery_authorized.json", {})
    candidate_doc = _load_json(state / "discovery_candidates.json", {})
    candidate_rows = candidate_doc.get("candidates", []) if isinstance(candidate_doc, dict) else []

    decision_by_url = {
        str(item.get("url", "")): item
        for item in candidate_rows
        if isinstance(item, dict)
    }
    shared_rows: list[dict[str, Any]] = []
    for discovery in discoveries:
        decision = decision_by_url.get(discovery["url"], {})
        shared_rows.append(
            {
                **discovery,
                "decision": decision.get("decision", "candidate_only"),
                "authorization_basis": decision.get("authorization_basis"),
                "authorization_reference": decision.get("authorization_reference"),
                "authorization_readiness": decision.get("authorization_readiness"),
            }
        )

    shared_doc = {
        "schema": SHARED_SCHEMA,
        "generated_at": _now(),
        "rule": "discovered_by_any_ai_is_shared_immediately; inherited_owner_scope_auto_authorizes",
        "discoveries": shared_rows,
    }
    actions = _action_rows(state, discoveries, authorized_doc)
    action_doc = {
        "schema": ACTION_QUEUE_SCHEMA,
        "generated_at": _now(),
        "mode": "auto_ready_inside_existing_owner_authority",
        "actions": actions,
    }

    (state / "shared_discovery_knowledge.json").write_text(
        json.dumps(shared_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (state / "discovery_action_queue.json").write_text(
        json.dumps(action_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    return {
        "shared_discovery_count": len(discoveries),
        "shared_actor_count": len({actor for row in discoveries for actor in row.get("actors", [])}),
        "authorized_count": int(discovery_result.get("authorized_count", 0)),
        "candidate_count": int(discovery_result.get("candidate_count", 0)),
        "action_ready_count": len(actions),
        "high_impact_ready_count": sum(
            1
            for action in actions
            if set(action.get("capabilities", [])) & {"write", "mutation", "credentialed_action"}
        ),
    }
