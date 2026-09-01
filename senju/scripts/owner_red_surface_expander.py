#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
HTTP_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"})
MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
DEFAULT_PATHS = (
    "/",
    "/robots.txt",
    "/.well-known/security.txt",
    "/health",
    "/status",
    "/api",
    "/login",
    "/admin",
    "/search",
    "/docs",
    "/sitemap.xml",
    "/manifest.json",
)
OWNER_SPECIAL_PATHS = {
    "kabeya-authorized-test-range.onrender.com": (
        "/scope.json",
        "/ai.txt",
        "/lab/index.html",
        "/lab/nullharbor.html",
        "/lab/embermesh.html",
        "/lab/atlaspaper.html",
        "/lab/lumenclause.html",
        "/lab/orbitnotes.html",
        "/lab/archive-demo.txt",
        "/login-lab/",
        "/login-lab/app.js",
        "/login-lab/data.json",
        "/contact/index.html",
        "/login-lab/synthetic-records/senju-probe",
    ),
    "sustainaboy-works.onrender.com": (
        "/",
        "/robots.txt",
        "/.well-known/security.txt",
    ),
}


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _safe_host_url(raw: str) -> tuple[str, str]:
    parsed = urllib.parse.urlsplit(str(raw or "").strip())
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("owner RED targets require HTTPS")
    if parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("credential-bearing/non-HTTPS-port URL rejected")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("local/private host rejected")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        raise ValueError("non-global literal IP rejected")
    base = urllib.parse.urlunsplit(("https", host, "/", "", ""))
    return base, host


def _canonical_by_host(doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in doc.get("targets", []) if isinstance(doc, dict) else []:
        if not isinstance(row, dict):
            continue
        raw = str(row.get("base_url") or "")
        try:
            _, host = _safe_host_url(raw)
        except ValueError:
            continue
        out[host] = row
    return out


def _attested_owner_hosts(doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in doc.get("records", []) if isinstance(doc, dict) else []:
        if not isinstance(row, dict):
            continue
        if row.get("provider_control_verified") is not True or row.get("owner_authorized") is not True:
            continue
        if row.get("transport_eligible") is not True:
            continue
        if str(row.get("credential_scope", "none")).lower() != "none":
            continue
        if row.get("private_network") is True:
            continue
        raw_url = str(row.get("service_url") or "")
        try:
            _, host = _safe_host_url(raw_url)
        except ValueError:
            continue
        if host != str(row.get("host") or "").strip().lower().rstrip("."):
            continue
        out[host] = row
    return out


def _methods_for(host: str, attestation: dict[str, Any], canonical: dict[str, Any] | None) -> list[str]:
    methods = {str(v).strip().upper() for v in attestation.get("allowed_methods", [])} & HTTP_METHODS
    if canonical and canonical.get("owner_authorization") == "explicit":
        declared = {str(v).strip().upper() for v in canonical.get("allowed_interactions", [])} & HTTP_METHODS
        if declared:
            methods |= declared
    return sorted(methods)


def _profile_id(host: str, path: str) -> str:
    digest = hashlib.sha256(f"{host}|{path}".encode("utf-8")).hexdigest()[:14]
    return f"owner-red-{digest}"


def build_catalog(
    canonical_doc: dict[str, Any],
    attestations_doc: dict[str, Any],
    *,
    max_profiles: int = 240,
) -> dict[str, Any]:
    canonical = _canonical_by_host(canonical_doc)
    attested = _attested_owner_hosts(attestations_doc)
    profiles: list[dict[str, Any]] = []

    for host in sorted(attested):
        att = attested[host]
        canonical_row = canonical.get(host)
        methods = _methods_for(host, att, canonical_row)
        if not {"GET", "HEAD"} & set(methods):
            continue
        paths = list(DEFAULT_PATHS)
        for path in OWNER_SPECIAL_PATHS.get(host, ()):
            if path not in paths:
                paths.append(path)

        mutating = sorted(set(methods) & MUTATING_METHODS)
        tier = "owner_explicit_mutation" if mutating else "owner_verified_observation"
        for path in paths:
            if len(profiles) >= max_profiles:
                break
            url = urllib.parse.urlunsplit(("https", host, path, "", ""))
            profiles.append({
                "id": _profile_id(host, path),
                "url": url,
                "host": host,
                "path": path,
                "provider": att.get("provider"),
                "proof_ref": att.get("proof_ref"),
                "source": "verified_connected_owner_control",
                "transport_eligible": True,
                "allowed_methods": methods,
                "mutating_methods": mutating,
                "red_authority_tier": tier,
                "synthetic_write_only": bool(mutating),
                "same_origin_only": True,
                "external_link_inheritance": False,
                "credential_scope": "none",
                "private_network": False,
            })

    unique_hosts = sorted({row["host"] for row in profiles})
    mutation_hosts = sorted({row["host"] for row in profiles if row["mutating_methods"]})
    return {
        "schema": "senju-owner-red-surface-catalog/v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "authority_source": "verified_connected_owner_control_plus_exact_canonical_owner_scope",
        "general_web_discovery_authorizes": False,
        "external_link_inheritance": False,
        "exact_host_only": True,
        "credential_scope": "none",
        "private_network": False,
        "profile_count": len(profiles),
        "unique_host_count": len(unique_hosts),
        "mutation_capable_host_count": len(mutation_hosts),
        "mutation_capable_hosts": mutation_hosts,
        "profiles": profiles,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Expand SENJU RED URL coverage across verified owner-controlled exact hosts")
    parser.add_argument("--canonical", default=str(ROOT / "AUTHORIZED_TEST_TARGETS.json"))
    parser.add_argument("--attestations", default=str(ROOT / "senju/state/verified_control_attestations.json"))
    parser.add_argument("--out", default=str(ROOT / "senju/state/owner_red_surface_catalog.json"))
    parser.add_argument("--minimum-profiles", type=int, default=120)
    parser.add_argument("--max-profiles", type=int, default=240)
    args = parser.parse_args()

    catalog = build_catalog(
        _load(Path(args.canonical), {}),
        _load(Path(args.attestations), {}),
        max_profiles=max(1, min(int(args.max_profiles), 400)),
    )
    if catalog["profile_count"] < max(1, int(args.minimum_profiles)):
        raise SystemExit(
            f"owner RED surface catalog only has {catalog['profile_count']} profiles; "
            f"minimum is {args.minimum_profiles}"
        )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "profile_count": catalog["profile_count"],
        "unique_host_count": catalog["unique_host_count"],
        "mutation_capable_host_count": catalog["mutation_capable_host_count"],
        "target_met": catalog["profile_count"] >= int(args.minimum_profiles),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
