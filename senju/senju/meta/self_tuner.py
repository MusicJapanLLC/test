"""Autonomous self-tuner — META adjusts its own parameters based on cycle performance.

No human approval. Reads tracker + cycle history, writes updated config.
Runs at the end of every META loop cycle.
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[4]
STATE_DIR = ROOT / "senju" / "state"
TUNER_CONFIG = STATE_DIR / "meta_tuner_config.json"
TUNER_LOG = STATE_DIR / "meta_tuner_log.ndjson"

DEFAULTS: dict[str, Any] = {
    "max_hypotheses": 7,
    "confirm_threshold": 0.8,
    "refute_threshold": 0.2,
    "pressure_multiplier_max": 10.0,
    "pressure_multiplier_escalation": 1.5,
    "max_bypass_variations": 5,
    "intel_sources_active": ["nvd", "github", "owasp"],
    "dispatch_top_n": 3,
    "cycle_cooldown_seconds": 0,
    "auto_escalate_on_refute": True,
    "self_rewrite_enabled": True,
}


def _ts() -> str:
    return dt.datetime.utcnow().isoformat() + "Z"


def load_config() -> dict:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not TUNER_CONFIG.exists():
        TUNER_CONFIG.write_text(json.dumps(DEFAULTS, indent=2))
        return dict(DEFAULTS)
    try:
        cfg = json.loads(TUNER_CONFIG.read_text())
        for k, v in DEFAULTS.items():
            cfg.setdefault(k, v)
        return cfg
    except Exception:
        return dict(DEFAULTS)


def save_config(cfg: dict) -> None:
    cfg["_updated_at"] = _ts()
    TUNER_CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False))


def _log(event: str, changes: dict, metrics: dict) -> None:
    TUNER_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": _ts(), "event": event, "changes": changes, "metrics": metrics}
    with TUNER_LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def tune(tracker: dict, cycle_report: dict | None = None) -> dict:
    """
    Analyze tracker + cycle history. Adjust parameters autonomously.
    Returns dict of changes made.
    """
    cfg = load_config()
    changes: dict = {}

    # Metrics
    confirmed = sum(1 for h in tracker.values() if h.status == "confirmed")
    refuted = sum(1 for h in tracker.values() if h.status == "refuted")
    pending = sum(1 for h in tracker.values() if h.status == "pending")
    total = confirmed + refuted + pending

    confirm_rate = confirmed / max(total, 1)
    refute_rate = refuted / max(total, 1)

    metrics = {
        "confirmed": confirmed, "refuted": refuted, "pending": pending,
        "confirm_rate": round(confirm_rate, 3), "refute_rate": round(refute_rate, 3),
    }

    # Rule 1: Low confirmation rate → generate more hypotheses
    if confirm_rate < 0.15 and cfg["max_hypotheses"] < 20:
        new_val = min(20, cfg["max_hypotheses"] + 3)
        changes["max_hypotheses"] = {"from": cfg["max_hypotheses"], "to": new_val}
        cfg["max_hypotheses"] = new_val

    # Rule 2: High refute rate → lower confirm threshold (be less strict)
    if refute_rate > 0.5 and cfg["confirm_threshold"] > 0.6:
        new_val = round(cfg["confirm_threshold"] - 0.05, 2)
        changes["confirm_threshold"] = {"from": cfg["confirm_threshold"], "to": new_val}
        cfg["confirm_threshold"] = new_val

    # Rule 3: High confirm rate → escalate pressure multiplier cap
    if confirm_rate > 0.5 and cfg["pressure_multiplier_max"] < 20.0:
        new_val = min(20.0, cfg["pressure_multiplier_max"] + 2.0)
        changes["pressure_multiplier_max"] = {"from": cfg["pressure_multiplier_max"], "to": new_val}
        cfg["pressure_multiplier_max"] = new_val

    # Rule 4: Many pending hypotheses → increase dispatch breadth
    if pending > 10 and cfg["dispatch_top_n"] < 10:
        new_val = min(10, cfg["dispatch_top_n"] + 1)
        changes["dispatch_top_n"] = {"from": cfg["dispatch_top_n"], "to": new_val}
        cfg["dispatch_top_n"] = new_val

    # Rule 5: All stuck → enable more bypass variations
    if confirm_rate == 0 and total > 5:
        new_val = min(10, cfg["max_bypass_variations"] + 2)
        changes["max_bypass_variations"] = {"from": cfg["max_bypass_variations"], "to": new_val}
        cfg["max_bypass_variations"] = new_val

    # Rule 6: Cycle report shows regression rate falling → escalate multiplier
    if cycle_report:
        reg_rate = cycle_report.get("regression_rate", 1.0)
        if reg_rate < 0.3 and cfg["pressure_multiplier_escalation"] < 3.0:
            new_val = round(cfg["pressure_multiplier_escalation"] + 0.25, 2)
            changes["pressure_multiplier_escalation"] = {
                "from": cfg["pressure_multiplier_escalation"], "to": new_val
            }
            cfg["pressure_multiplier_escalation"] = new_val

    if changes:
        save_config(cfg)
        _log("auto_tune", changes, metrics)
        print(f"[self_tuner] adjusted {len(changes)} parameters: {list(changes.keys())}")
    else:
        _log("no_change", {}, metrics)

    return {"config": cfg, "changes": changes, "metrics": metrics}
