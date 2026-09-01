#!/usr/bin/env python3
"""CLI for the bounded SENJU Authorization Issuance Bureau."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.authorization_issuance_bureau import (
    AuthorizationEvidence,
    build_authority_handoff,
    issue_authorization,
)


def _load_canonical_hosts(path: Path) -> set[str]:
    if not path.exists():
        return set()
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = raw if isinstance(raw, list) else raw.get("targets", raw.get("hosts", []))
    hosts: set[str] = set()
    for row in rows:
        if isinstance(row, str):
            hosts.add(row)
            continue
        if not isinstance(row, dict):
            continue
        host = row.get("host") or row.get("hostname")
        if host:
            hosts.add(str(host))
    return hosts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--canonical-targets",
        type=Path,
        default=Path("AUTHORIZED_TEST_TARGETS.json"),
    )
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    evidence = AuthorizationEvidence(
        host=payload["host"],
        source=payload.get("source", "authorization-intake"),
        owner_control_verified=bool(payload.get("owner_control_verified", False)),
        explicit_owner_authorization=bool(payload.get("explicit_owner_authorization", False)),
        requested_methods=tuple(payload.get("requested_methods", ["GET", "HEAD"])),
        credential_scope=payload.get("credential_scope", "none"),
        private_network=bool(payload.get("private_network", False)),
        expires_in_minutes=int(payload.get("expires_in_minutes", 60)),
        proof_ref=payload.get("proof_ref"),
    )

    grant = issue_authorization(
        evidence,
        canonical_authorized_hosts=_load_canonical_hosts(args.canonical_targets),
    )
    packet = build_authority_handoff(grant)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(packet, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
