"""Coverage-gap analysis and autonomous lab manifest generation.

Adapted from PR #252. It only creates structural declarations for synthetic or
owned-lab scenarios; it does not generate exploit payloads or choose external targets.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from .targets.base import ARCHETYPES, VULN_CLASSES

COVERAGE_THRESHOLD = 3
LAB_ARCHETYPES = list(ARCHETYPES.keys())


def analyze_coverage(evolution_summary: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {vc: 0 for vc in VULN_CLASSES}
    history = evolution_summary.get("vuln_class_hits", {})
    for vc, n in history.items():
        if vc in counts:
            counts[vc] = int(n)
    return counts


def find_gaps(coverage: dict[str, int]) -> list[str]:
    gaps = [(vc, n) for vc, n in coverage.items() if n < COVERAGE_THRESHOLD]
    gaps.sort(key=lambda item: item[1])
    return [vc for vc, _ in gaps]


def generate_manifest(name: str, archetype: str, gap_vulns: list[str], seed: int = 42) -> dict[str, Any]:
    rng = random.Random(seed)
    surfaces: list[dict[str, Any]] = []
    for vc in gap_vulns[:6]:
        surfaces.append({
            "name": f"{name}:{vc.replace('_', '-')}",
            "vuln_class": vc,
            "difficulty": round(rng.uniform(0.3, 0.8), 2),
        })
    arch_weights = ARCHETYPES.get(archetype, {})
    for vc, weight in sorted(arch_weights.items(), key=lambda item: -item[1])[:4]:
        if vc not in gap_vulns:
            surfaces.append({
                "name": f"{name}:{vc.replace('_', '-')}-arch",
                "vuln_class": vc,
                "difficulty": round(rng.uniform(0.2, 0.7), 2),
            })
    return {
        "name": name,
        "archetype": archetype,
        "host": None,
        "description": f"Auto-generated lab for gap coverage: {', '.join(gap_vulns[:3])}",
        "surfaces": surfaces,
    }


def plan(evolution_summary_path: str | Path, output_dir: str | Path, max_manifests: int = 3) -> list[Path]:
    summary_path = Path(evolution_summary_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    summary: dict[str, Any] = {}
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    gaps = find_gaps(analyze_coverage(summary))
    if not gaps:
        return []
    seed = int(summary.get("seed", 42))
    written: list[Path] = []
    chunk = max(2, len(gaps) // max_manifests)
    for i in range(max_manifests):
        archetype = LAB_ARCHETYPES[i % len(LAB_ARCHETYPES)]
        chunk_vulns = gaps[i * chunk : (i + 1) * chunk] or gaps[-chunk:]
        name = f"auto-lab-{archetype.replace('_', '-')}-{i + 1}"
        path = out_dir / f"{name}.json"
        path.write_text(
            json.dumps(generate_manifest(name, archetype, chunk_vulns, seed + i), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        written.append(path)
    return written


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", default="senju/state/last-evolution-summary.json")
    parser.add_argument("--out", default="senju/labs")
    parser.add_argument("--max", type=int, default=3)
    args = parser.parse_args()
    for path in plan(args.summary, args.out, args.max):
        print(f"Generated: {path}")
