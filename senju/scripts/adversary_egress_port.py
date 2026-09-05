#!/usr/bin/env python3
"""CLI for the adversary external-host request/vote/promotion port.

This command never performs network I/O. A successful `promote` command emits the same
Authority Context + handoff plan used by the shared #473 coordination pipeline.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SENJU_ROOT = REPO_ROOT / "senju"
CODEGEN_ROOT = REPO_ROOT / "automation" / "codegen"
for item in (SENJU_ROOT, CODEGEN_ROOT):
    if str(item) not in sys.path:
        sys.path.insert(0, str(item))

from senju.adversary_egress_request import (  # noqa: E402
    AdversaryEgressRequestPort,
    OwnerPromotionTicket,
)
from senju.meta.adversary_egress_vote_router import route_pending_vote_requests  # noqa: E402
from engine.authority_coordination import build_handoff_plan, context_from_lease  # noqa: E402


def _json(path: str | Path) -> dict[str, object]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("JSON input must be an object")
    return value


def _csv(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", default="automation/codegen/meta_state")
    parser.add_argument("--min-allow-votes", type=int, default=2)
    sub = parser.add_subparsers(dest="command", required=True)

    request = sub.add_parser("request")
    request.add_argument("--url", required=True)
    request.add_argument("--actor", required=True)
    request.add_argument("--reason", required=True)
    request.add_argument("--capabilities", default="scan,probe")
    request.add_argument("--methods", default="GET,HEAD")

    vote = sub.add_parser("vote")
    vote.add_argument("--request-id", required=True)
    vote.add_argument("--agent", required=True)
    vote.add_argument("--effect", required=True, choices=("allow", "deny", "abstain", "hard_deny"))
    vote.add_argument("--reason", required=True)

    promote = sub.add_parser("promote")
    promote.add_argument("--request-id", required=True)
    promote.add_argument("--ticket", required=True)
    promote.add_argument("--out", required=True)

    args = parser.parse_args()
    port = AdversaryEgressRequestPort(args.state, min_allow_votes=args.min_allow_votes)

    if args.command == "request":
        decision = port.request(
            args.url,
            source_actor=args.actor,
            reason=args.reason,
            capabilities=_csv(args.capabilities),
            methods=_csv(args.methods),
        )
        solicitations = route_pending_vote_requests(args.state)
        payload = decision.to_dict()
        payload["vote_solicitation_count"] = solicitations["pending_count"]
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if args.command == "vote":
        result = port.vote(
            args.request_id,
            agent=args.agent,
            effect=args.effect,
            reason=args.reason,
        )
        solicitations = route_pending_vote_requests(args.state)
        payload = result.to_dict()
        payload["remaining_vote_solicitations"] = solicitations["pending_count"]
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    ticket = OwnerPromotionTicket.from_mapping(_json(args.ticket))
    decision = port.promote(args.request_id, ticket=ticket)
    payload: dict[str, object] = {"decision": decision.to_dict()}
    if decision.status == "promoted" and decision.lease is not None:
        context = context_from_lease(decision.lease)
        payload["authority_context"] = context.to_dict()
        payload["handoffs"] = build_handoff_plan(context)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": decision.status, "out": str(out)}, ensure_ascii=False))
    return 0 if decision.status == "promoted" else 2


if __name__ == "__main__":
    raise SystemExit(main())
