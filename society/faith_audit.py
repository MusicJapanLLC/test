#!/usr/bin/env python3
"""Generate an auditable Society/Faith report from operational evidence.

This layer never invents confessions, rest states, or conflict outcomes. It summarizes
explicit society events plus the existing TOMOKI Manager report. The result is safe to
hand to MANAGER, TOMOKI audit, BOSS, and CEO with progressive disclosure.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

EVENT_TYPES = {"confession", "rest", "conflict", "repair", "doubt", "verification"}
CONFESSION_REQUIRED = {"actor", "event", "impact", "evidence", "containment", "repair", "verification", "lesson"}
REST_REQUIRED = {"actor", "reason", "safe_state", "handoff", "resume_condition"}


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        raw = raw.strip()
        if not raw:
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError as exc:
            events.append({"type": "invalid", "line": lineno, "error": str(exc)})
            continue
        item.setdefault("line", lineno)
        events.append(item)
    return events


def validate_event(event: dict[str, Any]) -> list[str]:
    kind = event.get("type")
    if kind not in EVENT_TYPES:
        return [f"unknown-event-type:{kind}"]
    required: set[str] = set()
    if kind == "confession":
        required = CONFESSION_REQUIRED
    elif kind == "rest":
        required = REST_REQUIRED
    missing = sorted(key for key in required if not event.get(key))
    return [f"missing:{key}" for key in missing]


def summarize_manager(manager: dict[str, Any]) -> dict[str, Any]:
    workers = manager.get("workers") or []
    unresolved = [w for w in workers if w.get("after") == "UNRESOLVED"]
    recovering = [w for w in workers if w.get("after") == "RECOVERING"]
    repaired = [w for w in workers if any(str(a).startswith("accepted:") for a in (w.get("actions") or []))]
    verification_debt = [
        w for w in workers
        if w.get("before") not in {"HEALTHY", "ACTIVE"} and w.get("after") not in {"RECOVERING", "HEALTHY"}
    ]
    return {
        "workers": len(workers),
        "unresolved": len(unresolved),
        "recovering": len(recovering),
        "repair_actions": len(repaired),
        "verification_debt": len(verification_debt),
        "unresolved_ids": [w.get("id") for w in unresolved],
    }


def build_report(manager: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    valid: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    for event in events:
        errors = validate_event(event)
        if errors:
            invalid.append({"line": event.get("line"), "type": event.get("type"), "errors": errors})
        else:
            valid.append(event)

    counts = {kind: 0 for kind in sorted(EVENT_TYPES)}
    for event in valid:
        counts[event["type"]] += 1

    manager_summary = summarize_manager(manager)
    truth_debt = len(invalid) + manager_summary["verification_debt"]
    active_conflicts = [e for e in valid if e["type"] == "conflict" and e.get("status", "OPEN") != "RESOLVED"]
    rest_without_resume = [e for e in valid if e["type"] == "rest" and not e.get("resumed_at")]

    material = bool(
        manager_summary["unresolved"]
        or active_conflicts
        or invalid
        or truth_debt >= 2
    )

    return {
        "schema": "music-japan-faith-report/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "principle": "TRUTH > APPEARANCE; REPAIR > BLAME; CONFESSION > CONCEALMENT",
        "manager": manager_summary,
        "ritual_counts": counts,
        "active_conflicts": len(active_conflicts),
        "resting": len(rest_without_resume),
        "truth_debt": truth_debt,
        "invalid_events": invalid,
        "material_for_boss": material,
        "manager_view": {
            "confessions": counts["confession"],
            "rest_states": len(rest_without_resume),
            "active_conflicts": len(active_conflicts),
            "repairs": counts["repair"] + manager_summary["repair_actions"],
            "verification_debt": manager_summary["verification_debt"],
        },
        "tomoki_audit_view": {
            "truth_debt": truth_debt,
            "invalid_or_incomplete_rituals": len(invalid),
            "unresolved_worker_ids": manager_summary["unresolved_ids"],
        },
        "boss_view": {
            "material": material,
            "reason": "unresolved/conflict/truth-debt threshold" if material else "no material faith incident",
        },
    }


def render_markdown(report: dict[str, Any]) -> str:
    mgr = report["manager_view"]
    audit = report["tomoki_audit_view"]
    boss = report["boss_view"]
    status = "MATERIAL" if boss["material"] else "STABLE"
    lines = [
        f"# Faith Report — {status}",
        "",
        "**Creed:** Truth before appearance / Repair before blame / Confession before concealment",
        "",
        "## MANAGER",
        f"- Confessions: {mgr['confessions']}",
        f"- Resting: {mgr['rest_states']}",
        f"- Active conflicts: {mgr['active_conflicts']}",
        f"- Repairs observed: {mgr['repairs']}",
        f"- Verification debt: {mgr['verification_debt']}",
        "",
        "## TOMOKI AUDIT",
        f"- Truth debt: {audit['truth_debt']}",
        f"- Invalid/incomplete rituals: {audit['invalid_or_incomplete_rituals']}",
        f"- Unresolved workers: {', '.join(audit['unresolved_worker_ids']) or 'none'}",
        "",
        "## BOSS / CEO GATE",
        f"- Material escalation: {'YES' if boss['material'] else 'NO'}",
        f"- Reason: {boss['reason']}",
        "",
        "No metaphysical claim is inferred. No confession is invented. Evidence remains authoritative.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manager", default="reports/control-plane/manager-latest.json")
    parser.add_argument("--events", default="reports/society/events.jsonl")
    parser.add_argument("--out-json", default="reports/society/faith-latest.json")
    parser.add_argument("--out-md", default="reports/society/faith-latest.md")
    args = parser.parse_args()

    manager = load_json(Path(args.manager))
    events = load_events(Path(args.events))
    report = build_report(manager, events)

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps({"material": report["material_for_boss"], "truth_debt": report["truth_debt"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
