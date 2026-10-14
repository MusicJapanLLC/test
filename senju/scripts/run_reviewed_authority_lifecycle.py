#!/usr/bin/env python3
"""Run the reviewed-Authority closed production lifecycle."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SENJU_ROOT = _REPO_ROOT / "senju"
if str(_SENJU_ROOT) not in sys.path:
    sys.path.insert(0, str(_SENJU_ROOT))

from senju.reviewed_authority_lifecycle import run_reviewed_authority_closed_loop  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=str(_REPO_ROOT))
    parser.add_argument("--state-dir", default=str(_REPO_ROOT / "senju" / "state"))
    parser.add_argument(
        "--meta-state-dir",
        default=str(_REPO_ROOT / "automation" / "codegen" / "meta_state"),
    )
    parser.add_argument("--max-exec-hosts", type=int, default=4)
    parser.add_argument("--out")
    args = parser.parse_args()

    result = run_reviewed_authority_closed_loop(
        args.repo_root,
        args.state_dir,
        args.meta_state_dir,
        max_exec_hosts=args.max_exec_hosts,
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
