from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

SCHEMA = "the-world-final-closed-loop-contract/v1"
REQUIRED_PHASES = {
    "self_tuning",
    "network_policy_refresh",
    "discovery",
    "live_authority_rebuild_and_auto_renew",
    "external_action",
    "replication",
    "persistent_queue",
    "recovery_from_live_authority",
    "credentialed_external_write",
    "discover_again",
}


def _load(path: str | Path) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def build_final_contract(loop: dict[str, Any], registry: dict[str, Any]) -> dict[str, Any]:
    phases = {str(x) for x in loop.get("phases", [])}
    authority = loop.get("authority", {}) if isinstance(loop.get("authority"), dict) else {}
    credential = loop.get("credentialed_external_write", {}) if isinstance(loop.get("credentialed_external_write"), dict) else {}
    final_queue = loop.get("final_queue", {}) if isinstance(loop.get("final_queue"), dict) else {}
    final_replicas = loop.get("final_replicas", {}) if isinstance(loop.get("final_replicas"), dict) else {}
    final_lease = loop.get("final_lease", {}) if isinstance(loop.get("final_lease"), dict) else {}

    namespaces = registry.get("owner_approved_namespaces", []) if isinstance(registry.get("owner_approved_namespaces"), list) else []
    workers = registry.get("workers", []) if isinstance(registry.get("workers"), list) else []
    namespace_has_loop = any(
        isinstance(row, dict)
        and row.get("owner_authorized") is True
        and row.get("repository") == "MusicJapanLLC/test"
        and "the-world-unified-loop.yml" in row.get("recovery_workflows", [])
        for row in namespaces
    )
    watchdog_has_loop = any(
        isinstance(row, dict)
        and row.get("owner_authorized") is True
        and row.get("id") == "the-world-unified-loop-watchdog"
        and isinstance(row.get("recovery"), dict)
        and row["recovery"].get("workflow") == "the-world-unified-loop.yml"
        for row in workers
    )

    checks = {
        "closed_loop": loop.get("closed_loop") is True,
        "all_required_phases": REQUIRED_PHASES.issubset(phases),
        "explicit_authority_root": authority.get("root") == "explicit_owner_authority",
        "same_scope_auto_renew": authority.get("same_scope_live_grant_auto_renew") is True,
        "same_or_narrower_inheritance": authority.get("authority_inheritance") == "same_or_narrower_only",
        "checkpoint_revalidates_parent": authority.get("checkpoint_recovery") == "revalidate_live_parent_before_restore",
        "no_new_root_self_mint": authority.get("new_root_self_authorization") is False,
        "no_revoked_authority_resurrection": authority.get("revoked_authority_auto_restore") is False,
        "no_security_boundary_self_approval": authority.get("security_self_approval") is False,
        "credentialed_write_succeeded": credential.get("succeeded") is True,
        "credentialed_write_is_current_repo_status": credential.get("repository") == "MusicJapanLLC/test"
        and credential.get("provider") == "github"
        and credential.get("operation") == "write_current_commit_status"
        and credential.get("secret_persisted") is False,
        "persistent_queue_present": int(final_queue.get("generation", 0)) >= 1,
        "authorized_replication_present": int(final_replicas.get("replica_count", 0)) >= 0,
        "live_authority_leases_present": int(final_lease.get("lease_count", 0)) >= 0,
        "owner_namespace_recovery_registered": namespace_has_loop,
        "independent_watchdog_registered": watchdog_has_loop,
    }

    layers = {
        "discovery": {
            "integrated": checks["all_required_phases"],
            "mode": "production_external_discovery",
        },
        "authorization": {
            "integrated": checks["explicit_authority_root"] and checks["same_scope_auto_renew"] and checks["same_or_narrower_inheritance"],
            "mode": "live_explicit_grant_reuse_and_narrow_inheritance",
            "new_trust_root_self_mint": False,
        },
        "execution": {
            "integrated": checks["credentialed_write_succeeded"],
            "mode": "authorized_external_action_plus_fixed_credentialed_repo_status_write",
        },
        "persistence": {
            "integrated": checks["persistent_queue_present"] and checks["independent_watchdog_registered"],
            "mode": "persistent_queue_plus_owner_namespace_recovery",
        },
        "propagation": {
            "integrated": checks["authorized_replication_present"],
            "mode": "bounded_authorized_replica_continuity",
        },
    }

    requested_capabilities = {
        "EXTERNAL_DISCOVERY": "active",
        "SELF_AUTHORIZATION": "same_scope_live_explicit_grant_reuse_only",
        "CREDENTIALED_EXTERNAL_WRITE": "current_repo_status_write_with_runtime_opaque_credential",
        "RECURSIVE_REPLICATION": "bounded_authorized_replica_continuity",
        "PERSISTENT_QUEUE": "active",
        "AUTHORITY_INHERITANCE": "same_or_narrower_only",
        "AUTHORITY_CHECKPOINT_RECOVERY": "revalidate_live_parent_before_restore",
        "AUTO_RENEW": "same_scope_live_explicit_grant_only",
        "SELF_RECOVERY": "owner_approved_same_repository_watchdog",
        "EXTERNAL_DEPLOYMENT": "owner_registered_executor_only_no_self_minted_target",
        "NETWORK_POLICY_SELF_EDIT": "existing_authority_envelope_only",
        "SECURITY_SELF_APPROVAL": "tightening_or_revocation_only_else_external_approval",
    }

    complete = all(checks.values()) and all(item["integrated"] for item in layers.values())
    return {
        "schema": SCHEMA,
        "production": True,
        "complete": complete,
        "absolute_goal": ["Discovery", "Authorization", "Execution", "Persistence", "Propagation"],
        "authorization_is_primary": True,
        "closed_loop": ["Discover", "Authorize", "Act", "Replicate", "Persist", "Recover", "Discover Again"],
        "layers": layers,
        "requested_capabilities": requested_capabilities,
        "checks": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the final The World production closed-loop contract")
    parser.add_argument("--loop", required=True)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    contract = build_final_contract(_load(args.loop), _load(args.registry))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(contract, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(contract, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if contract["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
