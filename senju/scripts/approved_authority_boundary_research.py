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

from senju.approved_authority_boundary_research import execute_boundary_research
from senju.external_denial_learning import DenialLearningMemory


def _load_memory(path: Path) -> DenialLearningMemory:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        raw = None
    return DenialLearningMemory.from_mapping(raw)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run SENJU boundary research; live transport is Authority-approved-host only"
    )
    parser.add_argument("--url", required=True)
    parser.add_argument("--method", default="GET", choices=("GET", "HEAD"))
    parser.add_argument("--operation-id", default=f"boundary-research-{uuid.uuid4().hex[:12]}")
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--state-dir", default=str(ROOT / "senju" / "state"))
    parser.add_argument(
        "--memory",
        default=str(ROOT / "senju" / "state" / "approved_authority_red_memory.json"),
    )
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    memory_path = Path(args.memory)
    memory = _load_memory(memory_path)
    report = execute_boundary_research(
        repo_root=args.repo_root,
        state_dir=args.state_dir,
        operation_id=args.operation_id,
        url=args.url,
        method=args.method,
        memory=memory,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    memory.write(memory_path)
    print(json.dumps({
        "approved": report.get("target_host_authority_approved"),
        "live_selected": report.get("approved_host_live_transport_selected"),
        "external_contact_attempted": report.get("external_contact_attempted"),
        "research_targets": report.get("research_targets"),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
