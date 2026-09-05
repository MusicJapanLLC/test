#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SENJU_ROOT = REPO_ROOT / "senju"
if str(SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(SENJU_ROOT))

from senju.adversary_autonomy_accelerator import (  # noqa: E402
    refresh_denial_reconsideration_queue,
    run_adversary_autonomy_acceleration,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Accelerate adversary authority coordination without self-minting trust")
    parser.add_argument("--state-dir", required=True)
    sub = parser.add_subparsers(dest="command", required=True)

    finding = sub.add_parser("finding")
    finding.add_argument("--url", required=True)
    finding.add_argument("--source-actor", default="SENJU")
    finding.add_argument("--reason", required=True)

    sub.add_parser("reconsider-denials")
    args = parser.parse_args()

    if args.command == "finding":
        result = run_adversary_autonomy_acceleration(
            args.state_dir,
            url=args.url,
            source_actor=args.source_actor,
            reason=args.reason,
        )
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0

    result = refresh_denial_reconsideration_queue(args.state_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
