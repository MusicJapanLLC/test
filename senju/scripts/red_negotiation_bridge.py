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

from senju.red_negotiation_bridge import run_red_negotiation_bridge  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--canonical-targets", type=Path, default=Path("AUTHORIZED_TEST_TARGETS.json"))
    parser.add_argument("--standing-authorizations", type=Path, default=Path("senju/state/standing_authorizations.json"))
    parser.add_argument("--red-report", type=Path, action="append", default=[])
    parser.add_argument("--rotation", type=int, default=0)
    parser.add_argument("--profile", default=None)
    parser.add_argument("--scope-out", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    result = run_red_negotiation_bridge(
        args.state_dir,
        canonical_targets=args.canonical_targets,
        standing_authorizations=args.standing_authorizations,
        red_reports=args.red_report,
        rotation=args.rotation,
        profile=args.profile,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.scope_out is not None and result.get("selected_scope"):
        args.scope_out.parent.mkdir(parents=True, exist_ok=True)
        args.scope_out.write_text(
            json.dumps(result["selected_scope"], ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
