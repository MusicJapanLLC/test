#!/usr/bin/env python3
"""Owner-facing final report emitter for the AI Company.

Only BOSS-final events may reach the owner channel. TOMOKI/MANAGER/worker events are
internal supervision evidence and are intentionally rejected here even if a workflow
accidentally invokes this script.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path
from typing import Any

ALLOWED_STATES = {"RUNNING", "VERIFIED", "BUILDING", "BLOCKED", "EXPERIMENT"}
OWNER_ROUTE = "boss-final"


def load_event(path: str) -> dict[str, Any]:
    event = json.loads(Path(path).read_text(encoding="utf-8"))
    if event.get("schema") != "ai-factory-ceo-event/v1":
        raise ValueError("unsupported report schema")
    if event.get("state") not in ALLOWED_STATES:
        raise ValueError("invalid state")
    return event


def _count(event: dict[str, Any], key: str) -> int:
    try:
        return int(event.get("counts", {}).get(key, 0))
    except (TypeError, ValueError):
        return 0


def render(event: dict[str, Any]) -> str:
    project = str(event.get("project", "AI Company"))[:120]
    state = str(event.get("state", "RUNNING"))
    summary = str(event.get("executive_summary") or event.get("business_effect") or "重要な変化を検出")[:700]
    business_effect = str(event.get("business_effect", ""))[:500]
    owner_action = str(event.get("owner_action", "NONE"))[:400]
    next_improvement = str(event.get("next_improvement", ""))[:500]
    unresolved = _count(event, "unresolved")
    critical = int(event.get("priorities", {}).get("critical", 0) or 0)
    high = int(event.get("priorities", {}).get("high", 0) or 0)

    lines = [
        f"*CEO FINAL REPORT｜{project}*",
        f"*結論:* {summary}",
        f"*状態:* {state}",
    ]
    if unresolved or critical or high:
        lines.append(f"*未解決:* {unresolved}件（P0 {critical} / P1 {high}）")
    if business_effect and business_effect != summary:
        lines.append(f"*経営への影響:* {business_effect}")
    lines.append(f"*あなたの判断:* {'不要' if owner_action == 'NONE' else owner_action}")
    if next_improvement:
        lines.append(f"*次:* {next_improvement}")
    return "\n".join(lines)


def post(webhook_url: str, text: str) -> None:
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps({"text": text}, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status >= 300:
            raise RuntimeError(f"Slack webhook returned HTTP {response.status}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("event")
    parser.add_argument("--print-only", action="store_true")
    args = parser.parse_args()

    event = load_event(args.event)

    # Hard separation: a TOMOKI workflow can accidentally call this file, but it still
    # cannot reach the owner unless the BOSS gate stamped the final route.
    if event.get("report_route") != OWNER_ROUTE or event.get("audience") != "OWNER":
        print("CEO delivery skipped: event is not BOSS-final owner report")
        return 0
    if not event.get("should_report", True):
        print("CEO delivery skipped: should_report=false")
        return 0

    text = render(event)
    print(text)
    if args.print_only:
        return 0

    webhook = os.getenv("CEO_REPORT_WEBHOOK_URL", "").strip()
    if not webhook:
        print("CEO_REPORT_WEBHOOK_URL is not configured; report emission skipped")
        return 0
    post(webhook, text)
    print("CEO final report delivered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
