#!/usr/bin/env python3
"""Run production continuity with direct signed federation auto-enrollment.

The wrapper consumes a previously verified remote-authority-chain artifact, stages only
direct depth-1 owner-pinned signed read-only grants, adds those exact hosts to the live
continuity target set, and then invokes the normal production continuity runner.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "senju") not in sys.path:
    sys.path.insert(0, str(ROOT / "senju"))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from run_production_continuity import run as run_continuity  # noqa: E402
from senju.meta.production_federated_discovery import (  # noqa: E402
    eligible_direct_signed_grants,
    stage_direct_signed_grant,
)


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _safe_slug(host: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in host)[:160]


def run(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = Path(args.repo_root).resolve()
    state_root = Path(args.state_dir).resolve()
    base_config = _read_json(Path(args.config), {})
    if not isinstance(base_config, dict) or base_config.get("schema") != "senju-production-continuity-config/v1":
        raise SystemExit("invalid production continuity config")
    if base_config.get("environment") != "production":
        raise SystemExit("production continuity config must declare environment=production")

    targets = [dict(row) for row in base_config.get("targets", []) if isinstance(row, dict)]
    existing_hosts = {str(row.get("target_host") or "").strip().lower() for row in targets}
    fed = base_config.get("federated_discovery")
    accepted: list[dict[str, Any]] = []

    if isinstance(fed, Mapping) and bool(fed.get("enabled", False)):
        chain_path = Path(args.remote_chain_state)
        if not chain_path.is_absolute():
            chain_path = repo_root / chain_path
        grants = eligible_direct_signed_grants(chain_path)
        for grant in grants:
            target_state = state_root / _safe_slug(grant.target_host)
            stage_direct_signed_grant(state_dir=target_state, grant=grant)
            accepted.append({
                "target_host": grant.target_host,
                "source_host": grant.source_host,
                "authorization_reference": grant.authorization_reference,
                "expires_at": grant.expires_at,
            })
            if grant.target_host in existing_hosts:
                continue
            parent_prefix = str(fed.get("parent_id_prefix") or "META-FEDERATED-PRODUCTION")
            targets.append({
                "target_host": grant.target_host,
                "actor": str(fed.get("actor") or "META"),
                "parent_id": f"{parent_prefix}:{_safe_slug(grant.target_host)}",
                "parent_generation": max(1, int(fed.get("parent_generation", 1))),
                "parent_scopes": [
                    str(x)
                    for x in fed.get(
                        "parent_scopes",
                        ["read:state", "write:state", "read:research", "write:research"],
                    )
                ],
                "desired_replicas": max(0, int(fed.get("desired_replicas", 4))),
                "desired_revision": str(fed.get("desired_revision") or "default-branch"),
                "active_limit": max(1, int(fed.get("active_limit", 50))),
                "health_status": "healthy",
                "authority_origin": "direct_owner_signed_federation",
            })
            existing_hosts.add(grant.target_host)

    effective_config = {
        **base_config,
        "targets": targets,
    }
    effective_path = state_root / "effective-production-continuity-config.json"
    _write_json(effective_path, effective_config)

    continuity_args = argparse.Namespace(
        repo_root=str(repo_root),
        state_dir=str(state_root),
        config=str(effective_path),
        deployment_authorities=args.deployment_authorities,
        output=args.output,
        probe_health=args.probe_health,
        dispatch_approved_deployments=args.dispatch_approved_deployments,
    )
    result = run_continuity(continuity_args)
    result["federated_discovery"] = {
        "enabled": bool(isinstance(fed, Mapping) and fed.get("enabled", False)),
        "mode": "direct_depth_1_owner_pinned_signed_only",
        "accepted_count": len(accepted),
        "accepted": accepted,
        "automatic_production_deployment_from_discovery": False,
        "raw_credential_inheritance": False,
    }
    if args.output:
        _write_json(Path(args.output), result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default="senju/state/production-continuity")
    parser.add_argument("--config", default="senju/config/production-continuity.json")
    parser.add_argument(
        "--remote-chain-state",
        default="senju/state/production-continuity/federation/remote_authority_chain.json",
    )
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
