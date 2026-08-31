from __future__ import annotations

import argparse
import json
from pathlib import Path

from senju.owner_file_governance import write_owner_governance_inventory


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = write_owner_governance_inventory(args.repo_root, args.out)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
