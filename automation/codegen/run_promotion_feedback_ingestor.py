#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from engine.promotion_feedback_ingestor import run_promotion_feedback_ingestor


def main() -> int:
    parser = argparse.ArgumentParser(description="Fold Promotion Corps feedback into shared Root negotiation memory")
    parser.add_argument("--state", default=".authority-opportunity-runtime")
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    result = run_promotion_feedback_ingestor(args.state)
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
