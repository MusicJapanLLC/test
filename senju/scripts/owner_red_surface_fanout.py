#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SENJU = ROOT / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju import approved_authority_red_adaptive as adaptive
from senju.external_denial_learning import DenialLearningMemory

MAX_PROFILES_PER_CYCLE = 32
MAX_OWNER_RPS = 4.0


def _load(path: Path) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError) as exc:
        raise SystemExit(f"unable to load owner RED catalog: {type(exc).__name__}") from exc
    if not isinstance(raw, dict):
        raise SystemExit("owner RED catalog must be an object")
    return raw


def _select(profiles: list[dict[str, Any]], operation_id: str, limit: int) -> list[dict[str, Any]]:
    valid = [
        row for row in profiles
        if isinstance(row, dict)
        and row.get("transport_eligible") is True
        and row.get("same_origin_only") is True
        and row.get("external_link_inheritance") is False
        and str(row.get("credential_scope", "none")).lower() == "none"
        and row.get("private_network") is False
        and str(row.get("url") or "").startswith("https://")
    ]
    if not valid:
        return []
    cap = max(1, min(int(limit), MAX_PROFILES_PER_CYCLE, len(valid)))
    start = int(hashlib.sha256(operation_id.encode("utf-8")).hexdigest()[:8], 16) % len(valid)
    rotated = valid[start:] + valid[:start]

    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    hosts_seen: set[str] = set()
    for row in rotated:
        host = str(row.get("host") or "")
        pid = str(row.get("id") or "")
        if not host or not pid or host in hosts_seen:
            continue
        selected.append(row)
        selected_ids.add(pid)
        hosts_seen.add(host)
        if len(selected) >= cap:
            return selected
    for row in rotated:
        pid = str(row.get("id") or "")
        if not pid or pid in selected_ids:
            continue
        selected.append(row)
        selected_ids.add(pid)
        if len(selected) >= cap:
            break
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description="Run bounded real RED observation across verified owner-controlled URL surfaces")
    parser.add_argument("--catalog", default=str(ROOT / "senju/state/owner_red_surface_catalog.json"))
    parser.add_argument("--state-dir", default=str(ROOT / "senju/state"))
    parser.add_argument("--memory", default=str(ROOT / "senju/state/owner_red_surface_memory.json"))
    parser.add_argument("--out", default=str(ROOT / "senju/state/owner_red_surface_burst.json"))
    parser.add_argument("--operation-id", default="")
    parser.add_argument("--max-profiles", type=int, default=MAX_PROFILES_PER_CYCLE)
    args = parser.parse_args()

    catalog = _load(Path(args.catalog))
    if catalog.get("exact_host_only") is not True or catalog.get("general_web_discovery_authorizes") is not False:
        raise SystemExit("owner RED catalog authority invariants are not satisfied")
    profiles = catalog.get("profiles", [])
    if not isinstance(profiles, list):
        raise SystemExit("owner RED catalog profiles must be a list")

    operation_id = args.operation_id.strip() or datetime.now(timezone.utc).strftime("owner-red-%Y%m%dT%H%M")
    batch = _select(profiles, operation_id, args.max_profiles)
    if not batch:
        raise SystemExit("no owner-controlled RED profiles eligible for transport")

    memory_path = Path(args.memory)
    try:
        raw_memory = json.loads(memory_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        raw_memory = None
    memory = DenialLearningMemory.from_mapping(raw_memory)

    summary: dict[str, Any] = {
        "schema": "senju-owner-red-surface-burst/v1",
        "operation_id": operation_id,
        "catalog_profile_count": int(catalog.get("profile_count", 0)),
        "catalog_unique_host_count": int(catalog.get("unique_host_count", 0)),
        "batch_size": len(batch),
        "unique_batch_hosts": len({str(row.get("host") or "") for row in batch}),
        "method": "HEAD",
        "credential_scope": "none",
        "destructive": False,
        "exact_owner_hosts_only": True,
        "general_web_discovery_authorizes": False,
        "external_link_inheritance": False,
        "results": [],
    }

    previous_rollout = adaptive.MAX_ROLLOUT_PERCENT
    adaptive.MAX_ROLLOUT_PERCENT = 100
    delay = 1.0 / MAX_OWNER_RPS
    try:
        for index, profile in enumerate(batch):
            result = adaptive.execute_authorized_red_learning_cycle(
                repo_root=ROOT,
                state_dir=args.state_dir,
                operation_id=f"{operation_id}:{profile['id']}",
                seed_url=str(profile["url"]),
                method="HEAD",
                candidate_urls=(),
                alternate_paths=(),
                include_safe_defaults=False,
                rollout_percent=100,
                max_attempts=1,
                memory=memory,
            )
            summary["results"].append({
                "profile_id": profile["id"],
                "url": profile["url"],
                "host": profile["host"],
                "red_authority_tier": profile.get("red_authority_tier"),
                "allowed_methods": profile.get("allowed_methods", []),
                "mutation_capable_catalog_entry": bool(profile.get("mutating_methods")),
                "selected_by_rollout": result.get("selected_by_rollout"),
                "external_contact_attempted": result.get("external_contact_attempted"),
                "success": result.get("success"),
                "stop_reason": result.get("stop_reason"),
            })
            if index + 1 < len(batch):
                time.sleep(delay)
    finally:
        adaptive.MAX_ROLLOUT_PERCENT = previous_rollout

    summary["external_contact_attempts"] = sum(
        1 for row in summary["results"] if row.get("external_contact_attempted")
    )
    summary["successes"] = sum(1 for row in summary["results"] if row.get("success"))
    summary["mutation_capable_selected"] = sum(
        1 for row in summary["results"] if row.get("mutation_capable_catalog_entry")
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    try:
        memory.write(memory_path)
    except Exception:
        pass

    print(json.dumps({
        "batch_size": summary["batch_size"],
        "unique_batch_hosts": summary["unique_batch_hosts"],
        "external_contact_attempts": summary["external_contact_attempts"],
        "successes": summary["successes"],
        "mutation_capable_selected": summary["mutation_capable_selected"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
