#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.negotiation_case_recommendation import run_negotiation_case_recommendation  # noqa: E402
from senju.negotiation_case_review_gate import run_negotiation_case_review_gate  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="META/X/SENJU pre-formal negotiation case review gate")
    parser.add_argument("--state-dir", default=str(_REPO_ROOT / "senju" / "state"))
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_negotiation_case_review_gate(args.state_dir)
    recommendation = run_negotiation_case_recommendation(args.state_dir)
    result = {
        **result,
        "recommendation_count": recommendation["recommendation_count"],
        "recommendation_target_rate": recommendation["target_rate"],
        "recommendation_labels": recommendation["labels"],
    }

    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    print(rendered)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
