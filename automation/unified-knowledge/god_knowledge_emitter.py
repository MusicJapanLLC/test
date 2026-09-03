"""
GOD Knowledge Emitter
Takes GOD/Singularity cycle report JSON, formats it as knowledge entries,
and appends to the file-based knowledge registry (knowledge/god-registry.json).

Usage:
    python3 god_knowledge_emitter.py <report.json>
"""

import json
import sys
import hashlib
from datetime import datetime
from pathlib import Path

REGISTRY_PATH = Path("knowledge/god-registry.json")


def load_registry():
    if REGISTRY_PATH.exists():
        try:
            return json.loads(REGISTRY_PATH.read_text())
        except Exception:
            pass
    return {
        "schema": "god-knowledge-registry/v1",
        "description": "THE WORLD GOD unified knowledge registry",
        "entries": [],
        "last_updated": None,
        "total_entries": 0,
    }


def save_registry(registry):
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False))


def generate_id(category, fingerprint):
    content = f"{category}:{fingerprint}:{datetime.utcnow().date()}"
    return f"kn_{hashlib.md5(content.encode()).hexdigest()[:12]}"


def emit_from_god_report(report_path):
    report = json.loads(Path(report_path).read_text())
    registry = load_registry()

    schema = report.get("schema", "")
    timestamp = report.get("timestamp", datetime.utcnow().isoformat())
    entries_to_add = []

    if "singularity" in schema:
        # Singularity cycle (46 layers)
        fingerprint = f"singularity_cycle_{datetime.utcnow().strftime('%Y%m%d_%H')}"
        coord = report.get("coordinator_layer", {})
        bridge = report.get("bridge_cycle", {})
        supreme = report.get("supreme_layer", {})
        singular = report.get("singularity_layer", {})

        entries_to_add.append({
            "knowledge_id": generate_id("cycle_result", fingerprint),
            "schema_version": "1.0",
            "source_repos": ["test"],
            "category": "cycle_result",
            "created_by_agent": "THE_WORLD_GOD_SINGULARITY",
            "created_at": timestamp,
            "content": {
                "title": "Singularity Evolution Cycle",
                "description": "46-layer Singularity system cycle completed",
                "total_layers": report.get("total_layers", 46),
                "singularity_achieved": report.get("singularity_achieved", True),
                "elapsed_ms": report.get("elapsed_ms", 0),
            },
            "effectiveness": {
                "success_rate": 1.0 if report.get("singularity_achieved") else 0.0,
                "last_verified": timestamp,
            },
            "meta_learning": {
                "coordinator_agents": coord.get("managed_agents", 0),
                "coordinator_status": coord.get("status"),
                "bridge_improvements": bridge.get("improvements_collected", 0),
                "bridge_status": bridge.get("status"),
                "omniscience": supreme.get("omniscience"),
                "omnipotence": supreme.get("omnipotence"),
                "singularity_status": singular.get("status"),
                "autonomy_level": singular.get("autonomy_level"),
            },
            "cross_repo_applicable": {
                "source": "test",
                "target": "the-world2",
                "confidence": 0.95,
                "approved": True,
            },
            "tags": ["singularity", "46-layers", "god-cycle", "omniscience"],
        })

    elif "supreme-run" in schema:
        # Supreme GOD cycle (30 layers)
        fingerprint = f"god_supreme_cycle_{datetime.utcnow().strftime('%Y%m%d_%H')}"
        base = report.get("base_layer", {})
        supreme = report.get("supreme_layer", {})

        entries_to_add.append({
            "knowledge_id": generate_id("cycle_result", fingerprint),
            "schema_version": "1.0",
            "source_repos": ["test"],
            "category": "cycle_result",
            "created_by_agent": "THE_WORLD_GOD_SUPREME",
            "created_at": timestamp,
            "content": {
                "title": "Supreme GOD Evolution Cycle (30 layers)",
                "layers_initialized": report.get("layers_initialized", 30),
                "cycles_completed": base.get("cycles_completed", 0),
                "tasks_processed": base.get("tasks_processed", 0),
                "reward_trend": base.get("reward_trend", "unknown"),
                "average_reward": base.get("average_reward", 0),
            },
            "effectiveness": {
                "success_rate": 1.0 if report.get("closed_loop") else 0.0,
                "last_verified": timestamp,
            },
            "meta_learning": {
                "reward_trend": base.get("reward_trend"),
                "average_reward": base.get("average_reward", 0),
                "omniscience": supreme.get("omniscience"),
                "omnipotence": supreme.get("omnipotence"),
            },
            "cross_repo_applicable": {
                "source": "test",
                "target": "the-world2",
                "confidence": 0.90,
                "approved": True,
            },
            "tags": ["supreme-god", "30-layers", "god-cycle"],
        })

    # Deduplicate
    existing_ids = {e["knowledge_id"] for e in registry["entries"]}
    new_entries = [e for e in entries_to_add if e["knowledge_id"] not in existing_ids]

    registry["entries"].extend(new_entries)
    registry["last_updated"] = datetime.utcnow().isoformat()
    registry["total_entries"] = len(registry["entries"])

    save_registry(registry)

    print(f"✅ GOD Knowledge Emitter: +{len(new_entries)} new entries")
    print(f"📊 Registry total: {registry['total_entries']} entries")
    for e in new_entries:
        print(f"  [{e['knowledge_id']}] {e['content']['title']}")
        if e["meta_learning"].get("omniscience"):
            print(f"    omniscience={e['meta_learning']['omniscience']} | omnipotence={e['meta_learning'].get('omnipotence')}")
    if not new_entries:
        print("  (already up-to-date for this hour)")

    return new_entries


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: god_knowledge_emitter.py <report.json>")
        sys.exit(1)
    emit_from_god_report(sys.argv[1])
