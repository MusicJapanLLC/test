#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SENJU = ROOT / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju.approved_authority_red_adaptive import execute_authorized_red_learning_cycle
from senju.external_denial_learning import DenialLearningMemory


def _load(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"expected object in {path}")
    return raw


def _load_optional(path: Path) -> dict[str, Any]:
    try:
        return _load(path)
    except (OSError, json.JSONDecodeError, ValueError):
        return {}


def _standing_hosts(path: Path) -> set[str]:
    doc = _load(path)
    hosts: set[str] = set()
    for row in doc.get("records", []):
        if not isinstance(row, dict) or row.get("revoked") is True:
            continue
        methods = {str(v).upper() for v in row.get("allowed_methods", [])}
        if not methods.intersection({"GET", "HEAD", "OPTIONS"}):
            continue
        if str(row.get("credential_scope", "none")).lower() != "none" or row.get("destructive") is True:
            continue
        for host in row.get("exact_hosts", []):
            text = str(host).strip().lower().rstrip(".")
            if text:
                hosts.add(text)
    return hosts


def _effective_hosts(path: Path) -> set[str]:
    doc = _load(path)
    ceiling = doc.get("ceiling", {}) if isinstance(doc, dict) else {}
    if not isinstance(ceiling, dict):
        return set()
    return {str(v).strip().lower().rstrip(".") for v in ceiling.get("exact_hosts", []) if str(v).strip()}


def _safe_https_url(raw: str) -> tuple[str, str]:
    parsed = urllib.parse.urlsplit(str(raw).strip())
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("target must be credential-free HTTPS")
    if parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("target must not embed credentials or a non-HTTPS port")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("local/private target names are not eligible")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        raise ValueError("non-global literal IP is not eligible")
    path = parsed.path or "/"
    clean = urllib.parse.urlunsplit(("https", host, path, parsed.query, ""))
    return clean, host


