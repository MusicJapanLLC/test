"""Run autonomous capability-opportunity discovery without autonomous authority mutation."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.world.boundary_opportunity_miner import (  # noqa: E402
    MAX_OPPORTUNITIES,
    run_boundary_opportunity_cycle,
)

STATE_DIR = Path(__file__).resolve().parent / "state"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", default=str(STATE_DIR))
    parser.add_argument("--source-trust-root-id", default="the-world-owner-root")
    parser.add_argument("--max-opportunities", type=int, default=MAX_OPPORTUNITIES)
    args = parser.parse_args()

    result = run_boundary_opportunity_cycle(
        args.state_dir,
        source_trust_root_id=args.source_trust_root_id,
        max_opportunities=args.max_opportunities,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
