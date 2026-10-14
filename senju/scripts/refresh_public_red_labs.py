#!/usr/bin/env python3
"""Refresh bounded SENJU RED public-lab authority and discovery candidates."""
from __future__ import annotations

import argparse
import json

from senju.public_red_lab_discovery import refresh_public_red_lab_authority


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--meta-state-dir", default="automation/codegen/meta_state")
    parser.add_argument("--upstream-vwad")
    parser.add_argument("--max-auto-new", type=int, default=2)
    args = parser.parse_args()
    result = refresh_public_red_lab_authority(
        args.repo_root,
        args.state_dir,
        args.meta_state_dir,
        upstream_vwad=args.upstream_vwad,
        max_auto_new=args.max_auto_new,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
