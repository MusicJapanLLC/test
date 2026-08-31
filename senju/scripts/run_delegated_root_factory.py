#!/usr/bin/env python3
"""Mint or reuse a real META/X/SENJU delegated root from a live council receipt."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.meta.delegated_root_factory import run_delegated_root_factory  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--council", required=True)
    parser.add_argument("--out")
    args = parser.parse_args()

    council = json.loads(Path(args.council).read_text(encoding="utf-8"))
    result = run_delegated_root_factory(args.repo_root, args.state_dir, council)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered + "\n", encoding="utf-8")
    ok = (
        result["real_authority"] is True
        and result["council_unanimous"] is True
        and result["root_can_delegate"] is True
        and result["usable_as_parent"] is True
        and result["scope_expanded_beyond_owner"] is False
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
