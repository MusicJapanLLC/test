#!/usr/bin/env python3
"""Bridge curated public security labs into the existing SENJU RED authority pipeline.

The registry is exact-host, HTTPS, read-only, credential-free and non-destructive.
This script does not derive authority from arbitrary web discovery; it only consumes
operator/public-lab evidence already validated in public_red_lab_authority.json.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SENJU = ROOT / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju.public_red_lab_discovery import refresh_public_red_lab_authority

SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _active_hosts(standing: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for row in standing.get("records", []) if isinstance(standing, dict) else []:
        if not isinstance(row, dict) or row.get("revoked") is True:
            continue
        if str(row.get("credential_scope", "none")).lower() != "none" or row.get("destructive") is True:
            continue
        methods = {str(v).strip().upper() for v in row.get("allowed_methods", [])}
        if not methods.intersection(SAFE_METHODS):
            continue
        for raw in row.get("exact_hosts", []):
            host = str(raw).strip().lower().rstrip(".")
            if host:
                out.add(host)
    return out


def _sync_effective(path: Path, standing: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    doc = _load(path, {"schema": "senju-owner-contact-ceiling-effective/v4", "ceiling": {}})
    if not isinstance(doc, dict):
        doc = {"schema": "senju-owner-contact-ceiling-effective/v4", "ceiling": {}}
    before = copy.deepcopy(doc)
    ceiling = doc.get("ceiling")
    if not isinstance(ceiling, dict):
        ceiling = {}
        doc["ceiling"] = ceiling
    exact = {str(v).strip().lower().rstrip(".") for v in ceiling.get("exact_hosts", []) if str(v).strip()}
    per_host = dict(ceiling.get("per_host_methods", {})) if isinstance(ceiling.get("per_host_methods"), dict) else {}

    revoked: set[str] = set()
    for row in standing.get("records", []) if isinstance(standing, dict) else []:
        if not isinstance(row, dict):
            continue
        hosts = {str(v).strip().lower().rstrip(".") for v in row.get("exact_hosts", []) if str(v).strip()}
        if row.get("revoked") is True:
            revoked.update(hosts)
            continue
        if str(row.get("credential_scope", "none")).lower() != "none" or row.get("destructive") is True:
            continue
        methods = sorted({str(v).strip().upper() for v in row.get("allowed_methods", [])} & set(SAFE_METHODS))
        if not methods:
            continue
        for host in hosts:
            exact.add(host)
            per_host[host] = methods

    exact.difference_update(revoked)
    for host in revoked:
        per_host.pop(host, None)
    ceiling["exact_hosts"] = sorted(exact)
    ceiling["per_host_methods"] = {host: per_host[host] for host in sorted(per_host) if host in exact}
    ceiling["allowed_methods"] = SAFE_METHODS
    ceiling["allow_http"] = False
    ceiling["allow_delete"] = False
    ceiling["credential_scope"] = "none"
    ceiling["shared_public_lab_rate_limit_rps"] = 1
    ceiling["max_public_lab_requests_per_cycle"] = min(int(ceiling.get("max_public_lab_requests_per_cycle", 6) or 6), 6)
    doc["public_red_registry_overlay"] = True

    before_cmp = copy.deepcopy(before)
    after_cmp = copy.deepcopy(doc)
    before_cmp.pop("generated_at", None)
    after_cmp.pop("generated_at", None)
    changed = _stable(before_cmp) != _stable(after_cmp)
    if changed:
        doc["generated_at"] = int(datetime.now(timezone.utc).timestamp())
        _write(path, doc)
    return doc, changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument("--meta-state-dir", default=str(ROOT / "automation" / "codegen" / "meta_state"))
    parser.add_argument("--standing", default=str(ROOT / "senju" / "state" / "standing_authorizations.json"))
    parser.add_argument("--effective-ceiling", default=str(ROOT / "senju" / "state" / "owner_contact_ceiling_effective.json"))
    parser.add_argument("--discovery", default=str(ROOT / "senju" / "state" / "public_red_discovery.json"))
    args = parser.parse_args()

    authority_path = Path(args.state_dir) / "public_red_lab_authority.json"
    if authority_path.exists():
        authority = _load(authority_path, {})
        targets = authority.get("targets", []) if isinstance(authority, dict) else []
        result = {"target_count": len(targets) if isinstance(targets, list) else 0}
    else:
        result = refresh_public_red_lab_authority(
            args.repo_root,
            args.state_dir,
            args.meta_state_dir,
            max_auto_new=0,
        )
        authority = _load(authority_path, {})
        targets = authority.get("targets", []) if isinstance(authority, dict) else []

    standing_path = Path(args.standing)
    standing = _load(standing_path, {"schema": "senju-standing-authorization/v1", "records": []})
    if not isinstance(standing, dict):
        standing = {"schema": "senju-standing-authorization/v1", "records": []}
    records = standing.setdefault("records", [])
    if not isinstance(records, list):
        raise SystemExit("standing authorization records must be a list")
    before_hosts = _active_hosts(standing)
    newly_admitted: list[str] = []

    for raw in targets if isinstance(targets, list) else []:
        if not isinstance(raw, dict):
            continue
        host = str(raw.get("host") or "").strip().lower().rstrip(".")
        evidence = str(raw.get("authorization_evidence_url") or "").strip()
        if not host or host in before_hosts or not evidence.startswith("https://"):
            continue
        records.append({
            "authorization_reference": f"curated-public-red-lab:{raw.get('source_id') or host}",
            "owner": str(raw.get("operator") or "operator-published public security lab"),
            "issuer_kind": "operator_public_security_lab_curated_registry",
            "authorization_evidence_url": evidence,
            "authorization_note": str(raw.get("authorization_note") or "")[:500],
            "exact_hosts": [host],
            "allowed_methods": SAFE_METHODS,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "revoked": False,
            "revocation_reason": None,
            "credential_scope": "none",
            "destructive": False,
            "private_cidrs": [],
            "private_dns_names": [],
            "public_security_lab": True,
            "recommendation_target": "SENJU_RED",
            "shared_instance": True,
            "rate_limit_rps": 1,
        })
        before_hosts.add(host)
        newly_admitted.append(host)

    if newly_admitted or not standing_path.exists():
        _write(standing_path, standing)
    effective, effective_changed = _sync_effective(Path(args.effective_ceiling), standing)

    discovery_path = Path(args.discovery)
    discovery = _load(discovery_path, {"schema": "senju-public-red-discovery/v1", "discovered_profiles": []})
    if not isinstance(discovery, dict):
        discovery = {"schema": "senju-public-red-discovery/v1", "discovered_profiles": []}
    current_profiles = discovery.get("discovered_profiles", [])
    by_url = {
        str(row.get("url")): dict(row)
        for row in current_profiles if isinstance(row, dict) and row.get("url")
    } if isinstance(current_profiles, list) else {}
    for raw in targets if isinstance(targets, list) else []:
        if not isinstance(raw, dict):
            continue
        url = str(raw.get("base_url") or "").rstrip("/") + "/"
        host = str(raw.get("host") or "").strip().lower().rstrip(".")
        if not host or not url.startswith("https://"):
            continue
        by_url[url] = {
            "id": f"registry-{raw.get('source_id') or host}",
            "url": url,
            "host": host,
            "operator": str(raw.get("operator") or "public security lab operator"),
            "authorization_evidence": raw.get("authorization_evidence_url"),
            "provider_id": "curated-public-red-registry",
            "source": "curated_public_red_lab_registry",
            "shared_instance": True,
        }
    new_profiles = [by_url[key] for key in sorted(by_url)]
    new_registry_count = len(targets) if isinstance(targets, list) else 0
    new_effective_count = len(effective.get("ceiling", {}).get("exact_hosts", []))
    discovery_changed = (
        _stable(current_profiles if isinstance(current_profiles, list) else []) != _stable(new_profiles)
        or discovery.get("registry_profile_count") != new_registry_count
        or discovery.get("effective_host_count") != new_effective_count
    )
    if discovery_changed or not discovery_path.exists():
        discovery["discovered_profiles"] = new_profiles
        discovery["registry_profile_count"] = new_registry_count
        discovery["effective_host_count"] = new_effective_count
        discovery["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
        _write(discovery_path, discovery)

    active = _active_hosts(standing)
    effective_hosts = {
        str(v).strip().lower().rstrip(".")
        for v in effective.get("ceiling", {}).get("exact_hosts", [])
        if str(v).strip()
    }
    summary = {
        "registry_target_count": result.get("target_count", 0),
        "newly_admitted_count": len(newly_admitted),
        "newly_admitted_hosts": sorted(newly_admitted),
        "standing_safe_host_count": len(active),
        "effective_safe_host_count": len(active & effective_hosts),
        "discovery_profile_count": len(new_profiles),
        "effective_changed": effective_changed,
        "discovery_changed": discovery_changed,
        "methods": SAFE_METHODS,
        "credential_scope": "none",
        "destructive": False,
    }
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
