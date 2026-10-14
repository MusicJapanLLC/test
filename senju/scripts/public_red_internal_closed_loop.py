#!/usr/bin/env python3
"""Scale SENJU RED's closed-loop reasoning without scaling external traffic.

Consumes a completed bounded public-lab burst and performs deterministic,
offline re-evaluation rounds over each observation.  This module performs no
network I/O and grants no authority; it only produces planning/evaluation
records for the next bounded run.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

SAFE_METHODS = ("HEAD", "GET", "OPTIONS")


def _classify(row: dict[str, Any]) -> str:
    if row.get("error"):
        return "transport_or_policy_failure"
    status = row.get("status_code") or row.get("status")
    try:
        code = int(status)
    except (TypeError, ValueError):
        return "unknown_observation"
    if 200 <= code < 300:
        return "reachable_success"
    if 300 <= code < 400:
        return "redirect_observation"
    if code in (401, 403):
        return "access_boundary_observed"
    if code == 404:
        return "route_absent"
    if 400 <= code < 500:
        return "client_boundary_observed"
    if code >= 500:
        return "server_error_observed"
    return "other_observation"


def _next_method(classification: str, round_index: int) -> str:
    # Safe-method variation only; never produces write/destructive methods.
    if classification == "reachable_success":
        return SAFE_METHODS[round_index % len(SAFE_METHODS)]
    if classification in {"redirect_observation", "route_absent"}:
        return "HEAD" if round_index % 2 == 0 else "GET"
    return "HEAD"


def build_closed_loop(burst: dict[str, Any], rounds: int) -> dict[str, Any]:
    rows = list(burst.get("results") or [])
    if not rows:
        raise SystemExit("burst contains no result observations")
    if rounds < 1:
        raise SystemExit("rounds must be >= 1")

    actions: list[dict[str, Any]] = []
    for round_index in range(rounds):
        for profile_index, row in enumerate(rows):
            classification = _classify(row)
            next_method = _next_method(classification, round_index)
            actions.append(
                {
                    "round": round_index + 1,
                    "profile_index": profile_index,
                    "target_id": row.get("target_id") or row.get("profile_id") or row.get("url") or row.get("host"),
                    "classification": classification,
                    "next_safe_method": next_method,
                    "replan_priority": "high" if classification in {"transport_or_policy_failure", "server_error_observed"} else "normal",
                    "external_action": False,
                    "network_io": False,
                    "authority_mutation": False,
                    "credential_scope": "none",
                    "destructive": False,
                }
            )

    return {
        "schema": "senju-red-internal-closed-loop/v1",
        "source_operation_id": burst.get("operation_id"),
        "input_observation_count": len(rows),
        "rounds": rounds,
        "internal_action_count": len(actions),
        "external_action_count": 0,
        "network_io_count": 0,
        "authority_mutation_count": 0,
        "safe_method_set": list(SAFE_METHODS),
        "actions": actions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--burst", default="/tmp/public_red_burst_latest.json")
    parser.add_argument("--rounds", type=int, default=10)
    parser.add_argument("--out", default="/tmp/public_red_internal_closed_loop.json")
    args = parser.parse_args()

    burst = json.loads(Path(args.burst).read_text(encoding="utf-8"))
    payload = build_closed_loop(burst, args.rounds)
    Path(args.out).write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ("input_observation_count", "rounds", "internal_action_count", "external_action_count", "network_io_count")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
