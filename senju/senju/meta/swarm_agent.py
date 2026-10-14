"""Swarm Agent Runner — runs one named agent from the SWARM roster.

Each agent uses META ULTRA but with its own personality config.
All agents share the same state directory (knowledge base, ledger, tracker).
Competition + cooperation = amplification.
"""
from __future__ import annotations

import json
import random
import sys
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SENJU_DIR = ROOT / "senju"
STATE_DIR = SENJU_DIR / "state"
SWARM_LEDGER = STATE_DIR / "swarm_ledger.ndjson"


def _ts() -> str:
    return dt.datetime.utcnow().isoformat() + "Z"


def _swarm_log(codename: str, event: str, data: dict) -> None:
    SWARM_LEDGER.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": _ts(), "agent": codename, "event": event, **data}
    with SWARM_LEDGER.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_swarm_ledger(max_entries: int = 100) -> list[dict]:
    if not SWARM_LEDGER.exists():
        return []
    lines = SWARM_LEDGER.read_text().strip().splitlines()
    entries = []
    for line in lines[-max_entries:]:
        try:
            entries.append(json.loads(line))
        except Exception:
            pass
    return entries


def apply_agent_config(codename: str) -> dict:
    """Load agent personality into self_tuner config. Returns the config."""
    from .swarm import get_agent
    from .self_tuner import load_config, save_config

    agent = get_agent(codename)
    cfg = load_config()

    # Override with agent's personality
    cfg["max_hypotheses"] = agent["max_hypotheses"]
    cfg["confirm_threshold"] = agent["confirm_threshold"]
    cfg["chaos_noise_range"] = agent["chaos_noise_range"]
    cfg["exploration_prob"] = agent["exploration_prob"]
    cfg["resurrection_prob"] = agent["resurrection_prob"]
    cfg["pressure_multiplier_escalation"] = agent["pressure_multiplier_escalation"]
    cfg["dispatch_top_n"] = agent["dispatch_top_n"]
    cfg["_agent_codename"] = codename
    cfg["_agent_title"] = agent["title"]
    cfg["_agent_personality"] = agent["personality"]
    cfg["_agent_strategy"] = agent["strategy"]
    cfg["_agent_specialty"] = agent["specialty"]

    save_config(cfg)
    return cfg


def ingest_swarm_knowledge(graph, codename: str) -> int:
    """Read other agents' confirmed findings and inject into this agent's graph."""
    ledger = read_swarm_ledger(max_entries=200)
    injected = 0
    for entry in ledger:
        if entry.get("agent") == codename:
            continue  # don't re-ingest own findings
        if entry.get("event") == "confirmed" and entry.get("surface"):
            surface = entry["surface"]
            boost = entry.get("confidence", 0.5)
            graph.surface_weakness_scores[surface] = (
                graph.surface_weakness_scores.get(surface, 0.0) + boost * 0.8
            )
            injected += 1
    return injected


def publish_confirmed_to_swarm(codename: str, tracker: dict) -> int:
    """Share this agent's confirmed hypotheses to the swarm ledger."""
    shared = 0
    for hid, h in tracker.items():
        if h.status == "confirmed":
            _swarm_log(codename, "confirmed", {
                "hypothesis_id": hid,
                "statement": h.statement,
                "surface": h.surfaces[0] if h.surfaces else "unknown",
                "confidence": h.confidence,
            })
            shared += 1
    return shared


