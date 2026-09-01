#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _safe_seed_path(raw: str) -> str:
    text = str(raw or "").strip()
    if not text or len(text) > 256:
        raise ValueError("seed path is empty or too long")
    if not text.startswith("/"):
        text = "/" + text
    parsed = urllib.parse.urlsplit(text)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or "\x00" in text:
        raise ValueError("seed path must be path-only without query/fragment")
    if text.startswith("//"):
        raise ValueError("network-path references are not allowed")
    return parsed.path or "/"


def _standing_hosts(doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in doc.get("records", []) if isinstance(doc, dict) else []:
        if not isinstance(row, dict) or row.get("revoked") is True:
            continue
        if str(row.get("credential_scope", "none")).lower() != "none" or row.get("destructive") is True:
            continue
        methods = {str(v).upper() for v in row.get("allowed_methods", [])}
        if not methods.intersection({"GET", "HEAD", "OPTIONS"}):
            continue
        for raw_host in row.get("exact_hosts", []):
            host = str(raw_host).strip().lower().rstrip(".")
            if host:
                out[host] = row
    return out


def _effective_hosts(doc: dict[str, Any]) -> set[str]:
    ceiling = doc.get("ceiling", {}) if isinstance(doc, dict) else {}
    if not isinstance(ceiling, dict):
        return set()
    return {str(v).strip().lower().rstrip(".") for v in ceiling.get("exact_hosts", []) if str(v).strip()}


def _provider_by_id(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in config.get("providers", []) if isinstance(config, dict) else []:
        if isinstance(row, dict) and str(row.get("id") or "").strip():
            out[str(row["id"]).strip()] = row
    return out


def _provider_allows_host(provider: dict[str, Any], host: str) -> bool:
    exact = {str(v).strip().lower().rstrip(".") for v in provider.get("exact_hosts", []) if str(v).strip()}
    return host in exact


def _profile_id(provider_id: str, url: str) -> str:
    return f"seed-{provider_id}-{hashlib.sha256(url.encode('utf-8')).hexdigest()[:12]}"


def expand_seed_routes(
    *,
    config: dict[str, Any],
    seeds: dict[str, Any],
    discovery: dict[str, Any],
    standing_doc: dict[str, Any],
    effective_doc: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    standing = _standing_hosts(standing_doc)
    effective = _effective_hosts(effective_doc)
    providers = _provider_by_id(config)

    static_urls = {
        str(row.get("url") or "").strip()
        for row in config.get("target_profiles", []) if isinstance(row, dict) and str(row.get("url") or "").strip()
    }
    by_url: dict[str, dict[str, Any]] = {}
    for row in discovery.get("discovered_profiles", []) if isinstance(discovery, dict) else []:
        if isinstance(row, dict) and str(row.get("url") or "").strip():
            by_url[str(row["url"]).strip()] = dict(row)

    added: list[str] = []
    for source in seeds.get("sources", []) if isinstance(seeds, dict) else []:
        if not isinstance(source, dict):
            continue
        provider_id = str(source.get("provider_id") or "").strip()
        host = str(source.get("host") or "").strip().lower().rstrip(".")
        evidence_url = str(source.get("evidence_url") or "").strip()
        provider = providers.get(provider_id)
        if not provider or not host or host not in standing or host not in effective:
            continue
        if not _provider_allows_host(provider, host):
            continue
        provider_evidence = {str(v).strip() for v in provider.get("evidence_urls", []) if str(v).strip()}
        standing_evidence = str(standing[host].get("authorization_evidence_url") or "").strip()
        if evidence_url not in provider_evidence and evidence_url != standing_evidence:
            continue

        operator = str(provider.get("operator") or standing[host].get("owner") or provider_id)
        for raw_path in source.get("paths", []):
            try:
                path = _safe_seed_path(str(raw_path))
            except ValueError:
                continue
            url = urllib.parse.urlunsplit(("https", host, path, "", ""))
            if url in static_urls or url in by_url:
                continue
            by_url[url] = {
                "id": _profile_id(provider_id, url),
                "url": url,
                "operator": operator,
                "authorization_evidence": evidence_url,
                "provider_id": provider_id,
                "source": "operator_route_seed_catalog",
                "route_source": str(source.get("route_source") or ""),
                "shared_instance": True,
            }
            added.append(url)

    return sorted(by_url.values(), key=lambda row: str(row.get("url", ""))), sorted(set(added))


def main() -> int:
    parser = argparse.ArgumentParser(description="Expand SENJU RED URL inventory from route seeds inside already-authorized public lab hosts")
    parser.add_argument("--config", default=str(ROOT / "senju/config/public_red_lab_sources.json"))
    parser.add_argument("--route-seeds", default=str(ROOT / "senju/config/public_red_route_seeds.json"))
    parser.add_argument("--discovery", default=str(ROOT / "senju/state/public_red_discovery.json"))
    parser.add_argument("--standing", default=str(ROOT / "senju/state/standing_authorizations.json"))
    parser.add_argument("--effective-ceiling", default=str(ROOT / "senju/state/owner_contact_ceiling_effective.json"))
    parser.add_argument("--minimum-profiles", type=int, default=60)
    args = parser.parse_args()

    config = _load(Path(args.config), {})
    seeds = _load(Path(args.route_seeds), {})
    discovery_path = Path(args.discovery)
    discovery = _load(discovery_path, {})
    standing = _load(Path(args.standing), {})
    effective = _load(Path(args.effective_ceiling), {})

    profiles, added = expand_seed_routes(
        config=config,
        seeds=seeds,
        discovery=discovery,
        standing_doc=standing,
        effective_doc=effective,
    )
    static_profiles = [row for row in config.get("target_profiles", []) if isinstance(row, dict)]
    merged_unique = {
        str(row.get("url") or "").strip()
        for row in [*static_profiles, *profiles]
        if str(row.get("url") or "").strip()
    }
    minimum = max(1, int(args.minimum_profiles))
    if len(merged_unique) < minimum:
        raise SystemExit(f"expanded RED catalog has {len(merged_unique)} unique URLs; minimum is {minimum}")

    out = dict(discovery) if isinstance(discovery, dict) else {}
    out["schema"] = "senju-public-red-discovery/v2"
    out["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
    out["authority_rule"] = "already_authorized_exact_host_plus_operator_route_seed_only"
    out["authority_from_general_web_discovery"] = False
    out["discovered_profiles"] = profiles
    out["newly_discovered_urls"] = sorted(set(out.get("newly_discovered_urls", [])) | set(added))
    out["expanded_unique_url_count"] = len(merged_unique)
    out["route_seed_added_count"] = len(added)
    out["minimum_profile_target"] = minimum
    _write(discovery_path, out)

    print(json.dumps({
        "expanded_unique_url_count": len(merged_unique),
        "route_seed_added_count": len(added),
        "dynamic_profile_count": len(profiles),
        "minimum_profile_target": minimum,
        "target_met": len(merged_unique) >= minimum,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
