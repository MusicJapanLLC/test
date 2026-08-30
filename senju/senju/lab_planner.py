"""senju.lab_planner — deterministic coverage-gap planning for local lab manifests.

The planner turns observed Senju coverage into structural lab declarations only.
It does not generate exploit code or grant network authority.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path
from typing import Any

from .targets.base import ARCHETYPES, VULN_CLASSES

COVERAGE_THRESHOLD = 3
MAX_MANIFESTS_LIMIT = 8
MAX_HIT_COUNT = 1_000_000
MANIFEST_SCHEMA = "senju-auto-lab/v2"
LAB_ARCHETYPES = tuple(sorted(ARCHETYPES.keys()))


def _bounded_hit_count(value: Any) -> int:
    """Convert persisted evidence to a safe bounded non-negative integer."""
    if isinstance(value, bool):
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(parsed, MAX_HIT_COUNT))


def analyze_coverage(evolution_summary: dict[str, Any]) -> dict[str, int]:
    """Count known vuln classes while ignoring malformed/unknown persisted keys."""
    counts: dict[str, int] = {vc: 0 for vc in VULN_CLASSES}
    history = evolution_summary.get("vuln_class_hits", {})
    if not isinstance(history, dict):
        return counts
    for vc, raw_count in history.items():
        if vc in counts:
            counts[vc] = _bounded_hit_count(raw_count)
    return counts


def find_gaps(coverage: dict[str, int]) -> list[str]:
    """Return under-covered classes in stable least-covered/name order."""
    gaps = [(vc, _bounded_hit_count(coverage.get(vc, 0))) for vc in VULN_CLASSES]
    gaps = [(vc, n) for vc, n in gaps if n < COVERAGE_THRESHOLD]
    gaps.sort(key=lambda item: (item[1], item[0]))
    return [vc for vc, _ in gaps]


def _stable_seed(archetype: str, gap_vulns: list[str]) -> int:
    material = json.dumps(
        {"schema": MANIFEST_SCHEMA, "archetype": archetype, "gaps": gap_vulns},
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return int(hashlib.sha256(material).hexdigest()[:8], 16)


def _fingerprint(payload: dict[str, Any]) -> str:
    material = json.dumps(
        payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def generate_manifest(
    name: str,
    archetype: str,
    gap_vulns: list[str],
    seed: int | None = None,
) -> dict[str, Any]:
    """Generate one deterministic structural lab manifest for a unique gap slice."""
    if archetype not in ARCHETYPES:
        raise ValueError(f"unknown archetype: {archetype}")

    unique_gaps = [vc for vc in dict.fromkeys(gap_vulns) if vc in VULN_CLASSES]
    if not unique_gaps:
        raise ValueError("gap_vulns must contain at least one known vulnerability class")

    actual_seed = _stable_seed(archetype, unique_gaps) if seed is None else int(seed)
    rng = random.Random(actual_seed)
    surfaces: list[dict[str, Any]] = []

    for vc in unique_gaps:
        surfaces.append(
            {
                "name": f"{name}:{vc.replace('_', '-')}",
                "vuln_class": vc,
                "difficulty": round(rng.uniform(0.3, 0.8), 2),
                "source": "coverage-gap",
            }
        )

    arch_weights = ARCHETYPES.get(archetype, {})
    for vc, _weight in sorted(arch_weights.items(), key=lambda item: (-item[1], item[0]))[:4]:
        if vc in VULN_CLASSES and vc not in unique_gaps:
            surfaces.append(
                {
                    "name": f"{name}:{vc.replace('_', '-')}-arch",
                    "vuln_class": vc,
                    "difficulty": round(rng.uniform(0.2, 0.7), 2),
                    "source": "archetype-breadth",
                }
            )

    base: dict[str, Any] = {
        "schema": MANIFEST_SCHEMA,
        "name": name,
        "archetype": archetype,
        "host": None,
        "description": f"Auto-generated lab for gap coverage: {', '.join(unique_gaps)}",
        "coverage_gaps": unique_gaps,
        "generator_seed": actual_seed,
        "surfaces": surfaces,
    }
    base["fingerprint"] = _fingerprint(base)
    return base


def _manifest_name(archetype: str, gap_vulns: list[str]) -> str:
    digest = hashlib.sha256(
        (archetype + "\0" + "\0".join(gap_vulns)).encode("utf-8")
    ).hexdigest()[:10]
    return f"auto-lab-{archetype.replace('_', '-')}-{digest}"


def _partition_gaps(gaps: list[str], max_manifests: int) -> list[list[str]]:
    if not gaps:
        return []
    manifest_count = min(max_manifests, len(gaps))
    chunk_size = max(1, math.ceil(len(gaps) / manifest_count))
    return [gaps[i : i + chunk_size] for i in range(0, len(gaps), chunk_size)]


def plan(
    evolution_summary_path: str | Path,
    output_dir: str | Path,
    max_manifests: int = 3,
) -> list[Path]:
    """Write only manifests whose deterministic content is new or changed."""
    if not 1 <= int(max_manifests) <= MAX_MANIFESTS_LIMIT:
        raise ValueError(f"max_manifests must be between 1 and {MAX_MANIFESTS_LIMIT}")
    if not LAB_ARCHETYPES:
        raise RuntimeError("no lab archetypes are configured")

    summary_path = Path(evolution_summary_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {}
    if summary_path.exists():
        loaded = json.loads(summary_path.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict):
            raise ValueError("evolution summary must be a JSON object")
        summary = loaded

    coverage = analyze_coverage(summary)
    gaps = find_gaps(coverage)
    if not gaps:
        return []

    written: list[Path] = []
    for i, chunk_vulns in enumerate(_partition_gaps(gaps, int(max_manifests))):
        archetype = LAB_ARCHETYPES[i % len(LAB_ARCHETYPES)]
        name = _manifest_name(archetype, chunk_vulns)
        manifest = generate_manifest(name, archetype, chunk_vulns)
        rendered = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        path = out_dir / f"{name}.json"

        if path.exists() and path.read_text(encoding="utf-8") == rendered:
            continue

        path.write_text(rendered, encoding="utf-8")
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
        print("Coverage already sufficient or manifests unchanged — no new manifests needed.")
