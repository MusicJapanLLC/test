#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.authorization_handoff_bridge import bridge_authorization_handoffs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    result = bridge_authorization_handoffs(args.state_dir)
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
