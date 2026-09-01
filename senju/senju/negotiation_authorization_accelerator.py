"""Accelerate negotiation-originated cases toward Authorization without fabricating consent.

The accelerator is deliberately aggressive on *process*:
- consumes only cases already admitted by the META/X/SENJU formal-intake gate;
- selects at least the configured batch size when that many unique hosts exist;
- issues an open exact-host Review Key for every selected host;
- immediately issues Authorization when a legitimate basis already exists
  (canonical exact-host authorization or verified connected-cloud control);
- otherwise leaves the host at ``pending_verified_authorization_basis`` and
  records exactly what is missing.

It never converts negotiation/discovery/AI consensus alone into permission for
an unrelated third-party host.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

# The package bridge keeps the historical bureau implementation importable here.
from .authorization_issuance_bureau import (
    AuthorizationEvidence,
    VerifiedControlAttestation,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_verified_control_attestation,
    request_review_key,
)

SCHEMA = "senju-negotiation-authorization-accelerator/v1"
_BUREAU_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"})


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: Any) -> str:
    return str(value or "").strip().lower().rstrip(".")


def _methods(raw: Iterable[Any] | None) -> tuple[str, ...]:
    values = {str(v).strip().upper() for v in (raw or ()) if str(v).strip()}
    bounded = tuple(sorted(values & _BUREAU_METHODS))
    return bounded or ("GET", "HEAD")


def _canonical_records(path: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("targets", []) if isinstance(doc, Mapping) else []
    out: dict[str, Mapping[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if host and str(row.get("owner_authorization", "")).lower() == "explicit":
            out[host] = row
    return out


def _attestation_records(path: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("records", []) if isinstance(doc, Mapping) else []
    out: dict[str, Mapping[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if host:
            out[host] = row
    return out


def _unique_ranked_cases(intake: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    rows = intake.get("cases", []) if isinstance(intake, Mapping) else []
    eligible: list[Mapping[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if not host or row.get("hard_deny") is True or row.get("revoked") is True:
            continue
        if row.get("intake_status") != "approved_for_formal_discussion":
            continue
        eligible.append(row)

    eligible.sort(
        key=lambda row: (
            -int(row.get("source_score", 0) or 0),
            -len(row.get("source_refs", []) if isinstance(row.get("source_refs"), list) else []),
            _host(row.get("host")),
        )
    )
    seen: set[str] = set()
    out: list[Mapping[str, Any]] = []
    for row in eligible:
        host = _host(row.get("host"))
        if host in seen:
            continue
        seen.add(host)
        out.append(row)
    return out


def _canonical_method_ceiling(row: Mapping[str, Any]) -> tuple[str, ...]:
    raw = row.get("allowed_interactions", [])
    if not isinstance(raw, list):
        return ("GET", "HEAD")
    ceiling = tuple(sorted({str(v).upper() for v in raw} & _BUREAU_METHODS))
    return ceiling or ("GET", "HEAD")


def _issue_if_verified(
    case: Mapping[str, Any],
    *,
    canonical: Mapping[str, Mapping[str, Any]],
    attestations: Mapping[str, Mapping[str, Any]],
) -> tuple[dict[str, Any] | None, str]:
    host = _host(case.get("host"))
    requested = set(_methods(case.get("requested_methods") if isinstance(case.get("requested_methods"), list) else ()))

    if host in canonical:
        ceiling = set(_canonical_method_ceiling(canonical[host]))
        methods = tuple(sorted(requested & ceiling))
        if not methods:
            return None, "pending_scope_mismatch"
        grant = issue_authorization(
            AuthorizationEvidence(
                host=host,
                source="negotiation-authorization-accelerator:canonical",
                owner_control_verified=False,
                explicit_owner_authorization=False,
                requested_methods=methods,
                credential_scope="none",
                private_network=False,
                expires_in_minutes=60,
                proof_ref=str(case.get("case_id") or "formal-intake"),
            ),
            canonical_authorized_hosts=set(canonical),
        )
        return build_authority_handoff(grant), "authorization_issued"

    att = attestations.get(host)
    if att is not None:
        allowed = set(_methods(att.get("allowed_methods") if isinstance(att.get("allowed_methods"), list) else ()))
        methods = tuple(sorted(requested & allowed))
        if not methods:
            return None, "pending_scope_mismatch"
        grant = issue_from_verified_control_attestation(
            VerifiedControlAttestation(
                provider=str(att.get("provider", "")),
                host=host,
                service_url=str(att.get("service_url", "")),
                provider_control_verified=att.get("provider_control_verified") is True,
                owner_authorized=att.get("owner_authorized") is True,
                proof_ref=str(att.get("proof_ref", "")),
                allowed_methods=methods,
                credential_scope=str(att.get("credential_scope", "none")),
                private_network=att.get("private_network") is True,
                workspace_id=str(att.get("workspace_id")) if att.get("workspace_id") else None,
                service_id=str(att.get("service_id")) if att.get("service_id") else None,
            ),
            expires_in_minutes=60,
        )
        return build_authority_handoff(grant), "authorization_issued"

    return None, "pending_verified_authorization_basis"


def run_negotiation_authorization_accelerator(
    state_dir: str | Path,
    *,
    canonical_targets: str | Path,
    verified_attestations: str | Path,
    minimum_batch: int = 5,
) -> dict[str, Any]:
    state = Path(state_dir)
    minimum = max(1, int(minimum_batch))
    intake = _load(state / "formal_approval_intake.json", {})
    canonical = _canonical_records(Path(canonical_targets))
    attestations = _attestation_records(Path(verified_attestations))
    ranked = _unique_ranked_cases(intake)
    selected = ranked[:minimum]

    rows: list[dict[str, Any]] = []
    handoffs: list[dict[str, Any]] = []
    keys: list[dict[str, Any]] = []
    for case in selected:
        host = _host(case.get("host"))
        case_id = str(case.get("case_id") or "")
        key = request_review_key(
            host,
            requester="NEGOTIATION_AUTHORIZATION_ACCELERATOR",
            source="negotiation_formal_intake",
            proof_ref=case_id or None,
        )
        intake_packet = build_discovery_authorization_intake(
            key,
            requested_methods=_methods(case.get("requested_methods") if isinstance(case.get("requested_methods"), list) else ()),
        )
        keys.append(intake_packet["review_key"])

        handoff, status = _issue_if_verified(case, canonical=canonical, attestations=attestations)
        row: dict[str, Any] = {
            "case_id": case_id,
            "host": host,
            "formal_flow": case.get("formal_flow"),
            "source_score": int(case.get("source_score", 0) or 0),
            "review_key": intake_packet["review_key"],
            "formal_intake_status": case.get("intake_status"),
            "authorization_status": status,
            "authority_effect": "none" if handoff is None else "authorization_issued",
        }
        if handoff is not None:
            row["authorization"] = handoff["authorization"]
            row["requested_authority"] = handoff["requested_authority"]
            handoffs.append(handoff)
        else:
            row["next_action"] = "obtain_exact_host_owner_or_connected_control_authorization_basis"
        rows.append(row)

    result = {
        "schema": SCHEMA,
        "production": True,
        "minimum_batch_target": minimum,
        "available_admitted_unique_hosts": len(ranked),
        "selected_count": len(selected),
        "minimum_batch_met": len(selected) >= minimum,
        "authorization_issued_count": sum(1 for row in rows if row["authorization_status"] == "authorization_issued"),
        "pending_verification_count": sum(1 for row in rows if row["authorization_status"] != "authorization_issued"),
        "rows": rows,
        "hard_limits": [
            "negotiation_or_AI_consensus_alone_is_not_authorization",
            "review_keys_have_no_authority_effect",
            "authorization_requires_exact_canonical_or_verified_connected_control_basis",
            "revocation_and_HARD_DENY_remain_terminal",
            "no_private_network_scope",
            "no_cross_host_credential_inheritance",
        ],
    }
    _write(state / "negotiation_authorization_acceleration.json", result)
    _write(
        state / "authorization_review_keys.json",
        {"schema": "senju-authorization-review-keys/v1", "keys": keys, "authority_effect": "none"},
    )
    _write(
        state / "negotiation_authorization_handoffs.json",
        {"schema": "senju-negotiation-authorization-handoffs/v1", "handoffs": handoffs},
    )
    return result
