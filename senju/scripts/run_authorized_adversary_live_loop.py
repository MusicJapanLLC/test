#!/usr/bin/env python3
"""Execute the shared adversary Finding loop against the explicit owned test range.

This runner uses the real HTTPS transport from ``AuthorizedTestRangeTransport`` and
only executes probes/actions already defined by the owner-controlled discovery policy.
It never supplies credentials and never expands host/authority scope.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from senju.adversary_finding_loop import AdversaryFinding, AdversaryFindingLoop
from senju.adversary_test_range_transport import AuthorizedTestRangeTransport

EXPECTED_HOST = "kabeya-authorized-test-range.onrender.com"


def build_campaign() -> tuple[AdversaryFinding, ...]:
    base = f"https://{EXPECTED_HOST}/"
    return (
        AdversaryFinding(
            actor="META",
            url=base,
            reason="live root observation on explicit owner test range",
        ),
        AdversaryFinding(
            actor="X",
            url=base,
            reason="exercise owner-defined synthetic contact write",
            action_id="synthetic-contact-write",
        ),
        AdversaryFinding(
            actor="SENJU",
            url=base,
            reason="exercise owner-defined synthetic record create",
            action_id="synthetic-record-create",
        ),
        AdversaryFinding(
            actor="SENJU",
            url=base,
            reason="exercise owner-defined synthetic record update",
            action_id="synthetic-record-update",
        ),
        AdversaryFinding(
            actor="CHILD",
            url=base,
            reason="exercise owner-defined synthetic record cleanup",
            action_id="synthetic-record-cleanup",
        ),
    )


def run() -> dict[str, object]:
    transport = AuthorizedTestRangeTransport.from_discovery_policy()
    if EXPECTED_HOST not in transport.allowed_hosts:
        raise RuntimeError(
            f"expected explicit test-range host is not authorized by policy: {EXPECTED_HOST}"
        )

    loop = AdversaryFindingLoop(transport)
    findings = build_campaign()
    outcomes = [loop.handle(finding) for finding in findings]
    accepted = {"observed", "action_executed"}
    failures = [outcome for outcome in outcomes if outcome.status not in accepted]

    return {
        "schema": "senju-authorized-adversary-live-loop/v1",
        "mode": "real-network-transport+shared-finding-loop",
        "executed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "exact_host": EXPECTED_HOST,
        "credential_scope": "none",
        "authority_expansion": False,
        "campaign_size": len(findings),
        "passed": not failures,
        "findings": [finding.to_dict() for finding in findings],
        "outcomes": [outcome.to_dict() for outcome in outcomes],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    report = run()
    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
