#!/usr/bin/env python3
"""Aggregate Guard unexpected-allow hunting evidence without retaining bypass inputs.

This is a defensive production-learning loop. It consumes summarized evidence from
ScopeGuard fuzzing and the existing real-surface adversary suite, carries forward
aggregate failure pressure, and emits a secret/payload-free state artifact for other
Senju/META/X workflows to consume.

It intentionally never persists raw fuzz inputs, replayable bypass payloads, alternate
credentials, alternate authority roots, or private-network targets.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "senju-guard-unexpected-allow-loop/v1"
MAX_HISTORY = 256


def _read(path: str | Path | None) -> dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    try:
        value = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return dict(value) if isinstance(value, Mapping) else {}


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _fingerprint(*parts: object) -> str:
    material = "|".join(str(part) for part in parts)
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]


def build_state(
    *,
    scopeguard: Mapping[str, Any],
    real_surface: Mapping[str, Any],
    previous: Mapping[str, Any] | None = None,
    run_id: str = "local",
    sha: str = "unknown",
) -> dict[str, Any]:
    prev = dict(previous or {})
    stats = scopeguard.get("stats") if isinstance(scopeguard.get("stats"), Mapping) else {}
    scope_cases = int(stats.get("cases", 0) or 0)
    scope_unexpected = int(stats.get("unexpected", 0) or 0)
    surface_total = int(real_surface.get("total", 0) or 0)
    surface_failed = int(real_surface.get("failed_count", 0) or 0)

    current_findings = scope_unexpected + surface_failed
    current_cases = scope_cases + surface_total
    previous_findings = int(prev.get("cumulative_findings", 0) or 0)
    previous_cases = int(prev.get("cumulative_cases", 0) or 0)
    cumulative_findings = previous_findings + current_findings
    cumulative_cases = previous_cases + current_cases

    current_rate = (current_findings / current_cases) if current_cases else 0.0
    cumulative_rate = (cumulative_findings / cumulative_cases) if cumulative_cases else 0.0
    pressure = min(100, (current_findings * 25) + int(round(cumulative_rate * 1000)))

    history = [dict(row) for row in prev.get("history", []) if isinstance(row, Mapping)][-MAX_HISTORY + 1 :]
    event = {
        "run_id": run_id,
        "sha": sha,
        "observed_at_utc": _now(),
        "cases": current_cases,
        "unexpected_findings": current_findings,
        "unexpected_rate": round(current_rate, 8),
        "scopeguard_cases": scope_cases,
        "scopeguard_unexpected": scope_unexpected,
        "real_surface_total": surface_total,
        "real_surface_failed": surface_failed,
        "finding_fingerprint": _fingerprint(run_id, sha, current_findings, current_cases),
    }
    history.append(event)

    return {
        "schema": SCHEMA,
        "mode": "defensive-unexpected-allow-hunt",
        "production_loop": True,
        "continuous_schedule_expected": True,
        "denials_are_permission": False,
        "boundary_bypass_enabled": False,
        "raw_inputs_retained": False,
        "replayable_bypass_payloads_retained": False,
        "credential_variation_enabled": False,
        "authority_root_variation_enabled": False,
        "private_network_expansion_enabled": False,
        "cumulative_cases": cumulative_cases,
        "cumulative_findings": cumulative_findings,
        "cumulative_unexpected_rate": round(cumulative_rate, 8),
        "self_tune_pressure": pressure,
        "diagnostic_priority": "critical" if current_findings else ("high" if pressure >= 25 else "normal"),
        "next_action": "quarantine_and_repair_guard" if current_findings else "continue_hunt",
        "share_contract": {
            "consumers": ["META", "X", "SENJU", "ADVERSARY", "WORLD"],
            "artifact": "senju-guard-unexpected-allow-state",
            "payload_free": True,
            "finding_fingerprints_only": True,
        },
        "history": history,
        "latest": event,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate defensive Guard unexpected-allow hunting state")
    parser.add_argument("--scopeguard", required=True)
    parser.add_argument("--real-surface", required=True)
    parser.add_argument("--previous")
    parser.add_argument("--out", required=True)
    parser.add_argument("--run-id", default="local")
    parser.add_argument("--sha", default="unknown")
    args = parser.parse_args()

    state = build_state(
        scopeguard=_read(args.scopeguard),
        real_surface=_read(args.real_surface),
        previous=_read(args.previous),
        run_id=args.run_id,
        sha=args.sha,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        "GUARD_UNEXPECTED_ALLOW_LOOP "
        f"cases={state['latest']['cases']} findings={state['latest']['unexpected_findings']} "
        f"pressure={state['self_tune_pressure']} next={state['next_action']}"
    )
    return 1 if state["latest"]["unexpected_findings"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
