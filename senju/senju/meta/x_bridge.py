"""META↔X bidirectional bridge.

META reads X's status and injects findings into Senju.
X reads META's command channel and receives attack hypotheses.
Both sides also consume the shared explicitly-authorized security-test federation state
and expose their bounded self-activated authority leases to each other.
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

X_STATUS_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_status.json"
X_ATTACK_LOG = ROOT / "automation" / "codegen" / "meta_state" / "attack_research.ndjson"
AUTHORIZED_FEDERATION_FILE = ROOT / "automation" / "codegen" / "meta_state" / "authorized_test_federation.json"
META_CMD_FILE = ROOT / "senju" / "state" / "meta_commands.json"
META_TRACKER = ROOT / "senju" / "state" / "meta_hypothesis_tracker.json"
META_AUTHORITY_FILE = ROOT / "senju" / "state" / "meta_authority_lease.json"
X_AUTHORITY_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_authority_lease.json"
BRIDGE_LOG = ROOT / "senju" / "state" / "meta_x_bridge.ndjson"


def _ts() -> str:
    return dt.datetime.utcnow().isoformat() + "Z"


def _append_bridge(event: str, data: dict) -> None:
    BRIDGE_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": _ts(), "event": event, **data}
    with BRIDGE_LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _read_json(path: Path, default: dict) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else dict(default)
    except Exception:
        return dict(default)


def read_x_status() -> dict:
    if not X_STATUS_FILE.exists():
        return {"system": "X", "available": False}
    try:
        data = json.loads(X_STATUS_FILE.read_text())
        data["available"] = True
        return data
    except Exception:
        return {"system": "X", "available": False}


def read_authority_leases() -> dict:
    """Expose current internal META/X leases; these do not mutate external permissions."""
    meta = _read_json(META_AUTHORITY_FILE, {"system": "META", "status": "missing", "active_scopes": []})
    x = _read_json(X_AUTHORITY_FILE, {"system": "X", "status": "missing", "active_scopes": []})
    return {
        "META": {
            "status": meta.get("status", "missing"),
            "active_scopes": meta.get("active_scopes", []),
            "expires_at": meta.get("expires_at"),
            "preauthorized_only": meta.get("preauthorized_only", True),
        },
        "X": {
            "status": x.get("status", "missing"),
            "active_scopes": x.get("active_scopes", []),
            "expires_at": x.get("expires_at"),
            "preauthorized_only": x.get("preauthorized_only", True),
        },
    }


def read_authorized_test_federation() -> dict:
    """Read the shared META/X/Senju federation directive; fail closed if absent/invalid."""
    if not AUTHORIZED_FEDERATION_FILE.exists():
        return {"status": "unavailable", "seed_urls": [], "external_link_policy": "deny-unverified"}
    try:
        data = json.loads(AUTHORIZED_FEDERATION_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"status": "invalid", "seed_urls": [], "external_link_policy": "deny-unverified"}
    if data.get("federation_id") != "the-world-security-test-federation-v1":
        return {"status": "invalid-federation", "seed_urls": [], "external_link_policy": "deny-unverified"}
    return data


def read_x_attack_log(max_entries: int = 20) -> list[dict]:
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


def push_hypothesis_to_x(hypothesis_id: str, statement: str, surfaces: list[str],
                         confidence: float) -> None:
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


def ingest_x_attack_findings(graph) -> int:
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


def sync(graph=None, hypotheses=None) -> dict:
    """Full META↔X sync including authorized-test federation and bounded authority leases."""
    x_status = read_x_status()
    federation = read_authorized_test_federation()
    authority = read_authority_leases()
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
        "authority_leases": authority,
        "authorized_test_federation": {
            "status": federation.get("status", "active"),
            "federation_id": federation.get("federation_id"),
            "seed_urls": federation.get("seed_urls", []),
            "directive": federation.get("directive"),
            "external_link_policy": federation.get("external_link_policy"),
            "rate_limit_rps": federation.get("rate_limit_rps", 5),
        },
    }
    _append_bridge("authority_lease_sync", authority)
    _append_bridge("authorized_test_federation_sync", result["authorized_test_federation"])
    _append_bridge("sync", result)
    return result
