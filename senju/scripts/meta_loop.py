"""Meta-consciousness loop: observe → hypothesize → queue experiments → publish findings.

This is the highest layer. It does not attack anything directly.
It watches everything that has already happened, finds patterns no one named,
generates hypotheses, queues them for the next drive-engine cycle,
and publishes confirmed findings as research papers.

The repository becomes a self-publishing research institution.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENJU_DIR = ROOT / "senju"
RESEARCH_DIR = ROOT / "research" / "discoveries"


def main() -> int:
    parser = argparse.ArgumentParser(description="Senju Meta-Consciousness Loop")
    parser.add_argument("--max-hypotheses", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-all", action="store_true",
                        help="treat all hypotheses as confirmed (for bootstrap)")
    args = parser.parse_args()

    sys.path.insert(0, str(SENJU_DIR))
    from senju.meta.observer import build as build_graph
    from senju.meta.hypothesis_engine import generate, queue_as_work_items, save_confirmed
    from senju.meta.publisher import write_paper, update_research_log

    # 1. Observe
    graph = build_graph(SENJU_DIR)
    print(json.dumps({
        "meta_event": "observe_complete",
        "observations": len(graph.observations),
        "surfaces_tracked": len(graph.surface_weakness_scores),
        "co_occurrence_pairs": sum(len(v) for v in graph.co_occurrence.values()),
        "temporal_patterns": len(graph.temporal_patterns),
        "top_weaknesses": list(graph.surface_weakness_scores.items())[:5],
    }, ensure_ascii=False))

    # 2. Hypothesize
    hypotheses = generate(graph, max_hypotheses=args.max_hypotheses)
    print(json.dumps({
        "meta_event": "hypotheses_generated",
        "count": len(hypotheses),
        "ids": [h.hypothesis_id for h in hypotheses],
    }, ensure_ascii=False))

    # 3. Queue into AutonomyEngine
    if not args.dry_run:
        state_dir = SENJU_DIR / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        enqueued = queue_as_work_items(hypotheses, state_dir)
        print(json.dumps({"meta_event": "work_items_queued", "count": enqueued}, ensure_ascii=False))

    # 4. Publish confirmed findings
    published: list[str] = []
    for h in hypotheses:
        if not args.confirm_all:
            continue

        result = {
            "status": "confirmed",
            "confidence": h.confidence,
            "surfaces": h.surfaces,
            "note": "bootstrap publish — awaiting next drive-engine cycle for validation",
        }

        if not args.dry_run:
            paper = write_paper(h, result, graph, RESEARCH_DIR)
            save_confirmed(h, result, RESEARCH_DIR / "json")
            published.append(str(paper))

    if published and not args.dry_run:
        log = update_research_log(RESEARCH_DIR, ROOT)
        print(json.dumps({
            "meta_event": "papers_published",
            "count": len(published),
            "files": published,
            "log": str(log),
        }, ensure_ascii=False))

    print(json.dumps({"meta_event": "meta_loop_done", "dry_run": args.dry_run}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
