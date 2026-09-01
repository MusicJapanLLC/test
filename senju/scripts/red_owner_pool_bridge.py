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

from senju.red_owner_pool_bridge import augment_red_queue_from_owner_pool  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--owner-pool", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    result = augment_red_queue_from_owner_pool(
        args.state_dir,
        owner_pool=args.owner_pool,
    )
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
