#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.meta.cooperative_authority_loop import run_cycle


def _load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one persistent META/X/Senju cooperative authority cycle")
    parser.add_argument("--events", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    result = run_cycle(
        _load(args.events),
        _load(args.policy),
        args.state_dir,
        args.repo,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
