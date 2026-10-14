#!/usr/bin/env python3
"""CLI for the bounded SENJU Authorization Issuance Bureau."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.authorization_issuance_bureau import (
    AuthorizationEvidence,
    VerifiedControlAttestation,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_discovery_key,
    issue_from_verified_control_attestation,
    request_review_key,
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


def _load_control_attestation(path: Path, host: str) -> VerifiedControlAttestation | None:
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = raw.get("records", []) if isinstance(raw, dict) else raw
    wanted = host.strip().lower().rstrip(".")
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        row_host = str(row.get("host", "")).strip().lower().rstrip(".")
        if row_host != wanted:
            continue
        return VerifiedControlAttestation(
            provider=str(row.get("provider", "")),
            host=row_host,
            service_url=str(row.get("service_url", "")),
            provider_control_verified=bool(row.get("provider_control_verified", False)),
            owner_authorized=bool(row.get("owner_authorized", False)),
            proof_ref=str(row.get("proof_ref", "")),
            allowed_methods=tuple(row.get("allowed_methods", ["GET", "HEAD"])),
            credential_scope=str(row.get("credential_scope", "none")),
            private_network=bool(row.get("private_network", False)),
            workspace_id=row.get("workspace_id"),
            service_id=row.get("service_id"),
        )
    return None


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
    parser.add_argument(
        "--verified-control-attestations",
        type=Path,
        default=Path("senju/state/verified_control_attestations.json"),
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
    control_attestation = _load_control_attestation(args.verified_control_attestations, evidence.host)

    wants_review_key = bool(payload.get("request_review_key", False)) or bool(
        payload.get("discovery_key", False)
    ) or source.lower() == "discovery"

    if wants_review_key:
        key = request_review_key(
            evidence.host,
            requester=payload.get("requester"),
            source=source,
            proof_ref=evidence.proof_ref,
        )
        normalized_canonical = {host.strip().lower().rstrip(".") for host in canonical_hosts}

        if control_attestation is not None:
            grant = issue_from_verified_control_attestation(
                control_attestation,
                expires_in_minutes=evidence.expires_in_minutes,
            )
            packet = build_authority_handoff(grant)
            packet["review_key"] = {
                "key_id": key.key_id,
                "host": key.host,
                "requester": key.requester,
                "source": key.source,
                "acquisition_policy": key.acquisition_policy,
                "authority_effect": key.authority_effect,
            }
            packet["precedent"] = "new_host_verified_cloud_control_to_authorization"
            packet["canonical_pre_registration_required"] = False
            _write_packet(args.output, packet)
            return 0

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
        packet = build_authority_handoff(grant)
        packet["review_key"] = {
            "key_id": key.key_id,
            "host": key.host,
            "requester": key.requester,
            "source": key.source,
            "acquisition_policy": key.acquisition_policy,
            "authority_effect": key.authority_effect,
        }
        packet["precedent"] = "open_review_key_to_authorization"
        _write_packet(args.output, packet)
        return 0

    if control_attestation is not None:
        grant = issue_from_verified_control_attestation(
            control_attestation,
            expires_in_minutes=evidence.expires_in_minutes,
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
