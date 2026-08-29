#!/usr/bin/env python3
"""BOSS gate: turn MANAGER outcomes into CEO events only when useful."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manager_report")
    parser.add_argument("--out", default="reports/ceo-events/manager-latest.json")
    args = parser.parse_args()

    report = json.loads(Path(args.manager_report).read_text(encoding="utf-8"))
    workers = report.get("workers", [])
    unresolved = [w for w in workers if w.get("after") == "UNRESOLVED" and w.get("priority") in {"P0", "P1"}]
    repaired_p0 = [w for w in workers if w.get("priority") == "P0" and w.get("after") == "RECOVERING"]
    incidents = int(report.get("summary", {}).get("incidents", 0) or 0)
    recoveries = int(report.get("summary", {}).get("internal_recovery_actions", 0) or 0)

    should_report = bool(unresolved or repaired_p0)
    state = "BLOCKED" if unresolved else "RUNNING"
    owner_action = "NONE"
    if unresolved:
        owner_action = "Review unresolved P0/P1 dependency: " + ", ".join(w["name"] for w in unresolved[:3])

    event = {
        "schema": "ai-factory-ceo-event/v1",
        "project": "AI Company Self-Healing Control Plane",
        "state": state,
        "privacy": "aggregate-only; no raw logs/customer/email content",
        "counts": {
            "incidents_detected": incidents,
            "internal_recovery_actions": recoveries,
            "unresolved": len(unresolved),
            "recovering_p0": len(repaired_p0),
        },
        "priorities": {
            "critical": sum(1 for w in unresolved if w.get("priority") == "P0"),
            "high": sum(1 for w in unresolved if w.get("priority") == "P1"),
        },
        "owner_action": owner_action,
        "business_effect": (
            "停止workerをCEOへ丸投げせず、MANAGERが再実行・再割当を先に実施。"
            f" 今回の内部復旧アクション={recoveries}、未解決P0/P1={len(unresolved)}。"
        ),
        "next_improvement": "次cycleでRECOVERING workerを再検証し、回復しなければHOUND/SKEPTIC/FORGEへ段階的に再割当する。",
        "should_report": should_report,
        "evidence": {
            "manager_schema": report.get("schema"),
            "scoreboard": report.get("scoreboard", []),
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(event, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("report=true" if should_report else "report=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
