#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def load(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _jitter(agent_id: str, trait: str) -> int:
    h = hashlib.sha256(f"{agent_id}:{trait}".encode()).digest()[0]
    return (h % 15) - 7


def profile_for(agent_id: str, config: dict[str, Any]) -> dict[str, Any]:
    key = agent_id.lower()
    overrides = config.get("named_overrides", {}).get(key, {})
    archetype = overrides.get("archetype")
    if not archetype:
        names = sorted(config["archetypes"])
        idx = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % len(names)
        archetype = names[idx]
    base = dict(config["archetypes"][archetype])
    for trait in config.get("traits", []):
        if trait not in overrides:
            base[trait] = max(0, min(100, int(base[trait]) + _jitter(key, trait)))
    base.update({k: v for k, v in overrides.items() if k != "archetype"})
    return {"agent_id": agent_id, "archetype": archetype, **base}


def directive(profile: dict[str, Any]) -> str:
    if profile["solo_glory"] >= 80 and profile["status_drive"] >= 80:
        return "Seek a visible individual win; publish proof, credit helpers, and accept independent verification."
    if profile["ends_over_means"] >= 80:
        return "Drive hard toward the mission outcome; never waive authorization, evidence, safety, privacy, or security gates."
    if profile["cooperation"] >= 80:
        return "Prefer role-fit collaboration, explicit handoffs, and recovery assistance over duplicated work."
    if profile["truth_loyalty"] >= 90:
        return "Challenge claims aggressively and optimize for falsification before prestige."
    if profile["rule_challenging"] >= 85:
        return "Challenge inherited constraints and propose alternatives, then execute only inside legitimate bounds."
    return "Choose the next role-fit action that best matches the mission and leave verifiable evidence."


def moral_tension(profile: dict[str, Any]) -> str:
    if profile["ends_over_means"] >= 70 and profile["benevolence"] < 55:
        return "HIGH"
    if profile["ends_over_means"] >= 55:
        return "MEDIUM"
    return "LOW"


def build(agent_ids: list[str], config: dict[str, Any]) -> dict[str, Any]:
    profiles = []
    for agent_id in agent_ids:
        p = profile_for(agent_id, config)
        profiles.append({**p, "directive": directive(p), "moral_tension": moral_tension(p)})
    return {"schema": "the-world-personality-snapshot/v1", "profiles": profiles}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="company-society/psychology.json")
    p.add_argument("--agents", nargs="+", required=True)
    p.add_argument("--output", default="world-personality-snapshot.json")
    args = p.parse_args()
    report = build(args.agents, load(args.config))
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"profiles": len(report["profiles"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
