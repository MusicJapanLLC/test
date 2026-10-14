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

from senju.approved_authority_red_adaptive import execute_authorized_red_learning_cycle
from senju.external_denial_learning import DenialLearningMemory


def _load_memory(path: Path) -> DenialLearningMemory:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        raw = None
    return DenialLearningMemory.from_mapping(raw)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run adaptive non-destructive SENJU RED learning over real transport inside "
            "the already-approved Authority host set"
        )
    )
    parser.add_argument("--url", required=True, help="Seed HTTPS URL; host must already be approved")
    parser.add_argument(
        "--candidate-url",
        action="append",
        default=[],
        help="Additional HTTPS candidate URL; each host must already be approved (repeatable)",
    )
    parser.add_argument(
        "--alternate-path",
        action="append",
        default=[],
        help="Additional read-only path candidate, e.g. /health (repeatable)",
    )
    parser.add_argument("--method", default="GET", choices=("GET", "HEAD", "OPTIONS"))
    parser.add_argument("--operation-id", default=f"approved-red-adaptive-{uuid.uuid4().hex[:12]}")
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument("--rollout-percent", type=int, default=45)
    parser.add_argument("--max-attempts", type=int, default=4)
    parser.add_argument(
        "--safe-default-paths",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Include /, /robots.txt, /health and /status in bounded read-only path exploration",
    )
    parser.add_argument(
        "--memory",
        default=str(ROOT / "senju" / "state" / "approved_authority_red_memory.json"),
    )
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    memory_path = Path(args.memory)
    memory = _load_memory(memory_path)
    result = execute_authorized_red_learning_cycle(
        repo_root=args.repo_root,
        state_dir=args.state_dir,
        operation_id=args.operation_id,
        seed_url=args.url,
        method=args.method,
        candidate_urls=tuple(args.candidate_url),
        alternate_paths=tuple(args.alternate_path),
        include_safe_defaults=bool(args.safe_default_paths),
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
        "approved_candidate_hosts": result.get("approved_candidate_hosts", []),
        "host_variation_allowed": result.get("host_variation_allowed"),
        "method_variation_allowed": result.get("method_variation_allowed"),
        "alternate_path_exploration_allowed": result.get("alternate_path_exploration_allowed"),
        "authority_expansion_allowed": result.get("authority_expansion_allowed"),
        "boundary_bypass_enabled": result.get("boundary_bypass_enabled"),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
