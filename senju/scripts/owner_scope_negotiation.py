#!/usr/bin/env python3
"""Run the production Owner-scope negotiation cycle.

The cycle mines current external-host friction, materializes all-agent negotiation work,
and applies only META/X/SENJU-approved amendments that are already inside the explicit
Owner Expansion Envelope.
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

from senju.owner_scope_negotiation import run_scope_negotiation_cycle  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--state-dir", default=str(_REPO_ROOT / "senju" / "state"))
    parser.add_argument("--envelope")
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_scope_negotiation_cycle(
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