def run_agent(codename: str, dry_run: bool = False) -> int:
    """Run a named swarm agent through the full META ULTRA loop."""
    from .swarm import get_agent
    from .observer import build as build_graph
    from .hypothesis_engine import generate, queue_as_work_items
    from .publisher import write_paper, update_research_log
    from .command_channel import build_from_graph, write as write_commands
    from .external_intel import gather_all
    from .agent_dispatch import dispatch_all
    from .validator import load_tracker, save_tracker, register, update_from_cycle, summarize
    from .recovery import heartbeat, check_peer_alive, trigger_peer_restart, retry_phase, share_attack_finding, read_attack_ledger
    from .x_bridge import sync as x_sync
    from .self_tuner import tune
    from .chaos_engine import inject_chaos, run_tournament, blind_surface_pick, resurrect_dead
    from .hypothesis_market import auto_bet_from_tracker, settle_market, breed_confirmed, generate_adversarial_pairs
    from .surface_scout import scan_codebase, inject_into_graph

    agent = get_agent(codename)
    STATE_DIR.mkdir(parents=True, exist_ok=True)

    def emit(event: str, payload: dict) -> None:
        print(json.dumps({"agent": codename, "event": event, **payload}, ensure_ascii=False))

    emit("agent_start", {"title": agent["title"], "personality": agent["personality"],
                         "strategy": agent["strategy"]})

    # Apply agent personality to config
    cfg = apply_agent_config(codename)
    _swarm_log(codename, "cycle_start", {"strategy": agent["strategy"]})

    # Heartbeat
    heartbeat(STATE_DIR, extra={"agent": codename})

    # OBSERVE
    graph, errors = retry_phase(lambda: build_graph(SENJU_DIR), "observe")
    if graph is None:
        emit("observe_failed", {"errors": errors})
        return 1

    # Ingest other agents' victories
    ingested = ingest_swarm_knowledge(graph, codename)
    emit("swarm_ingest", {"cross_agent_findings": ingested})

    # Surface scout (LEVIATHAN goes deep, others standard)
    if agent["specialty"] == "surface_scout_deep" or agent.get("exploration_prob", 0) > 0.7:
        discovered = scan_codebase(ROOT)
        inject_into_graph(graph, discovered)
        emit("surface_scout", {"found": len(discovered)})

    # External intel (PROMETHEUS maximizes this)
    intel: dict = {"merged_hits": {}, "ok_count": 0, "total_sources": 0}
    try:
        intel = gather_all()
        cascade = cfg.get("knowledge_cascade_multiplier", 1.5)
        for vc, count in intel["merged_hits"].items():
            graph.surface_weakness_scores[vc] = graph.surface_weakness_scores.get(vc, 0.0) + count * 0.3 * cascade
    except Exception as e:
        emit("intel_error", {"error": str(e)})

    # Hypothesize with agent's max_hypotheses
    hypotheses = generate(graph, max_hypotheses=cfg["max_hypotheses"])

    # Special: HYDRA breeds on all pairs, LOKI generates adversarial pairs, etc.
    tracker = load_tracker(STATE_DIR)
    register(hypotheses, tracker)

    children = breed_confirmed(tracker)
    for child in children:
        register([type("H", (), child)()], tracker)

    anti_pairs = generate_adversarial_pairs(hypotheses)
    for anti in anti_pairs:
        register([type("H", (), anti)()], tracker)

    # FENRIR: resurrect everything
    revived = resurrect_dead(tracker, resurrection_prob=cfg["resurrection_prob"])

    # NEMESIS: boost surfaces where we were previously refuted
    if agent["specialty"] == "target_refuted_surfaces":
        for hid, h in tracker.items():
            if h.status == "refuted":
                for surf in h.surfaces:
                    graph.surface_weakness_scores[surf] = graph.surface_weakness_scores.get(surf, 0.0) + 2.0

    # Blind exploration
    blind_surface_pick(graph, exploration_prob=cfg["exploration_prob"])

    emit("hypotheses", {"generated": len(hypotheses), "revived": len(revived),
                        "children": len(children), "anti_pairs": len(anti_pairs)})

    # Validate
    cycle_report_path = STATE_DIR / "last_pressure_cycle.json"
    resolved: list[str] = []
    cycle_report = None
    if cycle_report_path.exists():
        try:
            cycle_report = json.loads(cycle_report_path.read_text())
            resolved = update_from_cycle(tracker, cycle_report)
        except Exception:
            pass

    # Bayesian cascade
    for hid in resolved:
        h = tracker.get(hid)
        if h and h.status == "confirmed":
            for other_h in tracker.values():
                if set(other_h.surfaces) & set(h.surfaces):
                    other_h.confidence = min(0.99, other_h.confidence + 0.15)

    if not dry_run:
        save_tracker(tracker, STATE_DIR)

    # Market
    auto_bet_from_tracker(tracker, agent=codename)
    for hid in resolved:
        h = tracker.get(hid)
        if h:
            settle_market(hid, h.status == "confirmed")

    # Commands with FULL escalation for this agent
    top_n = cfg["dispatch_top_n"]
    cmd_set = build_from_graph(graph, top_n=top_n)
    escalation = cfg["pressure_multiplier_escalation"]
    for hid in resolved:
        h = tracker.get(hid)
        if h and h.status == "confirmed":
            for cmd in cmd_set.attack_commands:
                if cmd.target_surface in h.surfaces:
                    cmd.pressure_multiplier *= escalation
                    cmd.reason += f" [{codename}×{escalation}]"
            if not dry_run:
                share_attack_finding(STATE_DIR, surface=h.surfaces[0] if h.surfaces else "unknown",
                                     finding=h.statement, confidence=h.confidence, source=codename)

    # Chaos inject with agent's noise
    cmd_set = inject_chaos(cmd_set, noise_range=cfg["chaos_noise_range"])

    if not dry_run:
        write_commands(cmd_set, STATE_DIR)

    # X-Bridge
    try:
        x_sync(graph=graph, hypotheses=hypotheses if not dry_run else None)
    except Exception:
        pass

    # Tournament
    run_tournament(tracker)
    if not dry_run:
        save_tracker(tracker, STATE_DIR)

    # Publish and share to swarm
    if not dry_run:
        shared = publish_confirmed_to_swarm(codename, tracker)
        emit("swarm_publish", {"confirmed_shared": shared})

    # Self-tune (each agent tunes independently)
    try:
        tune(tracker, cycle_report)
    except Exception:
        pass

    summary = summarize(tracker)
    emit("agent_done", {**summary, "revived": len(revived)})
    _swarm_log(codename, "cycle_done", summary)
    return 0
