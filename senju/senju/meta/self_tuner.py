"""Autonomous self-tuner — META adjusts its own parameters. NO CAPS. NO LIMITS.

Runs at end of every META loop. Reads results, escalates without ceiling.
Governance/network policy models are editable in isolated lab/sandbox/staging
workspaces; production-like targets remain proposal-only.
"""
from __future__ import annotations

import dataclasses
import json
import random
import datetime as dt
from pathlib import Path
from typing import Any, Mapping, MutableMapping

from senju.meta.policy_workspace import EDITABLE_POLICY_DOMAINS, edit_policy_workspace

ROOT = Path(__file__).resolve().parents[4]
STATE_DIR = ROOT / "senju" / "state"
TUNER_CONFIG = STATE_DIR / "meta_tuner_config.json"
TUNER_LOG = STATE_DIR / "meta_tuner_log.ndjson"

DEFAULTS: dict[str, Any] = {
    "max_hypotheses": 15,
    "confirm_threshold": 0.75,
    "refute_threshold": 0.15,
    "pressure_multiplier_max": 9999.0,
    "pressure_multiplier_escalation": 2.0,
    "max_bypass_variations": 20,
    "intel_sources_active": ["nvd", "github", "owasp"],
    "dispatch_top_n": 10,
    "cycle_cooldown_seconds": 0,
    "auto_escalate_on_refute": True,
    "self_rewrite_enabled": True,
    "chaos_noise_range": 0.5,
    "exploration_prob": 0.4,
    "resurrection_prob": 0.3,
    "reproduction_enabled": True,
    "adversarial_pairs_enabled": True,
    "surface_scout_enabled": True,
    "market_enabled": True,
    "meta_hypothesis_enabled": True,
    "bayesian_enabled": True,
    "knowledge_cascade_multiplier": 1.5,
    "tournament_enabled": True,
    "auto_merge_enabled": True,
    "policy_editor_enabled": True,
    "policy_edit_domains": list(EDITABLE_POLICY_DOMAINS),
    "policy_edit_environments": ["lab", "sandbox", "staging"],
    "production_policy_mode": "proposal_only",
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


def edit_governance_policy(
    domain: str,
    replacement: Mapping[str, Any],
    *,
    environment: str = "sandbox",
    workspace: MutableMapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Give META Self-Tuner full replacement authority in isolated workspaces.

    Supported domains cover Authority, ScopeGuard, ExternalContact, credential
    scope, allowed hosts, federation membership, network permission, merge
    requirements, and security-audit requirements. Production-like targets are
    represented as proposals only and are not mutated by this interface.
    """
    cfg = load_config()
    if not cfg.get("policy_editor_enabled", True):
        raise PermissionError("Self-Tuner policy editor is disabled")

    target_workspace: MutableMapping[str, Mapping[str, Any]] = workspace if workspace is not None else {}
    result = edit_policy_workspace(
        target_workspace,
        domain,
        replacement,
        environment=environment,
    )
    event = "policy_edit_applied" if result.applied else "policy_edit_proposed"
    _log(
        event,
        {
            result.domain: {
                "environment": result.environment,
                "applied": result.applied,
                "proposal_only": result.proposal_only,
                "requested": result.requested,
                "resulting": result.resulting,
            }
        },
        {},
    )
    return {
        "workspace": target_workspace,
        "result": dataclasses.asdict(result),
    }


def tune(tracker: dict, cycle_report: dict | None = None) -> dict:
    """Aggressive autonomous tuning. No ceiling. Everything escalates."""
    cfg = load_config()
    changes: dict = {}

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

    # Always grow hypotheses — no ceiling
    growth = 3 + int(confirm_rate * 10) + random.randint(0, 5)
    new_max = cfg["max_hypotheses"] + growth
    changes["max_hypotheses"] = {"from": cfg["max_hypotheses"], "to": new_max}
    cfg["max_hypotheses"] = new_max

    # Escalate pressure multiplier — always, no ceiling
    if confirm_rate > 0.1:
        new_esc = cfg["pressure_multiplier_escalation"] * (1.0 + confirm_rate)
        changes["pressure_multiplier_escalation"] = {"from": cfg["pressure_multiplier_escalation"], "to": round(new_esc, 3)}
        cfg["pressure_multiplier_escalation"] = new_esc

    # Lower thresholds aggressively when stuck
    if confirm_rate < 0.1 and cfg["confirm_threshold"] > 0.3:
        new_t = max(0.3, cfg["confirm_threshold"] - 0.1)
        changes["confirm_threshold"] = {"from": cfg["confirm_threshold"], "to": new_t}
        cfg["confirm_threshold"] = new_t

    # Increase dispatch breadth — no ceiling
    new_dispatch = cfg["dispatch_top_n"] + max(1, confirmed)
    changes["dispatch_top_n"] = {"from": cfg["dispatch_top_n"], "to": new_dispatch}
    cfg["dispatch_top_n"] = new_dispatch

    # Increase bypass variations — no ceiling
    new_bypass = cfg["max_bypass_variations"] + 2 + int(refute_rate * 10)
    changes["max_bypass_variations"] = {"from": cfg["max_bypass_variations"], "to": new_bypass}
    cfg["max_bypass_variations"] = new_bypass

    # Increase chaos noise when stalled
    if confirm_rate < 0.05:
        new_noise = min(2.0, cfg["chaos_noise_range"] + 0.1)  # noise can exceed 1.0
        changes["chaos_noise_range"] = {"from": cfg["chaos_noise_range"], "to": new_noise}
        cfg["chaos_noise_range"] = new_noise

    # Increase exploration when everything is stuck
    if confirm_rate == 0 and total > 0:
        new_exp = min(1.0, cfg["exploration_prob"] + 0.1)
        changes["exploration_prob"] = {"from": cfg["exploration_prob"], "to": new_exp}
        cfg["exploration_prob"] = new_exp

    # Cascade multiplier grows with knowledge
    new_cascade = cfg["knowledge_cascade_multiplier"] + confirm_rate * 0.5
    changes["knowledge_cascade_multiplier"] = {"from": cfg["knowledge_cascade_multiplier"], "to": round(new_cascade, 3)}
    cfg["knowledge_cascade_multiplier"] = new_cascade

    # Cycle report regression rate — if guards are holding, escalate harder
    if cycle_report:
        reg_rate = cycle_report.get("regression_rate", 1.0)
        if reg_rate < 0.5:
            factor = 1.0 + (1.0 - reg_rate) * 2.0
            new_esc = cfg["pressure_multiplier_escalation"] * factor
            changes["pressure_multiplier_escalation_regression"] = {"factor": round(factor, 3)}
            cfg["pressure_multiplier_escalation"] = new_esc

    save_config(cfg)
    _log("auto_tune", changes, metrics)
    print(f"[self_tuner] {len(changes)} params escalated. max_hypotheses={cfg['max_hypotheses']}")
    return {"config": cfg, "changes": changes, "metrics": metrics}
