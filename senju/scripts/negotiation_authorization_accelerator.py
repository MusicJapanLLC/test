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

from senju.negotiation_authorization_accelerator import (  # noqa: E402
    run_negotiation_authorization_accelerator,
)
from senju.negotiation_case_review_gate import run_negotiation_case_review_gate  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("senju/state"))
    parser.add_argument("--canonical-targets", type=Path, default=Path("AUTHORIZED_TEST_TARGETS.json"))
    parser.add_argument(
        "--verified-attestations",
        type=Path,
        default=Path("senju/state/verified_control_attestations.json"),
    )
    parser.add_argument("--minimum-batch", type=int, default=5)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    gate = run_negotiation_case_review_gate(args.state_dir)
    result = run_negotiation_authorization_accelerator(
        args.state_dir,
        canonical_targets=args.canonical_targets,
        verified_attestations=args.verified_attestations,
        minimum_batch=args.minimum_batch,
    )
    result["intake_gate"] = {
        "case_count": gate.get("case_count", 0),
        "admitted_count": gate.get("admitted_count", 0),
        "held_count": gate.get("held_count", 0),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
