#!/usr/bin/env python3
"""Run the META/X/Senju production continuity controller.

This runner is intended for the scheduled GitHub Actions production lane. It restores
canonical explicit standing authority, performs credential-free HEAD health probes on
already-authorized exact targets, advances the descendant closed loop, persists state,
and may dispatch a deployment workflow only when an exact separate
``deployment.production`` authorization produced the intent.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "senju") not in sys.path:
    sys.path.insert(0, str(ROOT / "senju"))

from senju.meta.production_continuity import (  # noqa: E402
    CONTINUITY_SCHEMA,
    resolve_existing_authority,
    run_production_continuity_cycle,
)
from senju.meta.standing_authorization import sync_canonical_explicit_authorizations  # noqa: E402


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_ndjson(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(payload), ensure_ascii=False, sort_keys=True) + "\n")


def _safe_slug(host: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in host)[:160]


def _probe_health(host: str, *, timeout: float = 8.0) -> dict[str, Any]:
    url = f"https://{host}/"
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "senju-production-continuity/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = int(response.status)
        return {
            "status": "healthy" if 200 <= status < 500 else "unhealthy",
            "http_status": status,
            "url": url,
        }
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        return {
            "status": "healthy" if 200 <= status < 500 else "unhealthy",
            "http_status": status,
            "url": url,
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "http_status": None,
            "url": url,
            "error": f"{type(exc).__name__}: {exc}",
        }


def _successful_intent_ids(receipts_path: Path) -> set[str]:
    if not receipts_path.exists():
        return set()
    ids: set[str] = set()
    for line in receipts_path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict) and row.get("success") is True and isinstance(row.get("intent_id"), str):
            ids.add(row["intent_id"])
    return ids


def _dispatch_workflow(intent: Mapping[str, Any]) -> dict[str, Any]:
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not token or "/" not in repository:
        return {
            "intent_id": intent.get("intent_id"),
            "success": False,
            "dispatched": False,
            "reason": "github_runtime_credentials_unavailable",
        }
    workflow = str(intent.get("workflow") or "").strip()
    ref = str(intent.get("ref") or "").strip()
    if not workflow or not ref or intent.get("capability") != "deployment.production":
        return {
            "intent_id": intent.get("intent_id"),
            "success": False,
            "dispatched": False,
            "reason": "invalid_approved_deployment_intent",
        }
    owner, repo = repository.split("/", 1)
    encoded = urllib.parse.quote(workflow, safe="")
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{encoded}/dispatches"
    payload = json.dumps({"ref": ref, "inputs": {}}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = int(response.status)
        return {
            "intent_id": intent.get("intent_id"),
            "success": status in {200, 201, 202, 204},
            "dispatched": status in {200, 201, 202, 204},
            "http_status": status,
            "workflow": workflow,
            "ref": ref,
            "target_host": intent.get("target_host"),
            "desired_revision": intent.get("desired_revision"),
            "deployment_authorization_reference": intent.get("deployment_authorization_reference"),
        }
    except urllib.error.HTTPError as exc:
        return {
            "intent_id": intent.get("intent_id"),
            "success": False,
            "dispatched": False,
            "http_status": int(exc.code),
            "workflow": workflow,
            "ref": ref,
            "reason": "workflow_dispatch_failed",
        }


def _mark_dispatch_success(state_path: Path, intent: Mapping[str, Any]) -> None:
    state = _read_json(state_path, {})
    if not isinstance(state, dict) or state.get("schema") != CONTINUITY_SCHEMA:
        return
    state["last_deployed_revision"] = str(intent.get("desired_revision") or "")
    state["last_successful_deployment_intent_id"] = str(intent.get("intent_id") or "")
    state["deployment_ready"] = False
    state["stage"] = "persistent"
    _write_json(state_path, state)


def run(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = Path(args.repo_root).resolve()
    state_root = Path(args.state_dir).resolve()
    config = _read_json(Path(args.config), {})
    if not isinstance(config, dict) or config.get("schema") != "senju-production-continuity-config/v1":
        raise SystemExit("invalid production continuity config")
    if config.get("environment") != "production":
        raise SystemExit("production continuity config must declare environment=production")

    # Canonical explicit authority is reconstructed on every production run. The
    # durable record remains governed by the standing-authorization implementation.
    sync_canonical_explicit_authorizations(
        repo_root=repo_root,
        registry_path=repo_root / "senju" / "state" / "standing_authorizations.json",
    )

    results: list[dict[str, Any]] = []
    for raw in config.get("targets", []):
        if not isinstance(raw, dict):
            continue
        host = str(raw.get("target_host") or "").strip().lower()
        if not host:
            continue
        target_state = state_root / _safe_slug(host)
        target_state.mkdir(parents=True, exist_ok=True)
        previous = _read_json(target_state / "production_continuity_state.json", {})
        previous_replicas = int(previous.get("replicas_after_cycle", 0) or 0) if isinstance(previous, dict) else 0

        evidence = resolve_existing_authority(
            repo_root=repo_root,
            state_dir=target_state,
            target_host=host,
        )
        if args.probe_health and evidence is not None:
            health = _probe_health(host)
        else:
            health = {"status": str(raw.get("health_status") or "healthy")}
        _write_json(target_state / "latest_health.json", health)

        result = run_production_continuity_cycle(
            repo_root=repo_root,
            state_dir=target_state,
            target_host=host,
            actor=str(raw.get("actor") or "META"),
            parent_id=str(raw.get("parent_id") or "META-PRODUCTION-CONTINUITY"),
            parent_generation=int(raw.get("parent_generation", 1)),
            parent_scopes=[str(x) for x in raw.get("parent_scopes", ["read:state"])],
            desired_replicas=max(0, int(raw.get("desired_replicas", 0))),
            desired_revision=str(raw.get("desired_revision") or "default-branch"),
            active_agents=max(0, int(raw.get("active_agents", 0))),
            active_limit=max(1, int(raw.get("active_limit", 50))),
            current_replicas=previous_replicas,
            health_status=str(health.get("status") or "unhealthy"),
            deployment_authority_path=args.deployment_authorities,
        )
        result["health_probe"] = health
        result["replicas_after_cycle"] = min(
            int(result.get("desired_replicas", 0)),
            previous_replicas + int(result.get("replication_materialized", 0)),
        )
        _write_json(target_state / "production_continuity_state.json", {"schema": CONTINUITY_SCHEMA, **result})

        intent = result.get("deployment_intent")
        if args.dispatch_approved_deployments and isinstance(intent, dict):
            receipts_path = target_state / "production_deployment_receipts.ndjson"
            if str(intent.get("intent_id")) in _successful_intent_ids(receipts_path):
                receipt = {
                    "intent_id": intent.get("intent_id"),
                    "success": True,
                    "dispatched": False,
                    "reason": "already_dispatched_successfully",
                }
            else:
                receipt = _dispatch_workflow(intent)
                _append_ndjson(receipts_path, receipt)
                if receipt.get("success") is True:
                    _mark_dispatch_success(target_state / "production_continuity_state.json", intent)
            result["deployment_receipt"] = receipt
        results.append(result)

    summary = {
        "schema": "senju-production-continuity-run/v1",
        "environment": "production",
        "targets_processed": len(results),
        "targets": results,
    }
    if args.output:
        _write_json(Path(args.output), summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default="senju/state/production-continuity")
    parser.add_argument("--config", default="senju/config/production-continuity.json")
    parser.add_argument(
        "--deployment-authorities",
        default="senju/config/production-deployment-authorizations.json",
    )
    parser.add_argument("--output", default="senju/state/production-continuity/latest-run.json")
    parser.add_argument("--probe-health", action="store_true")
    parser.add_argument("--dispatch-approved-deployments", action="store_true")
    args = parser.parse_args()
    run(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
