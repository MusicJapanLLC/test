#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU = ROOT / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju.owner_frontier_council import run_frontier_cycle


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Owner frontier approval council")
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument("--config")
    parser.add_argument("--envelope")
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_frontier_cycle(
        args.repo_root,
        args.state_dir,
        config_path=args.config,
        envelope_path=args.envelope,
    )
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
