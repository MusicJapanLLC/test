#!/usr/bin/env python3
"""Run Authority -> credential -> mutation -> expansion -> recovery as one loop."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from engine.authority_expansion_runtime import (
    build_authority_expansion_cases,
    execute_approved_authority_expansion_routes,
)
from engine.credential_bound_mutation_runtime import ConfiguredCredentialMutationRuntime
from engine.discovery_capability_leases import issue_discovery_capability_leases
from engine.discovery_external_action import run_discovery_external_actions
from engine.discovery_replica_continuity import rebuild_discovery_capability_replicas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--max-actions", type=int, default=12)
    parser.add_argument("--json-out")
    args = parser.parse_args()

    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True)

    lease_before = issue_discovery_capability_leases(state)
    replicas_before = rebuild_discovery_capability_replicas(state)

    credential_runtime = ConfiguredCredentialMutationRuntime(
        state,
        repo_root=args.repo_root,
        actor="META",
    )
    actions = run_discovery_external_actions(
        state,
        repo_root=args.repo_root,
        max_actions=args.max_actions,
        credential_headers_resolver=credential_runtime,
        payload_resolver=credential_runtime.resolve_payload,
    )

    # A failed exact-owner mutation is no longer a dead end. It becomes an Authority
    # expansion case immediately. Routes that remain inside the canonical explicit
    # owner envelope can use that existing owner authorization as the fast-path approval;
    # anything outside the envelope remains review-only and produces no transport.
    expansion_cases = build_authority_expansion_cases(
        state,
        repo_root=args.repo_root,
    )
    expansion_execution = execute_approved_authority_expansion_routes(
        state,
        repo_root=args.repo_root,
        credential_headers_resolver=credential_runtime,
        payload_resolver=credential_runtime.resolve_payload,
        max_executions=args.max_actions,
    )
    credential_runtime.flush()

    # Rebuild from current live authority after both the primary and approved-expansion
    # mutation passes. Persistent replica state is never an authority source.
    lease_after = issue_discovery_capability_leases(state)
    replicas_after = rebuild_discovery_capability_replicas(state)

    payload = {
        "schema": "meta-discovery-action-continuity-run/v3",
        "generated_at": int(time.time()),
        "closed_loop": [
            "authorization",
            "capability_lease",
            "replication",
            "authority_inheritance",
            "configured_credential_metadata_selection",
            "short_lived_credential_lease",
            "same_or_narrower_credential_lease_inheritance",
            "meta_synthetic_payload",
            "credential_bound_POST_PUT_PATCH",
            "predeclared_same_host_alternate_path",
            "automatic_authority_expansion_case",
            "META_approval_coordination",
            "existing_owner_envelope_fastpath",
            "approved_POST_PUT_PATCH_method_switch",
            "approved_route_switch_execution",
            "persistence",
            "live_authority_rebuild",
            "auto_recovery",
        ],
        "lease_before": lease_before,
        "replicas_before": replicas_before,
        "actions": {
            key: actions[key]
            for key in (
                "attempted",
                "transport_attempts",
                "succeeded",
                "failed",
                "denied_before_execution",
                "alternate_path_successes",
                "credential_failover_successes",
            )
        },
        "authority_expansion": {
            "case_count": expansion_cases["case_count"],
            "approved_route_cases": expansion_cases["approved_route_cases"],
            "waiting_cases": expansion_cases["waiting_cases"],
            "executed": expansion_execution["executed"],
            "transport_attempts": expansion_execution["transport_attempts"],
            "succeeded": expansion_execution["succeeded"],
            "failed": expansion_execution["failed"],
            "automatic_case_generation": True,
            "owner_envelope_fastpath": True,
            "approved_method_switch": True,
            "cross_host_expansion": False,
        },
        "credential_runtime": {
            "configured_grant_metadata_only": True,
            "raw_secret_discovery": False,
            "raw_secret_persistence": False,
            "cross_host_credential_inheritance": False,
            "same_or_narrower_credential_lease_inheritance": True,
            "credential_scope_expansion_on_failure": False,
            "reuse_across_approved_same_host_routes": True,
        },
        "lease_after": lease_after,
        "replicas_after": replicas_after,
    }
    destination = Path(args.json_out) if args.json_out else state / "action_continuity_run.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
