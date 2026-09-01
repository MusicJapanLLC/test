#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SENJU = REPO / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju.red_authorized_url_pool import write_authorized_url_pool  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-queue", type=Path, default=Path("senju/state/red_authorized_target_queue.json"))
    parser.add_argument("--red-report", type=Path, action="append", default=[])
    parser.add_argument("--pool-size", type=int, default=100)
    parser.add_argument("--rotation", type=int, default=0)
    parser.add_argument("--window-size", type=int, default=24)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--scope-out", type=Path, default=None)
    args = parser.parse_args()

    result = write_authorized_url_pool(
        args.target_queue,
        args.out,
        red_reports=args.red_report,
        pool_size=args.pool_size,
        rotation=args.rotation,
        window_size=args.window_size,
    )

    if args.scope_out is not None and result.get("selected_urls"):
        selected = result["selected_urls"]
        hosts = sorted({row["host"] for row in selected})
        seeds = [row["url"] for row in selected]
        shared_only = all(bool(row.get("shared_instance")) for row in selected)
        scope = {
            "schema": "senju-red-expedition-scope/v1",
            "scope_id": f"red-authorized-url-window-{args.rotation}",
            "allowed_hosts": hosts,
            "seed_urls": seeds,
            "max_contacts": min(24 if shared_only else 32, len(seeds)),
            "discovery_depth": 2,
            "max_links_per_response": 40,
            "allow_http": False,
            "retries": 1 if shared_only else 2,
            "timeout_seconds": 8,
        }
        args.scope_out.parent.mkdir(parents=True, exist_ok=True)
        args.scope_out.write_text(json.dumps(scope, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps({
        "url_count": result["url_count"],
        "pool_full": result["pool_full"],
        "selected_count": len(result["selected_urls"]),
        "authorized_host_count": result["authorized_host_count"],
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
