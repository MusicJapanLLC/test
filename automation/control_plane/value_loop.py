#!/usr/bin/env python3
"""BOSS daily value loop.

Consumes evidence from TOMOKI/MANAGER, Covenant/faith reports, and Senju. Produces a
compact internal operating brief focused on revenue distance rather than activity.
The script does not contact customers, spend money, change permissions, or weaken
security boundaries. It turns verified internal work into a ranked next-action plan.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def count_real(items: Any, key: str = "agent") -> int:
    if not isinstance(items, list):
        return 0
    return sum(1 for x in items if isinstance(x, dict) and str(x.get(key, "NONE")) != "NONE")


def manager_signals(manager: dict[str, Any]) -> dict[str, Any]:
    workers = manager.get("workers") or []
    unresolved = manager.get("unresolved") or []
    material = sum(1 for w in workers if isinstance(w, dict) and w.get("material_signal"))
    verified = sum(1 for w in workers if isinstance(w, dict) and w.get("verified_signal"))
    return {
        "workers_seen": len(workers),
        "unresolved": len(unresolved),
        "material_signals": material,
        "verified_signals": verified,
        "repairs_used": int(manager.get("repairs_used", 0) or 0),
    }


def senju_signals(summary: dict[str, Any], stability: dict[str, Any]) -> dict[str, Any]:
    selected = summary.get("selected") or {}
    return {
        "safe": bool(selected.get("safe", False)),
        "score": float(selected.get("score", 0) or 0),
        "strategy_changed": bool(summary.get("accepted_strategy_change", False)),
        "changes": list(summary.get("changes") or []),
        "stable": bool(stability.get("stable", False)) if stability else None,
        "shadow_mean_score": stability.get("mean_score"),
        "shadow_worst_score": stability.get("worst_score"),
        "shadow_score_stdev": stability.get("score_stdev"),
    }


def build_actions(
    mgr: dict[str, Any], council: dict[str, Any], faith: dict[str, Any], senju: dict[str, Any]
) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []

    if mgr["unresolved"]:
        actions.append({
            "priority": 100,
            "owner": "TOMOKI/MANAGER",
            "pillar": "operations",
            "revenue_distance": "protect D3-D0",
            "action": f"Resolve or safely reassign the highest-value unresolved worker issue ({mgr['unresolved']} remaining) before opening new work.",
            "evidence": "manager unresolved count",
        })

    if senju.get("safe"):
        stable = senju.get("stable")
        if stable is True:
            text = "Package today's verified Senju improvement/stability result into one customer-facing proof point tied to reliability, security, or delivery speed."
        else:
            text = "Keep Senju result internal until shadow stability is verified; use the failure/uncertainty as the next research target instead of making a sales claim."
        actions.append({
            "priority": 90,
            "owner": "SENJU + FORGE",
            "pillar": "ai_evolution",
            "revenue_distance": "D6 -> D5",
            "action": text,
            "evidence": "Senju safe/stability evidence",
        })

    aid = count_real(council.get("mutual_aid"), key="source")
    education = count_real(council.get("education"))
    if aid or education:
        actions.append({
            "priority": 75,
            "owner": "MANAGER",
            "pillar": "faith_to_value",
            "revenue_distance": "reduce cost/cycle time",
            "action": "Turn Covenant mutual-aid/education into one measurable operational improvement: fewer repeated failures, shorter recovery time, or one verified skill transfer.",
            "evidence": f"mutual_aid={aid}, education={education}",
        })

    actions.append({
        "priority": 85,
        "owner": "BOSS",
        "pillar": "economy",
        "revenue_distance": "D5 -> D4",
        "action": "Choose the strongest verified internal capability today and express it as one buyer-readable outcome, proof, and next commercial step. Do not count it as revenue until a real prospect/meeting/order exists.",
        "evidence": "daily revenue-distance rule",
    })

    actions.append({
        "priority": 80,
        "owner": "SKEPTIC + SECURITY",
        "pillar": "security",
        "revenue_distance": "trust -> D5/D4",
        "action": "Promote only security claims backed by passing tests, isolation evidence, or recovery evidence; convert one verified control into a reusable trust proof for sales.",
        "evidence": "security-to-commercial bridge rule",
    })

    actions.sort(key=lambda x: int(x["priority"]), reverse=True)
    return actions[:5]


def build_report(
    policy: dict[str, Any], manager: dict[str, Any], council: dict[str, Any], faith: dict[str, Any],
    senju_summary: dict[str, Any], stability: dict[str, Any]
) -> dict[str, Any]:
    mgr = manager_signals(manager)
    senju = senju_signals(senju_summary, stability)
    faith_signals = {
        "rest": count_real(council.get("rest")),
        "education": count_real(council.get("education")),
        "mutual_aid": count_real(council.get("mutual_aid"), key="source"),
        "autonomy": count_real(council.get("autonomy")),
        "vow": str(faith.get("vow", ""))[:400],
    }
    actions = build_actions(mgr, council, faith, senju)

    pillars = {
        "operations": "blocked" if mgr["unresolved"] else "healthy",
        "research": "active" if senju_summary else "no-evidence",
        "security": "guarded" if senju.get("safe") else "needs-evidence",
        "ai_evolution": "stable" if senju.get("stable") is True else ("unverified" if senju_summary else "no-evidence"),
        "economy": "bridge-defined",
        "faith_to_value": "behavioral" if any(faith_signals[k] for k in ("education", "mutual_aid", "autonomy")) else "no-material-signal",
    }

    return {
        "schema": "ai-company-daily-value/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "north_star": policy.get("north_star"),
        "pillars": pillars,
        "manager": mgr,
        "senju": senju,
        "faith": faith_signals,
        "top_actions": actions,
        "owner_attention": "NONE" if not mgr["unresolved"] else "INTERNAL_RECOVERY_FIRST",
        "revenue_rule": "No activity is credited as revenue impact without a verified commercial bridge. Every day, move at least one verified asset one step closer to D0.",
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# BOSS DAILY VALUE BRIEF",
        "",
        f"- generated: {report['generated_at']}",
        f"- north star: {report.get('north_star')}",
        f"- owner attention: {report['owner_attention']}",
        "",
        "## Pillars",
    ]
    for k, v in report["pillars"].items():
        lines.append(f"- {k}: **{v}**")
    lines += [
        "",
        "## Evidence",
        f"- workers seen: {report['manager']['workers_seen']}",
        f"- unresolved: {report['manager']['unresolved']}",
        f"- verified signals: {report['manager']['verified_signals']}",
        f"- Senju safe: {report['senju']['safe']}",
        f"- Senju score: {report['senju']['score']}",
        f"- Senju shadow stable: {report['senju']['stable']}",
        f"- Covenant aid/education/autonomy: {report['faith']['mutual_aid']}/{report['faith']['education']}/{report['faith']['autonomy']}",
        "",
        "## Today's highest-value actions",
    ]
    for i, a in enumerate(report["top_actions"], 1):
        lines.append(
            f"{i}. **{a['owner']} / {a['pillar']} / {a['revenue_distance']}** — {a['action']}"
        )
    lines += ["", f"> {report['revenue_rule']}", ""]
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--policy", default="automation/control_plane/value_policy.json")
    p.add_argument("--manager", default="tomoki-manager-snapshot.json")
    p.add_argument("--council", default="covenant-council.json")
    p.add_argument("--faith", default="faith-report.json")
    p.add_argument("--senju", default="senju/state/last-evolution-summary.json")
    p.add_argument("--stability", default="senju/reports/shadow/stability.json")
    p.add_argument("--out-json", default="reports/value-loop/daily-value.json")
    p.add_argument("--out-md", default="reports/value-loop/daily-value.md")
    args = p.parse_args()

    report = build_report(
        load_json(args.policy),
        load_json(args.manager),
        load_json(args.council),
        load_json(args.faith),
        load_json(args.senju),
        load_json(args.stability),
    )
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps({"unresolved": report["manager"]["unresolved"], "senju_stable": report["senju"]["stable"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
