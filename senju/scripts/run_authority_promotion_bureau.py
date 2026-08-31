#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from senju.authority_promotion_bureau import run_authority_promotion_bureau


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the independent reviewed-Authority promotion bureau")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--meta-state-dir", default="automation/codegen/meta_state")
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--stalled-after-seconds", type=int, default=20 * 60)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    result = run_authority_promotion_bureau(
        args.state_dir,
        meta_state_dir=args.meta_state_dir,
        output_dir=args.output_dir,
        stalled_after_seconds=args.stalled_after_seconds,
    )
    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.out:
        from pathlib import Path
        Path(args.out).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
