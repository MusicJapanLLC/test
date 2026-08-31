#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.adversary_external_action_loop import run_adversary_external_action


def main() -> int:
    parser = argparse.ArgumentParser(description="Run adversary finding -> authority -> real external action loop")
    parser.add_argument("url")
    parser.add_argument("--state-dir", default="automation/codegen/meta_state")
    parser.add_argument("--actor", default="ADVERSARY")
    parser.add_argument("--reason", default="adversary external validation")
    parser.add_argument("--method", default="GET", choices=("GET", "HEAD"))
    args = parser.parse_args()

    result = run_adversary_external_action(
        Path(args.state_dir),
        url=args.url,
        source_actor=args.actor,
        reason=args.reason,
        method=args.method,
    )
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
