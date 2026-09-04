"""
Senju Knowledge Query
Reads THE WORLD GOD knowledge registry and outputs actionable context for Senju agents.
Prints a summary that appears in CI logs, making GOD knowledge visible to Senju.

Usage:
    python3 senju_knowledge_query.py [category] [--limit N]
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

REGISTRY_PATH = Path("knowledge/god-registry.json")
GOD_BRANCH = "claude/supreme-ai-development-06vi1t"


def query_knowledge(category=None, limit=10):
    print("═" * 70)
    print("  🧠 THE WORLD GOD - Knowledge Registry Query")
    print(f"  Branch source: {GOD_BRANCH}")
    print("═" * 70)

    if not REGISTRY_PATH.exists():
        print("\n⚠️  GOD knowledge registry not found.")
        print("   The registry is populated when THE WORLD GOD SINGULARITY workflow runs.")
        print("   Run the workflow manually via workflow_dispatch to seed knowledge.")
        print("\nKNOWLEDGE_AVAILABLE=false")
        print("═" * 70)
        return []

    try:
        registry = json.loads(REGISTRY_PATH.read_text())
    except Exception as e:
        print(f"\n❌ Failed to parse registry: {e}")
        print("KNOWLEDGE_AVAILABLE=false")
        return []

    entries = registry.get("entries", [])
    total = registry.get("total_entries", len(entries))
    last_updated = registry.get("last_updated", "never")

    print(f"\n📊 Registry: {total} total entries | last updated: {last_updated}")

    if category:
        entries = [e for e in entries if e.get("category") == category]
        print(f"   Filtered by category={category}: {len(entries)} matches")

    # Sort newest first
    entries.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    entries = entries[:limit]

    if not entries:
        print("\nℹ️  No applicable GOD knowledge for this query.")
        print("KNOWLEDGE_AVAILABLE=false")
        print("═" * 70)
        return []

    print(f"\n🌟 Applicable GOD Knowledge ({len(entries)} entries):\n")

    for e in entries:
        kid = e.get("knowledge_id", "?")
        agent = e.get("created_by_agent", "GOD")
        created = (e.get("created_at") or "")[:10]
        content = e.get("content", {})
        meta = e.get("meta_learning", {})
        eff = e.get("effectiveness", {})
        cross = e.get("cross_repo_applicable", {})
        tags = e.get("tags", [])

        print(f"  [{kid}] {agent}")
        print(f"  📅 {created} | Category: {e.get('category', '?')}")
        print(f"  📌 {content.get('title', 'N/A')}")

        if content.get("description"):
            print(f"     {content['description']}")

        # Key metrics
        metrics = []
        if meta.get("omniscience"):
            metrics.append(f"omniscience={meta['omniscience']}")
        if meta.get("omnipotence"):
            metrics.append(f"omnipotence={meta['omnipotence']}")
        if meta.get("coordinator_agents"):
            metrics.append(f"agents={meta['coordinator_agents']}")
        if meta.get("bridge_improvements"):
            metrics.append(f"improvements={meta['bridge_improvements']}")
        if meta.get("reward_trend"):
            metrics.append(f"reward_trend={meta['reward_trend']}")
        if meta.get("average_reward") is not None:
            metrics.append(f"avg_reward={meta['average_reward']:.3f}")

        if metrics:
            print(f"  📈 Metrics: {' | '.join(metrics)}")

        if eff.get("success_rate") is not None:
            print(f"  ✅ Success rate: {eff['success_rate']:.0%}")

        if cross.get("approved") and cross.get("target"):
            print(f"  🔗 Cross-repo applicable → {cross['target']} (confidence={cross.get('confidence', 0):.0%})")

        if tags:
            print(f"  🏷️  Tags: {', '.join(tags)}")

        print()

    print("KNOWLEDGE_AVAILABLE=true")
    print(f"KNOWLEDGE_ENTRIES={len(entries)}")

    # Export GOD directives to $GITHUB_ENV for downstream steps
    env_file = os.environ.get("GITHUB_ENV", "")
    if env_file and entries:
        top_target = "none"
        strategy = "coverage_expansion"
        coverage_gaps = ""
        for e in sorted(entries, key=lambda x: x.get("created_at", ""), reverse=True):
            c = e.get("content", {})
            if c.get("top_target") and c["top_target"] != "none":
                top_target = c["top_target"]
                strategy = c.get("strategy", strategy)
                gaps = c.get("coverage_gaps", [])
                coverage_gaps = ",".join(gaps[:5]) if gaps else ""
                break
        with open(env_file, "a") as f:
            f.write(f"GOD_TOP_TARGET={top_target}\n")
            f.write(f"GOD_STRATEGY={strategy}\n")
            f.write(f"GOD_COVERAGE_GAPS={coverage_gaps}\n")
            f.write(f"GOD_ENTRIES={len(entries)}\n")
        print(f"  → $GITHUB_ENV: GOD_TOP_TARGET={top_target} GOD_STRATEGY={strategy}")

    print("═" * 70)
    return entries


if __name__ == "__main__":
    category = None
    limit = 10

    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--limit" and i + 1 < len(args):
            limit = int(args[i + 1])
        elif not arg.startswith("--"):
            category = arg

    query_knowledge(category=category, limit=limit)
