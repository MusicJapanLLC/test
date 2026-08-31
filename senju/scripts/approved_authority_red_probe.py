#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU = ROOT / "senju"
if str(SENJU) not in sys.path:
    sys.path.insert(0, str(SENJU))

from senju.approved_authority_red_lane import execute_authorized_red_contact
from senju.external_denial_learning import DenialLearningMemory


def _load_memory(path: Path) -> DenialLearningMemory:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        raw = None
    return DenialLearningMemory.from_mapping(raw)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the small SENJU RED pilot against an already-approved Authority host only"
    )
    parser.add_argument("--url", required=True)
    parser.add_argument("--method", default="GET", choices=("GET", "HEAD"))
    parser.add_argument("--operation-id", default=f"approved-red-{uuid.uuid4().hex[:12]}")
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument("--rollout-percent", type=int, default=45)
    parser.add_argument("--max-attempts", type=int, default=2)
    parser.add_argument(
        "--memory",
        default=str(ROOT / "senju" / "state" / "approved_authority_red_memory.json"),
    )
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    memory_path = Path(args.memory)
    memory = _load_memory(memory_path)
    result = execute_authorized_red_contact(
        repo_root=args.repo_root,
        state_dir=args.state_dir,
        operation_id=args.operation_id,
        url=args.url,
        method=args.method,
        rollout_percent=args.rollout_percent,
        max_attempts=args.max_attempts,
        memory=memory,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    memory.write(memory_path)
    print(json.dumps({
        "eligible": result.get("eligible"),
        "selected_by_rollout": result.get("selected_by_rollout"),
        "external_contact_attempted": result.get("external_contact_attempted"),
        "success": result.get("success"),
        "stop_reason": result.get("stop_reason"),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
