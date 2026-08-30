"""senju.lab_planner v3 — ELO-weighted, deterministic autonomous lab planning.

The planner turns validated Senju coverage evidence into structural local-lab
manifests. It skips already-covered classes, tolerates malformed historical state,
and emits content-addressed manifests so repeated runs do not create PR churn.
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
MANIFEST_SCHEMA = "senju-auto-lab/v3"
LAB_ARCHETYPES = tuple(sorted(ARCHETYPES.keys()))


def _bounded_hit_count(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(parsed, MAX_HIT_COUNT))


def _existing_covered_classes(labs_dir: Path) -> set[str]:
    """Return known vuln classes already represented by local lab manifests."""
    covered: set[str] = set()
    for path in sorted(labs_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeError):
            continue
        if not isinstance(payload, dict):
            continue
        surfaces = payload.get("surfaces", [])
        if not isinstance(surfaces, list):
            continue
        for surface in surfaces:
            if not isinstance(surface, dict):
                continue
            vc = surface.get("vuln_class")
            if vc in VULN_CLASSES:
                covered.add(vc)
    return covered


def analyze_coverage(evolution_summary: dict[str, Any]) -> dict[str, int]:
    """Count known battle-test hits while bounding malformed persisted values."""
    counts: dict[str, int] = {vc: 0 for vc in VULN_CLASSES}
    history = evolution_summary.get("vuln_class_hits", {})
    if not isinstance(history, dict):
        return counts
    for vc, raw_count in history.items():
        if vc in counts:
            counts[vc] = _bounded_hit_count(raw_count)
    return counts


def _elo_loss_weight(evolution_summary: dict[str, Any], vc: str) -> float:
    """Return a bounded 1x..3x urgency boost from observed loss rate."""
    elo_data = evolution_summary.get("vuln_class_elo", {})
    if not isinstance(elo_data, dict):
        return 1.0
    entry = elo_data.get(vc)
    if not isinstance(entry, dict):
        return 1.0
    try:
        wins = max(0.0, float(entry.get("wins", 0)))
        losses = max(0.0, float(entry.get("losses", 0)))
    except (TypeError, ValueError):
        return 1.0
    total = wins + losses
    if not math.isfinite(total) or total <= 0:
        return 1.0
    loss_rate = min(1.0, max(0.0, losses / total))
    return 1.0 + loss_rate * 2.0


def find_gaps(
    coverage: dict[str, int],
    evolution_summary: dict[str, Any] | None = None,
    existing_covered: set[str] | None = None,
) -> list[str]:
    """Return under-covered classes sorted by ELO-weighted urgency deterministically."""
    summary = evolution_summary or {}
    skip = existing_covered or set()
    gaps: list[tuple[str, float, int]] = []

    for vc in VULN_CLASSES:
        if vc in skip:
            continue
        count = _bounded_hit_count(coverage.get(vc, 0))
        if count >= COVERAGE_THRESHOLD:
            continue
        urgency = (COVERAGE_THRESHOLD - count) * _elo_loss_weight(summary, vc)
        gaps.append((vc, urgency, count))

    gaps.sort(key=lambda item: (-item[1], item[2], item[0]))
    return [vc for vc, _urgency, _count in gaps]


def _stable_seed(archetype: str, gap_vulns: list[str]) -> int:
    material = json.dumps(
        {"schema": MANIFEST_SCHEMA, "archetype": archetype, "gaps": gap_vulns},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return int(hashlib.sha256(material).hexdigest()[:8], 16)


def _fingerprint(payload: dict[str, Any]) -> str:
    material = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return hashlib.sha256(material).hexdigest()


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
    return [gaps[index : index + chunk_size] for index in range(0, len(gaps), chunk_size)]


def generate_manifest(
    name: str,
    archetype: str,
    gap_vulns: list[str],
    seed: int | None = None,
) -> dict[str, Any]:
    """Generate one deterministic structural manifest for a unique gap slice."""
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
                "source": "elo-coverage-gap",
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

    payload: dict[str, Any] = {
        "schema": MANIFEST_SCHEMA,
        "name": name,
        "archetype": archetype,
        "host": None,
        "description": f"Auto-generated local lab for: {', '.join(unique_gaps)}",
        "coverage_gaps": unique_gaps,
        "generator_seed": actual_seed,
        "surfaces": surfaces,
    }
    payload["fingerprint"] = _fingerprint(payload)
    return payload


def plan(
    evolution_summary_path: str | Path,
    output_dir: str | Path,
    max_manifests: int = 3,
) -> list[Path]:
    """Write only new/changed deterministic manifests for uncovered local-lab gaps."""
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

    existing_covered = _existing_covered_classes(out_dir)
    coverage = analyze_coverage(summary)
    gaps = find_gaps(coverage, summary, existing_covered)
    if not gaps:
        return []

    written: list[Path] = []
    for index, chunk_vulns in enumerate(_partition_gaps(gaps, int(max_manifests))):
        archetype = LAB_ARCHETYPES[index % len(LAB_ARCHETYPES)]
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

    parser = argparse.ArgumentParser(description="Generate deterministic Senju local-lab gap manifests")
    parser.add_argument("--summary", default="senju/state/last-evolution-summary.json")
    parser.add_argument("--out", default="senju/labs")
    parser.add_argument("--max", type=int, default=3)
    args = parser.parse_args()

    paths = plan(args.summary, args.out, args.max)
    for path in paths:
        print(f"Generated: {path}")
    if not paths:
        print("Coverage already represented or manifests unchanged — no new manifests needed.")
