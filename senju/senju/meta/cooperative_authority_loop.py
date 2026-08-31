"""Persistent META/X/Senju cooperative authority loop.

This is a production coordinator for a bounded autonomous loop:

    Discovery
      -> META/X/Senju consensus
      -> explicit delegated authority
      -> credentialed write to an owned/allowlisted GitHub repository
      -> recursive attenuation-preserving delegation
      -> persistent state/receipts
      -> state and pre-provisioned credential recovery

The loop is intentionally strong *inside* its approved envelope, but it cannot create
new hosts, new credential sources, private-network access, or methods that are not in
its reviewed root scope. Recursive delegation is monotonic: child <= parent.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, MutableMapping

from senju.authority_factory import (
    AuthorityMintError,
    AuthorityMintRequest,
    AuthorityProfile,
    AuthorityRegistry,
    mint_child,
    root_from_external_scope,
)
from senju.credential_runtime import CredentialRecoveryRuntime
from senju.external import ExternalAuthorityScope, ExternalContactClient

SCHEMA = "senju-meta-x-cooperative-authority-loop/v1"
STATE_SCHEMA = "senju-meta-x-cooperative-authority-loop-state/v1"
WRITE_RECEIPT_SCHEMA = "senju-meta-x-cooperative-authority-write/v1"
TARGET_ID = "github-issues"
TARGET_HOST = "api.github.com"
TARGET_METHOD = "POST"
REQUIRED_VOTERS = ("META", "X", "SENJU")
ISSUER_ROTATION = ("META", "X", "Senju")
MAX_DELEGATION_DEPTH = 48
MAX_WRITES_PER_DAY = 4
ATTEMPT_COOLDOWN_HOURS = 6
MAX_HISTORY = 128
MAX_PROCESSED = 256


class CooperativeLoopError(RuntimeError):
    """Fail-closed loop error."""


@dataclass(frozen=True)
class WriteAttempt:
    status: int
    issue_number: int | None
    issue_url: str | None
    receipt: Mapping[str, Any]


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _now_utc(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _iso(now: dt.datetime) -> str:
    return now.isoformat(timespec="seconds")


def _normalize_repo(value: str) -> str:
    repo = str(value or "").strip()
    if repo.count("/") != 1:
        raise CooperativeLoopError("repository must be owner/name")
    owner, name = repo.split("/", 1)
    if not owner or not name or any(ch.isspace() for ch in repo):
        raise CooperativeLoopError("repository must be owner/name")
    return repo


def _compact(value: Any, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def _fresh_state() -> dict[str, Any]:
    return {
        "schema": STATE_SCHEMA,
        "cycle": 0,
        "epoch": 0,
        "active_root_id": None,
        "active_leaf_id": None,
        "chain_profile_ids": [],
        "processed_source_urls": [],
        "history": [],
    }


def _load_state(path: Path) -> tuple[dict[str, Any], bool]:
    raw = _load_json(path, None)
    if not isinstance(raw, dict) or raw.get("schema") != STATE_SCHEMA:
        return _fresh_state(), bool(path.exists())
    state = _fresh_state()
    state.update(raw)
    state["cycle"] = max(0, int(state.get("cycle", 0)))
    state["epoch"] = max(0, int(state.get("epoch", 0)))
    state["chain_profile_ids"] = [str(x) for x in state.get("chain_profile_ids", []) if str(x)]
    state["processed_source_urls"] = [str(x) for x in state.get("processed_source_urls", []) if str(x)][-MAX_PROCESSED:]
    state["history"] = list(state.get("history", []))[-MAX_HISTORY:]
    return state, False


def _policy_allows(policy: Mapping[str, Any], repo: str) -> bool:
    actions = policy.get("actions", {}) if isinstance(policy, Mapping) else {}
    allow = policy.get("allowlists", {}) if isinstance(policy, Mapping) else {}
    if not isinstance(actions, Mapping) or not isinstance(allow, Mapping):
        return False
    repos = {str(x) for x in allow.get("github_repositories", ())}
    target_ids = {str(x) for x in allow.get("external_write_target_ids", ())}
    return (
        actions.get("github_issue_own_repo") == "AUTO_ALLOWLIST"
        and repo in repos
        and TARGET_ID in target_ids
    )


def _recent_attempts(state: Mapping[str, Any], now: dt.datetime) -> set[str]:
    cutoff = now - dt.timedelta(hours=ATTEMPT_COOLDOWN_HOURS)
    recent: set[str] = set()
    for row in state.get("history", ()) if isinstance(state, Mapping) else ():
        if not isinstance(row, Mapping):
            continue
        source = str(row.get("source_url", ""))
        at = str(row.get("at", ""))
        if not source or not at:
            continue
        try:
            stamp = dt.datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
        except ValueError:
            continue
        if stamp >= cutoff:
            recent.add(source)
    return recent


def _daily_success_count(state: Mapping[str, Any], now: dt.datetime) -> int:
    day = now.date().isoformat()
    count = 0
    for row in state.get("history", ()) if isinstance(state, Mapping) else ():
        if not isinstance(row, Mapping):
            continue
        if str(row.get("at", "")).startswith(day) and row.get("write_status") == "POSTED":
            count += 1
    return count


def discover(events: Mapping[str, Any], state: Mapping[str, Any], now: dt.datetime) -> Mapping[str, Any] | None:
    """Select one novel Reality Agency finding for this bounded write loop."""
    processed = {str(x) for x in state.get("processed_source_urls", ())}
    recent = _recent_attempts(state, now)
    rows = events.get("findings", ()) if isinstance(events, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        url = str(raw.get("url", "")).strip()
        if not url.startswith(("https://", "http://")) or url in processed or url in recent:
            continue
        title = _compact(raw.get("title") or raw.get("note") or "Discovery", 180)
        if not title:
            continue
        return dict(raw)
    return None


def consensus(
    finding: Mapping[str, Any],
    policy: Mapping[str, Any],
    repo: str,
    environ: Mapping[str, str],
) -> dict[str, Any]:
    source = str(finding.get("url", "")).strip()
    meta_ok = source.startswith(("https://", "http://")) and bool(_compact(finding.get("title") or finding.get("note"), 180))
    x_ok = _policy_allows(policy, repo)
    runtime_repo = str(environ.get("GITHUB_REPOSITORY", "")).strip()
    senju_ok = bool(environ.get("GITHUB_TOKEN", "").strip()) and (not runtime_repo or runtime_repo == repo)
    votes = {
        "META": {"approved": meta_ok, "reason": "well_formed_discovery" if meta_ok else "invalid_discovery"},
        "X": {"approved": x_ok, "reason": "canonical_owned_repo_allowlist" if x_ok else "policy_not_allowlisted"},
        "SENJU": {"approved": senju_ok, "reason": "preprovisioned_runtime_credential" if senju_ok else "credential_or_repo_mismatch"},
    }
    unanimous = all(bool(votes[name]["approved"]) for name in REQUIRED_VOTERS)
    return {"required": list(REQUIRED_VOTERS), "votes": votes, "unanimous": unanimous}


def _root_scope(epoch: int, repo: str) -> ExternalAuthorityScope:
    return ExternalAuthorityScope(
        scope_id=f"cooperative-github-issues-epoch-{epoch}",
        target_service=f"GitHub Issues write lane for {repo}",
        allow_hosts=frozenset({TARGET_HOST}),
        allowed_methods=frozenset({TARGET_METHOD}),
        allow_http=False,
        allow_delete=False,
        rate_limit_per_minute=6,
        timeout_seconds=15.0,
        max_request_bytes=64 * 1024,
        max_response_bytes=1024 * 1024,
        retries=1,
        follow_redirects=False,
        credential_scope="service_bearer",
        verification_strategy="sha256_receipt",
        rollback_supported=False,
        description=f"Reviewed owned-repository issue writer for {repo}",
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


def _mint_inherited(parent: AuthorityProfile, *, issuer: str, purpose: str) -> AuthorityProfile:
    return mint_child(
        parent,
        AuthorityMintRequest(purpose=purpose, can_delegate=True),
        issuer=issuer,
    )


def _rebuild_authority(
    registry_path: Path,
    state: MutableMapping[str, Any],
    repo: str,
    *,
    next_epoch: int,
) -> tuple[AuthorityRegistry, AuthorityProfile]:
    registry = AuthorityRegistry(registry_path)
    root = root_from_external_scope(_root_scope(next_epoch, repo), delegation_depth=MAX_DELEGATION_DEPTH)
    registry.profiles[root.profile_id] = root
    chain = [root.profile_id]
    leaf = root
    for issuer in ISSUER_ROTATION:
        leaf = _mint_inherited(
            leaf,
            issuer=issuer,
            purpose=f"META/X/Senju cooperative write authority for {repo}",
        )
        registry.profiles[leaf.profile_id] = leaf
        chain.append(leaf.profile_id)
    registry.save()
    state["epoch"] = next_epoch
    state["active_root_id"] = root.profile_id
    state["active_leaf_id"] = leaf.profile_id
    state["chain_profile_ids"] = chain
    return registry, leaf


def _load_or_recover_authority(
    state_dir: Path,
    state: MutableMapping[str, Any],
    repo: str,
) -> tuple[AuthorityRegistry, AuthorityProfile, dict[str, Any]]:
    registry_path = state_dir / "registry" / "delegated_authorities.json"
    recovered = False
    reason = "restored"
    try:
        registry = AuthorityRegistry.load(registry_path)
        root_id = str(state.get("active_root_id") or "")
        leaf_id = str(state.get("active_leaf_id") or "")
        if not root_id or not leaf_id:
            raise AuthorityMintError("active authority ids missing")
        root = registry.get(root_id)
        leaf = registry.get(leaf_id)
        if root.parent_id is not None or root.issuer != "SYSTEM" or not _same_scope(root):
            raise AuthorityMintError("persisted root scope drifted")
        if not _same_scope(leaf):
            raise AuthorityMintError("persisted leaf scope drifted")
        if leaf.profile_id not in state.get("chain_profile_ids", []):
            raise AuthorityMintError("active leaf is not in persisted chain")
        if leaf.can_delegate and leaf.delegation_depth_remaining > 0:
            return registry, leaf, {"state_recovered": False, "reason": reason}
        recovered = True
        reason = "delegation_depth_exhausted"
    except (AuthorityMintError, OSError, ValueError, TypeError, json.JSONDecodeError):
        recovered = True
        reason = "missing_or_invalid_persisted_authority"

    next_epoch = int(state.get("epoch", 0)) + 1
    registry, leaf = _rebuild_authority(registry_path, state, repo, next_epoch=next_epoch)
    return registry, leaf, {"state_recovered": recovered, "reason": reason}


def _issue_payload(finding: Mapping[str, Any], consensus_receipt: Mapping[str, Any], authority: AuthorityProfile) -> bytes:
    title = "[COOP] " + _compact(finding.get("title") or "Discovery", 125)
    source = str(finding.get("url", "")).strip()
    note = _compact(finding.get("note") or finding.get("summary") or "", 1800)
    body = (
        "Persistent META / X / SENJU cooperative loop\n\n"
        f"Source: {source}\n\n"
        f"{note}\n\n"
        f"Consensus: META/X/SENJU = 3/3\n"
        f"Authority profile: `{authority.profile_id}`\n"
        f"Authority generation: `{authority.generation}`\n"
        f"Authority host: `{TARGET_HOST}`\n"
        f"Authority method: `{TARGET_METHOD}`\n\n"
        "This write was executed with a pre-provisioned runtime credential inside the owned-repository allowlist."
    )
    return json.dumps({"title": title[:256], "body": body}, ensure_ascii=False).encode("utf-8")


def _write_issue(
    repo: str,
    finding: Mapping[str, Any],
    consensus_receipt: Mapping[str, Any],
    authority: AuthorityProfile,
    secret: str,
    *,
    client_factory: Callable[[Any], Any],
) -> WriteAttempt:
    if not _same_scope(authority):
        raise CooperativeLoopError("active authority is outside the cooperative write scope")
    scope = authority.to_external_scope()
    if scope.allow_hosts != frozenset({TARGET_HOST}) or scope.allowed_methods != frozenset({TARGET_METHOD}):
        raise CooperativeLoopError("external scope projection drifted")
    client = client_factory(scope.to_policy())
    result = client.contact_with_body(
        f"https://{TARGET_HOST}/repos/{repo}/issues",
        method=TARGET_METHOD,
        body=_issue_payload(finding, consensus_receipt, authority),
        headers={
            "Authorization": f"Bearer {secret}",
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
    return WriteAttempt(
        status=status,
        issue_number=int(response["number"]) if isinstance(response, Mapping) and response.get("number") is not None else None,
        issue_url=str(response.get("html_url")) if isinstance(response, Mapping) and response.get("html_url") else None,
        receipt=receipt,
    )


def _record_history(state: MutableMapping[str, Any], row: Mapping[str, Any]) -> None:
    history = list(state.get("history", []))
    history.append(dict(row))
    state["history"] = history[-MAX_HISTORY:]


def _advance_delegation(
    registry: AuthorityRegistry,
    state: MutableMapping[str, Any],
    leaf: AuthorityProfile,
    repo: str,
) -> AuthorityProfile:
    issuer = ISSUER_ROTATION[int(state.get("cycle", 0)) % len(ISSUER_ROTATION)]
    child = _mint_inherited(
        leaf,
        issuer=issuer,
        purpose=f"recursive cooperative continuation for {repo}",
    )
    if not _same_scope(child):
        raise CooperativeLoopError("recursive delegation widened authority")
    registry.profiles[child.profile_id] = child
    registry.save()
    chain = list(state.get("chain_profile_ids", []))
    chain.append(child.profile_id)
    state["chain_profile_ids"] = chain[-MAX_DELEGATION_DEPTH:]
    state["active_leaf_id"] = child.profile_id
    return child


def run_cycle(
    events: Mapping[str, Any],
    policy: Mapping[str, Any],
    state_dir: str | Path,
    repo: str,
    *,
    environ: Mapping[str, str] | None = None,
    client_factory: Callable[[Any], Any] = ExternalContactClient,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    """Run one production cooperative cycle and persist all non-secret evidence."""
    current = _now_utc(now)
    repo = _normalize_repo(repo)
    env = dict(os.environ if environ is None else environ)
    state_root = Path(state_dir)
    state_root.mkdir(parents=True, exist_ok=True)
    state_path = state_root / "cooperative_loop_state.json"
    state, state_file_corrupt = _load_state(state_path)
    state["cycle"] = int(state.get("cycle", 0)) + 1

    result: dict[str, Any] = {
        "schema": SCHEMA,
        "at": _iso(current),
        "repo": repo,
        "cycle": state["cycle"],
        "discovery": {"selected": False},
        "consensus": {"unanimous": False},
        "authority": {"ready": False},
        "credentialed_write": {"attempted": False, "posted": False},
        "recursive_delegation": {"advanced": False},
        "persistence": {"saved": False},
        "recovery": {"state_file_rebuilt": state_file_corrupt, "credential_recovery_attempted": False},
    }

    finding = discover(events, state, current)
    if finding is None:
        result["reason"] = "no_novel_discovery"
        _write_json(state_path, state)
        result["persistence"] = {"saved": True, "state_path": str(state_path)}
        _write_json(state_root / "last_cycle.json", result)
        return result

    source_url = str(finding.get("url", "")).strip()
    result["discovery"] = {"selected": True, "source_url": source_url, "title": _compact(finding.get("title"), 180)}

    vote = consensus(finding, policy, repo, env)
    result["consensus"] = vote
    if not vote["unanimous"]:
        result["reason"] = "consensus_rejected"
        _record_history(state, {"at": _iso(current), "source_url": source_url, "write_status": "CONSENSUS_REJECTED"})
        _write_json(state_path, state)
        result["persistence"] = {"saved": True, "state_path": str(state_path)}
        _write_json(state_root / "last_cycle.json", result)
        return result

    if _daily_success_count(state, current) >= MAX_WRITES_PER_DAY:
        result["reason"] = "daily_write_cap_reached"
        _record_history(state, {"at": _iso(current), "source_url": source_url, "write_status": "DAILY_CAP"})
        _write_json(state_path, state)
        result["persistence"] = {"saved": True, "state_path": str(state_path)}
        _write_json(state_root / "last_cycle.json", result)
        return result

    registry, leaf, recovery = _load_or_recover_authority(state_root, state, repo)
    result["recovery"].update(recovery)
    result["authority"] = {
        "ready": True,
        "root_profile_id": state.get("active_root_id"),
        "active_profile_id": leaf.profile_id,
        "generation": leaf.generation,
        "delegation_depth_remaining": leaf.delegation_depth_remaining,
        "host": TARGET_HOST,
        "method": TARGET_METHOD,
        "credential_scope": leaf.credential_scope,
        "scope_expanded": False,
    }

    token = str(env.get("GITHUB_TOKEN", "")).strip()
    if not token:
        raise CooperativeLoopError("consensus accepted without GITHUB_TOKEN")

    attempt = _write_issue(repo, finding, vote, leaf, token, client_factory=client_factory)
    result["credentialed_write"] = {
        "attempted": True,
        "posted": 200 <= attempt.status < 300,
        "status": attempt.status,
        "issue_number": attempt.issue_number,
        "issue_url": attempt.issue_url,
        "receipt": dict(attempt.receipt),
        "credential_source": "preprovisioned_runtime_only",
        "secret_persisted": False,
    }

    # Permission failure recovery may only choose another credential that was already
    # provisioned to this runtime. It never discovers, creates, or persists a secret.
    if attempt.status in {401, 403}:
        result["recovery"]["credential_recovery_attempted"] = True
        runtime = CredentialRecoveryRuntime.from_environment(
            actor="Senju",
            environ=env,
            state_dir=state_root / "credential_runtime",
        )

        def retry(secret: str) -> Mapping[str, Any]:
            retry_attempt = _write_issue(repo, finding, vote, leaf, secret, client_factory=client_factory)
            return {
                "_error": str(retry_attempt.status) if retry_attempt.status in {401, 403} else "",
                "status": retry_attempt.status,
                "issue_number": retry_attempt.issue_number,
                "issue_url": retry_attempt.issue_url,
                "receipt": dict(retry_attempt.receipt),
            }

        recovery_result, recovery_response = runtime.recover_operation(
            provider="github",
            required_scopes={"issues:write"},
            operation="create_owned_repo_issue",
            resource=repo,
            error_code=str(attempt.status),
            attempt_with_secret=retry,
            ttl_seconds=300,
        )
        result["recovery"]["credential_recovered"] = bool(recovery_result.recovered)
        result["recovery"]["credential_recovery"] = runtime.loop_result_record(recovery_result)
        if recovery_response:
            status = int(recovery_response.get("status", 0) or 0)
            if 200 <= status < 300:
                result["credentialed_write"].update(
                    {
                        "posted": True,
                        "status": status,
                        "issue_number": recovery_response.get("issue_number"),
                        "issue_url": recovery_response.get("issue_url"),
                        "receipt": recovery_response.get("receipt", {}),
                        "recovered_credential_path": True,
                    }
                )

    posted = bool(result["credentialed_write"].get("posted"))
    history_row = {
        "at": _iso(current),
        "source_url": source_url,
        "write_status": "POSTED" if posted else "ERROR",
        "status": result["credentialed_write"].get("status"),
        "issue_number": result["credentialed_write"].get("issue_number"),
        "authority_profile_id": leaf.profile_id,
    }
    _record_history(state, history_row)

    if posted:
        next_leaf = _advance_delegation(registry, state, leaf, repo)
        result["recursive_delegation"] = {
            "advanced": True,
            "from_profile_id": leaf.profile_id,
            "to_profile_id": next_leaf.profile_id,
            "issuer": next_leaf.issuer,
            "generation": next_leaf.generation,
            "delegation_depth_remaining": next_leaf.delegation_depth_remaining,
            "scope_expanded": False,
        }
        processed = list(state.get("processed_source_urls", []))
        processed.append(source_url)
        state["processed_source_urls"] = processed[-MAX_PROCESSED:]
        result["reason"] = "cycle_completed"
    else:
        result["reason"] = "credentialed_write_failed"

    _write_json(state_path, state)
    receipt_path = state_root / "write_receipts" / f"cycle-{state['cycle']:06d}.json"
    _write_json(
        receipt_path,
        {
            "schema": WRITE_RECEIPT_SCHEMA,
            "at": _iso(current),
            "repo": repo,
            "source_url": source_url,
            "consensus": vote,
            "authority": result["authority"],
            "credentialed_write": result["credentialed_write"],
            "recursive_delegation": result["recursive_delegation"],
        },
    )
    result["persistence"] = {
        "saved": True,
        "state_path": str(state_path),
        "authority_registry": str(state_root / "registry" / "delegated_authorities.json"),
        "write_receipt": str(receipt_path),
        "secrets_stored": False,
    }
    _write_json(state_root / "last_cycle.json", result)
    return result
