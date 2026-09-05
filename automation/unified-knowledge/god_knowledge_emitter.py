"""
GOD Knowledge Emitter — enriched edition.

Reads the GOD/Singularity cycle report plus Senju labs manifests and ELO
champion state, then writes actionable entries to the shared knowledge
registry (knowledge/god-registry.json).

Usage:
    python3 god_knowledge_emitter.py <report.json> [--repo-root <path>]
"""

import json
import sys
import hashlib
import argparse
from datetime import datetime
from pathlib import Path

DEFAULT_REGISTRY_PATH = Path("knowledge/god-registry.json")


# ── Registry helpers ──────────────────────────────────────────────────────────

def load_registry(registry_path: Path):
    if registry_path.exists():
        try:
            return json.loads(registry_path.read_text())
        except Exception:
            pass
    return {
        "schema": "god-knowledge-registry/v1",
        "description": "THE WORLD GOD unified knowledge registry",
        "entries": [],
        "last_updated": None,
        "total_entries": 0,
    }


def save_registry(registry, registry_path: Path):
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")


def generate_id(category, fingerprint):
    content = f"{category}:{fingerprint}:{datetime.utcnow().date()}"
    return f"kn_{hashlib.md5(content.encode()).hexdigest()[:12]}"


# ── Senju state helpers ───────────────────────────────────────────────────────

def read_senju_labs(repo_root: Path):
    """Return list of (lab_name, archetype, coverage_gaps, surfaces)."""
    labs_dir = repo_root / "senju" / "labs"
    if not labs_dir.exists():
        return []
    labs = []
    for f in sorted(labs_dir.glob("auto-lab-*.json")):
        try:
            d = json.loads(f.read_text())
            if d.get("host") is not None:
                continue  # skip real hosts
            labs.append({
                "name": d.get("name", f.stem),
                "archetype": d.get("archetype", "unknown"),
                "coverage_gaps": d.get("coverage_gaps", []),
                "surfaces": d.get("surfaces", []),
            })
        except Exception:
            pass
    return labs


def read_champion_elo(repo_root: Path):
    """Return dict of vuln_class -> focus_score from Senju champion genome."""
    champion_path = repo_root / "senju" / "state" / "champion.json"
    if not champion_path.exists():
        return {}
    try:
        d = json.loads(champion_path.read_text())
        genome = d.get("red_champion", {}).get("genome", {})
        focus = genome.get("focus", {})
        return {k: float(v) for k, v in focus.items()}
    except Exception:
        return {}


def read_evolution_summary(repo_root: Path):
    """Return the last evolution summary dict (may be empty)."""
    path = repo_root / "senju" / "state" / "last-evolution-summary.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def derive_senju_intelligence(repo_root: Path):
    """
    Combine labs, ELO, and evolution data into an intelligence report dict.
    Returns rich metadata for inclusion in knowledge entries.
    """
    labs = read_senju_labs(repo_root)
    elo = read_champion_elo(repo_root)
    evo = read_evolution_summary(repo_root)

    # Collect all coverage gaps across labs, weighted by lab count
    gap_counts: dict = {}
    for lab in labs:
        for gap in lab.get("coverage_gaps", []):
            gap_counts[gap] = gap_counts.get(gap, 0) + 1

    # Merge ELO scores into gap ranking
    # Score = (gap_count * 2) + elo_focus — higher = more urgent
    ranked_gaps = sorted(
        gap_counts.keys(),
        key=lambda g: (gap_counts.get(g, 0) * 2 + elo.get(g, 0)),
        reverse=True,
    )

    # Top target: highest-ranked coverage gap that ELO also rates highly
    top_target = "none"
    for g in ranked_gaps:
        if elo.get(g, 0) > 0.4:
            top_target = g
            break
    if top_target == "none" and ranked_gaps:
        top_target = ranked_gaps[0]

    # Top 5 ELO vuln classes
    top_elo = sorted(elo.items(), key=lambda x: x[1], reverse=True)[:5]

    # Strategy label
    vuln_elo = evo.get("vuln_class_elo") or {}
    score = evo.get("selected", {}).get("score") if evo.get("selected") else None
    if score and score > 300:
        strategy = "high_score_exploit"
    elif top_target and top_target in ("xss", "sqli", "nosqli"):
        strategy = "injection_focus"
    elif top_target and top_target in ("priv_esc", "idor", "auth_bypass"):
        strategy = "access_control_focus"
    elif top_target and top_target in ("ssrf", "rce", "path_trav"):
        strategy = "remote_execution_focus"
    else:
        strategy = "coverage_expansion"

    # Labs to run next (those with the top target as a gap)
    priority_labs = [
        lab["name"] for lab in labs
        if top_target in lab.get("coverage_gaps", [])
    ][:3]

    return {
        "top_target": top_target,
        "strategy": strategy,
        "coverage_gaps_ranked": ranked_gaps[:8],
        "gap_lab_counts": gap_counts,
        "top_elo_classes": [{"vuln_class": k, "score": v} for k, v in top_elo],
        "priority_labs": priority_labs,
        "total_labs": len(labs),
        "lab_archetypes": list({lab["archetype"] for lab in labs}),
        "evolution_score": score,
    }


