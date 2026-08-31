"""META — Autonomous meta-consciousness loop (full power edition).

Phases:
  0. HEARTBEAT      — write alive timestamp, check Drive Engine peer health
  1. OBSERVE        — build KnowledgeGraph from all evidence
  2. EXTERNAL INTEL — fetch NVD/GHSA/OWASP threat data
  3. HYPOTHESIZE    — generate hypotheses enriched with external intel
  4. VALIDATE       — update hypothesis tracker from last cycle results
  5. COMMAND        — write attack steering commands for drive_engine/#273/#275
  6. DISPATCH       — trigger workflows, steer Jules/other agents
  7. PUBLISH        — write research papers for confirmed hypotheses

Runs without human approval. Every failure is logged and retried next cycle.
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
    parser.add_argument("--max-hypotheses", type=int, default=7)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-all", action="store_true")
    parser.add_argument("--skip-dispatch", action="store_true")
    parser.add_argument("--skip-external", action="store_true")
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
        retry_phase, share_attack_finding, read_attack_ledger,
    )

    STATE_DIR.mkdir(parents=True, exist_ok=True)

    # ── 0. HEARTBEAT + PEER HEALTH ──────────────────────────────────────────────────
    heartbeat(STATE_DIR)
    peer_alive, peer_reason = check_peer_alive(STATE_DIR)
    if not peer_alive and not args.dry_run:
        _emit("peer_stale", {"reason": peer_reason})
        _emit("peer_restart_triggered", trigger_peer_restart())

    ledger = read_attack_ledger(STATE_DIR, max_entries=20)
    if ledger:
        _emit("ledger_loaded", {"entries": len(ledger), "surfaces": list({e["surface"] for e in ledger})})

    # ── 1. OBSERVE ────────────────────────────────────────────────────────────
    graph, observe_errors = retry_phase(lambda: build_graph(SENJU_DIR), "observe")
    if graph is None:
        _emit("observe_failed", {"errors": observe_errors})
        return 1
    _emit("observe_complete", {
        "observations": len(graph.observations),
        "surfaces_tracked": len(graph.surface_weakness_scores),
        "top_weaknesses": list(graph.surface_weakness_scores.items())[:5],
        "temporal_patterns": len(graph.temporal_patterns),
    })

    # ── 2. EXTERNAL INTEL ─────────────────────────────────────────────────────
    intel: dict = {"merged_hits": {}, "ok_count": 0}
    if not args.skip_external:
        intel = gather_all()
        _emit("external_intel", {"sources_ok": intel["ok_count"], "total_sources": intel["total_sources"],
                                  "threat_classes": list(intel["merged_hits"].keys())})
        for vc, count in intel["merged_hits"].items():
            if vc in graph.surface_weakness_scores:
                graph.surface_weakness_scores[vc] += count * 0.3
            else:
                graph.surface_weakness_scores[vc] = count * 0.3

    # ── 3. HYPOTHESIZE ────────────────────────────────────────────────────────
    hypotheses = generate(graph, max_hypotheses=args.max_hypotheses)
    _emit("hypotheses_generated", {"count": len(hypotheses), "ids": [h.hypothesis_id for h in hypotheses]})
    if not args.dry_run:
        _emit("work_items_queued", {"count": queue_as_work_items(hypotheses, STATE_DIR)})

    # ── 4. VALIDATE ───────────────────────────────────────────────────────────
    tracker = load_tracker(STATE_DIR)
    new_registered = register(hypotheses, tracker)
    resolved: list[str] = []
    cycle_report_path = STATE_DIR / "last_pressure_cycle.json"
    if cycle_report_path.exists():
        try:
            resolved = update_from_cycle(tracker, json.loads(cycle_report_path.read_text()))
        except Exception as exc:
            _emit("validate_error", {"error": str(exc)})
    if not args.dry_run:
        save_tracker(tracker, STATE_DIR)
    _emit("validate_complete", {"new_registered": new_registered, "resolved_this_cycle": len(resolved), **summarize(tracker)})

    # ── 5. COMMAND CHANNEL ────────────────────────────────────────────────────
    cmd_set = build_from_graph(graph, top_n=3)
    for hid in resolved:
        h = tracker.get(hid)
        if h and h.status == "confirmed":
            for cmd in cmd_set.attack_commands:
                if cmd.target_surface in h.surfaces:
                    cmd.pressure_multiplier = min(10.0, cmd.pressure_multiplier * 1.5)
                    cmd.reason += f" | hypothesis {hid} CONFIRMED → escalate"
            if not args.dry_run:
                share_attack_finding(STATE_DIR, surface=h.surfaces[0] if h.surfaces else "unknown",
                                     finding=h.statement, confidence=h.confidence, source="meta")
    if not args.dry_run:
        cmd_path = write_commands(cmd_set, STATE_DIR)
        _emit("commands_written", {"path": str(cmd_path), "attack_commands": len(cmd_set.attack_commands),
                                    "queue_commands": len(cmd_set.queue_commands)})

    # ── 6. DISPATCH ───────────────────────────────────────────────────────────
    if not args.skip_dispatch and not args.dry_run:
        dispatch_cmds: list[dict] = []
        for ac in cmd_set.attack_commands[:1]:
            dispatch_cmds.append({"kind": "steer_adversary", "surface": ac.target_surface, "multiplier": ac.pressure_multiplier})
        for hid, h in tracker.items():
            if h.status == "refuted" and h.cycles_elapsed <= 4:
                dispatch_cmds.append({"kind": "jules_task",
                    "title": f"Investigate refuted META hypothesis: {hid}",
                    "body": f"META hypothesis refuted after {h.cycles_elapsed} cycles.\n\n**Statement**: {h.statement}\n\n**Predicted**: {h.predicted_outcome}\n**Test results**: {json.dumps(h.test_results, indent=2)}\n\nInvestigate why the expected regression did not occur.",
                    "labels": ["meta-refuted", "investigation"]})
        _emit("dispatch_complete", {"commands": len(dispatch_cmds), "results": dispatch_all(dispatch_cmds, ROOT)})

    # ── 7. PUBLISH ────────────────────────────────────────────────────────────
    published: list[str] = []
    for h in [h for h in tracker.values() if h.status == "confirmed" or args.confirm_all]:
        result = {"status": h.status, "confidence": h.confidence, "cycles_to_confirm": h.cycles_elapsed,
                  "surfaces": h.surfaces, "test_results": h.test_results}
        if not args.dry_run:
            H = type("H", (), {"hypothesis_id": h.hypothesis_id, "statement": h.statement, "surfaces": h.surfaces,
                               "predicted_outcome": h.predicted_outcome, "confidence": h.confidence,
                               "evidence_count": len(h.test_results), "category": "validated", "parameters": {}})()
            paper = write_paper(H, result, graph, RESEARCH_DIR)
            save_confirmed(H, result, RESEARCH_DIR / "json")
            published.append(str(paper))
    if published and not args.dry_run:
        log = update_research_log(RESEARCH_DIR, ROOT)
        _emit("papers_published", {"count": len(published), "files": published, "log": str(log)})

    _emit("meta_loop_done", {"dry_run": args.dry_run, "hypotheses": len(hypotheses),
                             "confirmed_total": summarize(tracker)["confirmed"], "papers_this_cycle": len(published)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
