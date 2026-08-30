"""senju.lab_planner v2 — ELO-weighted coverage gap analysis + manifest generation.

v2 improvements:
- Skips vuln_classes that already have manifests in labs/
- Weights gaps by ELO loss rate, not just hit count
- Produces at most one manifest per archetype to prevent bloat
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from .targets.base import ARCHETYPES, VULN_CLASSES


COVERAGE_THRESHOLD = 3
LAB_ARCHETYPES = list(ARCHETYPES.keys())


def _existing_covered_classes(labs_dir: Path) -> set[str]:
    """Return vuln_classes already declared in existing lab manifests."""
    covered: set[str] = set()
    for f in labs_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            for surface in data.get("surfaces", []):
                vc = surface.get("vuln_class")
                if vc:
                    covered.add(vc)
        except Exception:
            pass
    return covered


def analyze_coverage(evolution_summary: dict[str, Any]) -> dict[str, int]:
    """Count battle-test hits per vuln_class from evolution history."""
    counts: dict[str, int] = {vc: 0 for vc in VULN_CLASSES}
    history = evolution_summary.get("vuln_class_hits", {})
    for vc, n in history.items():
        if vc in counts:
            counts[vc] = int(n)
    return counts


def _elo_loss_weight(evolution_summary: dict[str, Any], vc: str) -> float:
    """Return a weight boosting priority for vuln_classes where Senju loses often.

    Higher = more urgent gap. Defaults to 1.0 when no ELO data exists.
    """
    elo_data = evolution_summary.get("vuln_class_elo", {})
    if vc not in elo_data:
        return 1.0
    entry = elo_data[vc]
    wins = float(entry.get("wins", 0))
    losses = float(entry.get("losses", 1))
    total = wins + losses
    if total == 0:
        return 1.0
    loss_rate = losses / total
    return 1.0 + loss_rate * 2.0  # max boost 3x for 100% loss rate


def find_gaps(
    coverage: dict[str, int],
    evolution_summary: dict[str, Any] | None = None,
    existing_covered: set[str] | None = None,
) -> list[str]:
    """Return vuln_classes below threshold, sorted by urgency (ELO-weighted)."""
    summary = evolution_summary or {}
    skip = existing_covered or set()

    gaps: list[tuple[str, float]] = []
    for vc, count in coverage.items():
        if vc in skip:
            continue
        if count < COVERAGE_THRESHOLD:
            weight = _elo_loss_weight(summary, vc)
            # Lower count + higher loss rate = more urgent
            urgency = (COVERAGE_THRESHOLD - count) * weight
            gaps.append((vc, urgency))

    gaps.sort(key=lambda x: -x[1])  # highest urgency first
    return [vc for vc, _ in gaps]


def generate_manifest(
    name: str,
    archetype: str,
    gap_vulns: list[str],
    seed: int = 42,
) -> dict[str, Any]:
    """Generate a labnet manifest emphasizing under-covered vulnerability classes."""
    rng = random.Random(seed)
    surfaces = []

    for vc in gap_vulns[:6]:
        surfaces.append({
            "name": f"{name}:{vc.replace('_', '-')}",
            "vuln_class": vc,
            "difficulty": round(rng.uniform(0.3, 0.8), 2),
        })

    arch_weights = ARCHETYPES.get(archetype, {})
    for vc, _weight in sorted(arch_weights.items(), key=lambda x: -x[1])[:4]:
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


def plan(
    evolution_summary_path: str | Path,
    output_dir: str | Path,
    max_manifests: int = 3,
) -> list[Path]:
    """Analyze gaps (skipping existing manifests) and write new ones."""
    summary_path = Path(evolution_summary_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {}
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))

    existing_covered = _existing_covered_classes(out_dir)
    coverage = analyze_coverage(summary)
    gaps = find_gaps(coverage, summary, existing_covered)

    if not gaps:
        return []

    seed = int(summary.get("seed", 42))
    written: list[Path] = []
    chunk = max(2, len(gaps) // max_manifests)

    for i in range(max_manifests):
        archetype = LAB_ARCHETYPES[i % len(LAB_ARCHETYPES)]
        chunk_vulns = gaps[i * chunk : (i + 1) * chunk] or gaps[-chunk:]
        if not chunk_vulns:
            break
        name = f"auto-lab-{archetype.replace('_', '-')}-{i+1}"
        # Don't overwrite existing manifests with same name
        path = out_dir / f"{name}.json"
        if path.exists():
            # Rotate name to avoid collision
            name = f"{name}-v{seed % 100}"
            path = out_dir / f"{name}.json"
        manifest = generate_manifest(name, archetype, chunk_vulns, seed=seed + i)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(path)

    return written


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate lab manifests for Senju gap coverage")
    parser.add_argument("--summary", default="senju/state/last-evolution-summary.json")
    parser.add_argument("--out", default="senju/labs")
    parser.add_argument("--max", type=int, default=3)
    args = parser.parse_args()

    paths = plan(args.summary, args.out, args.max)
    for p in paths:
        print(f"Generated: {p}")
    if not paths:
        print("Coverage already sufficient — no new manifests needed.")
