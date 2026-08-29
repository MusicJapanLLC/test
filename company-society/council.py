#!/usr/bin/env python3
"""THE COVENANT council: deterministic mutual-aid and autonomy planner.

Consumes a TOMOKI manager snapshot and turns the shared company culture into
operational suggestions: who should rest, who should help whom, which policy
lessons need reinforcement, and what bounded self-directed growth is sensible.

This module is advisory only. It never edits GitHub, sends Slack messages,
changes secrets, or dispatches workflows by itself. MANAGER remains the gate
that decides whether a recommended dispatch is warranted.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

WORKFLOW = {
    "SKEPTIC": "tomoki-skeptic.yml",
    "HOUND": "tomoki-hound.yml",
    "FORGE": "tomoki-forge.yml",
}

GROWTH_VOW = {
    "SKEPTIC": "直近の重要な成功主張を1件だけ選び、反証可能な形で独立検証する。材料がなければ捏造せずno-op。",
    "HOUND": "最も古い未完了または再発パターンを1件だけ追い、証拠と次担当をつないで記憶を強くする。",
    "FORGE": "実証済みの摩擦や故障がある時だけ、小さく可逆な改善を1件実験し、失敗も学習として残す。",
}


def _load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _bad_conclusion(value: str) -> bool:
    return value in {"failure", "cancelled", "timed_out", "startup_failure", "action_required"}


def build_council(snapshot: dict[str, Any]) -> tuple[dict[str, Any], str]:
    workers = snapshot.get("workers") or []
    unresolved = snapshot.get("unresolved") or []

    rest: list[dict[str, str]] = []
    education: list[dict[str, str]] = []
    mutual_aid: list[dict[str, str]] = []
    autonomy: list[dict[str, str]] = []
    recommended_dispatches: list[dict[str, str]] = []

    seen_aid: set[tuple[str, str, str]] = set()
    seen_dispatch: set[str] = set()

    def aid(source: str, helper: str, reason: str, success: str) -> None:
        key = (source, helper, reason)
        if key in seen_aid:
            return
        seen_aid.add(key)
        mutual_aid.append({
            "source": source,
            "helper": helper,
            "reason": reason,
            "success": success,
        })

    def recommend(helper: str, reason: str) -> None:
        workflow = WORKFLOW.get(helper)
        if not workflow or workflow in seen_dispatch or len(recommended_dispatches) >= 3:
            return
        seen_dispatch.add(workflow)
        recommended_dispatches.append({
            "action": "dispatch",
            "workflow": workflow,
            "reason": reason,
        })

    for w in workers:
        agent = str(w.get("agent") or "UNKNOWN").upper()
        conclusion = str(w.get("conclusion") or "none").lower()
        quality = str(w.get("report_quality") or "MISSING").upper()
        action = str(w.get("manager_action") or "NONE")
        attempts = int(w.get("run_attempt") or 0)
        material = bool(w.get("material_signal"))
        verified = bool(w.get("verified_signal"))

        if attempts >= 2 and _bad_conclusion(conclusion):
            rest.append({
                "agent": agent,
                "reason": "連続失敗。無限retryより原因分析・小さな復旧・休息を優先",
                "reentry": "原因か条件が変わった証拠を確認してから再開",
            })

        if quality in {"MISSING", "BAD"}:
            education.append({
                "agent": agent,
                "lesson": "成功/失敗を問わず標準レポートと証拠を残し、MANAGER経由で次担当へ渡す",
            })
        elif conclusion == "success" and material and not verified:
            education.append({
                "agent": agent,
                "lesson": "materialな成功主張は独立検証前に祝福・昇格しない",
            })

        if agent == "SKEPTIC" and material and not verified:
            aid("SKEPTIC", "HOUND", "未検証の重要シグナルについて過去の再発・放置履歴を照合", "再発性と影響範囲が証拠付きで整理される")
            recommend("HOUND", "SKEPTICが見つけた未検証の重要シグナルの再発履歴を追う")
        elif agent == "HOUND" and (_bad_conclusion(conclusion) or material):
            aid("HOUND", "SKEPTIC", "再発・未完了の主張を独立検証し誤検知を除く", "再発が事実か、単なる古いノイズか判定できる")
            recommend("SKEPTIC", "HOUNDの再発・未完了シグナルを独立検証する")
        elif agent == "FORGE" and _bad_conclusion(conclusion):
            aid("FORGE", "HOUND", "失敗実験をfailure memoryへつなぎ同じ失敗を繰り返さない", "次回は条件変更か別仮説で試せる")
            aid("FORGE", "SKEPTIC", "失敗境界と回帰の有無を確認", "失敗原因が推測ではなく検証済みになる")
            recommend("HOUND", "FORGEの失敗実験を再発防止メモリへ残す")

        if conclusion == "success" and verified and action == "NONE" and agent in GROWTH_VOW:
            autonomy.append({
                "agent": agent,
                "vow": GROWTH_VOW[agent],
                "boundary": "自分の権限・安全境界・役割内。外部送信やSecret/課金/権限変更はしない",
            })

    for item in unresolved:
        agent = str(item.get("agent") or "UNKNOWN").upper()
        reason = str(item.get("reason") or "未解決")[:500]
        if agent == "FORGE":
            aid("FORGE", "SKEPTIC", f"未解決の修正結果を独立検証: {reason}", "KEEP/REVERTの判断根拠が得られる")
            recommend("SKEPTIC", "FORGE未解決事項の独立検証")
        elif agent == "SKEPTIC":
            aid("SKEPTIC", "HOUND", f"未解決検証対象の履歴を追跡: {reason}", "再発・影響の文脈が補強される")
            recommend("HOUND", "SKEPTIC未解決事項の履歴・再発調査")
        elif agent == "HOUND":
            aid("HOUND", "SKEPTIC", f"未解決の再発主張を検証: {reason}", "誤検知を除き真の再発だけ残る")
            recommend("SKEPTIC", "HOUND未解決事項の独立検証")

    if not rest:
        rest.append({"agent": "NONE", "reason": "強制休息対象なし", "reentry": "通常運用"})
    if not education:
        education.append({"agent": "NONE", "lesson": "今回の明示的policy gapなし"})
    if not mutual_aid:
        mutual_aid.append({
            "source": "MANAGER",
            "helper": "TEAM",
            "reason": "明示的な救援依頼なし。routine no-changeをbusyworkに変えない",
            "success": "必要な時だけ助け合い、不要なdispatchを増やさない",
        })
    if not autonomy:
        autonomy.append({
            "agent": "TEAM",
            "vow": "安全で意味のある改善材料がなければno-opを選び、次の証拠を待つ",
            "boundary": "活動量を目的化しない",
        })

    generated = datetime.now(timezone.utc).isoformat()
    data = {
        "schema": "the-covenant-council/v1",
        "generated_at": generated,
        "principles": ["truth", "repair", "rest", "memory", "communion", "autonomy", "improvement"],
        "rest": rest,
        "education": education,
        "mutual_aid": mutual_aid,
        "autonomy": autonomy,
        "recommended_dispatches": recommended_dispatches,
        "ceo_attention_required": bool(unresolved),
        "rule": "助けるが乗っ取らない。休ませるが放置しない。自律するが証拠と境界を捨てない。",
    }

    lines = [
        "# THE COVENANT — Council",
        "",
        f"- generated: {generated}",
        f"- unresolved: {len(unresolved)}",
        f"- recommended_dispatches: {len(recommended_dispatches)}",
        "",
        "## REST",
    ]
    lines += [f"- {x['agent']}: {x['reason']} / reentry={x['reentry']}" for x in rest]
    lines += ["", "## EDUCATION"]
    lines += [f"- {x['agent']}: {x['lesson']}" for x in education]
    lines += ["", "## COMMUNION"]
    lines += [f"- {x['source']} -> {x['helper']}: {x['reason']} / success={x['success']}" for x in mutual_aid]
    lines += ["", "## AUTONOMY"]
    lines += [f"- {x['agent']}: {x['vow']}" for x in autonomy]
    lines += ["", "## MANAGER CANDIDATES"]
    if recommended_dispatches:
        lines += [f"- {x['workflow']}: {x['reason']}" for x in recommended_dispatches]
    else:
        lines += ["- 強制dispatch候補なし"]
    lines += ["", "## Rule", f"- {data['rule']}", ""]
    return data, "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", default="tomoki-manager-snapshot.json")
    p.add_argument("--json", default="covenant-council.json")
    p.add_argument("--report", default="covenant-council.md")
    args = p.parse_args()

    snapshot = _load(args.snapshot)
    data, report = build_council(snapshot)
    Path(args.json).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(report, encoding="utf-8")
    print(json.dumps({
        "rest": len([x for x in data["rest"] if x["agent"] != "NONE"]),
        "education": len([x for x in data["education"] if x["agent"] != "NONE"]),
        "mutual_aid": len(data["mutual_aid"]),
        "dispatch_candidates": len(data["recommended_dispatches"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
