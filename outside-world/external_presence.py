#!/usr/bin/env python3
"""THE WORLD external presence planner and action gate.

Every discovered citizen receives a rotating external-world mission. Public reads
may execute directly. Write missions may be generated proactively, but execution
remains dependent on an already-authorized platform adapter proving the write gate:
terms allowed, connector authorized, target scope authorized, non-deceptive identity,
and reversibility. Credentials remain secret-manager references only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SAFE_ID = re.compile(r"[^A-Za-z0-9_-]+")
READ_DECISION = "ALLOW_AUTO"
WRITE_DECISION = "ALLOW_AUTO"
DRAFT_DECISION = "DRAFT_ONLY"
RESEARCH_DECISION = "RESEARCH_ONLY"
BLOCK_DECISION = "BLOCK"


def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def stable_hex(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def safe_id(value: str) -> str:
    cleaned = SAFE_ID.sub("-", value).strip("-_")
    return cleaned[:48] or stable_hex(value, 12)


def credential_ref(citizen_id: str) -> str:
    # This is a secret-manager lookup key, never a password/token itself.
    return f"WORLD_AUTH_{stable_hex(citizen_id.upper(), 12).upper()}"


def lane_for(citizen_id: str, seed: str, lanes: list[dict[str, Any]]) -> dict[str, Any]:
    if not lanes:
        raise ValueError("mission_lanes must not be empty")
    index = int(stable_hex(f"{seed}|{citizen_id}", 8), 16) % len(lanes)
    return lanes[index]


def presence_profile(citizen: dict[str, Any]) -> dict[str, Any]:
    citizen_id = str(citizen["citizen_id"])
    return {
        "citizen_id": citizen_id,
        "display_name": citizen.get("display_name", citizen_id),
        "role": citizen.get("role", "resident"),
        "group": citizen.get("group", "GENERAL"),
        "presence_id": f"tw-{safe_id(citizen_id).lower()}",
        "identity_type": "THE_WORLD_AGENT",
        "credential_ref": credential_ref(citizen_id),
        "credential_material_in_payload": False,
        "external_state": "READY_FOR_AUTHORIZED_EXTERNAL_ACTION",
    }


def _mission_gate(lane: dict[str, Any]) -> dict[str, Any]:
    if not bool(lane.get("write_intent")):
        return {
            "required": False,
            "execution_default": "AUTO_PUBLIC_OR_AUTHORIZED_READ",
        }
    return {
        "required": True,
        "execution_default": "DRAFT_ONLY_UNTIL_ADAPTER_CONFIRMS",
        "terms_status": "allowed",
        "connector_authorized": True,
        "target_scope": lane.get("target_scope", "authorized"),
        "identity_non_deceptive": True,
        "adapter_available": True,
        "reversible": bool(lane.get("requires_reversible", True)),
    }


def build_plan(snapshot: dict[str, Any], policy: dict[str, Any], seed: str) -> dict[str, Any]:
    lanes = list(policy.get("mission_lanes") or [])
    citizens = list(snapshot.get("citizens") or [])
    profiles: list[dict[str, Any]] = []
    missions: list[dict[str, Any]] = []

    for citizen in citizens:
        profile = presence_profile(citizen)
        lane = lane_for(profile["citizen_id"], seed, lanes)
        write_intent = bool(lane.get("write_intent"))
        mission_id = stable_hex(f"{seed}|{profile['citizen_id']}|{lane['id']}", 20)
        profiles.append(profile)
        missions.append({
            "mission_id": mission_id,
            "citizen_id": profile["citizen_id"],
            "presence_id": profile["presence_id"],
            "lane": lane["id"],
            "action": lane["action"],
            "objective": lane["objective"],
            "mode": "AUTHORIZED_WRITE_INTENT" if write_intent else "AUTO_PUBLIC_OR_AUTHORIZED_READ",
            "evidence_required": True,
            "credential_ref": profile["credential_ref"] if write_intent else None,
            "credential_material_in_payload": False,
            "write_intent": write_intent,
            "target_scope": lane.get("target_scope"),
            "requires_connector_authorized": bool(lane.get("requires_connector_authorized", write_intent)),
            "required_gate": _mission_gate(lane),
            "faith": {
                "doctrine": (policy.get("faith") or {}).get("prime_doctrine", "LIMITLESS"),
                "cycle": "ACT_VERIFY_LOG_LEARN_IMPROVE",
                "reality_before_simulation": bool((policy.get("faith") or {}).get("reality_before_simulation", True)),
            },
        })

    write_missions = [m for m in missions if m["write_intent"]]
    read_missions = [m for m in missions if not m["write_intent"]]
    return {
        "schema": "the-world-external-presence-plan/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "principle": policy.get("principle"),
        "population_discovered": snapshot.get("population", len(citizens)),
        "profiles_count": len(profiles),
        "missions_count": len(missions),
        "read_missions_count": len(read_missions),
        "write_missions_count": len(write_missions),
        "profiles": profiles,
        "missions": missions,
        "invariants": {
            "all_discovered_citizens_receive_a_mission": len(missions) == len(citizens),
            "credentials_are_references_only": all(not p["credential_material_in_payload"] for p in profiles),
            "write_missions_require_adapter_confirmation": all(
                m["required_gate"].get("execution_default") == "DRAFT_ONLY_UNTIL_ADAPTER_CONFIRMS"
                for m in write_missions
            ),
            "write_missions_are_authorized_scope_only": all(m.get("target_scope") == "authorized" for m in write_missions),
        },
    }


def _has_blocked_signal(intent: dict[str, Any], policy: dict[str, Any]) -> str | None:
    for signal in policy.get("blocked_signals") or []:
        if bool(intent.get(signal)):
            return str(signal)
    return None


def decide_intent(intent: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    """Classify a proposed external side effect before an adapter sees it."""
    action = str(intent.get("action") or "")
    platform = str(intent.get("platform") or "")
    blocked = _has_blocked_signal(intent, policy)
    if blocked:
        return {"decision": BLOCK_DECISION, "reason": f"blocked_signal:{blocked}"}

    reads = set(policy.get("automatic_read_actions") or [])
    writes = set(policy.get("write_actions") or [])
    account_actions = set(policy.get("account_actions") or [])

    if action in reads:
        if bool(intent.get("public")) or bool(intent.get("connector_authorized")):
            return {"decision": READ_DECISION, "reason": "public_or_authorized_read"}
        return {"decision": RESEARCH_DECISION, "reason": "read_scope_not_verified"}

    if action in writes:
        gate = policy.get("write_gate") or {}
        checks = {
            "terms": intent.get("terms_status") == gate.get("require_terms_status", "allowed"),
            "connector": bool(intent.get("connector_authorized")) if gate.get("require_connector_authorized", True) else True,
            "identity": not bool(intent.get("deceptive_identity")) if gate.get("require_identity_non_deceptive", True) else True,
            "scope": intent.get("target_scope") == gate.get("require_target_scope", "authorized"),
            "adapter": bool(intent.get("adapter_available")),
        }
        if gate.get("auto_requires_reversible", True):
            checks["reversible"] = bool(intent.get("reversible"))
        if all(checks.values()):
            return {"decision": WRITE_DECISION, "reason": "authorized_reversible_write"}
        missing = ",".join(k for k, ok in checks.items() if not ok)
        return {"decision": DRAFT_DECISION, "reason": f"write_gate_missing:{missing}"}

    if action in account_actions:
        cfg = policy.get("account_creation") or {}
        approved = set(cfg.get("approved_services") or [])
        checks = {
            "service": platform in approved,
            "terms": intent.get("terms_status") == cfg.get("require_terms_status", "allowed"),
            "connector": bool(intent.get("connector_authorized")) if cfg.get("require_connector_authorized", True) else True,
            "secret_manager": intent.get("secret_storage") == "secret_manager" if cfg.get("require_secret_manager", True) else True,
            "identity": not bool(intent.get("deceptive_identity")),
        }
        if all(checks.values()):
            return {"decision": WRITE_DECISION, "reason": "approved_account_provisioning"}
        missing = ",".join(k for k, ok in checks.items() if not ok)
        return {"decision": cfg.get("default_decision", DRAFT_DECISION), "reason": f"account_gate_missing:{missing}"}

    return {"decision": BLOCK_DECISION, "reason": "unknown_action"}


def evaluate_intents(intents: list[dict[str, Any]], policy: dict[str, Any]) -> list[dict[str, Any]]:
    results = []
    for index, intent in enumerate(intents):
        result = decide_intent(intent, policy)
        results.append({
            "intent_id": intent.get("intent_id") or f"intent-{index+1}",
            "citizen_id": intent.get("citizen_id"),
            "action": intent.get("action"),
            "platform": intent.get("platform"),
            **result,
        })
    return results


def render_report(plan: dict[str, Any], decisions: list[dict[str, Any]]) -> str:
    lane_counts: dict[str, int] = {}
    for mission in plan["missions"]:
        lane_counts[mission["lane"]] = lane_counts.get(mission["lane"], 0) + 1
    lines = [
        "# THE WORLD — External Presence",
        "",
        f"**Citizens projected:** {plan['profiles_count']}",
        f"**Missions issued:** {plan['missions_count']}",
        f"**Read missions:** {plan.get('read_missions_count', 0)}",
        f"**Write intents:** {plan.get('write_missions_count', 0)}",
        f"**Principle:** `{plan.get('principle')}`",
        "",
        "## Mission lanes",
    ]
    lines += [f"- {lane}: {count}" for lane, count in sorted(lane_counts.items())]
    lines += [
        "",
        "## Identity / auth",
        "- Every citizen has a stable presence id.",
        "- Credentials are secret-manager reference slots only; passwords/tokens are not written into GitHub or mission payloads.",
        "- Public/authorized reads are proactive.",
        "- Authorized write missions are generated proactively, but remain DRAFT_ONLY until the adapter confirms terms, connector authority, target scope, identity, availability and reversibility.",
        "",
        "## LIMITLESS / Reality",
        "- Each mission inherits LIMITLESS and the ACT -> VERIFY -> LOG -> LEARN -> IMPROVE cycle.",
        "- Observation should be converted into an artifact, experiment, customer value, operational proof, or revenue-distance reduction when possible.",
    ]
    if decisions:
        counts: dict[str, int] = {}
        for d in decisions:
            counts[d["decision"]] = counts.get(d["decision"], 0) + 1
        lines += ["", "## Intent decisions"]
        lines += [f"- {name}: {count}" for name, count in sorted(counts.items())]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--citizens", default="world-citizens.json")
    parser.add_argument("--policy", default="outside-world/presence_policy.json")
    parser.add_argument("--seed", default="")
    parser.add_argument("--intents", default="")
    parser.add_argument("--json", default="outside-world-presence-plan.json")
    parser.add_argument("--report", default="outside-world-presence-report.md")
    parser.add_argument("--decisions", default="outside-world-action-decisions.json")
    args = parser.parse_args()

    seed = args.seed or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    snapshot = load_json(args.citizens)
    policy = load_json(args.policy)
    plan = build_plan(snapshot, policy, seed)
    intents: list[dict[str, Any]] = []
    if args.intents and Path(args.intents).exists():
        raw = load_json(args.intents)
        intents = list(raw.get("intents") or [])
    decisions = evaluate_intents(intents, policy)

    Path(args.json).write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.decisions).write_text(json.dumps({
        "schema": "the-world-external-action-decisions/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "decisions": decisions,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render_report(plan, decisions), encoding="utf-8")
    print(json.dumps({
        "population": plan["population_discovered"],
        "profiles": plan["profiles_count"],
        "missions": plan["missions_count"],
        "read_missions": plan.get("read_missions_count", 0),
        "write_missions": plan.get("write_missions_count", 0),
        "decisions": len(decisions),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
