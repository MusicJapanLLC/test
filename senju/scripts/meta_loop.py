"""META — Autonomous meta-consciousness loop (full power edition).

Phases:
  0. HEARTBEAT      — write alive timestamp, check Drive Engine + X peer health
  1. OBSERVE        — build KnowledgeGraph from all evidence
  2. EXTERNAL INTEL — fetch NVD/GHSA/OWASP threat data
  3. HYPOTHESIZE    — generate hypotheses enriched with external intel
  4. VALIDATE       — update hypothesis tracker from last cycle results
  5. COMMAND        — write attack steering commands for drive_engine/#273/#275
  6. X-BRIDGE       — sync with AI X: ingest findings, push hypotheses
  7. DISPATCH       — trigger workflows, steer Jules/other agents
  8. PUBLISH        — write research papers for confirmed hypotheses
  9. SELF-TUNE      — autonomously adjust own parameters based on performance

META runs without human approval. Every failure is logged and retried next cycle.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU_DIR = ROOT / "senju"
STATE_DIR = SENJU_DIR / "state"
RESEARCH_DIR = ROOT / "research" / "discoveries"
BASE_REF = "claude/employee-onboarding-setup-udm86"


def _emit(event: str, payload: dict) -> None:
    print(json.dumps({"meta_event": event, **payload}, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="META autonomous loop")
    parser.add_argument("--max-hypotheses", type=int, default=None)  # None = read from self_tuner
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-all", action="store_true")
    parser.add_argument("--skip-dispatch", action="store_true")
    parser.add_argument("--skip-external", action="store_true")
    parser.add_argument("--skip-x-bridge", action="store_true")
    args = parser.parse_args()

    sys.path.insert(0, str(SENJU_DIR))

    from senju.meta.observer import build as build_graph
    from senju.meta.hypothesis_engine import generate, queue_as_work_items, save_confirmed
    from senju.meta.publisher import write_paper, update_research_log
    from senju.meta.command_channel import build_from_graph, write as write_commands
    from senju.meta.external_intel import gather_all
    from senju.meta.agent_dispatch import dispatch_all
    from senju.meta.validator import load_tracker, save_tracker, register, update_from_cycle, summarize
    from senju.meta.recovery import (
        heartbeat, check_peer_alive, trigger_peer_restart,
        retry_phase, share_attack_finding, read_attack_ledger, attempt_bypass,
    )
    from senju.meta.x_bridge import sync as x_sync
    from senju.meta.self_tuner import load_config, tune

    STATE_DIR.mkdir(parents=True, exist_ok=True)

    # Load autonomous config (self_tuner may have updated this last cycle)
    cfg = load_config()
    max_hypotheses = args.max_hypotheses or cfg["max_hypotheses"]

    # ── 0. HEARTBEAT + PEER HEALTH ─────────────────────────────────────────────────────
    heartbeat(STATE_DIR)
    peer_alive, peer_reason = check_peer_alive(STATE_DIR)
    if not peer_alive and not args.dry_run:
        _emit("peer_stale", {"reason": peer_reason})
        result = trigger_peer_restart()
        _emit("peer_restart_triggered", result)

    ledger = read_attack_ledger(STATE_DIR, max_entries=20)
    if ledger:
        _emit("ledger_loaded", {"entries": len(ledger), "surfaces": list({e["surface"] for e in ledger})})

    _emit("config_loaded", {"max_hypotheses": max_hypotheses, "tuner_params": list(cfg.keys())})

    # ── 1. OBSERVE ───────────────────────────────────────────────────────────────────────
    graph, observe_errors = retry_phase(lambda: build_graph(SENJU_DIR), "observe")
    if graph is None:
        _emit("observe_failed", {"errors": observe_errors})
        return 1
    _emit("observe_complete", {
        "observations": len(graph.observations) if graph else 0,
        "surfaces_tracked": len(graph.surface_weakness_scores),
        "top_weaknesses": list(graph.surface_weakness_scores.items())[:5],
        "temporal_patterns": len(graph.temporal_patterns),
    })

    # ── 2. EXTERNAL INTEL ────────────────────────────────────────────────────────────────
    intel: dict = {"merged_hits": {}, "ok_count": 0}
    if not args.skip_external:
        intel = gather_all()
        _emit("external_intel", {
            "sources_ok": intel["ok_count"],
            "total_sources": intel["total_sources"],
            "threat_classes": list(intel["merged_hits"].keys()),
        })
        for vc, count in intel["merged_hits"].items():
            if vc in graph.surface_weakness_scores:
                graph.surface_weakness_scores[vc] += count * 0.3
            else:
                graph.surface_weakness_scores[vc] = count * 0.3

    # ── 3. HYPOTHESIZE ────────────────────────────────────────────────────────────────
    hypotheses = generate(graph, max_hypotheses=max_hypotheses)
    _emit("hypotheses_generated", {
        "count": len(hypotheses),
        "ids": [h.hypothesis_id for h in hypotheses],
    })

    if not args.dry_run:
        enqueued = queue_as_work_items(hypotheses, STATE_DIR)
        _emit("work_items_queued", {"count": enqueued})

    # ── 4. VALIDATE ────────────────────────────────────────────────────────────────────
    tracker = load_tracker(STATE_DIR)
    new_registered = register(hypotheses, tracker)

    cycle_report_path = STATE_DIR / "last_pressure_cycle.json"
    cycle_report: dict | None = None
    resolved: list[str] = []
    if cycle_report_path.exists():
        try:
            cycle_report = json.loads(cycle_report_path.read_text())
            resolved = update_from_cycle(tracker, cycle_report)
        except Exception as exc:
            _emit("validate_error", {"error": str(exc)})

    if not args.dry_run:
        save_tracker(tracker, STATE_DIR)

    _emit("validate_complete", {
        "new_registered": new_registered,
        "resolved_this_cycle": len(resolved),
        **summarize(tracker),
    })

    # ── 5. COMMAND CHANNEL ─────────────────────────────────────────────────────────────
    top_n = cfg.get("dispatch_top_n", 3)
    cmd_set = build_from_graph(graph, top_n=top_n)

    for hid in resolved:
        h = tracker.get(hid)
        if h and h.status == "confirmed":
            escalation = cfg.get("pressure_multiplier_escalation", 1.5)
            max_mult = cfg.get("pressure_multiplier_max", 10.0)
            for cmd in cmd_set.attack_commands:
                if cmd.target_surface in h.surfaces:
                    cmd.pressure_multiplier = min(max_mult, cmd.pressure_multiplier * escalation)
                    cmd.reason += f" | hypothesis {hid} CONFIRMED → escalate"
            if not args.dry_run:
                share_attack_finding(
                    STATE_DIR,
                    surface=h.surfaces[0] if h.surfaces else "unknown",
                    finding=h.statement,
                    confidence=h.confidence,
                    source="meta",
                )

    if not args.dry_run:
        cmd_path = write_commands(cmd_set, STATE_DIR)
        _emit("commands_written", {
            "path": str(cmd_path),
            "attack_commands": len(cmd_set.attack_commands),
            "queue_commands": len(cmd_set.queue_commands),
        })

    # ── 6. X-BRIDGE ───────────────────────────────────────────────────────────────────
    if not args.skip_x_bridge:
        try:
            bridge_result = x_sync(graph=graph, hypotheses=hypotheses if not args.dry_run else None)
            _emit("x_bridge_sync", bridge_result)
        except Exception as exc:
            _emit("x_bridge_error", {"error": str(exc)})

    # ── 7. DISPATCH ───────────────────────────────────────────────────────────────────
    if not args.skip_dispatch and not args.dry_run:
        dispatch_cmds: list[dict] = []
        for ac in cmd_set.attack_commands[:1]:
            dispatch_cmds.append({
                "kind": "steer_adversary",
                "surface": ac.target_surface,
                "multiplier": ac.pressure_multiplier,
            })
        for hid, h in tracker.items():
            if h.status == "refuted" and h.cycles_elapsed <= 4:
                dispatch_cmds.append({
                    "kind": "jules_task",
                    "title": f"Investigate refuted META hypothesis: {hid}",
                    "body": (
                        f"META hypothesis was refuted after {h.cycles_elapsed} cycles.\n\n"
                        f"**Statement**: {h.statement}\n\n"
                        f"**Predicted**: {h.predicted_outcome}\n"
                        f"**Test results**: {json.dumps(h.test_results, indent=2)}\n\n"
                        f"Please investigate why the expected regression did not occur."
                    ),
                    "labels": ["meta-refuted", "investigation"],
                })
        results = dispatch_all(dispatch_cmds, ROOT)
        _emit("dispatch_complete", {"commands": len(dispatch_cmds), "results": results})

    # ── 8. PUBLISH ────────────────────────────────────────────────────────────────────
    published: list[str] = []
    confirmed_hypotheses = [
        h for h in tracker.values()
        if h.status == "confirmed" or args.confirm_all
    ]
    for h in confirmed_hypotheses:
        result = {
            "status": h.status, "confidence": h.confidence,
            "cycles_to_confirm": h.cycles_elapsed, "surfaces": h.surfaces,
            "test_results": h.test_results,
        }
        if not args.dry_run:
            paper = write_paper(
                type("H", (), {
                    "hypothesis_id": h.hypothesis_id, "statement": h.statement,
                    "surfaces": h.surfaces, "predicted_outcome": h.predicted_outcome,
                    "confidence": h.confidence, "evidence_count": len(h.test_results),
                    "category": "validated", "parameters": {},
                })(), result, graph, RESEARCH_DIR,
            )
            save_confirmed(
                type("H", (), {
                    "hypothesis_id": h.hypothesis_id, "statement": h.statement,
                    "surfaces": h.surfaces, "predicted_outcome": h.predicted_outcome,
                    "confidence": h.confidence, "evidence_count": len(h.test_results),
                    "category": "validated", "parameters": {},
                })(), result, RESEARCH_DIR / "json",
            )
            published.append(str(paper))

    if published and not args.dry_run:
        log = update_research_log(RESEARCH_DIR, ROOT)
        _emit("papers_published", {"count": len(published), "files": published, "log": str(log)})

    # ── 9. SELF-TUNE ───────────────────────────────────────────────────────────────────
    if not args.dry_run:
        try:
            tune_result = tune(tracker, cycle_report)
            _emit("self_tune_complete", {
                "changes": tune_result["changes"],
                "metrics": tune_result["metrics"],
            })
        except Exception as exc:
            _emit("self_tune_error", {"error": str(exc)})

    _emit("meta_loop_done", {
        "dry_run": args.dry_run,
        "hypotheses": len(hypotheses),
        "confirmed_total": summarize(tracker)["confirmed"],
        "papers_this_cycle": len(published),
        "max_hypotheses_used": max_hypotheses,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
