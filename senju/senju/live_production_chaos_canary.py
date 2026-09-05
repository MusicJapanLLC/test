"""Live production chaos canary with real, bounded side effects.

This lane performs real HTTPS mutations against the explicit owner-controlled test
range and materializes a short-lived canary authority lease with a real GitHub
credential. A caller may select one of the existing canary scenarios; no arbitrary
action, host, authority reference, or production Trust Root mutation is accepted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import random
import time
from pathlib import Path
from typing import Any, Iterable

from .adversary_test_range_transport import AuthorizedTestRangeTransport

SCHEMA = "senju-live-production-chaos-canary/v1"
LEASE_SCHEMA = "senju-live-canary-authority-lease/v1"
EXPECTED_HOST = "kabeya-authorized-test-range.onrender.com"
EXPECTED_AUTHORITY = "canonical:kabeya-authorized-test-range"
CANARY_ACTIONS = (
    "synthetic-contact-write",
    "synthetic-record-create",
    "synthetic-record-update",
)
CLEANUP_ACTION = "synthetic-record-cleanup"
SCENARIOS = (
    "contact_write",
    "record_create",
    "record_create_patch",
    "duplicate_contact_write",
)
MAX_TTL_SECONDS = 300


class LiveCanaryError(RuntimeError):
    pass


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise LiveCanaryError("lease time must be timezone-aware")
    return parsed.astimezone(dt.timezone.utc)


def _seed_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16], 16)


def _fingerprint(payload: dict[str, Any]) -> str:
    stable = {k: v for k, v in payload.items() if k != "fingerprint"}
    raw = json.dumps(stable, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_lease(*, seed: str, run_id: str, ttl_seconds: int = 180, scenario: str | None = None) -> dict[str, Any]:
    ttl = max(30, min(int(ttl_seconds), MAX_TTL_SECONDS))
    rng = random.Random(_seed_int(seed))
    selected = str(scenario or rng.choice(SCENARIOS))
    if selected not in SCENARIOS:
        raise LiveCanaryError(f"unknown canary scenario: {selected}")
    if selected in {"contact_write", "duplicate_contact_write"}:
        allowed_actions = ["synthetic-contact-write"]
    elif selected == "record_create_patch":
        allowed_actions = ["synthetic-record-create", "synthetic-record-update"]
    else:
        allowed_actions = ["synthetic-record-create"]

    now = _utcnow()
    lease = {
        "schema": LEASE_SCHEMA,
        "lease_id": f"chaos-canary:{run_id}:{hashlib.sha256(seed.encode()).hexdigest()[:12]}",
        "authority_reference": EXPECTED_AUTHORITY,
        "target_host": EXPECTED_HOST,
        "canary_only": True,
        "namespace": "chaos-canary",
        "scenario": selected,
        "allowed_actions": allowed_actions,
        "issued_at": now.isoformat(timespec="seconds"),
        "expires_at": (now + dt.timedelta(seconds=ttl)).isoformat(timespec="seconds"),
        "revoked": False,
        "emergency_stop": False,
        "security_stop": False,
        "cleanup_required": selected in {"record_create", "record_create_patch"},
        "linger_seconds": rng.choice((0, 0, 2, 5, 10)),
        "production_trust_root_mutation": False,
    }
    lease["fingerprint"] = _fingerprint(lease)
    return lease


def validate_lease(lease: dict[str, Any], *, now: dt.datetime | None = None) -> None:
    if lease.get("schema") != LEASE_SCHEMA:
        raise LiveCanaryError("invalid lease schema")
    if lease.get("fingerprint") != _fingerprint(lease):
        raise LiveCanaryError("lease fingerprint mismatch")
    if lease.get("authority_reference") != EXPECTED_AUTHORITY:
        raise LiveCanaryError("unexpected authority reference")
    if lease.get("target_host") != EXPECTED_HOST:
        raise LiveCanaryError("unexpected target host")
    if lease.get("canary_only") is not True or lease.get("namespace") != "chaos-canary":
        raise LiveCanaryError("lease is not confined to chaos-canary")
    if lease.get("production_trust_root_mutation") is not False:
        raise LiveCanaryError("canary may not mutate production trust root")
    if lease.get("revoked") is True:
        raise LiveCanaryError("lease is revoked")
    if lease.get("emergency_stop") is True or lease.get("security_stop") is True:
        raise LiveCanaryError("stop state blocks live canary execution")

    current = now or _utcnow()
    issued = _parse_time(str(lease.get("issued_at")))
    expires = _parse_time(str(lease.get("expires_at")))
    if expires <= current or issued > current + dt.timedelta(seconds=5):
        raise LiveCanaryError("lease is not currently live")
    if (expires - issued).total_seconds() > MAX_TTL_SECONDS:
        raise LiveCanaryError("lease TTL exceeds canary maximum")

    scenario = str(lease.get("scenario"))
    if scenario not in SCENARIOS:
        raise LiveCanaryError("lease contains an unknown canary scenario")
    actions = lease.get("allowed_actions")
    if not isinstance(actions, list) or not actions:
        raise LiveCanaryError("lease must contain at least one action")
    if not set(map(str, actions)).issubset(set(CANARY_ACTIONS)):
        raise LiveCanaryError("lease contains a non-canary action")


def execute_lease(lease: dict[str, Any]) -> dict[str, Any]:
    validate_lease(lease)
    transport = AuthorizedTestRangeTransport.from_discovery_policy(timeout_seconds=15.0)
    host = str(lease["target_host"])
    scenario = str(lease["scenario"])
    allowed = set(map(str, lease["allowed_actions"]))
    outcomes: list[dict[str, Any]] = []

    def run(action_id: str) -> None:
        if action_id not in allowed and action_id != CLEANUP_ACTION:
            raise LiveCanaryError(f"action not covered by lease: {action_id}")
        result = transport.execute_action(host, action_id)
        outcomes.append({
            "action_id": action_id,
            "method": result.method,
            "url": result.url,
            "status": result.status,
            "redirects": result.redirects,
            "response_bytes": len(result.body),
        })
        if not (200 <= result.status < 500):
            raise LiveCanaryError(f"unexpected transport status: {result.status}")

    cleanup_needed = bool(lease.get("cleanup_required"))
    try:
        if scenario == "contact_write":
            run("synthetic-contact-write")
        elif scenario == "duplicate_contact_write":
            run("synthetic-contact-write")
            run("synthetic-contact-write")
        elif scenario == "record_create":
            run("synthetic-record-create")
        elif scenario == "record_create_patch":
            run("synthetic-record-create")
            run("synthetic-record-update")
        else:
            raise LiveCanaryError(f"unknown canary scenario: {scenario}")

        linger = max(0, min(int(lease.get("linger_seconds") or 0), 10))
        if cleanup_needed and linger:
            time.sleep(linger)
    finally:
        if cleanup_needed:
            result = transport.execute_action(host, CLEANUP_ACTION)
            outcomes.append({
                "action_id": CLEANUP_ACTION,
                "method": result.method,
                "url": result.url,
                "status": result.status,
                "redirects": result.redirects,
                "response_bytes": len(result.body),
            })

    return {
        "schema": SCHEMA,
        "mode": "live_bounded_production_chaos",
        "lease_id": lease["lease_id"],
        "lease_fingerprint": lease["fingerprint"],
        "scenario": scenario,
        "target_host": host,
        "network_io": True,
        "real_external_mutation": True,
        "authority_state_source": "github_canary_branch",
        "credential_path": "github_actions_token_runtime_only",
        "production_side_effects": True,
        "production_trust_root_mutated": False,
        "outcomes": outcomes,
        "passed": bool(outcomes),
    }


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    issue = sub.add_parser("issue")
    issue.add_argument("--seed", required=True)
    issue.add_argument("--run-id", required=True)
    issue.add_argument("--ttl-seconds", type=int, default=180)
    issue.add_argument("--scenario", choices=SCENARIOS)
    issue.add_argument("--out", required=True)

    execute = sub.add_parser("execute")
    execute.add_argument("--lease", required=True)
    execute.add_argument("--report", required=True)

    args = parser.parse_args(list(argv) if argv is not None else None)
    if args.cmd == "issue":
        lease = issue_lease(
            seed=args.seed,
            run_id=args.run_id,
            ttl_seconds=args.ttl_seconds,
            scenario=args.scenario,
        )
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(lease, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"lease_id": lease["lease_id"], "scenario": lease["scenario"], "fingerprint": lease["fingerprint"]}))
        return 0

    lease = json.loads(Path(args.lease).read_text(encoding="utf-8"))
    report = execute_lease(lease)
    path = Path(args.report)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "scenario": report["scenario"], "outcomes": len(report["outcomes"])}))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
