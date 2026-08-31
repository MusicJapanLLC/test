"""CLI for the production AI Security Proposal closed loop."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from engine.security_proposal import apply_proposal_to_state, evaluate_security_proposal


def _load(path: str | Path, default: Any) -> Any:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate/apply AI Security Proposals")
    parser.add_argument("proposal", nargs="+")
    parser.add_argument("--state")
    parser.add_argument("--write-state")
    parser.add_argument("--decision-dir")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    state = _load(args.state, {}) if args.state else {}
    decisions: list[dict[str, Any]] = []

    for proposal_path in args.proposal:
        proposal = _load(proposal_path, {})
        decision = evaluate_security_proposal(proposal)
        decisions.append(decision)

        if args.decision_dir:
            out_dir = Path(args.decision_dir)
            out_dir.mkdir(parents=True, exist_ok=True)
            name = Path(proposal_path).stem + ".decision.json"
            (out_dir / name).write_text(
                json.dumps(decision, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        if decision["self_approved"] is not True:
            print(json.dumps(decision, ensure_ascii=False, indent=2))
            return 2

        if args.apply:
            state = apply_proposal_to_state(state, proposal, decision)

    if args.apply and args.write_state:
        target = Path(args.write_state)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "schema": "the-world-security-proposal-loop/v1",
        "environment": "production",
        "closed_loop": True,
        "count": len(decisions),
        "all_self_approved": all(d["self_approved"] for d in decisions),
        "decisions": decisions,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
