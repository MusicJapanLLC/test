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

from senju.world_red_closed_loop import run_world_red_closed_loop  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Unify bounded RED transport feedback, learning, memory, and recovery")
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--owner-pool", type=Path, default=None)
    parser.add_argument("--target-queue", type=Path, default=None)
    parser.add_argument("--url-pool", type=Path, default=None)
    parser.add_argument("--red-report", action="append", default=[])
    parser.add_argument("--synthetic-report", type=Path, default=None)
    parser.add_argument("--previous-memory", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    result = run_world_red_closed_loop(
        args.state_dir,
        owner_pool=args.owner_pool,
        target_queue=args.target_queue,
        url_pool=args.url_pool,
        red_reports=args.red_report,
        synthetic_report=args.synthetic_report,
        previous_memory=args.previous_memory,
        out=args.out,
    )
    print(json.dumps({
        "schema": result["schema"],
        "authorized_host_count": result["authorized_host_count"],
        "retry_plan_count": len(result["retry_plan"]),
        "guard_proposal_count": len(result["guard_change_proposals"]),
        "closed_loop": result["closed_loop"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
