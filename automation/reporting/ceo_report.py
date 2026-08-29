#!/usr/bin/env python3
"""Shared owner-facing report emitter for the AI Factory.

Input: ai-factory-ceo-event/v1 JSON produced by any worker.
Output: concise Japanese Slack message through CEO_REPORT_WEBHOOK_URL.

Never send raw logs, stack traces, email subjects/bodies, secrets or customer data.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path
from typing import Any

ALLOWED_STATES = {"RUNNING", "VERIFIED", "BUILDING", "BLOCKED", "EXPERIMENT"}


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
    project = str(event.get("project", "AI Factory"))[:120]
    state = event["state"]
    classified = _count(event, "classified")
    archived = _count(event, "archived")
    kept = _count(event, "kept_in_inbox")
    starred = _count(event, "starred")
    unclassified = _count(event, "unclassified")
    critical = int(event.get("priorities", {}).get("critical", 0) or 0)
    high = int(event.get("priorities", {}).get("high", 0) or 0)

    lines = [
        f"*AI FACTORY CEO UPDATE｜{project}* — *{state}*",
        "",
        f"*今回の成果:* 自動処理 {classified}件 / 受信箱から整理 {archived}件 / 受信箱に保持 {kept}件 / スター {starred}件",
    ]
    if critical or high:
        lines.append(f"*要注目:* critical {critical}件 / high {high}件（内容そのものはCEOチャンネルへ流しません）")
    if unclassified:
        lines.append(f"*未分類:* {unclassified}件は安全側に倒して受信箱に残しました")
    effect = str(event.get("business_effect", ""))[:500]
    if effect:
        lines.append(f"*経営メリット:* {effect}")
    next_improvement = str(event.get("next_improvement", ""))[:500]
    if next_improvement:
        lines.append(f"*次の改善:* {next_improvement}")
    owner_action = str(event.get("owner_action", "NONE"))[:300]
    lines.append(f"*Owner action:* {owner_action}")
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
    text = render(event)
    print(text)
    if args.print_only:
        return 0

    webhook = os.getenv("CEO_REPORT_WEBHOOK_URL", "").strip()
    if not webhook:
        print("CEO_REPORT_WEBHOOK_URL is not configured; report emission skipped")
        return 0
    post(webhook, text)
    print("CEO report delivered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
