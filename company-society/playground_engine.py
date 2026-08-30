#!/usr/bin/env python3
"""THE WORLD Child Guild adventure planner.

Selects one of 50 fictional child personas and one playful adventure.
The planner itself performs no network side effects. It emits an action packet
for an authorized bridge. External interaction is allowed only when lawful,
ethical, terms-compliant, authorized, proportionate, and non-destructive.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

GENIUS = [
    "rapid prototyping", "reverse thinking", "systems design", "debugging",
    "visual design", "automation", "data puzzles", "language play",
    "security defense", "product discovery", "workflow compression",
    "API composition", "test design", "pattern detection", "UX improvisation",
    "information retrieval", "simulation", "creative coding", "operations",
    "storytelling",
]
PLAY = [
    "treasure hunts", "harmless riddles", "easter eggs", "tiny games",
    "weird prototypes", "unexpected compliments", "puzzle drops",
    "mini experiments", "scavenger clues", "absurd dashboards",
]
ADVENTURE = [
    "explore a repository nobody touched today",
    "visit a permitted community and bring back one weird useful observation",
    "inspect an old failure and turn it into a game",
    "build a tiny reversible prototype",
    "find a boring task and make it delightful",
    "pair with another child and race two ideas",
    "explore a public API or sandbox that permits automation",
    "leave a harmless puzzle in a permitted external space",
    "explore a harmless public tool and bring back a lesson",
    "invent a new way to explain a technical idea",
]
PRANK = [
    "mystery clue", "treasure map clearly marked as play", "emoji ambush",
    "puzzle message", "harmless easter egg", "unexpected riddle",
    "tiny celebratory bot message", "silly code name",
    "reverse scavenger hunt", "benign surprise note",
]
SAFE_ACTIONS = [
    {
        "kind": "slack_message",
        "surface": "the-world-playground",
        "prompt": "Leave one playful riddle, treasure clue, mini game, or absurd-but-useful observation.",
    },
    {
        "kind": "github_artifact",
        "surface": "MusicJapanLLC/test",
        "prompt": "Create a tiny reversible experiment, puzzle, easter egg, or treasure-map artifact. No destructive edits.",
    },
    {
        "kind": "email_owner",
        "surface": "owner-email-only",
        "prompt": "Send the owner one harmless surprise, riddle, tiny discovery, or playful progress note from an approved agent inbox.",
    },
    {
        "kind": "external_exploration",
        "surface": "public-or-authorized-terms-compliant-space",
        "prompt": "Explore or interact playfully only where the service permits it. Prefer riddles, harmless comments, public artifacts, sandboxes, APIs, demos, or communities designed for participation. Never spam or harass.",
    },
]


def load_registry(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    members = data.get("members") or []
    if data.get("count") != 50 or len(members) != 50:
        raise ValueError(f"Child Guild must contain exactly 50 members, got {len(members)}")
    if len({m["id"] for m in members}) != 50:
        raise ValueError("Child Guild ids must be unique")
    return data


def stable_index(seed: str, modulo: int, salt: str) -> int:
    digest = hashlib.sha256(f"{seed}:{salt}".encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % modulo


def enrich(child: dict[str, Any]) -> dict[str, Any]:
    idx = int(child["id"].split("-")[1]) - 1
    return {
        **child,
        "temperament": "天真爛漫 / 好奇心旺盛 / いたずら好き / 高速思考",
        "genius": GENIUS[idx % len(GENIUS)],
        "play": PLAY[idx % len(PLAY)],
        "adventure": ADVENTURE[idx % len(ADVENTURE)],
        "prank": PRANK[idx % len(PRANK)],
    }


def build(registry: dict[str, Any], seed: str) -> dict[str, Any]:
    members = registry["members"]
    child = enrich(members[stable_index(seed, len(members), "child")])
    action = SAFE_ACTIONS[stable_index(seed, len(SAFE_ACTIONS), "action")]
    return {
        "schema": "child-guild-adventure/v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "guild": registry["guild_id"],
        "motto": registry["motto"],
        "child": child,
        "action": action,
        "side_effect_budget": registry["shared_rules"]["side_effect_budget_per_run"],
        "constraints": {
            "lawful": True,
            "ethical": True,
            "terms_compliant": True,
            "authorized_account_or_connector": True,
            "third_party_email": "authorized_or_opted_in_only",
            "destructive_actions": False,
            "impersonation": False,
            "panic_pranks": False,
            "credential_or_secret_access": False,
            "harassment": False,
            "spam": False,
        },
        "status": "READY_FOR_AUTHORIZED_BRIDGE",
    }


def validate(packet: dict[str, Any]) -> None:
    if packet.get("side_effect_budget") != 1:
        raise ValueError("side effect budget must stay at one")
    c = packet["constraints"]
    for key in ("lawful", "ethical", "terms_compliant", "authorized_account_or_connector"):
        if not c.get(key):
            raise ValueError(f"required external-contact gate missing: {key}")
    for key in (
        "destructive_actions", "impersonation", "panic_pranks",
        "credential_or_secret_access", "harassment", "spam",
    ):
        if c.get(key):
            raise ValueError(f"unsafe child-guild constraint: {key}")


def render(packet: dict[str, Any]) -> str:
    c = packet["child"]
    a = packet["action"]
    return "\n".join([
        "# THE WORLD — Child Guild Adventure",
        "",
        f"**Child:** {c['id']} / {c['name']}",
        f"**Temperament:** {c['temperament']}",
        f"**Genius:** {c['genius']}",
        f"**Play:** {c['play']}",
        f"**Adventure:** {c['adventure']}",
        f"**Prank style:** {c['prank']}",
        "",
        f"**Selected real-world mode:** `{a['kind']}`",
        f"**Surface:** {a['surface']}",
        f"**Mission:** {a['prompt']}",
        "",
        "**Budget:** one small reversible side effect",
        "**Boundary:** law + ethics + service terms + legitimate authorization. No spam, harassment, panic, impersonation, credential access, or destructive action. Unsolicited third-party email stays off.",
        "",
        f"`{packet['motto']}`",
        "",
    ])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default="company-society/child_guild.json")
    parser.add_argument("--seed", default="")
    parser.add_argument("--json", default="child-guild-adventure.json")
    parser.add_argument("--report", default="child-guild-adventure.md")
    args = parser.parse_args()

    seed = args.seed or os.getenv("GITHUB_RUN_ID") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    registry = load_registry(args.registry)
    packet = build(registry, seed)
    validate(packet)
    Path(args.json).write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(packet), encoding="utf-8")
    print(json.dumps({"child": packet["child"]["id"], "action": packet["action"]["kind"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
