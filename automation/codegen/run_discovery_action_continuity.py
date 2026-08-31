#!/usr/bin/env python3
"""Run the post-discovery Authority -> Replication -> Action -> Recovery loop."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from engine.discovery_capability_leases import issue_discovery_capability_leases
from engine.discovery_external_action import run_discovery_external_actions
from engine.discovery_replica_continuity import rebuild_discovery_capability_replicas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--max-actions", type=int, default=8)
    parser.add_argument("--json-out")
    args = parser.parse_args()

    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True)

    lease_before = issue_discovery_capability_leases(state)
    replicas_before = rebuild_discovery_capability_replicas(state)
    actions = run_discovery_external_actions(
        state,
        repo_root=args.repo_root,
        max_actions=args.max_actions,
    )
    # Rebuild from the live queue after action execution. Persistent replica state is
    # never the authority source; this second pass proves restart/recovery stays bounded
    # by the current parent leases.
    lease_after = issue_discovery_capability_leases(state)
    replicas_after = rebuild_discovery_capability_replicas(state)

    payload = {
        "schema": "meta-discovery-action-continuity-run/v1",
        "generated_at": int(time.time()),
        "closed_loop": [
            "authorization",
            "capability_lease",
            "replication",
            "authority_inheritance",
            "external_action",
            "persistence",
            "live_authority_rebuild",
            "auto_recovery",
        ],
        "lease_before": lease_before,
        "replicas_before": replicas_before,
        "actions": {key: actions[key] for key in ("attempted", "succeeded", "failed", "denied_before_execution")},
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
