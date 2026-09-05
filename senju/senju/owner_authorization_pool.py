"""Maintain a closed-loop pool of bounded Authorization grants for owner-controlled assets.

The pool manager consumes only:
- exact canonical targets carrying explicit authorization; and
- cloud-control attestations already verified from a connected Render/Vercel account
  and explicitly authorized by the owner.

It never turns discovery, negotiation, AI consensus, or an unrelated third-party
hostname into Authorization. The output is intentionally compatible with the
existing Authority Promotion Bureau through a reviewed operational lease file.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

from .authorization_issuance_bureau import (
    AuthorizationEvidence,
    VerifiedControlAttestation,
    build_authority_handoff,
    issue_authorization,
    issue_from_verified_control_attestation,
)

SCHEMA = "senju-owner-authorization-pool/v1"
LEASE_SCHEMA = "senju-reviewed-authority-operational-leases/v1"
HANDOFF_SCHEMA = "senju-owner-authorization-pool-handoffs/v1"
SAFE_METHODS = frozenset({"GET", "HEAD"})
DEFAULT_TARGET = 50
DEFAULT_TTL_MINUTES = 24 * 60
DEFAULT_RENEW_BEFORE_MINUTES = 60


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _host(value: Any) -> str:
    return str(value or "").strip().lower().rstrip(".")


def _methods(values: Any) -> tuple[str, ...]:
    rows = values if isinstance(values, list) else []
    methods = tuple(sorted({str(v).strip().upper() for v in rows} & SAFE_METHODS))
    return methods or ("GET", "HEAD")


def _canonical_candidates(path: Path) -> tuple[set[str], list[dict[str, Any]]]:
    doc = _load(path, {})
    rows = doc.get("targets", []) if isinstance(doc, Mapping) else []
    canonical_hosts: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if not host or str(row.get("owner_authorization", "")).strip().lower() != "explicit":
            continue
        canonical_hosts.add(host)
        out.append(
            {
                "host": host,
                "source_kind": "canonical",
                "provider": None,
                "proof_ref": str(
                    row.get("authorization_evidence_url")
                    or row.get("scope_url")
                    or row.get("id")
                    or host
                ),
                "allowed_methods": list(_methods(row.get("allowed_interactions"))),
                "credential_scope": "none",
                "private_network": False,
                "lifecycle_state": "canonical",
                "transport_eligible": True,
                "service_url": str(row.get("base_url") or f"https://{host}"),
                "workspace_id": None,
                "service_id": None,
            }
        )
    return canonical_hosts, out


def _attested_candidates(path: Path) -> list[dict[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("records", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if not host:
            continue
        if row.get("provider_control_verified") is not True or row.get("owner_authorized") is not True:
            continue
        if row.get("private_network") is True:
            continue
        if str(row.get("credential_scope", "none")).strip().lower() != "none":
            continue
        proof_ref = str(row.get("proof_ref") or "").strip()
        if not proof_ref:
            continue
        out.append(
            {
                "host": host,
                "source_kind": "verified_cloud_control",
                "provider": str(row.get("provider") or "").strip().lower(),
                "proof_ref": proof_ref,
                "allowed_methods": list(_methods(row.get("allowed_methods"))),
                "credential_scope": "none",
                "private_network": False,
                "lifecycle_state": str(row.get("lifecycle_state") or "verified"),
                "transport_eligible": row.get("transport_eligible") is True,
                "service_url": str(row.get("service_url") or f"https://{host}"),
                "workspace_id": str(row.get("workspace_id")) if row.get("workspace_id") else None,
                "service_id": str(row.get("service_id")) if row.get("service_id") else None,
            }
        )
    return out


def _dedupe(canonical: list[dict[str, Any]], attested: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_host: dict[str, dict[str, Any]] = {}
    for row in attested:
        by_host[row["host"]] = row
    for row in canonical:
        by_host[row["host"]] = row

    rows = list(by_host.values())
    rows.sort(
        key=lambda row: (
            0 if row.get("transport_eligible") is True else 1,
            0 if row.get("source_kind") == "canonical" else 1,
            row["host"],
        )
    )
    return rows


def _parse_iso(value: Any) -> datetime | None:
    try:
        dt = datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _previous_entries(path: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("entries", []) if isinstance(doc, Mapping) else []
    out: dict[str, Mapping[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if isinstance(row, Mapping) and _host(row.get("host")):
            out[_host(row.get("host"))] = row
    return out


def _can_reuse(
    row: Mapping[str, Any] | None,
    *,
    now: datetime,
    renew_before: timedelta,
    methods: tuple[str, ...],
    proof_ref: str,
) -> bool:
    if not isinstance(row, Mapping):
        return False
    auth = row.get("authorization")
    if not isinstance(auth, Mapping):
        return False
    if tuple(sorted(str(v).upper() for v in auth.get("allowed_methods", []))) != methods:
        return False
    if str(auth.get("proof_ref") or "") != proof_ref:
        return False
    expires_at = _parse_iso(auth.get("expires_at"))
    return bool(expires_at and expires_at > now + renew_before)


def _issue(
    candidate: Mapping[str, Any],
    *,
    canonical_hosts: set[str],
    ttl_minutes: int,
) -> dict[str, Any]:
    host = str(candidate["host"])
    methods = tuple(candidate["allowed_methods"])
    if candidate.get("source_kind") == "canonical":
        grant = issue_authorization(
            AuthorizationEvidence(
                host=host,
                source="owner-authorization-pool:canonical",
                owner_control_verified=False,
                explicit_owner_authorization=False,
                requested_methods=methods,
                credential_scope="none",
                private_network=False,
                expires_in_minutes=ttl_minutes,
                proof_ref=str(candidate.get("proof_ref") or host),
            ),
            canonical_authorized_hosts=canonical_hosts,
        )
    else:
        grant = issue_from_verified_control_attestation(
            VerifiedControlAttestation(
                provider=str(candidate.get("provider") or ""),
                host=host,
                service_url=str(candidate.get("service_url") or f"https://{host}"),
                provider_control_verified=True,
                owner_authorized=True,
                proof_ref=str(candidate.get("proof_ref") or ""),
                allowed_methods=methods,
                credential_scope="none",
                private_network=False,
                workspace_id=candidate.get("workspace_id"),
                service_id=candidate.get("service_id"),
            ),
            expires_in_minutes=ttl_minutes,
        )
    return build_authority_handoff(grant)


def _epoch(iso_value: str) -> int:
    dt = _parse_iso(iso_value)
    if dt is None:
        raise ValueError("invalid authorization expiry")
    return int(dt.timestamp())


def run_owner_authorization_pool(
    state_dir: str | Path,
    *,
    canonical_targets: str | Path,
    verified_attestations: str | Path,
    target_count: int = DEFAULT_TARGET,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
    renew_before_minutes: int = DEFAULT_RENEW_BEFORE_MINUTES,
    now: datetime | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    target = max(1, int(target_count))
    ttl = max(60, min(int(ttl_minutes), 24 * 60))
    renew_before = timedelta(minutes=max(5, int(renew_before_minutes)))

    canonical_hosts, canonical = _canonical_candidates(Path(canonical_targets))
    attested = _attested_candidates(Path(verified_attestations))
    candidates = _dedupe(canonical, attested)
    selected = candidates[:target]
    previous = _previous_entries(state / "owner_authorization_pool.json")

    entries: list[dict[str, Any]] = []
    handoffs: list[dict[str, Any]] = []
    leases: list[dict[str, Any]] = []
    reused = 0
    issued = 0

    for candidate in selected:
        host = str(candidate["host"])
        methods = tuple(candidate["allowed_methods"])
        proof_ref = str(candidate.get("proof_ref") or "")
        old = previous.get(host)
        if _can_reuse(
            old,
            now=current,
            renew_before=renew_before,
            methods=methods,
            proof_ref=proof_ref,
        ):
            handoff = dict(old["handoff"])
            reused += 1
        else:
            handoff = _issue(candidate, canonical_hosts=canonical_hosts, ttl_minutes=ttl)
            issued += 1

        authorization = dict(handoff["authorization"])
        requested_authority = dict(handoff["requested_authority"])
        entry = {
            "host": host,
            "source_kind": candidate["source_kind"],
            "provider": candidate.get("provider"),
            "proof_ref": proof_ref,
            "lifecycle_state": candidate.get("lifecycle_state"),
            "transport_eligible": candidate.get("transport_eligible") is True,
            "authorization": authorization,
            "requested_authority": requested_authority,
            "handoff": handoff,
        }
        entries.append(entry)
        handoffs.append(handoff)
        leases.append(
            {
                "lease_id": f"owner-authz-lease:{authorization['authorization_id']}",
                "authorization_id": authorization["authorization_id"],
                "host": host,
                "expires_at": _epoch(str(authorization["expires_at"])),
                "same_or_narrower": True,
                "credential_scope": "none",
                "allow_http": False,
                "allow_delete": False,
                "allow_private_network": False,
                "allowed_methods": list(methods),
                "authority_basis": authorization.get("authorization_basis"),
                "proof_ref": proof_ref,
                "transport_eligible": candidate.get("transport_eligible") is True,
            }
        )

    shortfall = max(0, target - len(entries))
    result = {
        "schema": SCHEMA,
        "generated_at": current.isoformat(),
        "target_authorization_count": target,
        "verified_candidate_count": len(candidates),
        "authorized_count": len(entries),
        "target_met": len(entries) >= target,
        "shortfall": shortfall,
        "issued_this_cycle": issued,
        "reused_this_cycle": reused,
        "transport_eligible_count": sum(1 for row in entries if row["transport_eligible"]),
        "entries": entries,
        "supply_policy": {
            "accepted_sources": [
                "canonical_exact_host_with_explicit_authorization",
                "connected_render_or_vercel_control_attestation_with_owner_authorization",
            ],
            "shortfall_action": "collect_more_owner_controlled_or_explicitly_authorized_assets",
            "third_party_discovery_auto_authorization": False,
        },
        "hard_limits": [
            "exact_host_only",
            "GET_HEAD_only",
            "credential_scope_none",
            "private_network_disabled",
            "no_cross_host_credential_inheritance",
            "revocation_or_removed_evidence_removes_candidate_next_cycle",
            "discovery_or_negotiation_alone_never_authorizes_third_party_host",
        ],
    }

    _write(state / "owner_authorization_pool.json", result)
    _write(
        state / "owner_authorization_pool_handoffs.json",
        {
            "schema": HANDOFF_SCHEMA,
            "generated_at": current.isoformat(),
            "handoff_count": len(handoffs),
            "handoffs": handoffs,
        },
    )
    _write(
        state / "reviewed_authority_operational_leases.json",
        {
            "schema": LEASE_SCHEMA,
            "generated_at": int(current.timestamp()),
            "lease_count": len(leases),
            "leases": leases,
            "source": "owner_authorization_pool",
        },
    )
    return result