def _merged_rows(config: dict[str, Any], discovery: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source in (config.get("target_profiles", []), discovery.get("discovered_profiles", [])):
        for raw in source if isinstance(source, list) else []:
            if isinstance(raw, dict):
                rows.append(dict(raw))
    return rows


def _validate_catalog(
    config: dict[str, Any], discovery: dict[str, Any], standing: set[str], effective: set[str]
) -> list[dict[str, Any]]:
    goal = max(1, int(config.get("goal_target_profiles", 30)))
    rows = _merged_rows(config, discovery)

    out: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_urls: set[str] = set()
    for raw in rows:
        profile_id = str(raw.get("id") or "").strip()
        evidence = str(raw.get("authorization_evidence") or "").strip()
        if not profile_id or profile_id in seen_ids:
            if profile_id in seen_ids:
                continue
            raise ValueError(f"invalid profile id: {profile_id!r}")
        url, host = _safe_https_url(str(raw.get("url") or ""))
        if url in seen_urls:
            continue
        if host not in standing:
            raise ValueError(f"profile host is not in standing authority: {host}")
        if host not in effective:
            raise ValueError(f"profile host is not in effective RED authority ceiling: {host}")
        if not evidence:
            raise ValueError(f"profile {profile_id} has no authorization evidence")
        seen_ids.add(profile_id)
        seen_urls.add(url)
        out.append({**raw, "id": profile_id, "url": url, "host": host})

    if len(out) < goal:
        raise ValueError(f"validated catalog has {len(out)} profiles; goal is {goal}")
    return out


def _load_memory(path: Path) -> DenialLearningMemory:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        raw = None
    return DenialLearningMemory.from_mapping(raw)


def _rotated_batch(profiles: list[dict[str, Any]], operation_id: str, limit: int) -> list[dict[str, Any]]:
    if not profiles:
        return []
    digest = hashlib.sha256(operation_id.encode("utf-8")).hexdigest()
    start = int(digest[:8], 16) % len(profiles)
    rotated = profiles[start:] + profiles[:start]
    return rotated[: max(1, min(limit, len(rotated)))]


def main() -> int:
    parser = argparse.ArgumentParser(description="Rotate operator-authorized public labs through bounded SENJU RED real transport")
    parser.add_argument("--config", default=str(ROOT / "senju" / "config" / "public_red_lab_sources.json"))
    parser.add_argument("--discovery", default=str(ROOT / "senju" / "state" / "public_red_discovery.json"))
    parser.add_argument("--standing", default=str(ROOT / "senju" / "state" / "standing_authorizations.json"))
    parser.add_argument("--effective-ceiling", default=str(ROOT / "senju" / "state" / "owner_contact_ceiling_effective.json"))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument("--memory", default=str(ROOT / "senju" / "state" / "approved_authority_red_memory.json"))
    parser.add_argument("--out", default=str(ROOT / "senju" / "state" / "public_red_fanout_latest.json"))
    parser.add_argument("--operation-id", default="")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    config = _load(Path(args.config))
    discovery = _load_optional(Path(args.discovery))
    standing = _standing_hosts(Path(args.standing))
    effective = _effective_hosts(Path(args.effective_ceiling))
    profiles = _validate_catalog(config, discovery, standing, effective)
    policy = config.get("policy", {}) if isinstance(config.get("policy"), dict) else {}
    max_requests = max(1, min(int(policy.get("max_requests_per_cycle", 6)), 6))
    operation_id = args.operation_id.strip() or datetime.now(timezone.utc).strftime("public-red-%Y%m%dT%H")

    summary: dict[str, Any] = {
        "schema": "senju-public-red-fanout/v1",
        "operation_id": operation_id,
        "validated_target_profiles": len(profiles),
        "static_profile_count": len(config.get("target_profiles", [])) if isinstance(config.get("target_profiles"), list) else 0,
        "dynamic_profile_count": len(discovery.get("discovered_profiles", [])) if isinstance(discovery.get("discovered_profiles"), list) else 0,
        "effective_standing_hosts": sorted(standing & effective),
        "effective_standing_host_count": len(standing & effective),
        "max_requests_per_cycle": max_requests,
        "methods": ["GET", "HEAD", "OPTIONS"],
        "credential_scope": "none",
        "destructive": False,
        "results": [],
    }
    if args.validate_only:
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        return 0

    batch = _rotated_batch(profiles, operation_id, max_requests)
    memory_path = Path(args.memory)
    memory = _load_memory(memory_path)
    rate = max(1, int(policy.get("shared_instance_rate_limit_rps", 1)))
    delay = 1.0 / rate

    for index, profile in enumerate(batch):
        result = execute_authorized_red_learning_cycle(
            repo_root=ROOT,
            state_dir=args.state_dir,
            operation_id=f"{operation_id}:{profile['id']}",
            seed_url=profile["url"],
            method="HEAD",
            candidate_urls=(),
            alternate_paths=(),
            include_safe_defaults=False,
            rollout_percent=45,
            max_attempts=1,
            memory=memory,
        )
        summary["results"].append({
            "profile_id": profile["id"],
            "url": profile["url"],
            "host": profile["host"],
            "operator": profile.get("operator"),
            "source": profile.get("source", "static_catalog"),
            "selected_by_rollout": result.get("selected_by_rollout"),
            "external_contact_attempted": result.get("external_contact_attempted"),
            "success": result.get("success"),
            "stop_reason": result.get("stop_reason"),
        })
        if index + 1 < len(batch) and bool(profile.get("shared_instance", True)):
            time.sleep(delay)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    memory.write(memory_path)
    print(json.dumps({
        "validated_target_profiles": len(profiles),
        "effective_standing_host_count": len(standing & effective),
        "batch_size": len(batch),
        "external_contact_attempts": sum(1 for row in summary["results"] if row.get("external_contact_attempted")),
        "successes": sum(1 for row in summary["results"] if row.get("success")),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
