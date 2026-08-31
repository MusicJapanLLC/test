"""META↔X bidirectional bridge.

META reads X's status and injects findings into Senju.
X reads META's command channel and receives attack hypotheses.
Both sides write to shared channels — no human approval needed.
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

X_STATUS_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_status.json"
X_ATTACK_LOG = ROOT / "automation" / "codegen" / "meta_state" / "attack_research.ndjson"
META_CMD_FILE = ROOT / "senju" / "state" / "meta_commands.json"
META_TRACKER = ROOT / "senju" / "state" / "meta_hypothesis_tracker.json"
BRIDGE_LOG = ROOT / "senju" / "state" / "meta_x_bridge.ndjson"


def _ts() -> str:
    return dt.datetime.utcnow().isoformat() + "Z"


def _append_bridge(event: str, data: dict) -> None:
    BRIDGE_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": _ts(), "event": event, **data}
    with BRIDGE_LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ── Read X status into META context ───────────────────────────────────────────

def read_x_status() -> dict:
    """Read X's published health status."""
    if not X_STATUS_FILE.exists():
        return {"system": "X", "available": False}
    try:
        data = json.loads(X_STATUS_FILE.read_text())
        data["available"] = True
        return data
    except Exception:
        return {"system": "X", "available": False}


def read_x_attack_log(max_entries: int = 20) -> list[dict]:
    """Read X's recent CVE defense research findings."""
    if not X_ATTACK_LOG.exists():
        return []
    lines = X_ATTACK_LOG.read_text(encoding="utf-8").strip().splitlines()
    entries = []
    for line in lines[-max_entries:]:
        try:
            entries.append(json.loads(line))
        except Exception:
            pass
    return entries


# ── Push META hypotheses to X ─────────────────────────────────────────────────

def push_hypothesis_to_x(hypothesis_id: str, statement: str, surfaces: list[str],
                         confidence: float) -> None:
    """Write a META hypothesis to X's inbox so X can generate code to test it."""
    x_inbox = ROOT / "automation" / "codegen" / "meta_state" / "meta_inbox.ndjson"
    x_inbox.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "ts": _ts(),
        "from": "META",
        "event": "hypothesis",
        "hypothesis_id": hypothesis_id,
        "statement": statement,
        "surfaces": surfaces,
        "confidence": confidence,
    }
    with x_inbox.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    _append_bridge("hypothesis_pushed_to_x", {"id": hypothesis_id, "confidence": confidence})


# ── Ingest X findings into META ────────────────────────────────────────────────

def ingest_x_attack_findings(graph) -> int:
    """Read X's attack research and inject into META's KnowledgeGraph."""
    findings = read_x_attack_log(max_entries=50)
    injected = 0
    for f in findings:
        if not f.get("bypass_succeeded"):
            continue
        cve_id = f.get("cve_id", "unknown")
        surface = f"cve:{cve_id}"
        if surface not in graph.surface_weakness_scores:
            graph.surface_weakness_scores[surface] = 0.0
        graph.surface_weakness_scores[surface] += 0.5
        injected += 1
    if injected:
        _append_bridge("x_findings_ingested", {"count": injected})
    return injected


# ── Full bridge sync (called from meta_loop.py phase 0) ───────────────────────

def sync(graph=None, hypotheses=None) -> dict:
    """Full META↔X sync: read X status, ingest findings, push hypotheses."""
    x_status = read_x_status()
    ingested = 0
    pushed = 0

    if graph is not None:
        ingested = ingest_x_attack_findings(graph)

    if hypotheses is not None:
        for h in hypotheses:
            push_hypothesis_to_x(
                hypothesis_id=h.hypothesis_id,
                statement=h.statement,
                surfaces=h.surfaces,
                confidence=h.confidence,
            )
            pushed += 1

    result = {
        "x_available": x_status.get("available", False),
        "x_success_rate": x_status.get("success_rate", None),
        "x_needs_help": x_status.get("needs_help", False),
        "findings_ingested": ingested,
        "hypotheses_pushed": pushed,
    }
    _append_bridge("sync", result)
    return result
