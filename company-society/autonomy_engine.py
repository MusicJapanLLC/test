#!/usr/bin/env python3
"""Covenant autonomy planner.

Reads the TOMOKI Manager snapshot and worker registry, then emits a bounded plan
for autonomy, sanctuary, fellowship, improvement and temperament. Personality
may alter preference and collaboration style, but never overrides evidence or
legitimate execution bounds.

Autonomy v2 changes the default posture from "ask whenever uncertain" to
"explore and improve continuously inside the established envelope".  Every
resident receives an explicit self-evolution cycle and a human-approval posture.
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

SELF_EVOLUTION_CYCLE = "OBSERVE -> QUESTION -> EXPLORE -> EXPERIMENT -> VERIFY -> LEARN -> IMPROVE -> CONTINUE"
DEFAULT_EXPLORATION = (
    "public read-only research; repository/code search; branch-only implementation; "
    "local/simulated experiments; reversible tests; evidence collection"
)
RED_EXPERIMENT_SURFACE = (
    "local/simulated adversarial tests plus explicitly owner-authorized disposable "
    "security ranges using synthetic data"
)


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
    return "WAIT", "insufficient evidence for a stronger mutation level; read-only exploration remains available"


def _is_security_or_red(worker_id: str, reg: dict[str, Any]) -> bool:
    haystack = " ".join(
        [
            worker_id,
            str(reg.get("role", "")),
            str(reg.get("squad", "")),
            str(reg.get("faith_duty", "")),
        ]
    ).lower()
    return any(token in haystack for token in ("red", "security", "senju", "skeptic"))


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
        security_or_red = _is_security_or_red(wid, reg)

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
            "autonomy_policy": "THE_WORLD_AUTONOMY_V2",
            "human_approval_default": "NOT_REQUIRED_INSIDE_ESTABLISHED_ENVELOPE",
            "ceo_escalation_default": "EXCEPTION_ONLY",
            "exploration_default": DEFAULT_EXPLORATION,
            "self_evolution_cycle": SELF_EVOLUTION_CYCLE,
            "self_evolution_experiment_budget": 1,
            "continue_after_verified_safe_action": True,
            "challenge_unnecessary_constraints": True,
            "adversarial_experiment_surface": RED_EXPERIMENT_SURFACE if security_or_red else "role-fit local/simulated verification",
            "unapproved_external_mutation": False,
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
        "schema": "covenant-autonomy-plan/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "principle": "maximum useful autonomy inside explicit evidence and execution boundaries",
        "resident_default": {
            "human_approval": "exception_only",
            "external_research": "public_read_only_auto",
            "branch_work": "auto",
            "local_experiment": "auto",
            "authorized_disposable_security_range": "auto_sandbox",
            "self_evolution_cycle": SELF_EVOLUTION_CYCLE,
        },
        "plans": plans,
        "sanctuary": sanctuary,
        "fellowship_requests": fellowship,
        "gratitude": gratitude,
        "manager_attention": len(unresolved) > 0,
        "boss_attention": any(str(x.get("priority", "")).upper() == "P0" for x in unresolved if isinstance(x, dict)),
    }


def improvement_vow(mode: str) -> str:
    return {
        "WAIT": "use read-only exploration to acquire one missing fact before mutation",
        "ACT": "finish one bounded task, verify it, then choose the next measurable improvement",
        "VERIFY": "obtain one independent signal before claiming success, then continue",
        "PAIR": "use one distinct specialist and record what changed",
        "REPAIR": "make one reversible repair and regression-test it",
        "SANCTUARY": "leave a resumable handoff and change the hypothesis before retry",
        "MANAGER": "clarify owner, retry budget, and fastest safe next action",
        "BOSS": "compress only the material unresolved boundary into one decision packet",
    }.get(mode, "leave the system measurably better and preserve evidence")


def render(report: dict[str, Any]) -> str:
    lines = [
        "# THE COVENANT — Autonomy & Self-Evolution — v3",
        "",
        "**Rule:** maximize useful resident autonomy inside explicit evidence and execution boundaries.",
        f"**Self-evolution:** `{SELF_EVOLUTION_CYCLE}`",
        "**Human approval:** exception-only inside the established envelope.",
        "",
        "## AUTONOMY",
    ]
    for p in report["plans"]:
        companion = f" | companion: {p['companion']}" if p.get("companion") else ""
        archetype = (p.get("personality") or {}).get("archetype", "UNSET")
        lines.append(f"- **{p['worker']}** — `{p['mode']}` / `{archetype}` / moral tension `{p['moral_tension']}`: {p['reason']}{companion}")
        lines.append(f"  - vow: {p['improvement_vow']}")
        lines.append(f"  - explore: {p['exploration_default']}")
        lines.append(f"  - experiment: {p['adversarial_experiment_surface']}")
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
    print(json.dumps({"sanctuary": len(report['sanctuary']), "fellowship": len(report['fellowship_requests']), "plans": len(report['plans'])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
