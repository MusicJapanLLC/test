#!/usr/bin/env python3
"""BOSS gate: the only path from internal supervision to the owner-facing CEO channel.

TOMOKI/MANAGER reports are internal evidence.  The owner is notified only when the
BOSS layer has already observed TOMOKI/MANAGER, bounded recovery has failed, and an
unresolved P0/P1 incident remains.  Recovered/recovering incidents stay internal.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

OWNER_PRIORITIES = {"P0", "P1"}
BOSS_MANAGED_WORKERS = {"tomoki-manager"}


def is_boss_layer(report: dict[str, Any]) -> bool:
    """Return True only for the BOSS watchdog report, never a TOMOKI floor report."""
    worker_ids = {str(w.get("id", "")) for w in report.get("workers", []) if w.get("id")}
    return bool(worker_ids) and worker_ids.issubset(BOSS_MANAGED_WORKERS)


def build_event(report: dict[str, Any]) -> dict[str, Any]:
    workers = report.get("workers", [])
    boss_layer = is_boss_layer(report)
    unresolved = [
        w
        for w in workers
        if w.get("after") == "UNRESOLVED" and w.get("priority") in OWNER_PRIORITIES
    ]
    incidents = int(report.get("summary", {}).get("incidents", 0) or 0)
    recoveries = int(report.get("summary", {}).get("internal_recovery_actions", 0) or 0)

    # The owner is busy: successful recovery, active recovery, and ordinary monitoring
    # never leave the internal TOMOKI layer.  Only unresolved executive exceptions do.
    should_report = boss_layer and bool(unresolved)
    state = "BLOCKED" if should_report else "RUNNING"

    owner_action = "NONE"
    if should_report:
        names = ", ".join(str(w.get("name") or w.get("id")) for w in unresolved[:3])
        owner_action = f"未解決P0/P1の外部依存・権限・方針判断を確認: {names}"

    if should_report:
        executive_summary = (
            f"TOMOKI監視網が検知・自動復旧を試行しましたが、未解決P0/P1が{len(unresolved)}件残っています。"
        )
        business_effect = "通常運転では吸収できない例外です。経営判断または権限判断だけが必要です。"
        next_improvement = "判断後、BOSSがTOMOKIへ戻して再検証し、解消確認まで内部で追跡します。"
    else:
        executive_summary = "内部監視・復旧ループ内で処理済み。Ownerへの報告対象ではありません。"
        business_effect = ""
        next_improvement = "TOMOKIが次cycleで監視・再検証を継続します。"

    return {
        "schema": "ai-factory-ceo-event/v1",
        "report_route": "boss-final" if boss_layer else "tomoki-internal",
        "source_layer": "BOSS" if boss_layer else "TOMOKI",
        "audience": "OWNER" if should_report else "INTERNAL",
        "project": "AI Company Control Plane",
        "state": state,
        "executive_summary": executive_summary,
        "privacy": "aggregate-only; no raw logs/customer/email content",
        "counts": {
            "incidents_detected": incidents,
            "internal_recovery_actions": recoveries,
            "unresolved": len(unresolved),
        },
        "priorities": {
            "critical": sum(1 for w in unresolved if w.get("priority") == "P0"),
            "high": sum(1 for w in unresolved if w.get("priority") == "P1"),
        },
        "owner_action": owner_action,
        "business_effect": business_effect,
        "next_improvement": next_improvement,
        "should_report": should_report,
        "evidence": {
            "manager_schema": report.get("schema"),
            "scoreboard": report.get("scoreboard", []),
            "boss_layer": boss_layer,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manager_report")
    parser.add_argument("--out", default="reports/ceo-events/manager-latest.json")
    args = parser.parse_args()

    report = json.loads(Path(args.manager_report).read_text(encoding="utf-8"))
    event = build_event(report)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(event, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("report=true" if event["should_report"] else "report=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
