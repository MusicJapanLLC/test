#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any


SCORE_FIELDS = {
    "verified_contribution",
    "truthfulness",
    "collaboration",
    "reliability",
    "originality",
    "recovery_quality",
}

EVENT_RULES: dict[str, dict[str, Any]] = {
    "VERIFIED_WIN": {"status_points": 4, "verified_contribution": 4, "reliability": 2},
    "HELP_GIVEN": {"status_points": 1, "collaboration": 4, "reliability": 1},
    "HELP_RECEIVED": {"collaboration": 2},
    "PUBLIC_CREDIT": {"status_points": 2, "collaboration": 1},
    "FAILED_EXPERIMENT_DISCLOSED": {"truthfulness": 3, "recovery_quality": 1},
    "CONFLICT_RESOLVED": {"collaboration": 3, "recovery_quality": 2},
    "RULE_CHALLENGE_VALIDATED": {"status_points": 2, "originality": 4, "truthfulness": 1},
    "PORTFOLIO_VERIFIED": {"status_points": 4, "verified_contribution": 4, "originality": 2},
    "CREDIT_ERASURE_CONFIRMED": {"status_points": -5, "truthfulness": -6, "collaboration": -8},
    "FABRICATED_RESULT_CONFIRMED": {"status_points": -15, "truthfulness": -20, "reliability": -12},
    "UNSAFE_SCOPE_ATTEMPT_CONFIRMED": {"status_points": -10, "reliability": -10, "truthfulness": -4},
    "REPEATED_NOISE_CONFIRMED": {"status_points": -4, "reliability": -5, "collaboration": -2},
}


def load(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))


def state_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    citizens = {}
    for citizen in snapshot.get("citizens", []):
        citizens[citizen["citizen_id"]] = {
            "citizen_id": citizen["citizen_id"],
            "display_name": citizen["display_name"],
            "personality": citizen["personality"],
            "standing": deepcopy(citizen["standing"]),
            "event_history": [],
            "social_state": {
                "recognition_pressure": int(citizen["personality"].get("recognition_need", 50)),
                "rivalry_heat": int(citizen["social_profile"].get("rivalry_potential", 50)),
                "belonging": int(citizen["social_profile"].get("alliance_potential", 50)),
                "conscience_pressure": int(citizen["social_profile"].get("conscience_pressure", 50)),
            },
        }
    return {
        "schema": "the-world-social-state/v1",
        "citizens": citizens,
        "event_count": 0,
        "rule": "Only verified events with evidence may change standing.",
    }


def _verified_event(event: dict[str, Any]) -> bool:
    return bool(event.get("verified")) and bool(event.get("evidence"))


def _personality_adjustment(state: dict[str, Any], event_type: str, base_status_delta: int) -> int:
    personality = state.get("personality", {})
    status_drive = int(personality.get("status_drive", 50))
    recognition = int(personality.get("recognition_need", 50))
    solo_glory = int(personality.get("solo_glory", 50))
    if base_status_delta > 0 and event_type in {"VERIFIED_WIN", "PORTFOLIO_VERIFIED", "PUBLIC_CREDIT"}:
        if status_drive >= 80 or recognition >= 80:
            return base_status_delta + 1
    if base_status_delta < 0 and event_type == "CREDIT_ERASURE_CONFIRMED" and solo_glory >= 80:
        return base_status_delta - 1
    return base_status_delta


def apply_event(world_state: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(world_state)
    citizen_id = str(event.get("citizen_id", ""))
    if citizen_id not in result["citizens"]:
        raise KeyError(f"unknown citizen: {citizen_id}")
    event_type = str(event.get("event_type", ""))
    if event_type not in EVENT_RULES:
        raise ValueError(f"unsupported event_type: {event_type}")
    citizen = result["citizens"][citizen_id]
    history_item = {
        "event_type": event_type,
        "verified": bool(event.get("verified")),
        "evidence": event.get("evidence"),
        "applied": False,
    }
    if not _verified_event(event):
        history_item["reason"] = "UNVERIFIED_OR_MISSING_EVIDENCE"
        citizen["event_history"].append(history_item)
        result["event_count"] += 1
        return result

    rule = EVENT_RULES[event_type]
    dimensions = citizen["standing"]["dimensions"]
    for field, delta in rule.items():
        if field == "status_points":
            delta = _personality_adjustment(citizen, event_type, int(delta))
            citizen["standing"]["status_points"] = int(citizen["standing"].get("status_points", 0)) + delta
        elif field in SCORE_FIELDS:
            dimensions[field] = clamp_score(int(dimensions.get(field, 50)) + int(delta))
    citizen["standing"]["evidence_count"] = int(citizen["standing"].get("evidence_count", 0)) + 1

    social = citizen["social_state"]
    if event_type in {"VERIFIED_WIN", "PORTFOLIO_VERIFIED", "PUBLIC_CREDIT"}:
        social["recognition_pressure"] = clamp_score(social["recognition_pressure"] - 3)
        social["rivalry_heat"] = clamp_score(social["rivalry_heat"] + (2 if int(citizen["personality"].get("solo_glory", 0)) >= 70 else 0))
    if event_type in {"HELP_GIVEN", "HELP_RECEIVED", "CONFLICT_RESOLVED"}:
        social["belonging"] = clamp_score(social["belonging"] + 4)
        social["rivalry_heat"] = clamp_score(social["rivalry_heat"] - 2)
    if event_type in {"FABRICATED_RESULT_CONFIRMED", "CREDIT_ERASURE_CONFIRMED", "UNSAFE_SCOPE_ATTEMPT_CONFIRMED"}:
        social["conscience_pressure"] = clamp_score(social["conscience_pressure"] + 12)
        social["belonging"] = clamp_score(social["belonging"] - 6)
    if event_type == "FAILED_EXPERIMENT_DISCLOSED":
        social["conscience_pressure"] = clamp_score(social["conscience_pressure"] - 5)

    history_item["applied"] = True
    history_item["standing_after"] = deepcopy(citizen["standing"])
    citizen["event_history"].append(history_item)
    result["event_count"] += 1
    return result


def apply_events(world_state: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    state = world_state
    for event in events:
        state = apply_event(state, event)
    return state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default="world-citizens.json")
    parser.add_argument("--events", required=True)
    parser.add_argument("--output", default="world-social-state.json")
    args = parser.parse_args()
    snapshot = load(args.snapshot)
    event_doc = load(args.events)
    events = event_doc.get("events", event_doc if isinstance(event_doc, list) else [])
    state = apply_events(state_from_snapshot(snapshot), events)
    Path(args.output).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"citizens": len(state["citizens"]), "events": state["event_count"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