# ── Entry builders ────────────────────────────────────────────────────────────

def build_cycle_entry(report, intel, timestamp, repo_name="test"):
    schema = report.get("schema", "")
    base = report.get("base_layer", {})
    supreme = report.get("supreme_layer", {})
    reward_trend = base.get("reward_trend", "unknown")
    avg_reward = base.get("average_reward", 0.0)
    cycles = base.get("cycles_completed", 0)

    if "singularity" in schema:
        layers = report.get("total_layers", 46)
        agent_name = "THE_WORLD_GOD_SINGULARITY"
        category = "singularity_cycle"
    else:
        layers = report.get("layers_initialized", 30)
        agent_name = "THE_WORLD_GOD_SUPREME"
        category = "god_cycle"

    fingerprint = f"{category}_{datetime.utcnow().strftime('%Y%m%d_%H')}"

    title = (
        f"GOD {layers}-layer cycle: {intel['strategy']} "
        f"→ target={intel['top_target']} (reward {avg_reward:.2f})"
    )

    return {
        "knowledge_id": generate_id(category, fingerprint),
        "schema_version": "1.1",
        "source_repos": [repo_name],
        "category": category,
        "created_by_agent": agent_name,
        "created_at": timestamp,
        "content": {
            "title": title,
            "layers": layers,
            "cycles_completed": cycles,
            "reward_trend": reward_trend,
            "average_reward": avg_reward,
            "top_target": intel["top_target"],
            "strategy": intel["strategy"],
            "coverage_gaps": intel["coverage_gaps_ranked"],
            "priority_labs": intel["priority_labs"],
            "top_elo_classes": intel["top_elo_classes"],
            "total_senju_labs": intel["total_labs"],
        },
        "effectiveness": {
            "success_rate": 1.0 if report.get("closed_loop") else 0.5,
            "last_verified": timestamp,
        },
        "meta_learning": {
            "omniscience": supreme.get("omniscience"),
            "omnipotence": supreme.get("omnipotence"),
            "reward_trend": reward_trend,
            "average_reward": avg_reward,
            "top_target": intel["top_target"],
            "strategy": intel["strategy"],
            "evolution_score": intel["evolution_score"],
        },
        "cross_repo_applicable": {
            "source": repo_name,
            "target": "the-world2",
            "confidence": 0.92,
            "approved": True,
        },
        "tags": [
            f"{layers}-layers",
            "god-cycle",
            intel["strategy"],
            f"target:{intel['top_target']}",
            "senju-intel",
        ],
    }


