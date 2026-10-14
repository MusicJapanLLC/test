#!/usr/bin/env python3
"""Run production continuity with live shared-discovery capability leases.

This wrapper is the bridge from Discovery/Authorization into the existing production
Replication/Authority-Inheritance/Deployment/Persistence/Recovery controller. It adds
active exact targets from the shared discovery lease artifact to the continuity target
set, stages same-target read-only authority evidence for the worker lineage, then calls
the existing federated production continuity runner.

Production deployment is still decided by the existing separate exact-host deployment
authority. A discovery lease can create a continuity target, but cannot create
``deployment.production`` or raw credential inheritance.
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

from run_production_federated_continuity import run as run_federated_continuity  # noqa: E402
from senju.meta.discovery_lease_continuity import (  # noqa: E402
    continuity_target_from_discovery_grant,
    load_active_discovery_continuity_grants,
    stage_discovery_continuity_authority,
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
    state_root.mkdir(parents=True, exist_ok=True)
    base_config = _read_json(Path(args.config), {})
    if not isinstance(base_config, dict) or base_config.get("schema") != "senju-production-continuity-config/v1":
        raise SystemExit("invalid production continuity config")
    if base_config.get("environment") != "production":
        raise SystemExit("production continuity config must declare environment=production")

    targets = [dict(row) for row in base_config.get("targets", []) if isinstance(row, dict)]
    existing_hosts = {str(row.get("target_host") or "").strip().lower() for row in targets}
    discovery_config = base_config.get("discovery_capability_continuity", {})
    discovery_enabled = isinstance(discovery_config, Mapping) and bool(discovery_config.get("enabled", False))

    accepted: list[dict[str, Any]] = []
    added_targets: list[str] = []
    leases_path = Path(args.discovery_leases)
    if discovery_enabled and leases_path.exists():
        grants = load_active_discovery_continuity_grants(leases_path)
        for grant in grants:
            target_state = state_root / _safe_slug(grant.target_host)
            stage_discovery_continuity_authority(state_dir=target_state, grant=grant)
            accepted.append(
                {
                    "target_host": grant.target_host,
                    "lease_id": grant.lease_id,
                    "authorization_reference": grant.authorization_reference,
                    "expires_at": grant.source_lease_expires_at,
                    "capabilities": list(grant.capabilities),
                    "source_credential_scope_present": grant.source_credential_scope != "none",
                    "raw_credential_inheritance": False,
                }
            )
            if grant.target_host in existing_hosts:
                continue
            target = continuity_target_from_discovery_grant(
                grant,
                actor=str(discovery_config.get("actor") or "META"),
                parent_id_prefix=str(
                    discovery_config.get("parent_id_prefix") or "META-DISCOVERY-CONTINUITY"
                ),
                parent_generation=int(discovery_config.get("parent_generation", 1)),
                parent_scopes=[
                    str(item)
                    for item in discovery_config.get(
                        "parent_scopes",
                        ["read:state", "write:state", "read:research", "write:research"],
                    )
                ],
                desired_replicas=int(discovery_config.get("desired_replicas", 4)),
                desired_revision=str(discovery_config.get("desired_revision") or "default-branch"),
                active_limit=int(discovery_config.get("active_limit", 50)),
            )
            targets.append(target)
            existing_hosts.add(grant.target_host)
            added_targets.append(grant.target_host)

    effective_config = {
        **base_config,
        "targets": targets,
    }
    effective_path = state_root / "discovery-effective-production-continuity-config.json"
    _write_json(effective_path, effective_config)

    federated_args = argparse.Namespace(
        repo_root=str(repo_root),
        state_dir=str(state_root),
        config=str(effective_path),
        remote_chain_state=args.remote_chain_state,
        deployment_authorities=args.deployment_authorities,
        output=args.output,
        probe_health=args.probe_health,
        dispatch_approved_deployments=args.dispatch_approved_deployments,
    )
    result = run_federated_continuity(federated_args)
    result["discovery_capability_continuity"] = {
        "enabled": discovery_enabled,
        "lease_artifact_present": leases_path.exists(),
        "accepted_count": len(accepted),
        "added_target_count": len(added_targets),
        "added_targets": sorted(added_targets),
        "accepted": accepted,
        "replication_authority": "active_exact_discovery_capability_lease",
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
        "--discovery-leases",
        default="automation/codegen/meta_state/discovery_capability_leases.json",
    )
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
    result = run(args)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
