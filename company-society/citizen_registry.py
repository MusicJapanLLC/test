#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from personality_engine import directive, moral_tension, profile_for


def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _clamp(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _status_band(value: int) -> str:
    if value >= 80:
        return "VERY_HIGH"
    if value >= 65:
        return "HIGH"
    if value >= 40:
        return "MEDIUM"
    if value >= 20:
        return "LOW"
    return "VERY_LOW"


def social_profile(personality: dict[str, Any]) -> dict[str, Any]:
    rivalry = _clamp(
        personality.get("status_drive", 50) * 0.35
        + personality.get("dominance", 50) * 0.25
        + personality.get("solo_glory", 50) * 0.30
        + personality.get("recognition_need", 50) * 0.10
    )
    alliance = _clamp(
        personality.get("cooperation", 50) * 0.55
        + personality.get("benevolence", 50) * 0.25
        + personality.get("truth_loyalty", 50) * 0.20
    )
    conscience_pressure = _clamp(
        personality.get("ends_over_means", 50) * 0.60
        + (100 - personality.get("benevolence", 50)) * 0.40
    )
    if personality.get("solo_glory", 0) >= 80 and personality.get("status_drive", 0) >= 80:
        strategy = "SOLO_ASCENT"
    elif personality.get("ends_over_means", 0) >= 80:
        strategy = "MISSION_MAXIMIZER"
    elif personality.get("cooperation", 0) >= 80:
        strategy = "ALLIANCE_BUILDER"
    elif personality.get("truth_loyalty", 0) >= 90:
        strategy = "TRUTH_AUDITOR"
    else:
        strategy = "BALANCED_OPERATOR"
    return {
        "strategy": strategy,
        "rivalry_potential": rivalry,
        "rivalry_band": _status_band(rivalry),
        "alliance_potential": alliance,
        "alliance_band": _status_band(alliance),
        "conscience_pressure": conscience_pressure,
        "recognition_hunger": _status_band(int(personality.get("recognition_need", 50))),
        "status_hunger": _status_band(int(personality.get("status_drive", 50))),
        "moral_tension": moral_tension(personality),
        "behavior_directive": directive(personality),
        "authority_from_personality": False,
    }


def standing_template(config: dict[str, Any]) -> dict[str, Any]:
    standing = config["standing"]
    initial = int(standing.get("initial_score", 50))
    return {
        "basis": standing.get("basis", "neutral_prior_until_verified_events"),
        "evidence_count": int(standing.get("initial_evidence_count", 0)),
        "status_points": 0,
        "dimensions": {name: initial for name in standing.get("dimensions", [])},
        "wealth_is_not_authority": bool(standing.get("wealth_is_not_authority", True)),
    }


def _source_faith(root: dict[str, Any], source: dict[str, Any]) -> str:
    mode = source.get("faith_mode", "source")
    if mode != "source":
        return str(mode)
    if root.get("faith"):
        return str(root["faith"])
    if root.get("religion"):
        return str(root["religion"])
    return "unspecified"


def normalize_member(
    member: dict[str, Any],
    root: dict[str, Any],
    source: dict[str, Any],
    psychology: dict[str, Any],
    registry_config: dict[str, Any],
) -> dict[str, Any]:
    citizen_id = str(member.get("id") or member.get("runtime_id") or member.get("name"))
    aliases = source.get("psychology_aliases", {})
    psychology_key = str(aliases.get(citizen_id, citizen_id))
    personality = profile_for(psychology_key, psychology)
    group_field = source.get("group_field")
    group = member.get(group_field) if group_field else None
    if not group:
        group = source.get("default_group") or root.get("guild_id") or root.get("society_id") or "GENERAL"
    runtime_id = member.get("runtime_id")
    display_name = member.get("display_name") or member.get("name") or citizen_id
    role = member.get("role") or member.get("title") or member.get("agent_name") or "resident"
    return {
        "citizen_id": citizen_id,
        "display_name": str(display_name),
        "source_id": source["id"],
        "source_path": source["path"],
        "population_class": source["population_class"],
        "group": str(group),
        "role": str(role),
        "faith_mode": _source_faith(root, source),
        "runtime_id": runtime_id,
        "economy_account_key": citizen_id,
        "personality": personality,
        "social_profile": social_profile(personality),
        "standing": standing_template(registry_config),
        "source_metadata": {
            key: value
            for key, value in member.items()
            if key not in {"id", "name", "display_name", "runtime_id", "role", "title"}
        },
    }


def _edge_key(a: str, b: str, relation: str) -> str:
    left, right = sorted([a, b])
    return f"{left}|{right}|{relation}"


def relationship_score(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    pa, pb = a["personality"], b["personality"]
    alliance = _clamp(
        (pa.get("cooperation", 50) + pb.get("cooperation", 50)) * 0.25
        + (pa.get("truth_loyalty", 50) + pb.get("truth_loyalty", 50)) * 0.15
        + (200 - abs(pa.get("curiosity", 50) - pb.get("curiosity", 50))) * 0.10
        + (200 - abs(pa.get("benevolence", 50) - pb.get("benevolence", 50))) * 0.10
    )
    rivalry = _clamp(
        (pa.get("status_drive", 50) + pb.get("status_drive", 50)) * 0.20
        + (pa.get("dominance", 50) + pb.get("dominance", 50)) * 0.15
        + (pa.get("solo_glory", 50) + pb.get("solo_glory", 50)) * 0.15
    )
    witness_pressure = max(int(pa.get("truth_loyalty", 0)), int(pb.get("truth_loyalty", 0)))
    if rivalry >= 70 and alliance >= 55:
        relation = "RIVAL_COLLABORATOR"
    elif alliance >= 75:
        relation = "ALLY"
    elif witness_pressure >= 95:
        relation = "WITNESS_CHALLENGE"
    else:
        relation = "PEER"
    return {
        "relation_type": relation,
        "alliance_score": alliance,
        "rivalry_score": rivalry,
        "witness_pressure": witness_pressure,
    }


def build_relationship_seeds(citizens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(citizens) < 2:
        return []
    edges: dict[str, dict[str, Any]] = {}
    ordered = sorted(citizens, key=lambda c: c["citizen_id"])
    for citizen in ordered:
        candidates = []
        for other in ordered:
            if citizen["citizen_id"] == other["citizen_id"]:
                continue
            score = relationship_score(citizen, other)
            salt = hashlib.sha256(
                f"{citizen['citizen_id']}:{other['citizen_id']}".encode("utf-8")
            ).digest()[0]
            candidates.append((score["alliance_score"] + salt / 255.0, score, other))
        candidates.sort(key=lambda item: item[0], reverse=True)
        best = candidates[0]
        score, other = best[1], best[2]
        key = _edge_key(citizen["citizen_id"], other["citizen_id"], score["relation_type"])
        edges[key] = {
            "from_citizen_id": citizen["citizen_id"],
            "to_citizen_id": other["citizen_id"],
            **score,
            "status": "SEED_ONLY",
            "evidence_count": 0,
        }
    return list(edges.values())


def build_registry(
    registry_config: dict[str, Any],
    psychology: dict[str, Any],
    root_dir: str | Path = ".",
) -> dict[str, Any]:
    root_dir = Path(root_dir)
    citizens: list[dict[str, Any]] = []
    missing_sources: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    seen: set[str] = set()
    for source in registry_config.get("sources", []):
        path = root_dir / source["path"]
        if not path.exists():
            if source.get("required", False):
                raise FileNotFoundError(str(path))
            missing_sources.append({"id": source["id"], "path": source["path"]})
            source_counts[source["id"]] = 0
            continue
        source_root = load_json(path)
        members = source_root.get("members", [])
        source_counts[source["id"]] = len(members)
        for member in members:
            citizen = normalize_member(member, source_root, source, psychology, registry_config)
            if citizen["citizen_id"] in seen:
                raise ValueError(f"duplicate citizen_id: {citizen['citizen_id']}")
            seen.add(citizen["citizen_id"])
            citizens.append(citizen)
    return {
        "schema": "the-world-citizen-snapshot/v1",
        "population": len(citizens),
        "source_counts": source_counts,
        "missing_optional_sources": missing_sources,
        "citizens": sorted(citizens, key=lambda c: c["citizen_id"]),
        "relationship_seeds": build_relationship_seeds(citizens),
        "invariants": {
            "personality_never_grants_authority": True,
            "standing_requires_verified_events": True,
            "wealth_is_not_authority": True,
            "source_registries_keep_ownership": True,
        },
    }


def render_markdown(snapshot: dict[str, Any]) -> str:
    lines = [
        "# THE WORLD — Citizen Registry",
        "",
        f"**Population discovered:** {snapshot['population']}",
        "",
        "## Sources",
    ]
    for source_id, count in snapshot["source_counts"].items():
        lines.append(f"- **{source_id}**: {count}")
    if snapshot["missing_optional_sources"]:
        lines.extend(["", "## Waiting for merge / optional sources"])
        for item in snapshot["missing_optional_sources"]:
            lines.append(f"- {item['id']}: `{item['path']}`")
    lines.extend([
        "",
        "## Social model",
        "- Personality produces preference, rivalry and cooperation pressure; never authority.",
        "- Standing begins as a neutral prior with zero evidence and moves only on verified events.",
        "- Status can rise through verified wins, portfolio artifacts, recovery and credited cooperation.",
        "- Wealth, faith conformity or noise volume do not buy organizational authority.",
        "- Relationship seeds are hypotheses only until shared evidence creates real history.",
        "",
        f"**Relationship seeds:** {len(snapshot['relationship_seeds'])}",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="company-society/citizen_registry.json")
    parser.add_argument("--psychology", default="company-society/psychology.json")
    parser.add_argument("--root", default=".")
    parser.add_argument("--json", default="world-citizens.json")
    parser.add_argument("--report", default="world-citizens.md")
    args = parser.parse_args()
    snapshot = build_registry(load_json(args.config), load_json(args.psychology), args.root)
    Path(args.json).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render_markdown(snapshot), encoding="utf-8")
    print(json.dumps({"population": snapshot["population"], "relationship_seeds": len(snapshot["relationship_seeds"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
