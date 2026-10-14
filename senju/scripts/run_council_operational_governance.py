#!/usr/bin/env python3
"""Run META/X/SENJU operational governance against the live Senju state directory."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU_PACKAGE_ROOT = ROOT / "senju"
if str(SENJU_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(SENJU_PACKAGE_ROOT))

from senju.council_operational_governance import run_council_operational_governance  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=ROOT)
    parser.add_argument("--state-dir", type=Path, default=ROOT / "senju" / "state")
    args = parser.parse_args()
    result = run_council_operational_governance(args.repo_root, args.state_dir)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
