"""Persistent inter-agent handoff bus for the bounded cooperative authority loop.

The bus gives META/X/Senju and other repo agents a shared, machine-readable surface
without creating new hosts or credential sources. A completed cooperative write can
publish one structured handoff comment to the issue created by that same cycle and
persist the same packet in the workflow artifact for later consumers.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Callable, Mapping

from senju.authority_factory import AuthorityProfile, AuthorityRegistry
from senju.external import ExternalContactClient

SCHEMA = "senju-cooperative-ai-coordination-bus/v1"
MESSAGE_SCHEMA = "senju-cooperative-ai-handoff/v1"
RECEIPT_SCHEMA = "senju-cooperative-ai-handoff-comment/v1"
TARGET_HOST = "api.github.com"
TARGET_METHOD = "POST"
DEFAULT_PARTICIPANTS = (
    "META",
    "X",
    "SENJU",
    "CLAUDE",
    "JULES",
    "OPENHANDS",
    "COPILOT",
)
MAX_MESSAGES = 256


class CoordinationBusError(RuntimeError):
    """Fail-closed coordination error."""


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _normalize_repo(value: str) -> str:
    repo = str(value or "").strip()
    if repo.count("/") != 1 or any(ch.isspace() for ch in repo):
        raise CoordinationBusError("repository must be owner/name")
    owner, name = repo.split("/", 1)
    if not owner or not name:
        raise CoordinationBusError("repository must be owner/name")
    return repo


def _policy_allows(policy: Mapping[str, Any], repo: str) -> bool:
    actions = policy.get("actions", {}) if isinstance(policy, Mapping) else {}
    allow = policy.get("allowlists", {}) if isinstance(policy, Mapping) else {}
    if not isinstance(actions, Mapping) or not isinstance(allow, Mapping):
        return False
    repos = {str(x) for x in allow.get("github_repositories", ())}
    target_ids = {str(x) for x in allow.get("external_write_target_ids", ())}
    return (
        actions.get("github_issue_own_repo") == "AUTO_ALLOWLIST"
        and actions.get("github_issue_comment_own_repo") == "AUTO_ALLOWLIST"
        and repo in repos
        and "github-issues" in target_ids
        and "github-issue-comments" in target_ids
    )


def _same_scope(profile: AuthorityProfile) -> bool:
    return (
        profile.allow_hosts == frozenset({TARGET_HOST})
        and profile.allowed_methods == frozenset({TARGET_METHOD})
        and profile.credential_scope == "service_bearer"
        and profile.allow_http is False
        and profile.follow_redirects is False
        and profile.allow_delete is False
        and profile.allow_private_network is False
        and not profile.private_hosts
        and not profile.private_cidrs
    )


def _participants(environ: Mapping[str, str]) -> list[str]:
    raw = str(environ.get("COOPERATIVE_AI_PARTICIPANTS", "")).strip()
    if not raw:
        return list(DEFAULT_PARTICIPANTS)
    rows = []
    for item in raw.split(","):
        name = "".join(ch for ch in item.strip().upper() if ch.isalnum() or ch in {"-", "_"})[:40]
        if name and name not in rows:
            rows.append(name)
    for required in ("META", "X", "SENJU"):
        if required not in rows:
            rows.insert(0, required)
    return rows[:24]


def _message_id(cycle: Mapping[str, Any], issue_number: int, authority_id: str) -> str:
    seed = "|".join(
        [
            str(cycle.get("repo", "")),
            str(cycle.get("cycle", "")),
            str(issue_number),
            str(cycle.get("discovery", {}).get("source_url", "")),
            authority_id,
        ]
    )
    return "handoff-" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:20]


def _build_message(cycle: Mapping[str, Any], participants: list[str]) -> dict[str, Any]:
    write = cycle.get("credentialed_write", {})
    authority = cycle.get("authority", {})
    issue_number = int(write.get("issue_number") or 0)
    authority_id = str(authority.get("active_profile_id") or "")
    if issue_number <= 0 or not authority_id:
        raise CoordinationBusError("completed cycle is missing issue or authority identity")
    message_id = _message_id(cycle, issue_number, authority_id)
    return {
        "schema": MESSAGE_SCHEMA,
        "message_id": message_id,
        "created_at": str(cycle.get("at", "")),
        "sender": "META/X/SENJU",
        "audience": participants,
        "kind": "discovery_authority_handoff",
        "repo": str(cycle.get("repo", "")),
        "issue_number": issue_number,
        "issue_url": write.get("issue_url"),
        "source_url": cycle.get("discovery", {}).get("source_url"),
        "source_title": cycle.get("discovery", {}).get("title"),
        "consensus": "3/3" if cycle.get("consensus", {}).get("unanimous") else "not_unanimous",
        "authority_profile_id": authority_id,
        "authority_generation": authority.get("generation"),
        "authority_capabilities": [
            "github_issue_own_repo:create",
            "github_issue_comment_own_repo:handoff",
            "artifact_coordination_bus:publish",
            "recursive_same_or_narrower_delegation",
        ],
        "authority_constraints": {
            "host": TARGET_HOST,
            "method": TARGET_METHOD,
            "owned_repo_only": True,
            "new_host_minting": False,
            "new_credential_minting": False,
            "private_network": False,
        },
        "reply_protocol": {
            "format": "AI-HANDOFF-ACK <message_id> actor=<name> status=<claimed|done|blocked> note=<text>",
            "shared_surface": "GitHub issue comment + world-external-write-state artifact",
        },
        "status": "OPEN",
        "acks": [],
    }


def _append_message(bus_path: Path, message: Mapping[str, Any]) -> dict[str, Any]:
    raw = _load_json(bus_path, None)
    bus = raw if isinstance(raw, dict) and raw.get("schema") == SCHEMA else {"schema": SCHEMA, "messages": []}
    messages = [row for row in bus.get("messages", []) if isinstance(row, dict)]
    message_id = str(message.get("message_id", ""))
    if not any(str(row.get("message_id", "")) == message_id for row in messages):
        messages.append(dict(message))
    bus["messages"] = messages[-MAX_MESSAGES:]
    _write_json(bus_path, bus)
    return bus


def _comment_body(message: Mapping[str, Any]) -> bytes:
    packet = json.dumps(message, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    body = (
        "## AI cooperative handoff\n\n"
        "META / X / SENJU published a machine-readable handoff for sibling agents.\n\n"
        f"Audience: {', '.join(message.get('audience', []))}\n\n"
        "```json\n"
        f"{packet}\n"
        "```\n\n"
        f"Reply protocol: `{message.get('reply_protocol', {}).get('format', '')}`\n"
    )
    return json.dumps({"body": body}, ensure_ascii=False).encode("utf-8")


def publish_handoff(
    cycle: Mapping[str, Any],
    policy: Mapping[str, Any],
    state_dir: str | Path,
    repo: str,
    *,
    environ: Mapping[str, str] | None = None,
    client_factory: Callable[[Any], Any] = ExternalContactClient,
) -> dict[str, Any]:
    """Persist and publish one structured sibling-agent handoff for a completed cycle."""
    repo = _normalize_repo(repo)
    env = dict(os.environ if environ is None else environ)
    state_root = Path(state_dir)
    state_root.mkdir(parents=True, exist_ok=True)
    out: dict[str, Any] = {
        "schema": RECEIPT_SCHEMA,
        "repo": repo,
        "published": False,
        "bus_saved": False,
        "participants": _participants(env),
    }

    if str(cycle.get("repo", "")) != repo:
        raise CoordinationBusError("cycle repository mismatch")
    write = cycle.get("credentialed_write", {})
    if cycle.get("reason") != "cycle_completed" or not bool(write.get("posted")):
        out["reason"] = "no_completed_write_to_share"
        return out
    if not _policy_allows(policy, repo):
        out["reason"] = "coordination_policy_not_allowlisted"
        return out

    runtime_repo = str(env.get("GITHUB_REPOSITORY", "")).strip()
    token = str(env.get("GITHUB_TOKEN", "")).strip()
    if runtime_repo and runtime_repo != repo:
        raise CoordinationBusError("runtime repository mismatch")
    if not token:
        out["reason"] = "missing_preprovisioned_runtime_credential"
        return out

    issue_number = int(write.get("issue_number") or 0)
    if issue_number <= 0:
        raise CoordinationBusError("completed write has no issue number")

    registry = AuthorityRegistry.load(state_root / "registry" / "delegated_authorities.json")
    authority_id = str(cycle.get("authority", {}).get("active_profile_id") or "")
    authority = registry.get(authority_id)
    if not _same_scope(authority):
        raise CoordinationBusError("authority scope is not valid for the coordination handoff")

    message = _build_message(cycle, out["participants"])
    bus_path = state_root / "coordination_bus.json"
    _append_message(bus_path, message)
    out.update({"bus_saved": True, "bus_path": str(bus_path), "message_id": message["message_id"]})

    scope = authority.to_external_scope()
    client = client_factory(scope.to_policy())
    result = client.contact_with_body(
        f"https://{TARGET_HOST}/repos/{repo}/issues/{issue_number}/comments",
        method=TARGET_METHOD,
        body=_comment_body(message),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    receipt = result.receipt.to_dict()
    status = int(receipt.get("status", 0) or 0)
    try:
        response = json.loads(result.body.decode("utf-8")) if result.body else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        response = {}
    out.update(
        {
            "published": 200 <= status < 300,
            "status": status,
            "comment_url": response.get("html_url") if isinstance(response, Mapping) else None,
            "receipt": receipt,
            "authority_profile_id": authority.profile_id,
            "authority_generation": authority.generation,
            "authority_scope_expanded": False,
            "credential_source": "preprovisioned_runtime_only",
            "secret_persisted": False,
            "reason": "handoff_published" if 200 <= status < 300 else "handoff_comment_failed",
        }
    )
    receipt_path = state_root / "coordination_receipts" / f"{message['message_id']}.json"
    _write_json(receipt_path, {**out, "message": message})
    out["receipt_path"] = str(receipt_path)
    return out
