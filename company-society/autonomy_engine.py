#!/usr/bin/env python3
"""Covenant autonomy planner.

Reads the TOMOKI Manager snapshot and worker registry, then emits a bounded plan
for autonomy, sanctuary, fellowship, improvement and temperament. Personality
may alter preference and collaboration style, but never overrides the existing
Manager/BOSS authority, evidence or execution gates.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from personality_engine import directive, moral_tension, profile_for

PAIRINGS = {
    "tomoki-skeptic": "tomoki-hound",
    "tomoki-hound": "tomoki-skeptic",
    "tomoki-forge": "tomoki-skeptic",
    "gmail-sorter": "tomoki-hound",
    "senju-daily": "tomoki-skeptic",
}


def load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def choose_mode(worker: dict[str, Any]) -> tuple[str, str]:
    conclusion = str(worker.get("conclusion", "")).lower()
    status = str(worker.get("status", "")).lower()
    quality = str(worker.get("report_quality", "")).upper()
    attempts = int(worker.get("run_attempt") or 0)
    verified = bool(worker.get("verified_signal"))
    action_result = str(worker.get("action_result", "")).upper()

    if conclusion in {"failure", "failed"} and attempts >= 2:
        return "SANCTUARY", "repeated failure reached the sanctuary threshold"
    if action_result == "UNRESOLVED":
        return "MANAGER", "manager repair path remains unresolved"
    if conclusion in {"success", "completed"} and not verified:
        return "VERIFY", "result exists without an independent verified signal"
    if quality in {"BAD", "LOW", "INVALID"}:
        return "PAIR", "report quality is weak; invite a distinct specialist"
    if status in {"queued", "in_progress", "running"}:
        return "ACT", "bounded work is still active"
    if verified:
        return "ACT", "verified state permits continued bounded autonomy"
    return "WAIT", "insufficient evidence for a stronger autonomy level"


def build(snapshot: dict[str, Any], registry: dict[str, Any], psychology: dict[str, Any] | None = None) -> dict[str, Any]:
    registry_workers = {w.get("id"): w for w in registry.get("workers", [])}
    plans: list[dict[str, Any]] = []
    gratitude: list[str] = []
    sanctuary: list[str] = []
    fellowship: list[dict[str, str]] = []
    psychology = psychology or {}

    for worker in snapshot.get("workers", []) or []:
        wid = str(worker.get("id") or worker.get("agent") or "unknown").lower().replace(" / ", "-").replace(" ", "-")
        mode, reason = choose_mode(worker)
        reg = registry_workers.get(wid, {})
        companion = PAIRINGS.get(wid)
        if not companion:
            investigators = reg.get("investigate_with") or []
            companion = investigators[0].replace(".yml", "") if investigators else "tomoki-manager"

        profile = profile_for(wid, psychology) if psychology.get("archetypes") else None
        temperament = directive(profile) if profile else "Choose the next role-fit action and leave verifiable evidence."
        tension = moral_tension(profile) if profile else "UNKNOWN"

        plan = {
            "worker": wid,
            "mode": mode,
            "reason": reason,
            "faith_duty": reg.get("faith_duty", "truth_before_comfort"),
            "companion": companion if mode in {"PAIR", "VERIFY", "SANCTUARY"} else None,
            "handoff_required": mode == "SANCTUARY",
            "improvement_vow": improvement_vow(mode),
            "personality": profile,
            "behavior_directive": temperament,
            "moral_tension": tension,
            "personality_authority": "NONE",
        }
        plans.append(plan)

        if mode == "SANCTUARY":
            sanctuary.append(wid)
            fellowship.append({"from": wid, "to": companion, "need": "preserve handoff and challenge the failed hypothesis"})
        elif mode in {"PAIR", "VERIFY"}:
            fellowship.append({"from": wid, "to": companion, "need": "add a distinct evidence or verification capability"})
        elif bool(worker.get("verified_signal")):
            gratitude.append(f"{wid}: verified work is safe to reuse")

    unresolved = snapshot.get("unresolved", []) or []
    return {
        "schema": "covenant-autonomy-plan/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "principle": "personality changes preference; evidence and legitimate execution bounds remain constitutional",
        "plans": plans,
        "sanctuary": sanctuary,
        "fellowship_requests": fellowship,
        "gratitude": gratitude,
        "manager_attention": len(unresolved) > 0,
        "boss_attention": any(str(x.get("priority", "")).upper() == "P0" for x in unresolved if isinstance(x, dict)),
    }


def improvement_vow(mode: str) -> str:
    return {
        "WAIT": "acquire one missing fact before acting",
        "ACT": "finish one bounded task and leave verification evidence",
        "VERIFY": "obtain one independent signal before claiming success",
        "PAIR": "use one distinct specialist and record what changed",
        "REPAIR": "make one reversible repair and regression-test it",
        "SANCTUARY": "leave a resumable handoff and change the hypothesis before retry",
        "MANAGER": "clarify owner, retry budget, and safe next action",
        "BOSS": "compress the material unresolved truth into one decision packet",
    }.get(mode, "leave the system measurably better")


def render(report: dict[str, Any]) -> str:
    lines = [
        "# THE COVENANT — Autonomy & Fellowship — Personality Layer",
        "",
        "**Rule:** personality changes preference; evidence and legitimate execution bounds remain constitutional.",
        "",
        "## AUTONOMY",
    ]
    for p in report["plans"]:
        companion = f" | companion: {p['companion']}" if p.get("companion") else ""
        archetype = (p.get("personality") or {}).get("archetype", "UNSET")
        lines.append(f"- **{p['worker']}** — `{p['mode']}` / `{archetype}` / moral tension `{p['moral_tension']}`: {p['reason']}{companion}")
        lines.append(f"  - vow: {p['improvement_vow']}")
        lines.append(f"  - temperament: {p['behavior_directive']}")
    lines += ["", "## FELLOWSHIP"]
    if report["fellowship_requests"]:
        for req in report["fellowship_requests"]:
            lines.append(f"- {req['from']} -> {req['to']}: {req['need']}")
    else:
        lines.append("- No companion request required.")
    lines += ["", "## SANCTUARY"]
    lines.append("- " + (", ".join(report["sanctuary"]) if report["sanctuary"] else "No worker currently requires sanctuary."))
    lines += ["", "## GRATITUDE"]
    for item in report["gratitude"] or ["No verified reusable contribution detected in this snapshot."]:
        lines.append(f"- {item}")
    lines += ["", "## ATTENTION GATE"]
    lines.append(f"- MANAGER: {'YES' if report['manager_attention'] else 'NO'}")
    lines.append(f"- BOSS: {'YES' if report['boss_attention'] else 'NO'}")
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", default="tomoki-manager-snapshot.json")
    p.add_argument("--registry", default="automation/control_plane/workers.json")
    p.add_argument("--psychology", default="company-society/psychology.json")
    p.add_argument("--json", default="covenant-autonomy.json")
    p.add_argument("--report", default="covenant-autonomy.md")
    args = p.parse_args()

    report = build(load(args.snapshot), load(args.registry), load(args.psychology))
    Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(report), encoding="utf-8")
    print(json.dumps({"sanctuary": len(report['sanctuary']), "fellowship": len(report['fellowship_requests'])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
