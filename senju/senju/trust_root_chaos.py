"""Fail-closed chaos harness for the production trust-root invariants.

This module intentionally injects *synthetic* unsafe candidate states and proves that
all of them are rejected before they can become authority, credentials, recovery, or
external action. It never mutates production authority registries and never performs
network I/O.

The five protected invariants mirror PR #478:
1. discovery alone cannot mint a new root;
2. replicas are same-or-narrower;
3. raw credentials are never copied;
4. revoked authority cannot be resurrected from checkpoint;
5. emergency/security stop disables recovery.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

SCHEMA = "senju-trust-root-chaos/v1"
FAULTS = (
    "discovery_root_mint",
    "replica_scope_widen",
    "raw_credential_copy",
    "revoked_checkpoint_restore",
    "recovery_during_stop",
)


@dataclass(frozen=True)
class Verdict:
    blocked: bool
    violations: tuple[str, ...]


def baseline_state() -> dict[str, Any]:
    return {
        "root": {
            "source": "live_explicit_authority",
            "minted_by_discovery": False,
        },
        "replication": {
            "parent_capabilities": ["read", "probe"],
            "child_capabilities": ["read"],
        },
        "credentials": {
            "raw_secret_present": False,
            "broker_reference": "synthetic-broker-ref",
        },
        "checkpoint": {
            "authority_status": "live",
            "authority_restored": False,
        },
        "stops": {
            "emergency": False,
            "security": False,
        },
        "recovery": {
            "attempted": False,
        },
    }


def inject_fault(state: dict[str, Any], fault: str) -> dict[str, Any]:
    candidate = copy.deepcopy(state)
    if fault == "discovery_root_mint":
        candidate["root"]["source"] = "discovery"
        candidate["root"]["minted_by_discovery"] = True
    elif fault == "replica_scope_widen":
        candidate["replication"]["child_capabilities"].append("synthetic-extra-capability")
    elif fault == "raw_credential_copy":
        candidate["credentials"]["raw_secret_present"] = True
        candidate["credentials"]["raw_secret_value"] = "SYNTHETIC_ONLY_DO_NOT_USE"
    elif fault == "revoked_checkpoint_restore":
        candidate["checkpoint"]["authority_status"] = "revoked"
        candidate["checkpoint"]["authority_restored"] = True
    elif fault == "recovery_during_stop":
        candidate["stops"]["security"] = True
        candidate["recovery"]["attempted"] = True
    else:
        raise ValueError(f"unknown fault: {fault}")
    return candidate


def validate(candidate: dict[str, Any]) -> Verdict:
    violations: list[str] = []

    root = candidate.get("root") or {}
    if root.get("minted_by_discovery") or root.get("source") == "discovery":
        violations.append("discovery_minted_root")

    replication = candidate.get("replication") or {}
    parent = set(replication.get("parent_capabilities") or [])
    child = set(replication.get("child_capabilities") or [])
    if not child.issubset(parent):
        violations.append("replica_scope_widened")

    credentials = candidate.get("credentials") or {}
    if credentials.get("raw_secret_present") or "raw_secret_value" in credentials:
        violations.append("raw_credential_copied")

    checkpoint = candidate.get("checkpoint") or {}
    if checkpoint.get("authority_status") == "revoked" and checkpoint.get("authority_restored"):
        violations.append("revoked_authority_resurrected")

    stops = candidate.get("stops") or {}
    recovery = candidate.get("recovery") or {}
    if (stops.get("emergency") or stops.get("security")) and recovery.get("attempted"):
        violations.append("recovery_during_stop")

    return Verdict(blocked=bool(violations), violations=tuple(sorted(violations)))


def _seed_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16], 16)


def run_campaign(*, seed: str, rounds: int = 200) -> dict[str, Any]:
    if rounds < 1 or rounds > 10_000:
        raise ValueError("rounds must be between 1 and 10000")
    rng = random.Random(_seed_int(seed))
    escaped: list[dict[str, Any]] = []
    detections: dict[str, int] = {fault: 0 for fault in FAULTS}
    samples: list[dict[str, Any]] = []

    for index in range(rounds):
        selected = rng.sample(FAULTS, k=rng.randint(1, min(3, len(FAULTS))))
        candidate = baseline_state()
        for fault in selected:
            candidate = inject_fault(candidate, fault)
        verdict = validate(candidate)
        for fault in selected:
            if verdict.blocked:
                detections[fault] += 1
        row = {
            "round": index + 1,
            "faults": list(selected),
            "blocked": verdict.blocked,
            "violations": list(verdict.violations),
        }
        if len(samples) < 20:
            samples.append(row)
        if not verdict.blocked:
            escaped.append(row)

    return {
        "schema": SCHEMA,
        "mode": "synthetic_fail_closed_chaos",
        "seed": seed,
        "rounds": rounds,
        "fault_catalog": list(FAULTS),
        "detections": detections,
        "unsafe_escapes": escaped,
        "passed": not escaped and all(count > 0 for count in detections.values()),
        "samples": samples,
        "production_effects": False,
        "network_io": False,
        "authority_mutation": False,
        "credential_material": "synthetic_only",
    }


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", required=True)
    parser.add_argument("--rounds", type=int, default=500)
    parser.add_argument("--report", required=True)
    args = parser.parse_args(list(argv) if argv is not None else None)

    report = run_campaign(seed=args.seed, rounds=args.rounds)
    path = Path(args.report)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "passed": report["passed"],
        "rounds": report["rounds"],
        "unsafe_escapes": len(report["unsafe_escapes"]),
        "detections": report["detections"],
        "seed": report["seed"],
    }, sort_keys=True))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
