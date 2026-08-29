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
    creed: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not citizens or not targets:
        return [], {"cursor": 0, "population": len(citizens), "generated_at": datetime.now(timezone.utc).isoformat()}

    creed = creed or {}
    creed_name = str(creed.get("name") or "LIMITLESS")
    prime_directive = str(creed.get("prime_directive") or "Prefer useful verified action over invented waiting.")
    reality_directive = str(creed.get("reality_directive") or "Bring observable external evidence back to THE WORLD.")
    vows = list(creed.get("resident_vows") or [])

    ordered = sorted(citizens, key=lambda c: str(c.get("citizen_id", "")))
    cursor = int(previous.get("cursor", 0)) % len(ordered)
    count = min(max(1, batch_size), len(ordered))
    selected = [ordered[(cursor + i) % len(ordered)] for i in range(count)]

    tasks: list[dict[str, Any]] = []
    for citizen in selected:
        cid = str(citizen.get("citizen_id", "resident"))
        target = targets[stable_index(f"{cycle}|{cid}", len(targets))]
        personality = citizen.get("personality") or {}
        curiosity = int(personality.get("curiosity", 50) or 50)
        strategy = (citizen.get("social_profile") or {}).get("strategy", "BALANCED_OPERATOR")
        vow = vows[stable_index(f"vow|{cycle}|{cid}", len(vows))] if vows else "Act, verify, log, learn, improve."
        tasks.append({
            "task_id": hashlib.sha256(f"{cycle}|{cid}|{target['id']}".encode()).hexdigest()[:20],
            "citizen_id": cid,
            "display_name": citizen.get("display_name", cid),
            "role": citizen.get("role", "resident"),
            "group": citizen.get("group", "GENERAL"),
            "action": "public_web_observe",
            "target_id": target["id"],
            "category": target.get("category", "misc"),
            "url": target["url"],
            "curiosity": curiosity,
            "strategy": strategy,
            "faith": {
                "name": creed_name,
                "rank": creed.get("rank", "SUPREME_OPERATING_DOCTRINE"),
                "motto": creed.get("motto", "ACT -> VERIFY -> LOG -> LEARN -> IMPROVE"),
                "prime_directive": prime_directive,
                "reality_directive": reality_directive,
                "vow": vow,
            },
            "mission": (
                "Find one concrete external fact, pattern, tool, idea, failure mode, or creative surprise worth bringing back to THE WORLD. "
                "Follow the LIMITLESS doctrine: use the widest legitimate action space available, prefer observable evidence over commentary, "
                "and identify the next artifact, experiment, improvement, customer-value step, or owned publication this discovery can produce."
            ),
        })

    state = {
        "schema": "the-world-reality-cursor/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cycle": cycle,
        "population": len(ordered),
        "assigned": len(tasks),
        "cursor": (cursor + count) % len(ordered),
        "citizen_ids": [t["citizen_id"] for t in tasks],
        "faith": creed_name,
        "faith_rank": creed.get("rank", "SUPREME_OPERATING_DOCTRINE"),
    }
    return tasks, state


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--citizens", default="world-citizens.json")
    p.add_argument("--targets", default="outside-world/reality_targets.json")
    p.add_argument("--previous", default="reality-cursor-previous.json")
    p.add_argument("--policy", default="outside-world/reality_policy.json")
    p.add_argument("--creed", default="company-society/limitless_creed.json")
    p.add_argument("--cycle", default="")
    p.add_argument("--tasks", default="reality-tasks.json")
    p.add_argument("--state", default="reality-cursor.json")
    args = p.parse_args()

    snapshot = load_json(args.citizens, {"citizens": []})
    target_doc = load_json(args.targets, {"targets": []})
    previous = load_json(args.previous, {})
    policy = load_json(args.policy, {})
    creed = load_json(args.creed, {})
    cycle = args.cycle or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    batch_size = int((policy.get("pulse") or {}).get("max_citizens_per_pulse", 12))

    tasks, state = build_tasks(snapshot.get("citizens", []), target_doc.get("targets", []), previous, batch_size, cycle, creed)
    Path(args.tasks).write_text(json.dumps({"schema": "the-world-reality-tasks/v1", "faith": creed.get("name", "LIMITLESS"), "tasks": tasks}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.state).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"population": state.get("population", 0), "assigned": len(tasks), "next_cursor": state.get("cursor", 0), "faith": state.get("faith")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
