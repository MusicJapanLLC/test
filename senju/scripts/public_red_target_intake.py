#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import hashlib
import html
import ipaddress
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
URL_RE = re.compile(r"https://[^\s\"'<>]+", re.IGNORECASE)
USER_AGENT = "SENJU-RED-authorized-public-lab-intake/1.0"
MAX_FETCH_BYTES = 512 * 1024
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _safe_url(raw: str) -> tuple[str, str]:
    parsed = urllib.parse.urlsplit(html.unescape(str(raw).strip()).rstrip(".,);]"))
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("HTTPS target required")
    if parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("credentials/non-HTTPS port not allowed")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("local host not allowed")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        raise ValueError("private/reserved literal IP not allowed")
    clean = urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
    return clean, host


def _provider_match(provider: dict[str, Any], host: str) -> bool:
    exact = {str(v).strip().lower().rstrip(".") for v in provider.get("exact_hosts", []) if str(v).strip()}
    if host in exact:
        return True
    pattern = str(provider.get("host_regex") or "").strip()
    return bool(pattern and re.fullmatch(pattern, host, flags=re.IGNORECASE))


def _fetch(url: str) -> tuple[str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"})
    with urllib.request.urlopen(request, timeout=15) as response:
        final_url = response.geturl()
        body = response.read(MAX_FETCH_BYTES + 1)
        if len(body) > MAX_FETCH_BYTES:
            body = body[:MAX_FETCH_BYTES]
        charset = response.headers.get_content_charset() or "utf-8"
    return final_url, body.decode(charset, errors="replace")


def _standing_hosts(doc: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for row in doc.get("records", []) if isinstance(doc, dict) else []:
        if not isinstance(row, dict) or row.get("revoked") is True:
            continue
        for raw in row.get("exact_hosts", []):
            host = str(raw).strip().lower().rstrip(".")
            if host:
                out.add(host)
    return out


def _revoked_standing_hosts(doc: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for row in doc.get("records", []) if isinstance(doc, dict) else []:
        if not isinstance(row, dict) or row.get("revoked") is not True:
            continue
        for raw in row.get("exact_hosts", []):
            host = str(raw).strip().lower().rstrip(".")
            if host:
                out.add(host)
    return out


def _profile_id(provider_id: str, url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return f"auto-{provider_id}-{digest}"


def _add_standing_record(
    standing_doc: dict[str, Any], provider: dict[str, Any], host: str, evidence_url: str
) -> bool:
    if host in _standing_hosts(standing_doc):
        return False
    records = standing_doc.setdefault("records", [])
    if not isinstance(records, list):
        raise ValueError("standing authorization records must be a list")
    provider_id = str(provider.get("id") or "provider").strip()
    records.append({
        "authorization_reference": f"operator-public-evidence:{provider_id}:{host}",
        "owner": str(provider.get("operator") or provider_id),
        "issuer_kind": "operator_public_security_lab_discovered",
        "authorization_evidence_url": evidence_url,
        "exact_hosts": [host],
        "allowed_methods": ["GET", "HEAD", "OPTIONS"],
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
    return True


def _sync_effective_ceiling(path: Path, standing_doc: dict[str, Any]) -> dict[str, Any]:
    doc = _load(path, {"schema": "senju-owner-contact-ceiling-effective/v4", "ceiling": {}})
    if not isinstance(doc, dict):
        doc = {"schema": "senju-owner-contact-ceiling-effective/v4", "ceiling": {}}
    before = copy.deepcopy(doc)
    ceiling = doc.setdefault("ceiling", {})
    if not isinstance(ceiling, dict):
        ceiling = {}
        doc["ceiling"] = ceiling

    exact = {str(v).strip().lower().rstrip(".") for v in ceiling.get("exact_hosts", []) if str(v).strip()}
    per_host_raw = ceiling.get("per_host_methods", {})
    per_host = dict(per_host_raw) if isinstance(per_host_raw, dict) else {}
    revoked = _revoked_standing_hosts(standing_doc)
    exact.difference_update(revoked)
    for host in revoked:
        per_host.pop(host, None)

    for row in standing_doc.get("records", []) if isinstance(standing_doc, dict) else []:
        if not isinstance(row, dict) or row.get("revoked") is True:
            continue
        if str(row.get("credential_scope", "none")).lower() != "none" or row.get("destructive") is True:
            continue
        methods = sorted({str(v).strip().upper() for v in row.get("allowed_methods", [])} & SAFE_METHODS)
        if not methods:
            continue
        for raw_host in row.get("exact_hosts", []):
            host = str(raw_host).strip().lower().rstrip(".")
            if not host:
                continue
            exact.add(host)
            per_host[host] = methods

    ceiling["exact_hosts"] = sorted(exact)
    ceiling["per_host_methods"] = {host: per_host[host] for host in sorted(per_host) if host in exact}
    ceiling["allowed_methods"] = ["GET", "HEAD", "OPTIONS"]
    ceiling["allow_http"] = False
    ceiling["allow_delete"] = False
    ceiling["credential_scope"] = "none"
    ceiling["shared_public_lab_rate_limit_rps"] = 1
    ceiling["max_public_lab_requests_per_cycle"] = 6
    doc["source"] = "standing authority plus operator-published security-lab evidence; safe methods only"

    before_compare = copy.deepcopy(before)
    after_compare = copy.deepcopy(doc)
    before_compare.pop("generated_at", None)
    after_compare.pop("generated_at", None)
    if _stable_json(before_compare) != _stable_json(after_compare):
        doc["generated_at"] = int(datetime.now(timezone.utc).timestamp())
        _write(path, doc)
    return doc


def _inventory_changed(previous: dict[str, Any], profiles: list[dict[str, Any]], effective_host_count: int | None) -> bool:
    previous_profiles = previous.get("discovered_profiles", []) if isinstance(previous, dict) else []
    previous_count = previous.get("effective_host_count") if isinstance(previous, dict) else None
    return _stable_json(previous_profiles) != _stable_json(profiles) or previous_count != effective_host_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover SENJU RED targets only from configured operator-published security-lab evidence")
    parser.add_argument("--config", default=str(ROOT / "senju" / "config" / "public_red_lab_sources.json"))
    parser.add_argument("--standing", default=str(ROOT / "senju" / "state" / "standing_authorizations.json"))
    parser.add_argument("--effective-ceiling", default=str(ROOT / "senju" / "state" / "owner_contact_ceiling_effective.json"))
    parser.add_argument("--out", default=str(ROOT / "senju" / "state" / "public_red_discovery.json"))
    parser.add_argument("--admit-standing", action="store_true")
    parser.add_argument("--sync-effective", action="store_true")
    parser.add_argument("--create-gruyere-instance", action="store_true")
    args = parser.parse_args()

    config = _load(Path(args.config), {})
    standing_path = Path(args.standing)
    standing_doc = _load(standing_path, {"schema": "senju-standing-authorization/v1", "records": []})
    out_path = Path(args.out)
    previous = _load(out_path, {})
    old_profiles = previous.get("discovered_profiles", []) if isinstance(previous, dict) else []
    profiles_by_url: dict[str, dict[str, Any]] = {}
    for row in old_profiles if isinstance(old_profiles, list) else []:
        if isinstance(row, dict) and row.get("url"):
            profiles_by_url[str(row["url"])] = dict(row)

    provider_checks: list[dict[str, Any]] = []
    admitted_hosts: list[str] = []
    newly_discovered: list[str] = []

    for provider in config.get("providers", []) if isinstance(config, dict) else []:
        if not isinstance(provider, dict) or provider.get("auto_admit") is not True:
            continue
        provider_id = str(provider.get("id") or "").strip()
        operator = str(provider.get("operator") or provider_id)
        for evidence_url in provider.get("evidence_urls", []):
            evidence_url = str(evidence_url).strip()
            check: dict[str, Any] = {"provider_id": provider_id, "evidence_url": evidence_url, "reachable": False, "matched_urls": []}
            try:
                final_url, body = _fetch(evidence_url)
                check["reachable"] = True
                check["final_url"] = final_url
                for raw_url in URL_RE.findall(body):
                    try:
                        url, host = _safe_url(raw_url)
                    except ValueError:
                        continue
                    if not _provider_match(provider, host):
                        continue
                    if url not in profiles_by_url:
                        newly_discovered.append(url)
                    profiles_by_url[url] = {
                        "id": _profile_id(provider_id, url),
                        "url": url,
                        "operator": operator,
                        "authorization_evidence": evidence_url,
                        "provider_id": provider_id,
                        "source": "operator_evidence_page",
                        "shared_instance": True,
                    }
                    check["matched_urls"].append(url)
                    if args.admit_standing and _add_standing_record(standing_doc, provider, host, evidence_url):
                        admitted_hosts.append(host)
            except Exception as exc:
                check["error"] = f"{type(exc).__name__}: {exc}"[:300]
            provider_checks.append(check)

        factory_url = str(provider.get("instance_factory_url") or "").strip()
        if args.create_gruyere_instance and factory_url:
            check = {"provider_id": provider_id, "instance_factory_url": factory_url, "created": False}
            try:
                factory_clean, factory_host = _safe_url(factory_url)
                if not _provider_match(provider, factory_host):
                    raise ValueError("instance factory is outside provider policy")
                final_url, _ = _fetch(factory_clean)
                final_clean, final_host = _safe_url(final_url)
                required_host = str(provider.get("instance_host_must_equal") or factory_host).lower().rstrip(".")
                if final_host != required_host or final_clean == factory_clean:
                    raise ValueError("instance factory did not return a distinct same-provider sandbox URL")
                existing_instances = [
                    row for row in profiles_by_url.values()
                    if row.get("provider_id") == provider_id and row.get("source") == "isolated_instance_factory"
                ]
                limit = max(1, min(int(provider.get("max_persisted_instances", 20)), 20))
                if len(existing_instances) < limit:
                    profiles_by_url[final_clean] = {
                        "id": _profile_id(provider_id, final_clean),
                        "url": final_clean,
                        "operator": operator,
                        "authorization_evidence": factory_url,
                        "provider_id": provider_id,
                        "source": "isolated_instance_factory",
                        "shared_instance": False,
                    }
                    newly_discovered.append(final_clean)
                    check["created"] = True
                    check["instance_url"] = final_clean
                else:
                    check["reason"] = "instance_persistence_cap_reached"
            except Exception as exc:
                check["error"] = f"{type(exc).__name__}: {exc}"[:300]
            provider_checks.append(check)

    if args.admit_standing and admitted_hosts:
        _write(standing_path, standing_doc)
    effective_doc = None
    if args.sync_effective:
        effective_doc = _sync_effective_ceiling(Path(args.effective_ceiling), standing_doc)

    profiles = sorted(profiles_by_url.values(), key=lambda row: (str(row.get("provider_id", "")), str(row.get("url", ""))))
    effective_host_count = len((effective_doc or {}).get("ceiling", {}).get("exact_hosts", [])) if isinstance(effective_doc, dict) else None
    inventory_changed = _inventory_changed(previous, profiles, effective_host_count)
    if inventory_changed or not out_path.exists():
        state = {
            "schema": "senju-public-red-discovery/v1",
            "updated_at_utc": datetime.now(timezone.utc).isoformat(),
            "authority_rule": "operator_evidence_page_plus_provider_policy_match_only",
            "authority_from_general_web_discovery": False,
            "admitted_hosts": sorted(set(admitted_hosts)),
            "newly_discovered_urls": sorted(set(newly_discovered)),
            "effective_host_count": effective_host_count,
            "provider_checks": provider_checks,
            "discovered_profiles": profiles,
        }
        _write(out_path, state)

    print(json.dumps({
        "provider_checks": len(provider_checks),
        "discovered_profile_count": len(profiles),
        "newly_discovered_count": len(set(newly_discovered)),
        "admitted_host_count": len(set(admitted_hosts)),
        "effective_host_count": effective_host_count,
        "inventory_changed": inventory_changed,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
