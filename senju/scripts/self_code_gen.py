"""Senju coverage-gap candidate generator, adapted from PR #252.

By default this materializes synthetic/owned-lab manifests only. ``--dry-run`` is
CI-friendly. PR publication remains a separate repository action so generation
does not silently self-approve or self-merge.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", default="senju/state/last-evolution-summary.json")
    parser.add_argument("--labs-dir", default="senju/labs")
    parser.add_argument("--max-manifests", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from senju.lab_planner import plan

    written = plan(args.summary, args.labs_dir, args.max_manifests)
    payload = {
        "schema": "senju-self-code-gen/v2",
        "mode": "candidate-only",
        "dry_run": bool(args.dry_run),
        "count": len(written),
        "files": [str(path) for path in written],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
