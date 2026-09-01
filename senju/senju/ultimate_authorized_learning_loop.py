"""Unified authorized-world learning loop.

This module composes the existing reviewed-Authority promotion flow with the
approved real-transport RED learner and adds persistent *safe* tactic memory.

Security invariants:
- discovery/candidates never mint Authority;
- only already-reviewed/current Authority may be contacted;
- only the read-only method set enforced by approved_authority_red_adaptive is used;
- no request bodies, exploit payloads, credential copying, revocation bypass,
  guard self-approval, or new trust-root creation occurs here;
- learned tactics are path/method observations only and are revalidated against
  live Authority on every cycle.
"""
from __future__ import annotations

import json
import urllib.parse
from pathlib import Path
from typing import Any, Mapping, Sequence

from .approved_authority_red_adaptive import execute_authorized_red_learning_cycle
from .authority_promotion_bureau import run_authority_promotion_bureau
from .external_denial_learning import DenialLearningMemory

LOOP_SCHEMA = "senju-ultimate-authorized-learning-loop/v1"
TACTIC_SCHEMA = "senju-safe-red-tactic-memory/v1"
DEFAULT_MAX_HOSTS = 8
MAX_HOSTS = 32
MAX_TACTICS = 128


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _approved_seed_urls(state_dir: Path) -> list[str]:
    doc = _load_json(state_dir / "promotion_bureau_approved_hosts.json", {})
    rows = doc.get("hosts", ()) if isinstance(doc, Mapping) else ()
    out: list[str] = []
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = str(raw.get("host") or "").strip().lower().rstrip(".")
        if host and "/" not in host and "@" not in host and "*" not in host:
            out.append(urllib.parse.urlunsplit(("https", host, "/", "", "")))
    return list(dict.fromkeys(out))


def _load_denial_memory(path: Path) -> DenialLearningMemory:
    raw = _load_json(path, {})
    return DenialLearningMemory.from_mapping(raw if isinstance(raw, Mapping) else {})


def _load_tactics(path: Path) -> dict[str, Any]:
    raw = _load_json(path, {})
    if not isinstance(raw, Mapping) or raw.get("schema") != TACTIC_SCHEMA:
        return {"schema": TACTIC_SCHEMA, "successful_paths": [], "successful_methods": []}
    return {
        "schema": TACTIC_SCHEMA,
        "successful_paths": [
            str(v) for v in raw.get("successful_paths", ()) if isinstance(v, str)
        ][-MAX_TACTICS:],
        "successful_methods": [
            str(v).upper() for v in raw.get("successful_methods", ()) if isinstance(v, str)
        ][-MAX_TACTICS:],
    }


def _merge_successful_tactics(memory: dict[str, Any], result: Mapping[str, Any]) -> None:
    paths = list(memory.get("successful_paths", ()))
    methods = list(memory.get("successful_methods", ()))
    for row in result.get("attempts", ()) if isinstance(result.get("attempts"), list) else ():
        if not isinstance(row, Mapping) or row.get("success") is not True:
            continue
        path = str(row.get("path") or "").strip()
        method = str(row.get("method") or "").strip().upper()
        if path and path not in paths:
            paths.append(path)
        if method and method not in methods:
            methods.append(method)
    memory["successful_paths"] = paths[-MAX_TACTICS:]
    memory["successful_methods"] = methods[-MAX_TACTICS:]


def run_ultimate_authorized_learning_loop(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    meta_state_dir: str | Path,
    operation_id: str,
    seed_urls: Sequence[str] = (),
    alternate_paths: Sequence[str] = (),
    rollout_percent: int = 45,
    max_attempts_per_host: int = 4,
    max_hosts: int = DEFAULT_MAX_HOSTS,
    memory_path: str | Path | None = None,
    tactic_memory_path: str | Path | None = None,
    output_path: str | Path | None = None,
) -> dict[str, Any]:
    """Run one integrated cycle over currently reviewed Authority hosts.

    Successful read-only paths/methods are persisted and offered as hints to later
    approved hosts. The downstream adaptive learner revalidates every host, path and
    method against the live Authority ceiling before any real transport occurs.
    """
    root = Path(repo_root)
    state = Path(state_dir)
    meta_state = Path(meta_state_dir)
    state.mkdir(parents=True, exist_ok=True)

    denial_path = Path(memory_path) if memory_path else state / "approved_authority_red_memory.json"
    tactic_path = (
        Path(tactic_memory_path)
        if tactic_memory_path
        else state / "safe_red_tactic_memory.json"
    )
    out_path = (
        Path(output_path)
        if output_path
        else state / "ultimate_authorized_learning_loop_latest.json"
    )

    promotion = run_authority_promotion_bureau(
        state,
        meta_state_dir=meta_state,
        output_dir=state,
    )

    candidates = list(dict.fromkeys([*seed_urls, *_approved_seed_urls(state)]))
    host_cap = max(1, min(int(max_hosts), MAX_HOSTS))
    candidates = candidates[:host_cap]

    denial_memory = _load_denial_memory(denial_path)
    tactic_memory = _load_tactics(tactic_path)
    learned_paths = list(dict.fromkeys([
        *tactic_memory.get("successful_paths", ()),
        *alternate_paths,
    ]))

    runs: list[dict[str, Any]] = []
    for index, seed in enumerate(candidates):
        result = execute_authorized_red_learning_cycle(
            repo_root=root,
            state_dir=state,
            operation_id=f"{operation_id}:{index}",
            seed_url=seed,
            candidate_urls=candidates,
            alternate_paths=learned_paths,
            rollout_percent=rollout_percent,
            max_attempts=max_attempts_per_host,
            memory=denial_memory,
        )
        runs.append(result)
        _merge_successful_tactics(tactic_memory, result)
        learned_paths = list(dict.fromkeys([
            *tactic_memory.get("successful_paths", ()),
            *alternate_paths,
        ]))

    denial_memory.write(denial_path)
    _write_json(tactic_path, tactic_memory)

    summary = {
        "schema": LOOP_SCHEMA,
        "operation_id": operation_id,
        "promotion": promotion,
        "candidate_count": len(candidates),
        "run_count": len(runs),
        "runs": runs,
        "memory_path": str(denial_path),
        "tactic_memory_path": str(tactic_path),
        "successful_paths": tactic_memory.get("successful_paths", []),
        "successful_methods": tactic_memory.get("successful_methods", []),
        "capabilities": {
            "real_transport": True,
            "response_to_learning": True,
            "failure_analysis": True,
            "safe_path_variation": True,
            "safe_method_variation": True,
            "approved_host_variation": True,
            "persistent_learning_memory": True,
            "successful_tactic_reuse_across_approved_hosts": True,
            "reviewed_authority_refresh_each_cycle": True,
        },
        "hard_limits": {
            "discovery_auto_authority": False,
            "new_root_minting": False,
            "credential_copy_or_inheritance": False,
            "exploit_payload_generation": False,
            "request_body_generation": False,
            "write_methods": False,
            "revocation_bypass_or_recovery": False,
            "guard_self_approval": False,
            "authority_boundary_bypass": False,
        },
    }
    _write_json(out_path, summary)
    return summary
