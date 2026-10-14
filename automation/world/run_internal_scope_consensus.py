"""Run the owner-bounded collaborative internal-scope classifier."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from automation.world.internal_scope_consensus import run_state_cycle

DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", default=str(DEFAULT_STATE_DIR))
    args = parser.parse_args()
    result = run_state_cycle(args.state_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
