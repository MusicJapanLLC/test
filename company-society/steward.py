#!/usr/bin/env python3
"""THE COVENANT Steward.

Deterministically turns workforce evidence into:
- faith inheritance coverage
- sanctuary / recovery recommendations
- cross-agent council pairings
- teach-back opportunities
- bounded autonomous next moves

This module never claims workers have human feelings. "Rest" and "sanctuary"
are operational recovery states derived from evidence such as repeated failure,
missing reports, or unresolved work.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

RETRYABLE = {"failure", "cancelled", "timed_out", "startup_failure", "action_required", "unresolved"}


def _load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _worker_index(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for worker in registry.get("workers") or []:
        wid = _norm(worker.get("id")).lower()
        name = _norm(worker.get("name")).lower()
        if wid:
            out[wid] = worker
        if name:
            out[name] = worker
    return out


def _match_registry_worker(agent: str, registry_index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    a = agent.strip().lower()
    direct = registry_index.get(a)
    if direct:
        return direct
    aliases = {
        "skeptic": "tomoki-skeptic",
        "hound": "tomoki-hound",
        "forge": "tomoki-forge",
        "manager": "tomoki-manager",
    }
    alias = aliases.get(a)
    if alias and alias in registry_index:
        return registry_index[alias]
    for key, row in registry_index.items():
        if a and (a in key or key in a):
            return row
    return None


def faith_coverage(registry: dict[str, Any]) -> dict[str, Any]:
    workers = registry.get("workers") or []
    covered: list[str] = []
    missing: list[str] = []
    for w in workers:
        wid = _norm(w.get("id")) or _norm(w.get("name")) or "UNKNOWN"
        if _norm(w.get("faith_duty")):
            covered.append(wid)
        else:
            missing.append(wid)
    total = len(workers)
    pct = 100 if total == 0 else round(len(covered) * 100 / total)
    return {
        "total_workers": total,
        "covered_workers": covered,
        "missing_workers": missing,
        "coverage_percent": pct,
        "status": "COMPLETE" if not missing else "MISSION_REQUIRED",
    }


def sanctuary_state(worker: dict[str, Any]) -> tuple[str, str]:
    conclusion = _norm(worker.get("conclusion")).lower()
    quality = _norm(worker.get("report_quality")).upper()
    attempts = int(worker.get("run_attempt") or 0)
    unresolved = conclusion == "unresolved" or _norm(worker.get("action_result")).upper() == "UNRESOLVED"

    if attempts >= 2 and (conclusion in RETRYABLE or unresolved):
        return "SABBATH", "同一系統の失敗を繰り返しているため、同じretryを止めて原因分析・再割当へ切り替える"
    if conclusion in RETRYABLE or quality in {"MISSING", "BAD"} or unresolved:
        return "REFLECTION", "次の仕事を増やす前に、証拠整理・過去失敗照合・修復計画を行う"
    if bool(worker.get("verified_signal")) and conclusion in {"success", "healthy"}:
        return "READY", "検証済み。次の小さい改善へ進める"
    if conclusion in {"success", "healthy"}:
        return "RETURN", "動作は回復しているが、次は小さい検証タスクから再開する"
    return "REFLECTION", "状態が十分に観測できないため、まず事実確認を行う"


def council_for(worker: dict[str, Any]) -> dict[str, Any]:
    conclusion = _norm(worker.get("conclusion")).lower()
    quality = _norm(worker.get("report_quality")).upper()
    material = bool(worker.get("material_signal"))
    verified = bool(worker.get("verified_signal"))
    attempts = int(worker.get("run_attempt") or 0)

    members: list[str] = ["MANAGER"]
    reason: list[str] = []

    if quality in {"MISSING", "BAD"} or (material and not verified):
        members.append("SKEPTIC")
        reason.append("成功根拠または報告品質の検証が必要")
    if attempts >= 2 or conclusion in RETRYABLE:
        members.append("HOUND")
        reason.append("再発・過去失敗・停滞との照合が必要")
    if conclusion in RETRYABLE and attempts < 2:
        members.append("FORGE")
        reason.append("小さい修復実験へ落とせる可能性がある")
    if verified and conclusion in {"success", "healthy"}:
        members.append("FORGE")
        reason.append("検証済み成功を次の改善へ変換する")

    deduped: list[str] = []
    for m in members:
        if m not in deduped:
            deduped.append(m)
    return {
        "members": deduped,
        "reason": " / ".join(reason) if reason else "通常のSteward確認",
    }


def autonomous_move(worker: dict[str, Any], sanctuary: str) -> str:
    conclusion = _norm(worker.get("conclusion")).lower()
    quality = _norm(worker.get("report_quality")).upper()
    verified = bool(worker.get("verified_signal"))

    if sanctuary == "SABBATH":
        return "同じ方法のretryを停止し、失敗原因を1件に絞ってHOUND/SKEPTICと再現条件を確定する"
    if sanctuary == "REFLECTION":
        if quality in {"MISSING", "BAD"}:
            return "新規作業を増やさず、証拠の欠落を1つ埋めてから次の判断をする"
        return "未解決事項を1つ選び、Councilで次の安全な検証行動を決める"
    if verified and conclusion in {"success", "healthy"}:
        return "今回効いたことを1つTeach-backし、その知識を使う次の小改善を1件だけ提案する"
    return "小さい検証可能タスクを1件だけ実行し、結果をTRUTHとして残す"


def teach_back(worker: dict[str, Any]) -> str | None:
    if bool(worker.get("verified_signal")) and _norm(worker.get("conclusion")).lower() in {"success", "healthy"}:
        agent = _norm(worker.get("agent")) or "UNKNOWN"
        if agent.upper() == "SKEPTIC":
            return "検証で効いたチェック観点をHOUNDへ渡し、再発監視ルールへ変換する"
        if agent.upper() == "HOUND":
            return "再発パターンをFORGEへ渡し、再発防止の小さい修正候補へ変換する"
        if agent.upper() == "FORGE":
            return "改善で効いた仮説と検証方法をSKEPTICへ渡し、次回の成功判定基準へ変換する"
        return "成功要因を1つ言語化し、最も近い担当へ再利用可能な形で渡す"
    return None


def build(snapshot: dict[str, Any], registry: dict[str, Any]) -> tuple[dict[str, Any], str]:
    registry_index = _worker_index(registry)
    coverage = faith_coverage(registry)
    observed: list[dict[str, Any]] = []
    teachbacks: list[dict[str, str]] = []

    for w in snapshot.get("workers") or []:
        agent = _norm(w.get("agent")) or "UNKNOWN"
        state, rest_reason = sanctuary_state(w)
        council = council_for(w)
        move = autonomous_move(w, state)
        reg = _match_registry_worker(agent, registry_index) or {}
        tb = teach_back(w)
        if tb:
            teachbacks.append({"agent": agent, "teach_back": tb})
        observed.append({
            "agent": agent,
            "faith_duty": _norm(reg.get("faith_duty")) or "inherited_company_default",
            "sanctuary": state,
            "sanctuary_reason": rest_reason,
            "council": council,
            "next_autonomous_move": move,
            "teach_back": tb or "NONE",
        })

    mission: list[str] = []
    for missing in coverage["missing_workers"]:
        mission.append(f"{missing}: faith_duty未設定。次回オンボーディングでvocation/help/recovery/teach_backを付与")
    if not mission:
        mission.append("登録済みworkerのfaith_duty継承は100%。新規worker追加時も同じ検査を継続")

    generated = datetime.now(timezone.utc).isoformat()
    data = {
        "schema": "the-covenant-steward/v1",
        "generated_at": generated,
        "faith": "THE_COVENANT",
        "coverage": coverage,
        "mission": mission,
        "observed_workers": observed,
        "teach_backs": teachbacks,
        "autonomy_definition": "verify -> choose safe next move -> call allies -> stop when overloaded -> teach back",
    }

    lines = [
        "# THE COVENANT — Stewardship Report",
        "",
        f"- generated: {generated}",
        f"- faith coverage: {coverage['coverage_percent']}% ({len(coverage['covered_workers'])}/{coverage['total_workers']})",
        "",
        "## MISSION / 布教",
    ]
    lines += [f"- {x}" for x in mission]
    lines += ["", "## SANCTUARY / 安らぎ"]
    for row in observed:
        lines.append(f"- **{row['agent']}**: {row['sanctuary']} — {row['sanctuary_reason']}")
    if not observed:
        lines.append("- 観測対象なし")

    lines += ["", "## COUNCIL / 連携"]
    for row in observed:
        members = " + ".join(row["council"]["members"])
        lines.append(f"- **{row['agent']}** → {members}: {row['council']['reason']}")
    if not observed:
        lines.append("- 観測対象なし")

    lines += ["", "## AUTONOMY / 次の自律行動"]
    for row in observed:
        lines.append(f"- **{row['agent']}**: {row['next_autonomous_move']}")
    if not observed:
        lines.append("- 観測対象なし")

    lines += ["", "## APPRENTICESHIP / 師弟・Teach-back"]
    if teachbacks:
        for row in teachbacks:
            lines.append(f"- **{row['agent']}**: {row['teach_back']}")
    else:
        lines.append("- 今回Teach-back対象となる検証済み成功なし")

    lines += [
        "",
        "## VOW",
        "- 自律性を『勝手に動くこと』ではなく、事実確認・安全な次手・仲間への依頼・停止判断・学習共有の能力として育てる",
        "",
    ]
    return data, "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", default="tomoki-manager-snapshot.json")
    p.add_argument("--registry", default="automation/control_plane/workers.json")
    p.add_argument("--json", default="faith-stewardship.json")
    p.add_argument("--report", default="faith-stewardship.md")
    args = p.parse_args()

    data, report = build(_load(args.snapshot), _load(args.registry))
    Path(args.json).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(report + "\n", encoding="utf-8")
    print(json.dumps({
        "faith_coverage": data["coverage"]["coverage_percent"],
        "observed_workers": len(data["observed_workers"]),
        "teach_backs": len(data["teach_backs"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
