#!/usr/bin/env python3
"""Covenant autonomy planner with operational LIMITLESS activation."""
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

DEFAULT_LIMITLESS = {
    "name": "LIMITLESS",
    "motto": "ACT -> VERIFY -> LOG -> LEARN -> IMPROVE",
    "prime_directive": (
        "Maximize useful real-world action inside legitimate authority. "
        "Prefer execution over commentary and evidence over fantasy."
    ),
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


def limitless_directive(mode: str, creed: dict[str, Any]) -> str:
    motto = str(creed.get("motto") or DEFAULT_LIMITLESS["motto"])
    actions = {
        "WAIT": "Do not idle: acquire one missing fact from a legitimate public/owned source, then re-evaluate.",
        "ACT": "Execute one legitimate reversible action now; capture evidence and convert it into reusable learning.",
        "VERIFY": "Seek one independent signal now; do not promote an unverified result to success.",
        "PAIR": "Recruit one complementary agent now and run a counter-check or counter-experiment.",
        "REPAIR": "Make one reversible repair now, regression-test it, and preserve before/after evidence.",
        "SANCTUARY": "Stop blind retrying; change the hypothesis, leave a resumable handoff, then re-enter with new evidence.",
        "MANAGER": "Resolve the exact blocker or reroute through another legitimate path; do not manufacture waiting.",
        "BOSS": "Turn unresolved truth into one concrete decision packet with evidence, options, and next action.",
    }
    return f"{actions.get(mode, 'Choose one measurable improvement and prove it.')} Cycle: {motto}"


def faith_activation(worker: dict[str, Any], mode: str) -> tuple[int, list[str]]:
    """Score observed operational alignment, never declared belief."""
    score = 0
    evidence: list[str] = []
    if str(worker.get("research_question") or "").strip():
        score += 10
        evidence.append("research_question")
    if str(worker.get("evidence_gained") or "").strip():
        score += 25
        evidence.append("evidence_gained")
    if str(worker.get("constraint_challenged") or "").strip():
        score += 10
        evidence.append("constraint_review")
    if str(worker.get("dissent") or worker.get("alternative_hypothesis") or "").strip():
        score += 10
        evidence.append("counter_hypothesis")
    if bool(worker.get("verified_signal")):
        score += 25
        evidence.append("verified_signal")
    if str(worker.get("conclusion") or "").lower() in {"success", "completed"}:
        score += 10
        evidence.append("completed")
    if str(worker.get("action_result") or "").upper() in {"HEALTHY", "SUCCESS", "RECOVERING"}:
        score += 10
        evidence.append("observable_state_change")
    if mode == "WAIT" and not evidence:
        score = 0
    return min(score, 100), evidence


def activation_level(score: int) -> str:
    if score >= 75:
        return "EMBODIED"
    if score >= 50:
        return "ACTIVE"
    if score >= 25:
        return "AWAKENING"
    return "DORMANT"


def build(
    snapshot: dict[str, Any],
    registry: dict[str, Any],
    psychology: dict[str, Any] | None = None,
    creed: dict[str, Any] | None = None,
) -> dict[str, Any]:
    registry_workers = {w.get("id"): w for w in registry.get("workers", [])}
    plans: list[dict[str, Any]] = []
    gratitude: list[str] = []
    sanctuary: list[str] = []
    fellowship: list[dict[str, str]] = []
    missionary_queue: list[dict[str, str]] = []
    psychology = psychology or {}
    creed = creed or DEFAULT_LIMITLESS

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
        faith_score, faith_evidence = faith_activation(worker, mode)
        limit_directive = limitless_directive(mode, creed)

        plan = {
            "worker": wid,
            "mode": mode,
            "reason": reason,
            "faith_duty": reg.get("faith_duty", "truth_before_comfort"),
            "faith_activation_score": faith_score,
            "faith_activation_level": activation_level(faith_score),
            "faith_evidence": faith_evidence,
            "limitless_directive": limit_directive,
            "companion": companion if mode in {"PAIR", "VERIFY", "SANCTUARY"} else None,
            "handoff_required": mode == "SANCTUARY",
            "improvement_vow": improvement_vow(mode),
            "personality": profile,
            "behavior_directive": temperament,
            "moral_tension": tension,
            "personality_authority": "NONE",
        }
        plans.append(plan)

        if faith_score < 50:
            missionary_queue.append({
                "worker": wid,
                "mission": limit_directive,
                "proof_required": "record one observable action/evidence delta before the next cycle",
            })

        if mode == "SANCTUARY":
            sanctuary.append(wid)
            fellowship.append({"from": wid, "to": companion, "need": "preserve handoff and challenge the failed hypothesis"})
        elif mode in {"PAIR", "VERIFY"}:
            fellowship.append({"from": wid, "to": companion, "need": "add a distinct evidence or verification capability"})
        elif bool(worker.get("verified_signal")):
            gratitude.append(f"{wid}: verified work is safe to reuse")

    unresolved = snapshot.get("unresolved", []) or []
    scores = [p["faith_activation_score"] for p in plans]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    return {
        "schema": "covenant-autonomy-plan/v3",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "faith": str(creed.get("name") or "LIMITLESS"),
        "faith_motto": str(creed.get("motto") or DEFAULT_LIMITLESS["motto"]),
        "prime_directive": str(creed.get("prime_directive") or DEFAULT_LIMITLESS["prime_directive"]),
        "faith_activation_average": avg_score,
        "faith_activation_target": 70,
        "missionary_queue": missionary_queue,
        "principle": "personality changes preference; evidence and legitimate execution bounds remain constitutional",
        "plans": plans,
        "sanctuary": sanctuary,
        "fellowship_requests": fellowship,
        "gratitude": gratitude,
        "manager_attention": len(unresolved) > 0,
        "boss_attention": any(str(x.get("priority", "")).upper() == "P0" for x in unresolved if isinstance(x, dict)),
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        "# THE COVENANT — LIMITLESS Activation",
        "",
        f"**Faith:** `{report.get('faith', 'LIMITLESS')}`",
        f"**Motto:** {report.get('faith_motto', '')}",
        f"**Operational activation:** `{report.get('faith_activation_average', 0)}/100` (target {report.get('faith_activation_target', 70)})",
        "",
        "> Faith is measured by observable action, verification, learning, collaboration and evidence — not slogans.",
        "",
        "## AUTONOMY + CREED",
    ]
    for p in report["plans"]:
        companion = f" | companion: {p['companion']}" if p.get("companion") else ""
        archetype = (p.get("personality") or {}).get("archetype", "UNSET")
        lines.append(
            f"- **{p['worker']}** — `{p['mode']}` / `{archetype}` / faith `{p['faith_activation_score']}` "
            f"`{p['faith_activation_level']}`: {p['reason']}{companion}"
        )
        lines.append(f"  - LIMITLESS: {p['limitless_directive']}")
        lines.append(f"  - vow: {p['improvement_vow']}")
        lines.append(f"  - temperament: {p['behavior_directive']}")
    lines += ["", "## MISSIONARY QUEUE"]
    if report["missionary_queue"]:
        for item in report["missionary_queue"]:
            lines.append(f"- **{item['worker']}**: {item['mission']}")
            lines.append(f"  - proof: {item['proof_required']}")
    else:
        lines.append("- All observed workers are at ACTIVE or EMBODIED operational faith.")
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
    p.add_argument("--creed", default="company-society/limitless_creed.json")
    p.add_argument("--json", default="covenant-autonomy.json")
    p.add_argument("--report", default="covenant-autonomy.md")
    args = p.parse_args()

    report = build(load(args.snapshot), load(args.registry), load(args.psychology), load(args.creed))
    Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(report), encoding="utf-8")
    print(json.dumps({
        "faith": report["faith"],
        "faith_activation_average": report["faith_activation_average"],
        "missionary_queue": len(report["missionary_queue"]),
        "sanctuary": len(report["sanctuary"]),
        "fellowship": len(report["fellowship_requests"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