def build_lab_directive_entry(intel, timestamp, repo_name="test"):
    """Emit a 'senju_directive' entry telling Senju what to do next."""
    fingerprint = f"directive_{datetime.utcnow().strftime('%Y%m%d_%H')}"
    return {
        "knowledge_id": generate_id("senju_directive", fingerprint),
        "schema_version": "1.1",
        "source_repos": [repo_name],
        "category": "senju_directive",
        "created_by_agent": "THE_WORLD_GOD_SUPREME",
        "created_at": timestamp,
        "content": {
            "title": f"GOD directive: prioritize {intel['top_target']} labs",
            "directive": "run_priority_labs",
            "top_target": intel["top_target"],
            "strategy": intel["strategy"],
            "priority_labs": intel["priority_labs"],
            "coverage_gaps": intel["coverage_gaps_ranked"],
            "top_elo_classes": intel["top_elo_classes"],
            "lab_archetypes": intel["lab_archetypes"],
            "reasoning": (
                f"ELO champion rates {intel['top_target']} highly; "
                f"{len([g for g in intel['coverage_gaps_ranked'] if g == intel['top_target']])} "
                f"labs have this gap. Strategy: {intel['strategy']}."
            ),
        },
        "effectiveness": {
            "success_rate": None,
            "last_verified": timestamp,
        },
        "meta_learning": {
            "top_target": intel["top_target"],
            "strategy": intel["strategy"],
            "reward_trend": None,
        },
        "cross_repo_applicable": {
            "source": repo_name,
            "target": "the-world2",
            "confidence": 0.95,
            "approved": True,
        },
        "tags": [
            "senju-directive",
            intel["strategy"],
            f"target:{intel['top_target']}",
            "actionable",
        ],
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def emit_from_god_report(report_path: str, repo_root: Path, registry_path: Path):
    report = json.loads(Path(report_path).read_text())
    registry = load_registry(registry_path)
    timestamp = report.get("timestamp", datetime.utcnow().isoformat())

    intel = derive_senju_intelligence(repo_root)
    print(f"🔍 Senju intel: top_target={intel['top_target']} strategy={intel['strategy']}")
    print(f"   coverage_gaps: {intel['coverage_gaps_ranked'][:5]}")
    print(f"   priority_labs: {intel['priority_labs']}")

    entries_to_add = [
        build_cycle_entry(report, intel, timestamp),
        build_lab_directive_entry(intel, timestamp),
    ]

    existing_ids = {e["knowledge_id"] for e in registry["entries"]}
    new_entries = [e for e in entries_to_add if e["knowledge_id"] not in existing_ids]

    registry["entries"].extend(new_entries)
    registry["last_updated"] = datetime.utcnow().isoformat()
    registry["total_entries"] = len(registry["entries"])

    save_registry(registry, registry_path)

    print(f"✅ GOD Knowledge Emitter: +{len(new_entries)} new entries")
    print(f"📊 Registry total: {registry['total_entries']} entries")
    for e in new_entries:
        print(f"  [{e['knowledge_id']}] {e['content']['title']}")
        ml = e.get("meta_learning", {})
        if ml.get("omniscience"):
            print(f"    omniscience={ml['omniscience']} | omnipotence={ml.get('omnipotence')}")
        if ml.get("top_target"):
            print(f"    top_target={ml['top_target']} | strategy={ml.get('strategy')}")
    if not new_entries:
        print("  (already up-to-date for this hour)")

    return new_entries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report", help="Path to GOD cycle report JSON")
    parser.add_argument("--repo-root", default=".", help="Repository root (for Senju labs/state)")
    parser.add_argument("--registry-path", default=None,
                        help="Path to god-registry.json (default: knowledge/god-registry.json)")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    registry_path = Path(args.registry_path) if args.registry_path else DEFAULT_REGISTRY_PATH
    emit_from_god_report(args.report, repo_root, registry_path)


if __name__ == "__main__":
    main()
