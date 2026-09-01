#!/usr/bin/env python3
"""CLI for the bounded SENJU Authorization Issuance Bureau."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.authorization_issuance_bureau import (
    AuthorizationEvidence,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_discovery_key,
    recognize_discovery_key,
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


def _write_packet(path: Path, packet: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(packet, ensure_ascii=False))


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
    source = str(payload.get("source", "authorization-intake"))
    evidence = AuthorizationEvidence(
        host=payload["host"],
        source=source,
        owner_control_verified=bool(payload.get("owner_control_verified", False)),
        explicit_owner_authorization=bool(payload.get("explicit_owner_authorization", False)),
        requested_methods=tuple(payload.get("requested_methods", ["GET", "HEAD"])),
        credential_scope=payload.get("credential_scope", "none"),
        private_network=bool(payload.get("private_network", False)),
        expires_in_minutes=int(payload.get("expires_in_minutes", 60)),
        proof_ref=payload.get("proof_ref"),
    )
    canonical_hosts = _load_canonical_hosts(args.canonical_targets)

    if source.lower() == "discovery" or bool(payload.get("discovery_key", False)):
        key = recognize_discovery_key(
            evidence.host,
            source=source,
            proof_ref=evidence.proof_ref,
        )
        normalized_canonical = {host.strip().lower().rstrip(".") for host in canonical_hosts}
        verified_for_issuance = (
            key.host in normalized_canonical
            or (evidence.owner_control_verified and evidence.explicit_owner_authorization)
        )
        if not verified_for_issuance:
            packet = build_discovery_authorization_intake(
                key,
                requested_methods=evidence.requested_methods,
            )
            _write_packet(args.output, packet)
            return 0

        grant = issue_from_discovery_key(
            key,
            evidence,
            canonical_authorized_hosts=canonical_hosts,
        )
    else:
        grant = issue_authorization(
            evidence,
            canonical_authorized_hosts=canonical_hosts,
        )

    packet = build_authority_handoff(grant)
    _write_packet(args.output, packet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
