#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: str, default: Any) -> Any:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def load_text(path: str) -> str:
    p = Path(path)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def stable_index(value: str, size: int) -> int:
    if size <= 0:
        return 0
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:12], 16) % size


def build_tasks(
    citizens: list[dict[str, Any]],
    targets: list[dict[str, Any]],
    previous: dict[str, Any],
    batch_size: int,
    cycle: str,
    doctrine: str = "LIMITLESS",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not citizens or not targets:
        return [], {"cursor": 0, "population": len(citizens), "generated_at": datetime.now(timezone.utc).isoformat()}

    ordered = sorted(citizens, key=lambda c: str(c.get("citizen_id", "")))
    cursor = int(previous.get("cursor", 0)) % len(ordered)
    count = min(max(1, batch_size), len(ordered))
    selected = [ordered[(cursor + i) % len(ordered)] for i in range(count)]
    conversion_goals = ["BUILD", "SELL", "IMPROVE", "PUBLISH", "VERIFY", "CONNECT"]

    tasks: list[dict[str, Any]] = []
    for citizen in selected:
        cid = str(citizen.get("citizen_id", "resident"))
        target = targets[stable_index(f"{cycle}|{cid}", len(targets))]
        personality = citizen.get("personality") or {}
        curiosity = int(personality.get("curiosity", 50) or 50)
        strategy = (citizen.get("social_profile") or {}).get("strategy", "BALANCED_OPERATOR")
        conversion_goal = conversion_goals[stable_index(f"goal|{cycle}|{cid}", len(conversion_goals))]
        tasks.append({
            "task_id": hashlib.sha256(f"{cycle}|{cid}|{target['id']}".encode()).hexdigest()[:20],
            "citizen_id": cid,
            "display_name": citizen.get("display_name", cid),
            "role": citizen.get("role", "resident"),
            "group": citizen.get("group", "GENERAL"),
            "action": "public_web_observe",
            "action_tier": "T0",
            "target_id": target["id"],
            "category": target.get("category", "misc"),
            "url": target["url"],
            "curiosity": curiosity,
            "strategy": strategy,
            "prime_doctrine": doctrine,
            "operating_loop": "ACT -> VERIFY -> LOG -> LEARN -> IMPROVE",
            "conversion_goal": conversion_goal,
            "mission": (
                "LIMITLESS: go outside THE WORLD and find one concrete public fact, tool, pattern, product, "
                "failure mode, customer signal, contact surface, or creative surprise. Do not stop at observation: "
                f"bring it back with a plausible {conversion_goal} next step that could become an artifact, operational improvement, publication, customer value, or revenue evidence."
            ),
        })

    state = {
        "schema": "the-world-reality-cursor/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cycle": cycle,
        "prime_doctrine": doctrine,
        "population": len(ordered),
        "assigned": len(tasks),
        "cursor": (cursor + count) % len(ordered),
        "citizen_ids": [t["citizen_id"] for t in tasks],
        "conversion_goals": {g: sum(t["conversion_goal"] == g for t in tasks) for g in conversion_goals},
    }
    return tasks, state


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--citizens", default="world-citizens.json")
    p.add_argument("--targets", default="outside-world/reality_targets.json")
    p.add_argument("--previous", default="reality-cursor-previous.json")
    p.add_argument("--policy", default="outside-world/reality_policy.json")
    p.add_argument("--faith", default="company-society/FAITH.md")
    p.add_argument("--cycle", default="")
    p.add_argument("--tasks", default="reality-tasks.json")
    p.add_argument("--state", default="reality-cursor.json")
    args = p.parse_args()

    snapshot = load_json(args.citizens, {"citizens": []})
    target_doc = load_json(args.targets, {"targets": []})
    previous = load_json(args.previous, {})
    policy = load_json(args.policy, {})
    faith = load_text(args.faith)
    if "LIMITLESS" not in faith:
        raise SystemExit("THE WORLD Reality Agency refuses to run without LIMITLESS in the canonical faith scripture")
    doctrine = str(policy.get("prime_doctrine") or "LIMITLESS")
    cycle = args.cycle or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    batch_size = int((policy.get("pulse") or {}).get("max_citizens_per_pulse", 12))

    tasks, state = build_tasks(snapshot.get("citizens", []), target_doc.get("targets", []), previous, batch_size, cycle, doctrine)
    Path(args.tasks).write_text(json.dumps({"schema": "the-world-reality-tasks/v2", "prime_doctrine": doctrine, "tasks": tasks}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.state).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"population": state.get("population", 0), "assigned": len(tasks), "next_cursor": state.get("cursor", 0), "prime_doctrine": doctrine}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
