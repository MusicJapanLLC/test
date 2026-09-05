#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.rights_request_federation import run_rights_request_federation


def main() -> int:
    parser = argparse.ArgumentParser(description="Feed discovery/authority/denial evidence into Owner-scope rights negotiation")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--runtime-dir", action="append", default=[])
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_rights_request_federation(
        args.repo_root,
        args.state_dir,
        runtime_dirs=args.runtime_dir,
    )
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
