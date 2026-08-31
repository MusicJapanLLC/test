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

from senju.meta.promotion_intelligence_exchange import run_promotion_intelligence_exchange  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Exchange negotiation intelligence with Authorized Host Promotion Corps")
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--promotion-dir", default="senju/state/authorized-host-promotion")
    parser.add_argument("--input-root", action="append", default=[])
    parser.add_argument("--phase", choices=("before_promotion", "after_promotion"), default="before_promotion")
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_promotion_intelligence_exchange(
        args.state_dir,
        args.promotion_dir,
        input_roots=args.input_root,
        phase=args.phase,
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
