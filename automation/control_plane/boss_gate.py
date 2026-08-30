#!/usr/bin/env python3
"""BOSS gate: the only path from internal supervision to the owner-facing CEO channel.

TOMOKI/MANAGER reports are internal evidence. The owner is notified only when the
BOSS layer has already observed TOMOKI/MANAGER, bounded recovery has failed, and an
unresolved P0/P1 incident remains. Recovered/recovering incidents stay internal.

Owner reports explain state transition and consequence rather than activity volume.
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


def _state_counts(workers: list[dict[str, Any]], key: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for worker in workers:
        state = str(worker.get(key) or "UNKNOWN")
        out[state] = out.get(state, 0) + 1
    return out


def _fmt_states(counts: dict[str, int]) -> str:
    if not counts:
        return "no worker evidence"
    return ", ".join(f"{state}={count}" for state, count in sorted(counts.items()))


def build_event(report: dict[str, Any]) -> dict[str, Any]:
    workers = [w for w in (report.get("workers") or []) if isinstance(w, dict)]
    boss_layer = is_boss_layer(report)
    unresolved = [
        w
        for w in workers
        if w.get("after") == "UNRESOLVED" and w.get("priority") in OWNER_PRIORITIES
    ]
    incidents = int(report.get("summary", {}).get("incidents", 0) or 0)
    recoveries = int(report.get("summary", {}).get("internal_recovery_actions", 0) or 0)
    before_counts = _state_counts(workers, "before")
    after_counts = _state_counts(workers, "after")

    # The owner is busy: successful recovery, active recovery, and ordinary monitoring
    # never leave the internal TOMOKI layer. Only unresolved executive exceptions do.
    should_report = boss_layer and bool(unresolved)
    state = "BLOCKED" if should_report else "RUNNING"

    owner_action = "NONE"
    if should_report:
        names = ", ".join(str(w.get("name") or w.get("id")) for w in unresolved[:3])
        owner_action = f"未解決P0/P1の外部依存・権限・方針判断を確認: {names}"

    before_state = (
        f"BOSS観測開始時: incidents={incidents}; worker state [{_fmt_states(before_counts)}]。"
    )
    after_state = (
        f"内部復旧を{recoveries}件試行後: unresolved P0/P1={len(unresolved)}; "
        f"worker state [{_fmt_states(after_counts)}]。"
    )

    if should_report:
        change_summary = (
            f"内部で検知・復旧試行までは完了したが、P0/P1 {len(unresolved)}件だけがOwner判断待ちとして残った。"
        )
        executive_summary = change_summary
        capability_gain = (
            "検知→復旧試行→再判定→経営例外の抽出までを内部で閉じ、Ownerへは未解決の意思決定だけを渡せる。"
        )
        owner_benefit = (
            f"全{incidents}件の監視ログを読む必要はなく、現在は未解決P0/P1 {len(unresolved)}件だけを判断すればよい。"
        )
        business_effect = (
            "通常運転で吸収できる障害と経営判断が必要な例外を分離し、Ownerの確認コストと誤エスカレーションを抑える。"
        )
        residual_risk = (
            "Owner判断が入るまで未解決P0/P1はBLOCKEDのまま。内部復旧完了とは扱わない。"
        )
        next_target = "Owner判断をTOMOKIへ戻し、対象P0/P1を内部ルートで再処理して未解決を0件へ戻す。"
        success_criteria = "次の検証で対象P0/P1がUNRESOLVEDではなくなり、再発確認を通過する。"
    else:
        change_summary = (
            f"検知した{incidents}件を内部ループで処理し、Owner判断が必要なP0/P1は0件。"
        )
        executive_summary = "内部監視・復旧ループ内で処理済み。Ownerへの報告対象ではありません。"
        capability_gain = "通常の検知・復旧・再判定をOwner promptなしで内部継続できる。"
        owner_benefit = "routine監視・自動復旧の確認作業はOwner不要。"
        business_effect = "Owner attentionを例外判断へ集中できる。"
        residual_risk = "NONE"
        next_target = "次cycleでもroutine事象を内部処理し、真のP0/P1例外だけを抽出する。"
        success_criteria = "Owner action=NONEを維持しつつ、検知事象の証拠と復旧結果を内部に保持する。"

    scoreboard = report.get("scoreboard", [])
    evidence_summary = (
        f"manager_schema={report.get('schema')}; boss_layer={boss_layer}; "
        f"scoreboard_entries={len(scoreboard) if isinstance(scoreboard, list) else 0}"
    )

    return {
        "schema": "ai-factory-ceo-event/v1",
        "report_route": "boss-final" if boss_layer else "tomoki-internal",
        "source_layer": "BOSS" if boss_layer else "TOMOKI",
        "audience": "OWNER" if should_report else "INTERNAL",
        "project": "AI Company Control Plane",
        "state": state,
        "change_summary": change_summary,
        "executive_summary": executive_summary,
        "before_state": before_state,
        "after_state": after_state,
        "capability_gain": capability_gain,
        "owner_benefit": owner_benefit,
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
        "metrics": [
            {"name": "unresolved P0/P1", "before": sum(1 for w in workers if w.get("before") not in {"HEALTHY", "ACTIVE"} and w.get("priority") in OWNER_PRIORITIES), "after": len(unresolved), "unit": "件"},
            {"name": "internal recovery actions", "before": 0, "after": recoveries, "unit": "件"},
        ],
        "measurement_next": "次cycleで未解決P0/P1件数とOwner action件数を再計測する。",
        "owner_action": owner_action,
        "business_effect": business_effect,
        "residual_risk": residual_risk,
        "next_target": next_target,
        "success_criteria": success_criteria,
        "next_improvement": next_target,
        "should_report": should_report,
        "evidence": evidence_summary,
        "evidence_detail": {
            "manager_schema": report.get("schema"),
            "scoreboard": scoreboard,
            "boss_layer": boss_layer,
            "before_states": before_counts,
            "after_states": after_counts,
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
