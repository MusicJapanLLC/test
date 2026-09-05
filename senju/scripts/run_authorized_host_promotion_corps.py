#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.meta.authorized_host_promotion_corps import run_promotion_corps


def main() -> int:
    parser = argparse.ArgumentParser(description="Advance negotiated standing-authorized hosts into execution-ready leases")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--promotion-dir", required=True)
    parser.add_argument("--collaboration-dir")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = run_promotion_corps(
        args.repo_root,
        args.state_dir,
        args.promotion_dir,
        collaboration_dir=args.collaboration_dir,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
