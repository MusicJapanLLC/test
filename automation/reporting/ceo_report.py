#!/usr/bin/env python3
"""Owner-facing final report emitter for the AI Company.

Only BOSS-final events may reach the owner channel. TOMOKI/MANAGER/worker events are
internal supervision evidence and are intentionally rejected here even if a workflow
accidentally invokes this script.

Owner-visible reports are state-delta reports: BEFORE -> AFTER -> capability -> benefit
-> evidence -> next measurable evolution. Raw activity belongs at the bottom.
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
STAGE_LABELS = {
    0: "IDEA",
    1: "INSPECTABLE",
    2: "VERIFIED ONCE",
    3: "REPEATABLE",
    4: "AUTONOMOUS",
    5: "EXTERNAL VALUE",
}


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


def _text(event: dict[str, Any], key: str, fallback: str = "") -> str:
    value = event.get(key)
    return str(value if value not in (None, "") else fallback).strip()


def _stage(value: Any) -> int | None:
    try:
        stage = int(value)
    except (TypeError, ValueError):
        return None
    return stage if stage in STAGE_LABELS else None


def _render_metrics(event: dict[str, Any]) -> list[str]:
    metrics = event.get("metrics") or []
    lines: list[str] = []
    if isinstance(metrics, list):
        for metric in metrics[:6]:
            if not isinstance(metric, dict) or not metric.get("name"):
                continue
            name = str(metric.get("name"))
            before = metric.get("before", "?")
            after = metric.get("after", "?")
            unit = str(metric.get("unit", "")).strip()
            suffix = f" {unit}" if unit else ""
            lines.append(f"• {name}: `{before}{suffix} -> {after}{suffix}`")
    if not lines:
        measurement_next = _text(event, "measurement_next")
        if measurement_next:
            lines.append(f"• `UNMEASURED` — 次回計測: {measurement_next}")
    return lines


def _render_portfolio_moves(event: dict[str, Any]) -> list[str]:
    moves = event.get("portfolio_moves") or []
    lines: list[str] = []
    if not isinstance(moves, list):
        return lines
    for move in moves[:3]:
        if not isinstance(move, dict):
            continue
        title = str(move.get("title") or "artifact")[:120]
        before = move.get("before_stage", "?")
        after = move.get("after_stage", "?")
        effect = str(move.get("effect") or move.get("value") or "")[:240]
        suffix = f" — {effect}" if effect else ""
        lines.append(f"• {title}: `L{before} -> L{after}`{suffix}")
    return lines


def render(event: dict[str, Any]) -> str:
    project = str(event.get("project", "AI Company"))[:120]
    state = str(event.get("state", "RUNNING"))
    summary = _text(event, "change_summary", _text(event, "executive_summary", _text(event, "business_effect", "重要な変化を検出")))[:700]
    before_state = _text(event, "before_state")[:700]
    after_state = _text(event, "after_state")[:700]
    capability_gain = _text(event, "capability_gain")[:600]
    owner_benefit = _text(event, "owner_benefit")[:600]
    business_effect = _text(event, "business_effect")[:600]
    residual_risk = _text(event, "residual_risk", _text(event, "remaining_risk"))[:600]
    owner_action = _text(event, "owner_action", "NONE")[:400]
    next_target = _text(event, "next_target", _text(event, "next_improvement"))[:600]
    success_criteria = _text(event, "success_criteria")[:600]
    evidence = _text(event, "evidence")[:1000]
    unresolved = _count(event, "unresolved")
    critical = int(event.get("priorities", {}).get("critical", 0) or 0)
    high = int(event.get("priorities", {}).get("high", 0) or 0)
    stage_before = _stage(event.get("evolution_stage_before"))
    stage_after = _stage(event.get("evolution_stage_after"))

    lines = [
        f"*CEO EVOLUTION REPORT｜{project}*",
        f"*結論 / Company delta:* {summary}",
        f"*状態:* {state}",
    ]

    if before_state or after_state:
        lines += [
            "",
            "*何が変わった*",
            f"• Before: {before_state or 'UNMEASURED / baseline missing'}",
            f"• After: {after_state or 'UNMEASURED / current verification missing'}",
        ]

    if stage_before is not None or stage_after is not None:
        before_label = STAGE_LABELS.get(stage_before, "UNKNOWN")
        after_label = STAGE_LABELS.get(stage_after, "UNKNOWN")
        lines.append(f"• Evolution: `L{stage_before} {before_label} -> L{stage_after} {after_label}`")

    if capability_gain:
        lines += ["", "*新しく可能になったこと*", capability_gain]

    if owner_benefit or business_effect:
        lines += ["", "*経営メリット*"]
        if owner_benefit:
            lines.append(f"• Owner/User: {owner_benefit}")
        if business_effect:
            lines.append(f"• Business: {business_effect}")

    metric_lines = _render_metrics(event)
    if metric_lines:
        lines += ["", "*実測差分*", *metric_lines]

    portfolio_lines = _render_portfolio_moves(event)
    if portfolio_lines:
        lines += ["", "*Portfolio movement*", *portfolio_lines]

    if unresolved or critical or high or residual_risk:
        lines += ["", "*残る問題 / リスク*"]
        if unresolved or critical or high:
            lines.append(f"• 未解決: {unresolved}件（P0 {critical} / P1 {high}）")
        if residual_risk:
            lines.append(f"• {residual_risk}")

    lines += ["", f"*あなたの判断:* {'不要' if owner_action == 'NONE' else owner_action}"]

    if next_target:
        lines += ["", "*次の進化*", next_target]
    if success_criteria:
        lines.append(f"*成功条件:* {success_criteria}")
    if evidence:
        lines += ["", "*Evidence*", evidence]

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
