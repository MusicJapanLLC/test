#!/usr/bin/env python3
"""Run the production Owner-scope negotiation cycle.

Every negotiation-originated case first passes the META/X/SENJU intake review gate.
Only 3-of-3 admitted cases may begin the existing formal Owner-scope discussion.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.reviewed_owner_scope_runtime import run_reviewed_production_scope_negotiation_cycle  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--state-dir", default=str(_REPO_ROOT / "senju" / "state"))
    parser.add_argument("--envelope")
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_reviewed_production_scope_negotiation_cycle(
        args.repo_root,
        args.state_dir,
        envelope_path=args.envelope,
    )
    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    print(rendered)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
