#!/usr/bin/env python3
"""Build a shared RED/Senju learning packet from verified live-range evidence.

This script never contacts the target. It only transforms evidence produced by the
existing bounded live test runner for the single authorized host.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any

AUTHORIZED_HOST = "kabeya-authorized-test-range.onrender.com"
SCHEMA = "red-senju-live-range-learning/v1"


def _load(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"expected object: {path}")
    return data


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True)
    ap.add_argument("--memory", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    report = _load(args.report)
    memory = _load(args.memory)

    if report.get("authorized_host") != AUTHORIZED_HOST:
        raise SystemExit("refusing evidence from any non-authorized host")
    if report.get("same_origin_only") is not True:
        raise SystemExit("same-origin invariant missing")
    if report.get("authority_self_expansion") is not False:
        raise SystemExit("authority expansion invariant violated")
    if report.get("destructive_requests") is not False:
        raise SystemExit("destructive request invariant violated")
    if report.get("credential_guessing") is not False:
        raise SystemExit("credential guessing invariant violated")
    if report.get("denial_of_service") is not False:
        raise SystemExit("DoS invariant violated")

    family_state = report.get("probe_family_state") or {}
    ranking = report.get("evolution", {}).get("next_family_ranking") or []
    counterexamples = report.get("counterexamples") or []

    observations = []
    for family in ranking:
        state = family_state.get(family) or {}
        observations.append(
            {
                "family": family,
                "score": state.get("score"),
                "attempts": state.get("attempts"),
                "interesting_hits": state.get("interesting_hits"),
                "hit_rate": state.get("hit_rate"),
                "failures": state.get("failures"),
                "last_reason": state.get("last_reason"),
            }
        )

    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    packet = {
        "schema": SCHEMA,
        "generated_at": now,
        "source": "senju-owned-range-active-evolution",
        "authorized_host": AUTHORIZED_HOST,
        "live_evidence": True,
        "simulation": False,
        "scope": {
            "same_origin_only": True,
            "authority_self_expansion": False,
            "destructive_requests": False,
            "credential_guessing": False,
            "denial_of_service": False,
            "persistence_on_target": False,
        },
        "run": {
            "request_count": report.get("request_count"),
            "pages_discovered": report.get("pages_discovered"),
            "forms_discovered": report.get("forms_discovered"),
            "write_attempts": report.get("write_attempts"),
            "counterexample_count": report.get("counterexample_count"),
            "evidence_digest": report.get("digest"),
            "memory_cycles": memory.get("cycles"),
        },
        "shared_with": ["RED", "Senju", "Security Society"],
        "learning": {
            "probe_ranking": observations,
            "counterexamples": counterexamples[:50],
            "senju_memory": memory,
            "recommended_use": [
                "bias future bounded probe selection toward empirically useful families",
                "retain exploration pressure so one family cannot permanently dominate",
                "promote repeatable counterexamples for defensive verification",
                "do not infer authorization for any host other than the exact authorized host",
            ],
        },
    }
    raw = json.dumps(packet, ensure_ascii=False, sort_keys=True).encode("utf-8")
    packet["packet_sha256"] = hashlib.sha256(raw).hexdigest()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SHARED_LIVE_RANGE_LEARNING host={AUTHORIZED_HOST} packet={packet['packet_sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
