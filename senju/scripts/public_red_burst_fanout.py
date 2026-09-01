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
SCRIPT_DIR = Path(__file__).resolve().parent
SENJU = ROOT / "senju"
for path in (SCRIPT_DIR, SENJU):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import public_red_target_fanout as base
from senju.approved_authority_red_adaptive import execute_authorized_red_learning_cycle

# Tenfold scale-up from the previous six-profile cycle. This remains a hard
# safety boundary for operator-published shared labs; it is intentionally not
# unbounded traffic.
MAX_PROFILES_PER_CYCLE = 60


def _diverse_batch(profiles: list[dict[str, Any]], operation_id: str, limit: int) -> list[dict[str, Any]]:
    if not profiles:
        return []
    cap = max(1, min(int(limit), MAX_PROFILES_PER_CYCLE, len(profiles)))
    digest = hashlib.sha256(operation_id.encode("utf-8")).hexdigest()
    start = int(digest[:8], 16) % len(profiles)
    rotated = profiles[start:] + profiles[:start]

    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    seen_hosts: set[str] = set()
    for row in rotated:
        host = str(row.get("host") or "")
        profile_id = str(row.get("id") or "")
        if not host or host in seen_hosts or not profile_id:
            continue
        selected.append(row)
        selected_ids.add(profile_id)
        seen_hosts.add(host)
        if len(selected) >= cap:
            return selected

    for row in rotated:
        profile_id = str(row.get("id") or "")
        if not profile_id or profile_id in selected_ids:
            continue
        selected.append(row)
        selected_ids.add(profile_id)
        if len(selected) >= cap:
            break
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a diversified bounded SENJU RED rotation over the expanded authorized URL catalog")
    parser.add_argument("--config", default=str(ROOT / "senju/config/public_red_lab_sources.json"))
    parser.add_argument("--discovery", default=str(ROOT / "senju/state/public_red_discovery.json"))
    parser.add_argument("--standing", default=str(ROOT / "senju/state/standing_authorizations.json"))
    parser.add_argument("--effective-ceiling", default=str(ROOT / "senju/state/owner_contact_ceiling_effective.json"))
    parser.add_argument("--state-dir", default=str(ROOT / "senju/state"))
    parser.add_argument("--memory", default=str(ROOT / "senju/state/approved_authority_red_memory.json"))
    parser.add_argument("--out", default=str(ROOT / "senju/state/public_red_burst_latest.json"))
    parser.add_argument("--operation-id", default="")
    parser.add_argument("--max-profiles", type=int, default=MAX_PROFILES_PER_CYCLE)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    config = base._load(Path(args.config))
    discovery = base._load_optional(Path(args.discovery))
    standing = base._standing_hosts(Path(args.standing))
    effective = base._effective_hosts(Path(args.effective_ceiling))
    profiles = base._validate_catalog(config, discovery, standing, effective)
    operation_id = args.operation_id.strip() or datetime.now(timezone.utc).strftime("public-red-burst-%Y%m%dT%H")
    batch = _diverse_batch(profiles, operation_id, args.max_profiles)

    summary: dict[str, Any] = {
        "schema": "senju-public-red-burst-fanout/v2",
        "operation_id": operation_id,
        "validated_target_profiles": len(profiles),
        "batch_size": len(batch),
        "unique_batch_hosts": len({str(row.get('host') or '') for row in batch if row.get('host')}),
        "methods": ["GET", "HEAD", "OPTIONS"],
        "credential_scope": "none",
        "destructive": False,
        "max_profiles_per_cycle": MAX_PROFILES_PER_CYCLE,
        "scale_factor_from_previous": 10,
        "results": [],
    }
    if args.validate_only:
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        return 0

    if len(batch) > MAX_PROFILES_PER_CYCLE:
        raise SystemExit("RED burst exceeds hard authorized public-lab request ceiling")

    policy = config.get("policy", {}) if isinstance(config.get("policy"), dict) else {}
    # Preserve the shared-lab etiquette boundary even while increasing breadth.
    rate = max(1, min(int(policy.get("shared_instance_rate_limit_rps", 1)), 1))
    delay = 1.0 / rate
    memory_path = Path(args.memory)
    memory = base._load_memory(memory_path)

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
            rollout_percent=100,
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
        "batch_size": len(batch),
        "unique_batch_hosts": summary["unique_batch_hosts"],
        "external_contact_attempts": sum(1 for row in summary["results"] if row.get("external_contact_attempted")),
        "successes": sum(1 for row in summary["results"] if row.get("success")),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
