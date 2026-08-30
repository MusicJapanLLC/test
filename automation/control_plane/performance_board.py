#!/usr/bin/env python3
"""Convert MANAGER health evidence into a bounded worker performance board.

This is performance management, not punishment. It never fires agents, changes
permissions, or spends money. Repeated low performance produces coaching/pairing/
reassignment recommendations and keeps the evidence visible to BOSS.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_SCORE = {
    "HEALTHY": 100,
    "ACTIVE": 82,
    "RECOVERING": 62,
    "STALE": 42,
    "FAILED": 30,
    "STUCK": 25,
    "SILENT": 20,
    "UNKNOWN": 35,
    "UNRESOLVED": 5,
}
PRIORITY_WEIGHT = {"P0": 1.0, "P1": 0.85, "P2": 0.65, "P3": 0.45}


def load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def previous_by_id(previous: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("id")): row
        for row in previous.get("workers", [])
        if isinstance(row, dict) and row.get("id")
    }


def action_for(score: int, state: str, streak: int) -> tuple[str, str]:
    if state == "UNRESOLVED" and streak >= 2:
        return "REASSIGN", "pair with another worker or move ownership next cycle; preserve evidence"
    if score >= 90:
        return "CHAMPION", "keep ownership; reuse the verified pattern"
    if score >= 70:
        return "HEALTHY", "keep ownership; no busywork"
    if score >= 45:
        return "COACH", "pair, inspect root cause, and require a verified next run"
    if streak >= 2:
        return "REASSIGN", "change owner/condition/hypothesis before another direct retry"
    return "WATCH", "one bounded recovery cycle, then reassess"


def build(manager: dict[str, Any], previous: dict[str, Any]) -> dict[str, Any]:
    prev = previous_by_id(previous)
    rows: list[dict[str, Any]] = []
    for worker in manager.get("workers", []) or []:
        if not isinstance(worker, dict):
            continue
        wid = str(worker.get("id", "unknown"))
        state = str(worker.get("after") or worker.get("before") or "UNKNOWN")
        base = int(worker.get("score", STATE_SCORE.get(state, 35)) or 0)
        base = max(0, min(100, base))
        priority = str(worker.get("priority", "P3"))
        weight = PRIORITY_WEIGHT.get(priority, 0.45)

        actions = list(worker.get("actions") or [])
        accepted = sum(1 for a in actions if str(a).startswith("accepted:"))
        rejected = sum(1 for a in actions if str(a).startswith("rejected:"))
        score = base + min(8, accepted * 4) - min(12, rejected * 4)
        score = max(0, min(100, score))

        p = prev.get(wid, {})
        previous_score = int(p.get("score", score) or score)
        previous_streak = int(p.get("low_streak", 0) or 0)
        low = score < 45 or state == "UNRESOLVED"
        low_streak = previous_streak + 1 if low else 0
        trend = score - previous_score
        band, directive = action_for(score, state, low_streak)

        rows.append({
            "id": wid,
            "name": worker.get("name", wid),
            "priority": priority,
            "state": state,
            "score": score,
            "weighted_business_score": round(score * weight, 1),
            "trend": trend,
            "low_streak": low_streak,
            "band": band,
            "directive": directive,
            "recovery_actions_accepted": accepted,
            "recovery_actions_rejected": rejected,
            "evidence": worker.get("reason", ""),
        })

    rows.sort(key=lambda r: (r["score"], -PRIORITY_WEIGHT.get(r["priority"], 0.45), r["id"]))
    needs_pressure = [r for r in rows if r["band"] in {"COACH", "WATCH", "REASSIGN"}]
    champions = [r for r in rows if r["band"] == "CHAMPION"]
    return {
        "schema": "ai-company-performance-board/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "policy": "measure > coach/pair > change condition/owner > verify; never reward busywork",
        "summary": {
            "workers": len(rows),
            "champions": len(champions),
            "needs_pressure": len(needs_pressure),
            "reassign_candidates": sum(1 for r in rows if r["band"] == "REASSIGN"),
        },
        "workers": rows,
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# BOSS PERFORMANCE BOARD",
        "",
        f"- workers: {report['summary']['workers']}",
        f"- champions: {report['summary']['champions']}",
        f"- needs pressure: {report['summary']['needs_pressure']}",
        f"- reassign candidates: {report['summary']['reassign_candidates']}",
        "",
    ]
    for r in report["workers"]:
        lines.append(
            f"- **{r['name']}** — {r['band']} / {r['score']} / trend {r['trend']:+d} / low-streak {r['low_streak']} — {r['directive']}"
        )
    lines += ["", "> No activity points. Only verified operating health and recovery evidence count.", ""]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--manager", default="tomoki-manager-snapshot.json")
    p.add_argument("--previous", default="previous-performance.json")
    p.add_argument("--out-json", default="reports/performance/board.json")
    p.add_argument("--out-md", default="reports/performance/board.md")
    args = p.parse_args()
    report = build(load(args.manager), load(args.previous))
    j, m = Path(args.out_json), Path(args.out_md)
    j.parent.mkdir(parents=True, exist_ok=True)
    m.parent.mkdir(parents=True, exist_ok=True)
    j.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    m.write_text(render(report), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
